import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  Info,
  Loader2,
  Pencil,
  Trash2,
  Trophy,
  Upload,
  X,
} from "lucide-react";
import { BrandBar } from "@/components/layout/BrandBar";
import { Button } from "@/components/ui/Button";
import { Card, SectionLabel } from "@/components/ui/Card";
import { Select } from "@/components/ui/Select";
import { api } from "@/lib/api";
import { fmtMoney, fmtPct, fmtShortDate, parseCentsInput } from "@/lib/money";
import type {
  Tournament,
  TournamentFilters,
  TournamentOverview,
} from "@/lib/types";
import { cn } from "@/lib/cn";

const GOLD = "#D2A54A";
const GREEN = "#2BA672";
const RED = "#D6535B";
const FMT_ALL = "__all__";

function readAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file, "utf-8");
  });
}

export function TournamentsPage() {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [lastImport, setLastImport] = useState<{ new: number; updated: number; duplicates: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [overview, setOverview] = useState<TournamentOverview | null>(null);
  const [formats, setFormats] = useState<string[]>([]);
  const [filters, setFilters] = useState<TournamentFilters>({});
  const [editingId, setEditingId] = useState<string | null>(null);

  async function refresh(f = filters) {
    const [list, ov, fmts] = await Promise.all([
      api.listTournaments(f),
      api.tournamentsOverview(f),
      api.listTournamentFormats(),
    ]);
    setTournaments(list);
    setOverview(ov);
    setFormats(fmts);
  }

  useEffect(() => {
    refresh().catch((e) =>
      setError(e instanceof Error ? e.message : "Falha ao carregar torneios."),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setLoading(true);
    setError(null);
    try {
      const texts = await Promise.all(Array.from(files).map(readAsText));
      const res = await api.importTournaments(texts.join("\n\n\n"));
      if ("error" in res && res.error) {
        setError(res.error);
      } else {
        setLastImport({ new: res.new, updated: res.updated, duplicates: res.duplicates });
        await refresh();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao ler os arquivos.");
    } finally {
      setLoading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function applyFilters(f: TournamentFilters) {
    setFilters(f);
    await refresh(f);
  }

  async function savePrize(t: Tournament, prizeCents: number | null, finishPos: number | null) {
    const res = await api.updateTournament(t.tournament_id, prizeCents, finishPos);
    if ("error" in res && res.error) {
      setError(res.error);
      return;
    }
    setEditingId(null);
    await refresh();
  }

  async function removeTournament(id: string) {
    if (!confirm("Apagar este torneio da planilha?")) return;
    await api.deleteTournament(id);
    await refresh();
  }

  const currency = tournaments[0]?.currency ?? "USD";

  return (
    <div className="min-h-full">
      <header className="sticky top-0 z-30 border-b border-border bg-bg/85 backdrop-blur-md">
        <BrandBar
          title="Torneios"
          actions={
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/tournament-types")}
              >
                <Trophy className="h-4 w-4" />
                <span className="hidden sm:inline">Estruturas</span>
              </Button>
              <Button variant="ghost" size="sm" onClick={() => navigate("/")}>
                <ArrowLeft className="h-4 w-4" />
                <span className="hidden sm:inline">Início</span>
              </Button>
            </div>
          }
        />
      </header>

      {/* Container — padding menor no mobile, max-width pra desktop */}
      <div className="mx-auto w-full max-w-5xl px-3 py-4 sm:px-6 sm:py-6">
        <Dropzone
          loading={loading}
          dragging={dragging}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            handleFiles(e.dataTransfer.files);
          }}
          onClick={() => inputRef.current?.click()}
          inputRef={inputRef}
          onChange={(e) => handleFiles(e.target.files)}
          lastImport={lastImport}
        />

        {error && (
          <Card className="mt-3 flex items-center gap-2 border-action-red/30 p-3 text-sm text-action-red">
            <X className="h-4 w-4 shrink-0" />
            {error}
          </Card>
        )}

        {overview && overview.n_tournaments > 0 ? (
          <>
            <HeroLucro overview={overview} currency={currency} />
            <StatsRow overview={overview} currency={currency} />
            <BankrollChart overview={overview} currency={currency} />
            <Filters
              filters={filters}
              formats={formats}
              onApply={applyFilters}
            />
            <TournamentsList
              tournaments={tournaments}
              editingId={editingId}
              onStartEdit={setEditingId}
              onCancelEdit={() => setEditingId(null)}
              onSave={savePrize}
              onDelete={removeTournament}
            />
          </>
        ) : (
          <Card className="mt-4 p-6 text-center text-sm text-ink-dim sm:p-8">
            Solte os arquivos do PokerStars (.txt) acima para começar.
          </Card>
        )}
      </div>
    </div>
  );
}

// ── Dropzone ──────────────────────────────────────────────────────────────────

function Dropzone({
  loading,
  dragging,
  onDragOver,
  onDragLeave,
  onDrop,
  onClick,
  inputRef,
  onChange,
  lastImport,
}: {
  loading: boolean;
  dragging: boolean;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
  onClick: () => void;
  inputRef: React.RefObject<HTMLInputElement>;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  lastImport: { new: number; updated: number; duplicates: number } | null;
}) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
      <button
        type="button"
        onClick={onClick}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        disabled={loading}
        className={cn(
          "flex flex-1 items-center gap-3 rounded-card border-2 border-dashed px-3 py-3 text-left transition-colors active:bg-surface-2 sm:px-4",
          dragging
            ? "border-gold/60 bg-gold/10"
            : "border-border bg-surface-1 hover:border-border-strong hover:bg-surface-2",
          loading && "cursor-wait opacity-60",
        )}
      >
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-border bg-surface-2 text-ink-dim">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-ink">
            {loading ? "Processando…" : "Importar do PokerStars"}
          </div>
          <div className="text-2xs text-ink-faint">
            Toque pra escolher ou arraste o .txt
          </div>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept=".txt,text/plain"
          multiple
          className="hidden"
          onChange={onChange}
        />
      </button>

      {lastImport && (
        <Card className="flex items-center gap-2 px-3 py-2 text-xs text-ink-dim sm:w-auto">
          <CheckCircle2 className="h-4 w-4 text-action-green" />
          <span className="nums">
            +{lastImport.new} novos · {lastImport.updated} atualizados
            {lastImport.duplicates > 0 && ` · ${lastImport.duplicates} já existiam`}
          </span>
        </Card>
      )}
    </div>
  );
}

// ── Hero (Lucro grande) ──────────────────────────────────────────────────────

function HeroLucro({
  overview,
  currency,
}: {
  overview: TournamentOverview;
  currency: string;
}) {
  const profit = overview.profit_cents;
  const tone = profit > 0 ? "text-action-green" : profit < 0 ? "text-action-red" : "text-ink";
  const border = profit > 0 ? "border-action-green/25" : profit < 0 ? "border-action-red/25" : "border-border";
  return (
    <Card className={cn("mt-3 p-4 sm:p-5", border)}>
      <SectionLabel>Saldo total</SectionLabel>
      <div className={cn("mt-1 text-3xl font-bold nums sm:text-4xl", tone)}>
        {fmtMoney(profit, currency, { signed: true })}
      </div>
      {overview.pending_prize > 0 && (
        <div className="mt-1 text-2xs text-ink-faint">
          {overview.pending_prize} {overview.pending_prize === 1 ? "torneio" : "torneios"} sem prêmio confirmado · usando custo como base
        </div>
      )}
    </Card>
  );
}

// ── Tiles secundários ─────────────────────────────────────────────────────────

function StatsRow({ overview, currency }: { overview: TournamentOverview; currency: string }) {
  return (
    <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
      <Tile label="Torneios" value={String(overview.n_tournaments)} />
      <Tile label="ROI" value={fmtPct(overview.roi_pct)} tone={overview.roi_pct != null && overview.roi_pct > 0 ? "green" : overview.roi_pct != null && overview.roi_pct < 0 ? "red" : "ink"} />
      <Tile label="ITM" value={fmtPct(overview.itm_pct, 0)} />
      <Tile label="Buy-in médio" value={fmtMoney(overview.avg_buyin_cents, currency)} />
    </div>
  );
}

function Tile({
  label,
  value,
  tone = "ink",
}: {
  label: string;
  value: string;
  tone?: "ink" | "green" | "red";
}) {
  const color = {
    ink: "text-ink",
    green: "text-action-green",
    red: "text-action-red",
  }[tone];
  return (
    <Card className="flex flex-col gap-0.5 p-2.5 sm:p-3">
      <span className={cn("text-base font-bold nums sm:text-lg", color)}>{value}</span>
      <span className="text-2xs uppercase tracking-[0.1em] text-ink-faint">{label}</span>
    </Card>
  );
}

// ── Bankroll cumulativo ───────────────────────────────────────────────────────

function BankrollChart({
  overview,
  currency,
}: {
  overview: TournamentOverview;
  currency: string;
}) {
  const data = useMemo(
    () =>
      overview.cumulative.map((p, i) => ({
        idx: i + 1,
        running: (p.running ?? 0) / 100,
        date: fmtShortDate(p.played_at),
      })),
    [overview.cumulative],
  );

  if (data.length < 2) {
    return (
      <Card className="mt-2 p-4 text-center text-xs text-ink-faint sm:text-sm">
        Importe pelo menos 2 torneios pra ver a curva.
      </Card>
    );
  }

  const last = data[data.length - 1].running;
  const tone = last > 0 ? GREEN : last < 0 ? RED : GOLD;

  return (
    <Card className="mt-2 p-3 sm:p-4">
      <div className="flex items-start justify-between gap-3">
        <SectionLabel>Banca acumulada</SectionLabel>
        <div className="text-xs nums" style={{ color: tone }}>
          {fmtMoney(Math.round(last * 100), currency, { signed: true })}
        </div>
      </div>
      <div className="mt-2 h-[170px] w-full sm:h-[200px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 6, right: 6, bottom: 0, left: -12 }}>
            <defs>
              <linearGradient id="bkFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={tone} stopOpacity={0.28} />
                <stop offset="100%" stopColor={tone} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#273241" vertical={false} />
            <XAxis
              dataKey="idx"
              tick={{ fill: "#5D6875", fontSize: 10 }}
              tickLine={false}
              axisLine={{ stroke: "#273241" }}
              minTickGap={20}
            />
            <YAxis
              tick={{ fill: "#5D6875", fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              width={48}
              tickFormatter={(v: number) =>
                fmtMoney(Math.round(v * 100), currency, { placeholder: "0" })
              }
            />
            <Tooltip
              content={<BkTooltip currency={currency} />}
              cursor={{ stroke: "#33414F", strokeWidth: 1 }}
            />
            <Area
              type="monotone"
              dataKey="running"
              stroke={tone}
              strokeWidth={2}
              fill="url(#bkFill)"
              dot={false}
              activeDot={{ r: 4, fill: tone, stroke: "#0B1016", strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

function BkTooltip({ active, payload, currency }: any) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-ctl border border-border bg-surface-2 px-3 py-2 text-xs shadow-pop">
      <div className="font-semibold text-ink nums">
        {fmtMoney(Math.round(p.running * 100), currency, { signed: true })}
      </div>
      <div className="mt-0.5 text-ink-faint nums">
        #{p.idx} · {p.date}
      </div>
    </div>
  );
}

// ── Filtros ──────────────────────────────────────────────────────────────────

function Filters({
  filters,
  formats,
  onApply,
}: {
  filters: TournamentFilters;
  formats: string[];
  onApply: (f: TournamentFilters) => void;
}) {
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState(filters.from_date ?? "");
  const [to, setTo] = useState(filters.to_date ?? "");
  const [fmt, setFmt] = useState(filters.format ?? FMT_ALL);
  const [min, setMin] = useState(
    filters.min_buyin != null ? String(filters.min_buyin / 100) : "",
  );
  const [max, setMax] = useState(
    filters.max_buyin != null ? String(filters.max_buyin / 100) : "",
  );

  function apply() {
    onApply({
      from_date: from || null,
      to_date: to || null,
      format: fmt && fmt !== FMT_ALL ? fmt : null,
      min_buyin: min ? parseCentsInput(min) : null,
      max_buyin: max ? parseCentsInput(max) : null,
    });
    setOpen(false);
  }

  function clear() {
    setFrom("");
    setTo("");
    setFmt(FMT_ALL);
    setMin("");
    setMax("");
    onApply({});
    setOpen(false);
  }

  const fmtOptions = [
    { value: FMT_ALL, label: "Todos os formatos" },
    ...formats.map((f) => ({ value: f, label: f })),
    { value: "Sem rótulo", label: "Sem rótulo" },
  ];

  const activeCount = [
    filters.from_date, filters.to_date, filters.format,
    filters.min_buyin, filters.max_buyin,
  ].filter((v) => v != null && v !== "").length;

  return (
    <Card className="mt-2 overflow-hidden">
      {/* Mobile: header clicável; sm+: sempre expandido (sem header) */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left sm:hidden"
        aria-expanded={open}
      >
        <span className="text-sm font-semibold text-ink">
          Filtros
          {activeCount > 0 && (
            <span className="ml-2 rounded-full bg-gold/15 px-2 py-0.5 text-2xs font-semibold text-gold">
              {activeCount}
            </span>
          )}
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-4 text-ink-faint transition-transform",
            open && "rotate-180",
          )}
        />
      </button>

      <div className={cn("sm:block", open ? "block" : "hidden")}>
        <div className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-6">
          <FilterField label="De" hint="aaaa/mm/dd">
            <input
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              placeholder="2026/01/01"
              inputMode="numeric"
              className="filter-input"
            />
          </FilterField>
          <FilterField label="Até">
            <input
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="2026/12/31"
              inputMode="numeric"
              className="filter-input"
            />
          </FilterField>
          <FilterField label="Tipo" colSpan="col-span-2 sm:col-span-1">
            <Select
              value={fmt}
              onValueChange={setFmt}
              options={fmtOptions}
              ariaLabel="Filtrar por formato"
              className="w-full"
            />
          </FilterField>
          <FilterField label="Buy-in min">
            <input
              value={min}
              onChange={(e) => setMin(e.target.value)}
              placeholder="0"
              inputMode="decimal"
              className="filter-input"
            />
          </FilterField>
          <FilterField label="Buy-in max">
            <input
              value={max}
              onChange={(e) => setMax(e.target.value)}
              placeholder="∞"
              inputMode="decimal"
              className="filter-input"
            />
          </FilterField>
          <div className="col-span-2 flex items-end gap-2 sm:col-span-1">
            <Button size="sm" variant="primary" onClick={apply} className="flex-1">
              Aplicar
            </Button>
            <Button size="sm" variant="ghost" onClick={clear}>
              Limpar
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}

function FilterField({
  label,
  hint,
  children,
  colSpan = "",
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
  colSpan?: string;
}) {
  return (
    <label className={cn("flex flex-col gap-1", colSpan)}>
      <span className="text-2xs uppercase tracking-[0.1em] text-ink-faint">
        {label}
        {hint && <span className="ml-1 text-ink-faint/70 normal-case tracking-normal">· {hint}</span>}
      </span>
      {children}
    </label>
  );
}

// ── Lista de torneios (mobile: cards / desktop: tabela) ───────────────────────

function TournamentsList({
  tournaments,
  editingId,
  onStartEdit,
  onCancelEdit,
  onSave,
  onDelete,
}: {
  tournaments: Tournament[];
  editingId: string | null;
  onStartEdit: (id: string) => void;
  onCancelEdit: () => void;
  onSave: (t: Tournament, prizeCents: number | null, finishPos: number | null) => void;
  onDelete: (id: string) => void;
}) {
  // Engine traz asc por data, mostra desc (mais recente primeiro)
  const rows = [...tournaments].reverse();

  return (
    <div className="mt-2">
      {/* MOBILE: cards empilhados */}
      <div className="flex flex-col gap-2 sm:hidden">
        {rows.map((t) => (
          <TournamentCard
            key={t.tournament_id}
            t={t}
            editing={editingId === t.tournament_id}
            onStartEdit={() => onStartEdit(t.tournament_id)}
            onCancelEdit={onCancelEdit}
            onSave={onSave}
            onDelete={() => onDelete(t.tournament_id)}
          />
        ))}
      </div>

      {/* DESKTOP: tabela tradicional */}
      <Card className="hidden overflow-x-auto p-0 sm:block">
        <table className="w-full text-sm">
          <thead className="border-b border-border text-2xs uppercase tracking-[0.1em] text-ink-faint">
            <tr>
              <Th>Data</Th>
              <Th>Tipo</Th>
              <Th right>Buy-in</Th>
              <Th right>Pos.</Th>
              <Th right>Prêmio</Th>
              <Th right>Lucro</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => (
              <TableRow
                key={t.tournament_id}
                t={t}
                editing={editingId === t.tournament_id}
                onStartEdit={() => onStartEdit(t.tournament_id)}
                onCancelEdit={onCancelEdit}
                onSave={onSave}
                onDelete={() => onDelete(t.tournament_id)}
              />
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

// ── Card mobile ──────────────────────────────────────────────────────────────

function TournamentCard({
  t,
  editing,
  onStartEdit,
  onCancelEdit,
  onSave,
  onDelete,
}: {
  t: Tournament;
  editing: boolean;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSave: (t: Tournament, prizeCents: number | null, finishPos: number | null) => void;
  onDelete: () => void;
}) {
  const cost = (t.buy_in_cents ?? 0) + (t.fee_cents ?? 0);
  const profit = t.profit_cents;
  const profitTone = profit == null ? "text-ink-faint" : profit > 0 ? "text-action-green" : profit < 0 ? "text-action-red" : "text-ink";
  const borderTone = profit == null ? "" : profit > 0 ? "border-action-green/20" : profit < 0 ? "border-action-red/20" : "";

  return (
    <Card className={cn("p-3", borderTone)}>
      {/* Linha 1: data + tipo + lucro */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-xs text-ink-dim nums">{fmtShortDate(t.played_at)}</div>
          <div className="mt-0.5 text-sm font-semibold text-ink">
            {t.format ?? "Sem rótulo"}
          </div>
          <div className="truncate text-2xs text-ink-faint" title={t.tournament_name ?? ""}>
            {t.tournament_name ?? "—"}
          </div>
        </div>
        <div className={cn("text-right text-base font-bold nums", profitTone)}>
          {profit != null ? fmtMoney(profit, t.currency, { signed: true }) : "—"}
        </div>
      </div>

      {/* Linha 2: Buy-in · Pos · Prêmio */}
      <div className="mt-2 grid grid-cols-3 gap-2 border-t border-border pt-2 text-xs">
        <Field label="Buy-in">
          <span className="nums text-ink">{fmtMoney(cost, t.currency)}</span>
        </Field>
        <Field label="Posição">
          <span className="text-ink">
            {t.finish_pos != null
              ? `${t.finish_pos}${t.n_entries ? `/${t.n_entries}` : ""}`
              : "—"}
          </span>
        </Field>
        <Field label="Prêmio">
          {t.prize_known ? (
            <span className="flex items-baseline gap-1">
              <span className="nums text-ink">{fmtMoney(t.prize_cents, t.currency)}</span>
              {t.prize_source === "auto" && (
                <span className="text-2xs text-ink-faint" title="Calculado pela estrutura de payout">
                  auto
                </span>
              )}
            </span>
          ) : (
            <button
              onClick={onStartEdit}
              className="inline-flex items-center gap-1 rounded-ctl border border-gold/30 bg-gold/10 px-2 py-0.5 text-2xs text-gold active:bg-gold/15"
            >
              <Info className="h-3 w-3" />
              informar
            </button>
          )}
        </Field>
      </div>

      {/* Form de edição expandido (mobile-friendly: inputs grandes, vertical) */}
      {editing && (
        <EditForm
          t={t}
          onSave={onSave}
          onCancel={onCancelEdit}
        />
      )}

      {/* Botões de ação no rodapé do card — só quando NÃO editando */}
      {!editing && (
        <div className="mt-2 flex justify-end gap-1">
          <button
            onClick={onStartEdit}
            className="rounded-ctl p-2 text-ink-faint active:bg-surface-2 active:text-ink"
            aria-label="Editar"
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            onClick={onDelete}
            className="rounded-ctl p-2 text-ink-faint active:bg-action-red/15 active:text-action-red"
            aria-label="Excluir"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      )}
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-2xs uppercase tracking-[0.08em] text-ink-faint">{label}</span>
      <span className="text-sm">{children}</span>
    </div>
  );
}

// Form de edição compartilhado entre mobile card e desktop table
function EditForm({
  t,
  onSave,
  onCancel,
}: {
  t: Tournament;
  onSave: (t: Tournament, prizeCents: number | null, finishPos: number | null) => void;
  onCancel: () => void;
}) {
  const [prize, setPrize] = useState(
    t.prize_cents != null ? String(t.prize_cents / 100) : "",
  );
  const [pos, setPos] = useState(t.finish_pos != null ? String(t.finish_pos) : "");

  return (
    <div className="mt-3 grid grid-cols-2 gap-2 border-t border-border pt-3">
      <label className="flex flex-col gap-1">
        <span className="text-2xs uppercase tracking-[0.1em] text-ink-faint">Posição final</span>
        <input
          value={pos}
          onChange={(e) => setPos(e.target.value)}
          inputMode="numeric"
          placeholder="—"
          className="filter-input"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-2xs uppercase tracking-[0.1em] text-ink-faint">Prêmio ({t.currency})</span>
        <input
          value={prize}
          onChange={(e) => setPrize(e.target.value)}
          inputMode="decimal"
          placeholder="0,00"
          autoFocus
          className="filter-input"
        />
      </label>
      <div className="col-span-2 mt-1 flex gap-2">
        <Button
          size="sm"
          variant="primary"
          className="flex-1"
          onClick={() =>
            onSave(
              t,
              parseCentsInput(prize),
              pos.trim() ? Number.parseInt(pos, 10) || null : null,
            )
          }
        >
          Salvar
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}

// ── Tabela desktop ───────────────────────────────────────────────────────────

function Th({
  children,
  right,
}: {
  children?: React.ReactNode;
  right?: boolean;
}) {
  return (
    <th
      className={cn(
        "px-3 py-2 font-semibold",
        right ? "text-right" : "text-left",
      )}
    >
      {children}
    </th>
  );
}

function TableRow({
  t,
  editing,
  onStartEdit,
  onCancelEdit,
  onSave,
  onDelete,
}: {
  t: Tournament;
  editing: boolean;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSave: (t: Tournament, prizeCents: number | null, finishPos: number | null) => void;
  onDelete: () => void;
}) {
  const cost = (t.buy_in_cents ?? 0) + (t.fee_cents ?? 0);
  const profit = t.profit_cents;
  const profitTone = profit == null ? "text-ink-faint" : profit > 0 ? "text-action-green" : profit < 0 ? "text-action-red" : "text-ink";

  if (editing) {
    return (
      <tr className="border-b border-border/60">
        <td colSpan={7} className="px-3 py-3">
          <div className="mb-2 text-xs text-ink-dim">
            {fmtShortDate(t.played_at)} · {t.tournament_name ?? "—"}
          </div>
          <EditForm t={t} onSave={onSave} onCancel={onCancelEdit} />
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-b border-border/60 last:border-b-0 hover:bg-surface-2/60">
      <td className="px-3 py-2 text-xs text-ink-dim nums">{fmtShortDate(t.played_at)}</td>
      <td className="px-3 py-2">
        <div className="text-xs text-ink">{t.format ?? "Sem rótulo"}</div>
        <div className="truncate text-2xs text-ink-faint" title={t.tournament_name ?? ""}>
          {t.tournament_name ?? "—"}
        </div>
      </td>
      <td className="px-3 py-2 text-right text-xs nums text-ink-dim">
        {fmtMoney(cost, t.currency)}
      </td>
      <td className="px-3 py-2 text-right text-xs text-ink nums">
        {t.finish_pos != null
          ? `${t.finish_pos}${t.n_entries ? `/${t.n_entries}` : ""}`
          : "—"}
      </td>
      <td className="px-3 py-2 text-right nums">
        {t.prize_known ? (
          <span className="inline-flex items-baseline gap-1">
            <span className="text-xs text-ink">{fmtMoney(t.prize_cents, t.currency)}</span>
            {t.prize_source === "auto" && (
              <span
                className="text-[10px] text-ink-faint"
                title="Calculado pela estrutura de payout"
              >
                auto
              </span>
            )}
          </span>
        ) : (
          <button
            onClick={onStartEdit}
            className="inline-flex items-center gap-1 rounded-ctl border border-gold/30 bg-gold/10 px-2 py-0.5 text-2xs text-gold hover:bg-gold/15"
          >
            <Info className="h-3 w-3" />
            informar
          </button>
        )}
      </td>
      <td className={cn("px-3 py-2 text-right text-xs nums font-semibold", profitTone)}>
        {profit != null ? fmtMoney(profit, t.currency, { signed: true }) : "—"}
      </td>
      <td className="px-3 py-2 text-right">
        <div className="flex justify-end gap-1">
          <button
            onClick={onStartEdit}
            className="rounded-ctl p-1 text-ink-faint hover:bg-surface-2 hover:text-ink"
            aria-label="Editar"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={onDelete}
            className="rounded-ctl p-1 text-ink-faint hover:bg-action-red/15 hover:text-action-red"
            aria-label="Excluir"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </td>
    </tr>
  );
}
