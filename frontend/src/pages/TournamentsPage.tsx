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
  AlertTriangle,
  ArrowLeft,
  ArrowUpDown,
  BarChart3,
  CalendarDays,
  CalendarClock,
  ChevronDown,
  Clock,
  Download,
  Filter,
  Info,
  MoreHorizontal,
  Pencil,
  Plus,
  RotateCcw,
  Upload,
  Trash2,
  Trophy,
  X,
} from "lucide-react";
import { BrandBar } from "@/components/layout/BrandBar";
import { Button } from "@/components/ui/Button";
import { Card, SectionLabel } from "@/components/ui/Card";
import { Drawer } from "@/components/ui/Drawer";
import { Select } from "@/components/ui/Select";
import {
  BIG_WIN_MULT,
  BigWinBadge,
  RoomTag,
  fmtDuration,
  isBigWin,
  medalFor,
} from "@/components/tournaments/badges";
import { NewTournamentModal } from "@/components/tournaments/NewTournamentModal";
import { TournamentImport } from "@/components/tournaments/TournamentImport";
import { PkeBadge } from "@/components/PkeBadge";
import { useApp } from "@/state/AppProvider";
import { leakLabel, tournamentStatus, STATUS_LABEL, STATUS_CLS } from "@/lib/pke";
import { api } from "@/lib/api";
import { fmtMoney, fmtPct, fmtShortDate, parseCentsInput } from "@/lib/money";
import type {
  ManualTournamentInput,
  Tournament,
  TournamentFilters,
  TournamentOverview,
  TournamentSession,
} from "@/lib/types";
import { cn } from "@/lib/cn";

const GOLD = "#D2A54A";
const GREEN = "#2BA672";
const RED = "#D6535B";
const FMT_ALL = "__all__";
const ROOM_ALL = "__all__";

type SortKey =
  | "data_desc" | "data_asc"
  | "lucro_desc" | "lucro_asc"
  | "nota_desc" | "nota_asc"
  | "graves_desc" | "graves_asc"
  | "buyin_desc" | "buyin_asc";

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "data_desc", label: "Data mais recente" },
  { value: "data_asc", label: "Data mais antiga" },
  { value: "lucro_desc", label: "Maior lucro" },
  { value: "lucro_asc", label: "Menor lucro" },
  { value: "nota_desc", label: "Melhor Nota PKE" },
  { value: "nota_asc", label: "Pior Nota PKE" },
  { value: "graves_desc", label: "Mais erros graves" },
  { value: "graves_asc", label: "Menos erros graves" },
  { value: "buyin_desc", label: "Maior buy-in" },
  { value: "buyin_asc", label: "Menor buy-in" },
];

const buyinOf = (t: Tournament) => (t.buy_in_cents ?? 0) + (t.fee_cents ?? 0);

function sortTournaments(tournaments: Tournament[], key: SortKey): Tournament[] {
  // engine entrega asc por data → índice maior = mais recente
  const arr = tournaments.map((t, i) => ({ t, i }));
  const cmps: Record<SortKey, (a: { t: Tournament; i: number }, b: { t: Tournament; i: number }) => number> = {
    data_desc: (a, b) => b.i - a.i,
    data_asc: (a, b) => a.i - b.i,
    lucro_desc: (a, b) => (b.t.profit_cents ?? -Infinity) - (a.t.profit_cents ?? -Infinity),
    lucro_asc: (a, b) => (a.t.profit_cents ?? Infinity) - (b.t.profit_cents ?? Infinity),
    nota_desc: (a, b) => (b.t.pke_score_avg ?? -Infinity) - (a.t.pke_score_avg ?? -Infinity),
    nota_asc: (a, b) => (a.t.pke_score_avg ?? Infinity) - (b.t.pke_score_avg ?? Infinity),
    graves_desc: (a, b) => (b.t.pke_grave_errors ?? 0) - (a.t.pke_grave_errors ?? 0) || b.i - a.i,
    graves_asc: (a, b) => (a.t.pke_grave_errors ?? 0) - (b.t.pke_grave_errors ?? 0) || b.i - a.i,
    buyin_desc: (a, b) => buyinOf(b.t) - buyinOf(a.t) || b.i - a.i,
    buyin_asc: (a, b) => buyinOf(a.t) - buyinOf(b.t) || b.i - a.i,
  };
  return [...arr].sort(cmps[key] ?? cmps.data_desc).map((x) => x.t);
}

// ── seção recolhível (estado persiste por id; mobile pode começar fechada) ──────
function useCollapsed(id: string, defaultMobileClosed = false): [boolean, () => void] {
  const [open, setOpen] = useState(() => {
    try {
      const saved = localStorage.getItem("tsec:" + id);
      if (saved != null) return saved === "1";
    } catch { /* ignore */ }
    const isMobile = typeof window !== "undefined" && window.matchMedia?.("(max-width: 640px)").matches;
    return isMobile ? !defaultMobileClosed : true;
  });
  const toggle = () => setOpen((v) => {
    try { localStorage.setItem("tsec:" + id, !v ? "1" : "0"); } catch { /* ignore */ }
    return !v;
  });
  return [open, toggle];
}

function Collapsible({ id, title, icon, defaultMobileClosed, right, children }: {
  id: string; title: string; icon?: React.ReactNode; defaultMobileClosed?: boolean;
  right?: React.ReactNode; children: React.ReactNode;
}) {
  const [open, toggle] = useCollapsed(id, defaultMobileClosed);
  return (
    <div className="mt-3">
      <button onClick={toggle} className="flex w-full items-center justify-between gap-2 px-1 py-1.5 text-left">
        <SectionLabel className="flex items-center gap-1.5">{icon}{title}</SectionLabel>
        <div className="flex items-center gap-2">
          {right}
          <ChevronDown className={cn("h-4 w-4 text-ink-faint transition-transform", open && "rotate-180")} />
        </div>
      </button>
      {open && <div className="mt-1">{children}</div>}
    </div>
  );
}

// ── menu de ações secundárias do card ("...") ────────────────────────────────────
function CardMenu({ items }: { items: { label: string; onClick: () => void; danger?: boolean; icon?: React.ReactNode }[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [open]);
  return (
    <div ref={ref} className="relative">
      <button
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        className="rounded-ctl p-2 text-ink-faint hover:bg-surface-2 hover:text-ink"
        aria-label="Mais ações"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-20 mt-1 min-w-[160px] overflow-hidden rounded-ctl border border-border bg-surface-2 py-1 shadow-pop">
          {items.map((it) => (
            <button
              key={it.label}
              onClick={(e) => { e.stopPropagation(); setOpen(false); it.onClick(); }}
              className={cn(
                "flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-surface-3",
                it.danger ? "text-action-red" : "text-ink-dim",
              )}
            >
              {it.icon}{it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function TournamentsPage() {
  const { openTournament } = useApp();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [overview, setOverview] = useState<TournamentOverview | null>(null);
  const [formats, setFormats] = useState<string[]>([]);
  const [rooms, setRooms] = useState<string[]>([]);
  const [sessions, setSessions] = useState<TournamentSession[]>([]);
  const [filters, setFilters] = useState<TournamentFilters>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [outdated, setOutdated] = useState(0);
  const importRef = useRef<HTMLDivElement>(null);

  async function refresh(f = filters) {
    const [list, ov, fmts, rms, sess] = await Promise.all([
      api.listTournaments(f),
      api.tournamentsOverview(f),
      api.listTournamentFormats(),
      api.listRooms(),
      api.tournamentsSessions(f),
    ]);
    setTournaments(list);
    setOverview(ov);
    setFormats(fmts);
    setRooms(rms);
    setSessions(sess);
  }

  useEffect(() => {
    refresh().catch((e) =>
      setError(e instanceof Error ? e.message : "Falha ao carregar torneios."),
    );
    api.getPkeStatus().then((s) => setOutdated(s.pke_outdated)).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  async function addManual(data: ManualTournamentInput) {
    const res = await api.addTournament(data);
    if (res && "error" in res && res.error) {
      setError(res.error);
      return;
    }
    setShowNew(false);
    setError(null);
    await refresh();
  }

  function exportCsv() {
    if (tournaments.length === 0) return;
    const header = [
      "data", "sala", "tipo", "torneio", "buy_in", "fee",
      "moeda", "posicao", "participantes", "premio", "lucro", "origem",
    ];
    const esc = (v: unknown) => {
      const s = v == null ? "" : String(v);
      return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const c = (cents: number | null | undefined) =>
      cents == null ? "" : (cents / 100).toFixed(2);
    const rows = [...tournaments].reverse().map((t) => [
      t.played_at ?? "", t.room ?? "", t.format ?? "", t.tournament_name ?? "",
      c(t.buy_in_cents), c(t.fee_cents), t.currency, t.finish_pos ?? "",
      t.n_entries ?? "", c(t.prize_cents), c(t.profit_cents), t.origin ?? "",
    ]);
    const csv = [header, ...rows].map((r) => r.map(esc).join(";")).join("\r\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "torneios.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  const currency = tournaments[0]?.currency ?? "USD";
  const activeFilterCount = countFilters(filters);

  const pkeKpis = useMemo(() => {
    let soma = 0, maos = 0, graves = 0, analisados = 0;
    for (const t of tournaments) {
      if (!t.pke_analyzed) continue;
      analisados++;
      const ch = t.pke_critical_hands ?? 0;
      if (t.pke_score_avg != null && ch) { soma += t.pke_score_avg * ch; maos += ch; }
      graves += t.pke_grave_errors ?? 0;
    }
    return { media: maos ? Math.round((soma / maos) * 10) / 10 : null, graves, analisados };
  }, [tournaments]);

  async function analyzeOne(tid: string) {
    await api.analyzeTournament(tid);
    await refresh();
  }

  function goImport() {
    importRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className="min-h-full">
      <header className="sticky top-0 z-30 border-b border-border bg-bg/85 backdrop-blur-md">
        <BrandBar
          title="Meus Torneios"
          actions={
            <HeaderActions
              canExport={tournaments.length > 0}
              activeFilterCount={activeFilterCount}
              onImport={goImport}
              onFilters={() => setFiltersOpen(true)}
              onNew={() => setShowNew(true)}
              onExport={exportCsv}
            />
          }
        />
      </header>

      {/* Container — padding menor no mobile, max-width pra desktop */}
      <div className="mx-auto w-full max-w-5xl px-3 py-4 sm:px-6 sm:py-6">
        <div ref={importRef} className="scroll-mt-20">
          <TournamentImport onImported={() => refresh()} />
        </div>

        {outdated > 0 && (
          <Card className="mt-3 flex items-center justify-between gap-3 border-gold/30 bg-gold/5 p-3">
            <span className="text-xs text-ink-dim">
              Existem {outdated} torneio(s) analisados com versão antiga do PKE. Reprocessar agora.
            </span>
            <Button variant="ghost" size="sm" onClick={() => navigate("/settings")}>
              Reprocessar análises
            </Button>
          </Card>
        )}

        {error && (
          <Card className="mt-3 flex items-center gap-2 border-action-red/30 p-3 text-sm text-action-red">
            <X className="h-4 w-4 shrink-0" />
            {error}
          </Card>
        )}

        {overview && overview.n_tournaments > 0 ? (
          <>
            <StatsBar overview={overview} currency={currency} pke={pkeKpis} />
            <Collapsible id="graficos" title="Gráficos e análises" icon={<BarChart3 className="h-3.5 w-3.5" />} defaultMobileClosed>
              <BankrollChart overview={overview} currency={currency} tournaments={tournaments} />
              <PositionDistribution overview={overview} />
              <EvolutionBlock sessions={sessions} />
            </Collapsible>
            <Collapsible id="sessoes" title="Sessões por dia" icon={<CalendarDays className="h-3.5 w-3.5" />} defaultMobileClosed
              right={<span className="text-2xs text-ink-faint">{sessions.length} {sessions.length === 1 ? "dia" : "dias"}</span>}>
              <SessionsCard
                sessions={sessions}
                currency={currency}
                activeDay={filters.from_date && filters.from_date === filters.to_date ? filters.from_date : null}
                onPickDay={(day) =>
                  applyFilters(
                    filters.from_date === day && filters.to_date === day
                      ? { ...filters, from_date: null, to_date: null }
                      : { ...filters, from_date: day, to_date: day },
                  )
                }
              />
            </Collapsible>
            <TournamentsList
              tournaments={tournaments}
              editingId={editingId}
              onStartEdit={setEditingId}
              onCancelEdit={() => setEditingId(null)}
              onSave={savePrize}
              onDelete={removeTournament}
              onOpen={openTournament}
              onAnalyze={analyzeOne}
            />
          </>
        ) : (
          <Card className="mt-4 p-6 text-center text-sm text-ink-dim sm:p-8">
            Solte os arquivos do PokerStars (.txt) acima para começar — ou use{" "}
            <button
              onClick={() => setShowNew(true)}
              className="font-semibold text-gold underline-offset-2 hover:underline"
            >
              Novo torneio
            </button>{" "}
            pra cadastrar manualmente.
          </Card>
        )}
      </div>

      {showNew && (
        <NewTournamentModal
          rooms={rooms}
          formats={formats}
          defaultCurrency={currency}
          onCancel={() => setShowNew(false)}
          onSave={addManual}
        />
      )}
      <Drawer open={filtersOpen} onOpenChange={setFiltersOpen} title="Filtros">
        <Filters
          filters={filters}
          formats={formats}
          rooms={rooms}
          onApply={(f) => {
            applyFilters(f);
            setFiltersOpen(false);
          }}
        />
      </Drawer>
    </div>
  );
}

// â"€â"€ Hero (Lucro grande) â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

function HeaderActions({
  canExport,
  activeFilterCount,
  onImport,
  onFilters,
  onNew,
  onExport,
}: {
  canExport: boolean;
  activeFilterCount: number;
  onImport: () => void;
  onFilters: () => void;
  onNew: () => void;
  onExport: () => void;
}) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    }
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, []);

  const item = "flex w-full items-center gap-2 rounded-ctl px-3 py-2 text-left text-sm text-ink-dim hover:bg-surface-2 hover:text-ink";
  return (
    <div className="relative flex items-center gap-1" ref={boxRef}>
      <Button variant="primary" size="sm" onClick={onImport} aria-label="Importar mãos">
        <Upload className="h-4 w-4" />
        <span className="hidden sm:inline">Importar mãos</span>
      </Button>
      <Button variant="ghost" size="sm" onClick={onFilters} aria-label="Filtros">
        <Filter className="h-4 w-4" />
        <span className="hidden sm:inline">Filtros</span>
        {activeFilterCount > 0 && (
          <span className="ml-0.5 rounded-full bg-gold/15 px-1.5 py-0.5 text-[10px] font-bold text-gold">
            {activeFilterCount}
          </span>
        )}
      </Button>
      <button
        type="button"
        onClick={onNew}
        className="grid h-8 w-8 place-items-center rounded-ctl text-ink-dim hover:bg-surface-2 hover:text-ink sm:hidden"
        aria-label="Novo torneio"
      >
        <Plus className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="grid h-8 w-8 place-items-center rounded-ctl text-ink-dim hover:bg-surface-2 hover:text-ink"
        aria-label="Mais ações"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
      {open && (
        <div className="absolute right-0 top-10 z-50 w-48 rounded-card border border-border bg-surface-1 p-1 shadow-pop">
          <button className={cn(item, "hidden sm:flex")} onClick={() => { setOpen(false); onNew(); }}>
            <Plus className="h-4 w-4" /> Novo torneio
          </button>
          {canExport && (
            <button className={item} onClick={() => { setOpen(false); onExport(); }}>
              <Download className="h-4 w-4" /> CSV
            </button>
          )}
          <button className={item} onClick={() => { setOpen(false); navigate("/sessions"); }}>
            <CalendarClock className="h-4 w-4" /> Sessões
          </button>
          <button className={item} onClick={() => { setOpen(false); navigate("/tournament-types"); }}>
            <Trophy className="h-4 w-4" /> Estruturas
          </button>
          <button className={cn(item, "text-action-red hover:text-action-red")} onClick={() => { setOpen(false); navigate("/erros-criticos"); }}>
            <AlertTriangle className="h-4 w-4" /> Erros críticos
          </button>
          <button className={item} onClick={() => { setOpen(false); navigate("/"); }}>
            <ArrowLeft className="h-4 w-4" /> Início
          </button>
        </div>
      )}
    </div>
  );
}

function countFilters(filters: TournamentFilters): number {
  return [
    filters.from_date, filters.to_date, filters.format, filters.room,
    filters.min_buyin, filters.max_buyin,
  ].filter((v) => v != null && v !== "").length;
}
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

// â"€â"€ Tiles secundários â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

function StatsBar({ overview, currency, pke }: {
  overview: TournamentOverview;
  currency: string;
  pke: { media: number | null; graves: number; analisados: number };
}) {
  const profit = overview.profit_cents;
  const mediaTone = pke.media == null ? "ink" : pke.media >= 7 ? "green" : pke.media < 5 ? "red" : "ink";
  return (
    <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-6">
      <Tile
        label="Saldo"
        value={fmtMoney(profit, currency, { signed: true })}
        tone={profit > 0 ? "green" : profit < 0 ? "red" : "ink"}
      />
      <Tile label="Torneios" value={String(overview.n_tournaments)} />
      <Tile label="ROI" value={fmtPct(overview.roi_pct)} tone={overview.roi_pct != null && overview.roi_pct > 0 ? "green" : overview.roi_pct != null && overview.roi_pct < 0 ? "red" : "ink"} />
      <Tile label="ITM" value={fmtPct(overview.itm_pct, 0)} />
      <Tile label="Nota média PKE" value={pke.media != null ? pke.media.toFixed(1) : "—"} tone={mediaTone} />
      <Tile label="Erros graves" value={String(pke.graves)} tone={pke.graves > 0 ? "red" : "ink"} />
      {overview.pending_prize > 0 && (
        <p className="col-span-2 text-2xs text-ink-faint sm:col-span-6">
          {overview.pending_prize} {overview.pending_prize === 1 ? "torneio" : "torneios"} sem prêmio confirmado · usando custo como base.
        </p>
      )}
    </div>
  );
}

// â"€â"€ Evolução técnica (abas por dia: nota / erros / leaks) â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
function EvolutionBlock({
  sessions,
}: {
  sessions: TournamentSession[];
}) {
  type Tab = "nota" | "graves" | "leaks";
  const [tab, setTab] = useState<Tab>("nota");
  const TABS: { key: Tab; label: string }[] = [
    { key: "nota", label: "Nota PKE" },
    { key: "graves", label: "Erros graves" },
    { key: "leaks", label: "Leaks" },
  ];
  const days = useMemo(
    () => [...sessions].filter((s) => s.day !== "Sem data" && (s.analisados ?? 0) > 0).reverse(),
    [sessions],
  );
  const insight = useMemo(() => pickInsight(days), [days]);

  return (
    <Card className="mt-2 p-3 sm:p-4">
      <div className="mb-3 flex items-center gap-2">
        <SectionLabel className="flex items-center gap-1.5">
          <BarChart3 className="h-3.5 w-3.5" /> Evolução
        </SectionLabel>
        {days.length > 0 && <PkeBadge variant="analisado" />}
      </div>
      <div className="mb-3 flex flex-wrap gap-1.5">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={cn("rounded-full border px-3 py-1 text-2xs font-semibold transition-colors",
              tab === t.key ? "border-gold/50 bg-gold/15 text-gold"
                : "border-border bg-surface-1 text-ink-dim hover:text-ink")}>
            {t.label}
          </button>
        ))}
      </div>
      {tab === "nota" && (
        days.length > 0 ? <DayBars days={days} value={(s) => s.media_notas ?? null} max={10}
          fmt={(v) => v.toFixed(1)} color={(v) => v >= 7 ? "#2BA672" : v < 5 ? "#D6535B" : "#D2A54A"} />
        : <p className="py-6 text-center text-xs text-ink-faint">Nenhum dia analisado pelo PKE ainda.</p>
      )}
      {tab === "graves" && (
        days.length > 0 ? <DayBars days={days} value={(s) => s.erros_graves ?? null}
          fmt={(v) => String(v)} color={() => "#D6535B"} />
        : <p className="py-6 text-center text-xs text-ink-faint">Nenhum dia analisado pelo PKE ainda.</p>
      )}
      {tab === "leaks" && (
        <div className="flex flex-col gap-1.5">
          {[...days].reverse().filter((s) => s.main_leak).map((s) => (
            <div key={s.day} className="flex items-center justify-between rounded-ctl border border-border/60 bg-surface-1 px-3 py-1.5 text-xs">
              <span className="text-ink-dim">{s.day}</span>
              <span className="font-semibold text-gold">{leakLabel(s.main_leak)}</span>
            </div>
          ))}
        </div>
      )}
      {insight && (
        <p className={cn("mt-3 rounded-ctl px-3 py-2 text-xs",
          insight.tone === "warn" ? "bg-action-red/10 text-action-red" : "bg-action-green/10 text-action-green")}>
          {insight.text}
        </p>
      )}
    </Card>
  );
}

function pickInsight(days: TournamentSession[]): { text: string; tone: "warn" | "good" } | null {
  for (let i = days.length - 1; i >= 0; i--) {
    const s = days[i];
    if (s.media_notas == null) continue;
    if (s.profit_cents > 0 && s.media_notas < 6)
      return { text: `${s.day}: você ganhou, mas a nota foi ${s.media_notas}. Cuidado com a variância — resultado bom não valida decisão.`, tone: "warn" };
    if (s.profit_cents < 0 && s.media_notas >= 7)
      return { text: `${s.day}: você perdeu, mas jogou bem (nota ${s.media_notas}). Decisões boas — siga o processo.`, tone: "good" };
  }
  return null;
}

function DayBars({ days, value, fmt, color, max }: {
  days: TournamentSession[];
  value: (s: TournamentSession) => number | null;
  fmt: (v: number) => string;
  color: (v: number) => string;
  max?: number;
}) {
  const pts = days.map((s) => ({ day: s.day, v: value(s) })).filter((p) => p.v != null) as { day: string; v: number }[];
  if (!pts.length) return <p className="py-6 text-center text-xs text-ink-faint">Sem dados ainda.</p>;
  const top = max ?? Math.max(1, ...pts.map((p) => p.v));
  return (
    <div className="flex items-end gap-1.5 overflow-x-auto pb-1">
      {pts.map((p) => (
        <div key={p.day} className="flex min-w-[36px] flex-1 flex-col items-center gap-1">
          <span className="text-2xs nums text-ink-dim">{fmt(p.v)}</span>
          <div className="flex w-full items-end" style={{ height: 70 }}>
            <div className="w-full rounded-t" style={{ height: `${Math.max(4, (p.v / top) * 70)}px`, background: color(p.v) }} />
          </div>
          <span className="text-2xs text-ink-faint">{p.day.slice(5)}</span>
        </div>
      ))}
    </div>
  );
}

// Badge de Nota PKE destacado — faixas: 8–10 verde, 6–7.9 amarelo, <6 vermelho
function notaBadgeCls(n: number | null | undefined): string {
  if (n == null) return "border-border bg-surface-2 text-ink-faint";
  if (n >= 8) return "border-action-green/40 bg-action-green/15 text-action-green";
  if (n >= 6) return "border-gold/40 bg-gold/15 text-gold";
  return "border-action-red/40 bg-action-red/15 text-action-red";
}

function NotaBadge({ n, size = "sm" }: { n: number | null | undefined; size?: "sm" | "lg" }) {
  return (
    <span
      title="Nota PKE"
      className={cn(
        "inline-flex items-center gap-1 rounded-ctl border font-bold nums",
        notaBadgeCls(n),
        size === "lg" ? "px-2.5 py-1 text-sm" : "px-2 py-0.5 text-xs",
      )}
    >
      <span className="text-[9px] font-semibold uppercase tracking-wide opacity-60">PKE</span>
      {n != null ? n.toFixed(1) : "—"}
    </span>
  );
}

const SEM_MAOS_TITLE =
  "Sem hand history importado. Importe o .txt do PokerStars para receber análise PKE.";

// hideOk: oculta o chip quando o status é "analisado" (evita o rótulo repetido)
function StatusChip({ t, hideOk }: { t: Tournament; hideOk?: boolean }) {
  const st = tournamentStatus(t);
  if (hideOk && st === "analisado") return null;
  return (
    <span
      title={st === "sem_maos" ? SEM_MAOS_TITLE : undefined}
      className={cn("cursor-default rounded-full px-2 py-0.5 text-2xs font-semibold", STATUS_CLS[st])}
    >
      {STATUS_LABEL[st]}
    </span>
  );
}

// Itens do menu "..." compartilhados por card (mobile) e linha (desktop)
function buildCardMenuItems(
  t: Tournament,
  actions: { onStartEdit: () => void; onDelete: () => void; onAnalyze: (tid: string) => Promise<void> },
) {
  const st = tournamentStatus(t);
  const items: { label: string; onClick: () => void; danger?: boolean; icon?: React.ReactNode }[] = [];
  if (st !== "sem_maos") {
    items.push({
      label: st === "nao_analisado" ? "Analisar" : "Reanalisar",
      icon: <RotateCcw className="h-3.5 w-3.5" />,
      onClick: () => { void actions.onAnalyze(t.tournament_id); },
    });
  }
  items.push({ label: "Editar", icon: <Pencil className="h-3.5 w-3.5" />, onClick: actions.onStartEdit });
  items.push({ label: "Excluir", icon: <Trash2 className="h-3.5 w-3.5" />, danger: true, onClick: actions.onDelete });
  return items;
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

// â"€â"€ Distribuição de posições â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

function PositionDistribution({ overview, compact }: { overview: TournamentOverview; compact?: boolean }) {
  const b = overview.position_buckets;
  const total = b.champion + b.podium + b.itm + b.out;
  if (total === 0) return null;

  const bars = [
    { key: "champion", label: "1 lugar", n: b.champion, color: GOLD },
    { key: "podium", label: "2-3 lugar", n: b.podium, color: "#7C8AA5" },
    { key: "itm", label: "ITM", n: b.itm, color: GREEN },
    { key: "out", label: "Fora", n: b.out, color: "#3A4757" },
  ];

  return (
    <Card className={cn("p-3 sm:p-4", !compact && "mt-2")}>
      <SectionLabel>Distribuição de posições</SectionLabel>
      <div className="mt-3 flex flex-col gap-2">
        {bars.map((bar) => {
          const pct = total ? (bar.n / total) * 100 : 0;
          return (
            <div key={bar.key} className="flex items-center gap-2">
              <div className="w-24 shrink-0 text-xs text-ink-dim truncate">
                {bar.label}
              </div>
              <div className="h-3 flex-1 overflow-hidden rounded-full bg-surface-2">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${pct}%`, backgroundColor: bar.color }}
                />
              </div>
              <div className="w-16 shrink-0 text-right text-xs nums text-ink">
                {bar.n}
                <span className="ml-1 text-2xs text-ink-faint">{pct.toFixed(0)}%</span>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

// â"€â"€ Bankroll cumulativo â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

function BankrollChart({
  overview,
  currency,
  tournaments,
  compact,
}: {
  overview: TournamentOverview;
  currency: string;
  tournaments: Tournament[];
  compact?: boolean;
}) {
  const bigWinIds = useMemo(() => {
    const s = new Set<string>();
    for (const t of tournaments) if (isBigWin(t)) s.add(t.tournament_id);
    return s;
  }, [tournaments]);

  const data = useMemo(
    () =>
      overview.cumulative.map((p, i) => ({
        idx: i + 1,
        running: (p.running ?? 0) / 100,
        date: fmtShortDate(p.played_at),
        bigWin: bigWinIds.has(p.tournament_id),
      })),
    [overview.cumulative, bigWinIds],
  );

  if (data.length < 2) {
    return (
      <Card className={cn("p-4 text-center text-xs text-ink-faint sm:text-sm", !compact && "mt-2")}>
        Importe pelo menos 2 torneios pra ver a curva.
      </Card>
    );
  }

  const last = data[data.length - 1].running;
  const tone = last > 0 ? GREEN : last < 0 ? RED : GOLD;

  return (
    <Card className={cn("p-3 sm:p-4", !compact && "mt-2")}>
      <div className="flex items-start justify-between gap-3">
        <SectionLabel>Banca acumulada</SectionLabel>
        <div className="text-xs nums" style={{ color: tone }}>
          {fmtMoney(Math.round(last * 100), currency, { signed: true })}
        </div>
      </div>
      <div className={cn("mt-3 h-[190px] w-full", compact ? "sm:h-[150px]" : "sm:h-[260px]")}>
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
              dot={<BigWinDot />}
              activeDot={{ r: 4, fill: tone, stroke: "#0B1016", strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

// Dot só nos pontos de Big Win (cravadas grandes) — destaca no gráfico.
function BigWinDot(props: any) {
  const { cx, cy, payload } = props;
  if (!payload?.bigWin || cx == null || cy == null) return null;
  return <circle cx={cx} cy={cy} r={5} fill={GOLD} stroke="#0B1016" strokeWidth={2} />;
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

// â"€â"€ Filtros â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

function fmtDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}/${m}/${day}`;
}

type PresetKey = "today" | "7d" | "30d" | "month" | "year" | "all";

const PRESETS: { key: PresetKey; label: string }[] = [
  { key: "today", label: "Hoje" },
  { key: "7d", label: "7 dias" },
  { key: "30d", label: "30 dias" },
  { key: "month", label: "Mês" },
  { key: "year", label: "Ano" },
  { key: "all", label: "Tudo" },
];

function presetRange(key: PresetKey): { from: string | null; to: string | null } {
  const now = new Date();
  const to = fmtDate(now);
  switch (key) {
    case "today":
      return { from: to, to };
    case "7d": {
      const d = new Date(now);
      d.setDate(d.getDate() - 6);
      return { from: fmtDate(d), to };
    }
    case "30d": {
      const d = new Date(now);
      d.setDate(d.getDate() - 29);
      return { from: fmtDate(d), to };
    }
    case "month":
      return { from: fmtDate(new Date(now.getFullYear(), now.getMonth(), 1)), to };
    case "year":
      return { from: fmtDate(new Date(now.getFullYear(), 0, 1)), to };
    case "all":
    default:
      return { from: null, to: null };
  }
}

function Filters({
  filters,
  formats,
  rooms,
  onApply,
}: {
  filters: TournamentFilters;
  formats: string[];
  rooms: string[];
  onApply: (f: TournamentFilters) => void;
}) {
  const [from, setFrom] = useState(filters.from_date ?? "");
  const [to, setTo] = useState(filters.to_date ?? "");
  const [fmt, setFmt] = useState(filters.format ?? FMT_ALL);
  const [room, setRoom] = useState(filters.room ?? ROOM_ALL);
  const [min, setMin] = useState(
    filters.min_buyin != null ? String(filters.min_buyin / 100) : "",
  );
  const [max, setMax] = useState(
    filters.max_buyin != null ? String(filters.max_buyin / 100) : "",
  );

  // Mantém os inputs sincronizados quando os filtros mudam por fora
  // (presets, clique em sessão, etc.).
  useEffect(() => {
    setFrom(filters.from_date ?? "");
    setTo(filters.to_date ?? "");
    setFmt(filters.format ?? FMT_ALL);
    setRoom(filters.room ?? ROOM_ALL);
    setMin(filters.min_buyin != null ? String(filters.min_buyin / 100) : "");
    setMax(filters.max_buyin != null ? String(filters.max_buyin / 100) : "");
  }, [filters]);

  function applyPreset(key: PresetKey) {
    const { from: f, to: t } = presetRange(key);
    onApply({ ...filters, from_date: f, to_date: t });
  }

  function apply() {
    onApply({
      from_date: from || null,
      to_date: to || null,
      format: fmt && fmt !== FMT_ALL ? fmt : null,
      room: room && room !== ROOM_ALL ? room : null,
      min_buyin: min ? parseCentsInput(min) : null,
      max_buyin: max ? parseCentsInput(max) : null,
    });
  }

  function clear() {
    setFrom("");
    setTo("");
    setFmt(FMT_ALL);
    setRoom(ROOM_ALL);
    setMin("");
    setMax("");
    onApply({});
  }

  const fmtOptions = [
    { value: FMT_ALL, label: "Todos os formatos" },
    ...formats.map((f) => ({ value: f, label: f })),
    { value: "Sem rótulo", label: "Sem rótulo" },
  ];

  const roomOptions = [
    { value: ROOM_ALL, label: "Todas as salas" },
    ...rooms.map((r) => ({ value: r, label: r })),
  ];

  return (
    <div className="flex flex-col gap-3">
        {/* Presets de período — atalhos rápidos */}
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map((p) => {
            const r = presetRange(p.key);
            const active =
              (filters.from_date ?? null) === r.from &&
              (filters.to_date ?? null) === r.to;
            return (
              <button
                key={p.key}
                type="button"
                onClick={() => applyPreset(p.key)}
                className={cn(
                  "rounded-full border px-3 py-1 text-2xs font-semibold transition-colors",
                  active
                    ? "border-gold/50 bg-gold/15 text-gold"
                    : "border-border bg-surface-2 text-ink-dim hover:border-border-strong hover:text-ink",
                )}
              >
                {p.label}
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-2 gap-2">
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
          <FilterField label="Tipo" colSpan="col-span-2">
            <Select
              value={fmt}
              onValueChange={setFmt}
              options={fmtOptions}
              ariaLabel="Filtrar por formato"
              className="w-full"
            />
          </FilterField>
          <FilterField label="Sala" colSpan="col-span-2">
            <Select
              value={room}
              onValueChange={setRoom}
              options={roomOptions}
              ariaLabel="Filtrar por sala"
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
              placeholder="âˆž"
              inputMode="decimal"
              className="filter-input"
            />
          </FilterField>
          <div className="col-span-2 flex flex-col gap-2 sm:flex-row sm:items-end">
            <Button size="sm" variant="primary" onClick={apply} className="w-full sm:w-auto">
              Aplicar
            </Button>
            <Button size="sm" variant="ghost" onClick={clear} className="w-full sm:w-auto">
              Limpar
            </Button>
          </div>
        </div>
    </div>
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

// â"€â"€ Lista de torneios (mobile: cards / desktop: tabela) â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

function TournamentsList({
  tournaments,
  editingId,
  onStartEdit,
  onCancelEdit,
  onSave,
  onDelete,
  onOpen,
  onAnalyze,
}: {
  tournaments: Tournament[];
  editingId: string | null;
  onStartEdit: (id: string) => void;
  onCancelEdit: () => void;
  onSave: (t: Tournament, prizeCents: number | null, finishPos: number | null) => void;
  onDelete: (id: string) => void;
  onOpen: (tid: string) => void;
  onAnalyze: (tid: string) => Promise<void>;
}) {
  const [sortKey, setSortKey] = useState<SortKey>("data_desc");
  const allRows = useMemo(() => sortTournaments(tournaments, sortKey), [tournaments, sortKey]);
  const hasSemMaos = tournaments.some((t) => tournamentStatus(t) === "sem_maos");

  // paginação (desktop: páginas; mobile: carregar mais). Reseta ao mudar filtros/ordem.
  const [perPage, setPerPage] = useState(25);
  const [page, setPage] = useState(1);
  const [mobileCount, setMobileCount] = useState(25);
  useEffect(() => { setPage(1); setMobileCount(perPage); }, [tournaments, perPage, sortKey]);

  const sortSelect = (
    <label className="flex items-center gap-1.5 text-2xs text-ink-faint">
      <ArrowUpDown className="h-3.5 w-3.5" />
      Ordenar por
      <select
        value={sortKey}
        onChange={(e) => setSortKey(e.target.value as SortKey)}
        className="rounded-ctl border border-border bg-surface-2 px-2 py-1 text-xs text-ink outline-none"
      >
        {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  );

  const total = allRows.length;
  const pageCount = Math.max(1, Math.ceil(total / perPage));
  const safePage = Math.min(page, pageCount);
  const start = (safePage - 1) * perPage;
  const pageRows = allRows.slice(start, start + perPage);
  const mobileRows = allRows.slice(0, mobileCount);

  return (
    <div className="mt-2">
      {hasSemMaos && (
        <p className="mb-2 text-2xs text-ink-faint">
          Torneios marcados como <span className="text-ink-dim">"Sem mãos"</span> não têm hand
          history — importe o .txt do PokerStars para receber análise PKE.
        </p>
      )}
      {/* MOBILE: ordenação + cards empilhados + carregar mais */}
      <div className="mb-2 flex justify-end sm:hidden">{sortSelect}</div>
      <div className="flex flex-col gap-2 sm:hidden">
        {mobileRows.map((t) => (
          <TournamentCard
            key={t.tournament_id}
            t={t}
            editing={editingId === t.tournament_id}
            onStartEdit={() => onStartEdit(t.tournament_id)}
            onCancelEdit={onCancelEdit}
            onSave={onSave}
            onDelete={() => onDelete(t.tournament_id)}
            onOpen={() => onOpen(t.tournament_id)}
            onAnalyze={onAnalyze}
          />
        ))}
        <div className="mt-1 flex flex-col items-center gap-2">
          <span className="text-2xs text-ink-faint">
            Mostrando {Math.min(mobileCount, total)} de {total} torneios
          </span>
          {mobileCount < total && (
            <Button variant="ghost" size="sm" onClick={() => setMobileCount((c) => c + perPage)}>
              Carregar mais
            </Button>
          )}
        </div>
      </div>

      {/* DESKTOP: tabela tradicional */}
      <Card className="hidden overflow-x-auto p-0 sm:block">
        <table className="w-full text-sm">
          <thead className="border-b border-border text-2xs uppercase tracking-[0.1em] text-ink-faint">
            <tr>
              <Th>Data</Th>
              <Th right>Buy-in</Th>
              <Th>Resultado</Th>
              <Th right>Nota PKE</Th>
              <Th right>Graves</Th>
              <Th>Status</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {pageRows.map((t) => (
              <TableRow
                key={t.tournament_id}
                t={t}
                editing={editingId === t.tournament_id}
                onStartEdit={() => onStartEdit(t.tournament_id)}
                onCancelEdit={onCancelEdit}
                onSave={onSave}
                onDelete={() => onDelete(t.tournament_id)}
                onOpen={() => onOpen(t.tournament_id)}
                onAnalyze={onAnalyze}
              />
            ))}
          </tbody>
        </table>
      </Card>

      {/* DESKTOP: paginação */}
      <div className="hidden items-center justify-between gap-3 px-1 pt-3 text-xs text-ink-dim sm:flex">
        <span>
          Mostrando {total === 0 ? 0 : start + 1}–{Math.min(start + perPage, total)} de {total} torneios
        </span>
        <div className="flex items-center gap-3">
          {sortSelect}
          <label className="flex items-center gap-1.5 text-2xs text-ink-faint">
            Por página
            <select
              value={perPage}
              onChange={(e) => setPerPage(Number(e.target.value))}
              className="rounded-ctl border border-border bg-surface-2 px-2 py-1 text-xs text-ink outline-none"
            >
              {[10, 25, 50].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" disabled={safePage <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
              ‹ Anterior
            </Button>
            <span className="px-1 nums">{safePage}/{pageCount}</span>
            <Button variant="ghost" size="sm" disabled={safePage >= pageCount} onClick={() => setPage((p) => Math.min(pageCount, p + 1))}>
              Próxima ›
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// â"€â"€ Card mobile â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

function TournamentCard({
  t,
  editing,
  onStartEdit,
  onCancelEdit,
  onSave,
  onDelete,
  onOpen,
  onAnalyze,
}: {
  t: Tournament;
  editing: boolean;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSave: (t: Tournament, prizeCents: number | null, finishPos: number | null) => void;
  onDelete: () => void;
  onOpen: () => void;
  onAnalyze: (tid: string) => Promise<void>;
}) {
  const cost = (t.buy_in_cents ?? 0) + (t.fee_cents ?? 0);
  const profit = t.profit_cents;
  const profitTone = profit == null ? "text-ink-faint" : profit > 0 ? "text-action-green" : profit < 0 ? "text-action-red" : "text-ink";
  const borderTone = profit == null ? "" : profit > 0 ? "border-action-green/20" : profit < 0 ? "border-action-red/20" : "";
  const medal = medalFor(t.finish_pos);
  const big = isBigWin(t);
  const leak = leakLabel(t.pke_main_leak);

  return (
    <Card className={cn("p-3", big ? "border-gold/40" : borderTone)}>
      {/* Linha 1: data + tipo + lucro (toque abre a review) */}
      <div className="flex cursor-pointer items-start justify-between gap-2" onClick={onOpen}>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-xs text-ink-dim nums">
            <span>{fmtShortDate(t.played_at)}</span>
            <RoomTag room={t.room} />
          </div>
          <div className="mt-0.5 flex items-center gap-1.5 text-sm font-semibold text-ink">
            {medal && <span aria-hidden>{medal}</span>}
            <span>{t.format ?? "Sem rótulo"}</span>
            {big && <BigWinBadge />}
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

      {/* Linha PKE: badge de nota destacado + graves + status relevante + leak */}
      <div className="mt-2 flex cursor-pointer flex-wrap items-center gap-2 text-2xs" onClick={onOpen}>
        <NotaBadge n={t.pke_score_avg} />
        {(t.pke_grave_errors ?? 0) > 0 && (
          <span className="font-semibold text-action-red">{t.pke_grave_errors} graves</span>
        )}
        <StatusChip t={t} hideOk />
        {leak && <span className="text-gold">{leak}</span>}
      </div>

      {/* Form de edição expandido (mobile-friendly: inputs grandes, vertical) */}
      {editing && (
        <EditForm
          t={t}
          onSave={onSave}
          onCancel={onCancelEdit}
        />
      )}

      {/* Rodapé: ação primária "Abrir review" + menu "..." com ações secundárias */}
      {!editing && (
        <div className="mt-2 flex items-center gap-1">
          <Button size="sm" variant="primary" className="mr-auto" onClick={onOpen}>
            Abrir review
          </Button>
          <CardMenu items={buildCardMenuItems(t, { onStartEdit, onDelete, onAnalyze })} />
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

// â"€â"€ Tabela desktop â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

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
  onOpen,
  onAnalyze,
}: {
  t: Tournament;
  editing: boolean;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSave: (t: Tournament, prizeCents: number | null, finishPos: number | null) => void;
  onDelete: () => void;
  onOpen: () => void;
  onAnalyze: (tid: string) => Promise<void>;
}) {
  const cost = (t.buy_in_cents ?? 0) + (t.fee_cents ?? 0);
  const profit = t.profit_cents;
  const profitTone = profit == null ? "text-ink-faint" : profit > 0 ? "text-action-green" : profit < 0 ? "text-action-red" : "text-ink";
  const medal = medalFor(t.finish_pos);
  const big = isBigWin(t);
  const leak = leakLabel(t.pke_main_leak);
  const stop = (e: React.MouseEvent) => e.stopPropagation();

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
    <tr className="cursor-pointer border-b border-border/60 last:border-b-0 hover:bg-surface-2/60" onClick={onOpen}>
      <td className="px-3 py-2 text-xs text-ink-dim nums">
        <div>{fmtShortDate(t.played_at)}</div>
        <div className="mt-0.5"><RoomTag room={t.room} /></div>
        <div className="mt-0.5 truncate text-2xs text-ink-faint" title={t.tournament_name ?? ""}>
          {t.tournament_name ?? "—"}
        </div>
      </td>
      <td className="px-3 py-2 text-right text-xs nums text-ink-dim">
        {fmtMoney(cost, t.currency)}
      </td>
      <td className="px-3 py-2">
        <div className="flex items-center gap-1.5 text-xs text-ink">
          {medal && <span aria-hidden>{medal}</span>}
          <span className={cn("font-semibold nums", profitTone)}>
            {profit != null ? fmtMoney(profit, t.currency, { signed: true }) : "—"}
          </span>
          {big && <BigWinBadge />}
        </div>
        <div className="mt-0.5 text-2xs text-ink-faint">
          {t.finish_pos != null
            ? `${t.finish_pos}${t.n_entries ? `/${t.n_entries}` : ""}`
            : "sem posição"}
          {" · "}
          {t.format ?? "Sem rótulo"}
        </div>
        {leak ? (
          <div className="mt-0.5 text-2xs text-gold">{leak}</div>
        ) : (
          null
        )}
      </td>
      <td className="px-3 py-2 text-right">
        <NotaBadge n={t.pke_score_avg} />
      </td>
      <td className="px-3 py-2 text-right text-xs nums text-action-red">
        {t.pke_grave_errors ? t.pke_grave_errors : "—"}
      </td>
      <td className="px-3 py-2"><StatusChip t={t} hideOk /></td>
      <td className="px-3 py-2" onClick={stop}>
        <div className="flex items-center justify-end gap-2">
          <Button size="sm" variant="ghost" onClick={onOpen}>Abrir review</Button>
          <CardMenu items={buildCardMenuItems(t, { onStartEdit, onDelete, onAnalyze })} />
        </div>
      </td>
    </tr>
  );
}

// â"€â"€ Sessões (por dia) â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

function hhmm(s: string | null): string {
  if (!s || s.length < 16) return "";
  return s.slice(11, 16);
}

function SessionMini({ label, value, tone = "ink" }: { label: string; value: string; tone?: "ink" | "green" | "red" }) {
  const color = { ink: "text-ink", green: "text-action-green", red: "text-action-red" }[tone];
  return (
    <div className="rounded-ctl bg-surface-2/50 px-2 py-1.5">
      <div className={cn("font-bold nums", color)}>{value}</div>
      <div className="text-[10px] uppercase tracking-[0.08em] text-ink-faint">{label}</div>
    </div>
  );
}

function SessionsCard({
  sessions,
  currency,
  activeDay,
  onPickDay,
}: {
  sessions: TournamentSession[];
  currency: string;
  activeDay: string | null;
  onPickDay: (day: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  if (sessions.length === 0) return null;
  const shown = open ? sessions : sessions.slice(0, 5);

  return (
    <Card className="overflow-hidden">
      <div className="grid gap-2 p-3 sm:grid-cols-2">
        {shown.map((s) => {
          const start = hhmm(s.start_at);
          const end = hhmm(s.end_at);
          const secs = s.play_seconds ?? s.grind_seconds ?? null;
          const dur = secs && secs > 0 ? fmtDuration(secs) : null;
          const interval = start ? `${start}${end && end !== start ? `–${end}` : ""}` : null;
          const ppH = s.profit_per_hour_cents;
          const tone =
            s.pending > 0 && s.cashed === 0
              ? "text-ink-faint"
              : s.profit_cents > 0
                ? "text-action-green"
                : s.profit_cents < 0
                  ? "text-action-red"
                  : "text-ink";
          return (
            <div
              key={s.day}
              className={cn(
                "rounded-card border border-border bg-surface-1 p-3 transition-colors",
                activeDay === s.day && "border-gold/40 bg-gold/10",
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-ink nums">{fmtShortDate(s.day)}</div>
                  <div className="mt-0.5 text-2xs text-ink-faint nums">
                    {s.n} {s.n === 1 ? "torneio" : "torneios"}
                    {dur && ` em ${dur}`}
                    {s.roi_pct != null && ` · ROI ${fmtPct(s.roi_pct, 0)}`}
                  </div>
                </div>
                <div className={cn("shrink-0 text-right text-sm font-bold nums", tone)}>
                  {fmtMoney(s.profit_cents, currency, { signed: true })}
                </div>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2 text-2xs">
                <SessionMini label="Nota PKE" value={s.media_notas != null ? s.media_notas.toFixed(1) : "—"} tone={s.media_notas != null && s.media_notas < 5 ? "red" : s.media_notas != null && s.media_notas >= 7 ? "green" : "ink"} />
                <SessionMini label="Erros graves" value={String(s.erros_graves ?? 0)} tone={(s.erros_graves ?? 0) > 0 ? "red" : "ink"} />
              </div>
              {dur ? (
                <div className="mt-2 grid grid-cols-3 gap-2 text-2xs">
                  <SessionMini label="Torneios/h" value={s.tph != null ? s.tph.toFixed(1) : "—"} />
                  <SessionMini label="Lucro/h" value={ppH != null ? fmtMoney(ppH, currency, { signed: true }) : "—"} tone={ppH == null ? "ink" : ppH > 0 ? "green" : ppH < 0 ? "red" : "ink"} />
                  <SessionMini label="Graves/h" value={s.graves_per_hour != null ? s.graves_per_hour.toFixed(1) : "—"} tone={(s.graves_per_hour ?? 0) > 0 ? "red" : "ink"} />
                </div>
              ) : null}
              <div className="mt-2 text-2xs text-ink-faint">
                {dur ? (
                  <span><Clock className="mr-1 inline h-2.5 w-2.5" />Grind {dur}{interval ? ` · ${interval}` : ""} · </span>
                ) : (
                  <span className="italic">Duração não disponível · </span>
                )}
                Leak principal: <span className="text-gold">{s.main_leak ? leakLabel(s.main_leak) : "—"}</span>
              </div>
              <div className="mt-3 flex gap-2">
                <Button size="sm" variant="ghost" className="flex-1" onClick={() => onPickDay(s.day)}>
                  Revisar sessão
                </Button>
                <Button size="sm" variant="primary" className="flex-1" onClick={() => navigate("/treinar?mode=leaks&from=leak")}>
                  Treinar leaks
                </Button>
              </div>
            </div>
          );
        })}
      </div>
      {sessions.length > 5 && (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="w-full border-t border-border px-3 py-2 text-2xs font-semibold text-ink-dim hover:text-ink"
        >
          {open ? "Mostrar menos" : `Ver todos os ${sessions.length} dias`}
        </button>
      )}
    </Card>
  );
}
