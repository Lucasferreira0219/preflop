import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
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
  Loader2,
} from "lucide-react";
import { BrandBar } from "@/components/layout/BrandBar";
import { Button } from "@/components/ui/Button";
import { Card, SectionLabel } from "@/components/ui/Card";
import { Drawer } from "@/components/ui/Drawer";
import { Select } from "@/components/ui/Select";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import {
  BigWinBadge,
  RoomTag,
  fmtDuration,
  isBigWin,
  medalFor,
} from "@/components/tournaments/badges";
import { NewTournamentModal } from "@/components/tournaments/NewTournamentModal";
import { TournamentImport } from "@/components/tournaments/TournamentImport";
import { AnalyticsCenter } from "@/components/tournaments/AnalyticsCenter";
import { useApp } from "@/state/AppProvider";
import { leakLabel, tournamentStatus, STATUS_LABEL, STATUS_CLS } from "@/lib/pke";
import { api } from "@/lib/api";
import { fmtMoney, fmtPct, fmtShortDate, parseCentsInput } from "@/lib/money";
import type {
  AnalyticsPayload,
  FinancialFilter,
  GravesFilter,
  ManualTournamentInput,
  NotaBand,
  StatusFilter,
  Tournament,
  TournamentFilters,
  TournamentOverview,
  TournamentSession,
} from "@/lib/types";
import { cn } from "@/lib/cn";

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

function Collapsible({ id, title, icon, defaultMobileClosed, right, children, open: openProp, onToggle }: {
  id: string; title: string; icon?: React.ReactNode; defaultMobileClosed?: boolean;
  right?: React.ReactNode; children: React.ReactNode;
  open?: boolean; onToggle?: () => void;   // modo controlado (opcional)
}) {
  const internal = useCollapsed(id, defaultMobileClosed);
  const open = openProp ?? internal[0];
  const toggle = onToggle ?? internal[1];
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
  const [leaks, setLeaks] = useState<string[]>([]);
  const [sessions, setSessions] = useState<TournamentSession[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsPayload | null>(null);
  const [filters, setFilters] = useState<TournamentFilters>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [outdated, setOutdated] = useState(0);
  const [loading, setLoading] = useState(true);
  const importRef = useRef<HTMLDivElement>(null);
  // Seção "Importar mãos" controlada (pra goImport conseguir abri-la ao rolar).
  const [importOpen, toggleImport] = useCollapsed("importar", true);

  async function refresh(f = filters) {
    setLoading(true);
    try {
    const [list, ov, fmts, rms, lks, sess, anl] = await Promise.all([
      api.listTournaments(f),
      api.tournamentsOverview(f),
      api.listTournamentFormats(),
      api.listRooms(),
      api.listLeaks(),
      api.tournamentsSessions(f),
      api.tournamentsAnalytics(f),
    ]);
    setTournaments(list);
    setOverview(ov);
    setFormats(fmts);
    setRooms(rms);
    setLeaks(lks);
    setSessions(sess);
    setAnalytics(anl);
    } finally {
      setLoading(false);
    }
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

  async function analyzeOne(tid: string) {
    await api.analyzeTournament(tid);
    await refresh();
  }

  function goImport() {
    if (!importOpen) toggleImport();
    // espera o conteúdo expandir antes de rolar
    requestAnimationFrame(() =>
      importRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
    );
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
        {loading && (
          <div className="flex h-64 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-ink-dim" />
          </div>
        )}
        {!loading && overview && overview.n_tournaments > 0 ? (
          <Collapsible id="importar" title="Importar mãos" icon={<Upload className="h-3.5 w-3.5" />}
            open={importOpen} onToggle={toggleImport}>
            <div ref={importRef} className="scroll-mt-20">
              <TournamentImport onImported={() => refresh()} />
            </div>
          </Collapsible>
        ) : !loading ? (
          <div ref={importRef} className="scroll-mt-20">
            <TournamentImport onImported={() => refresh()} />
          </div>
        ) : null}

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
            <Collapsible id="kpis" title="Resumo" icon={<BarChart3 className="h-3.5 w-3.5" />}>
              <StatsBar overview={overview} currency={currency} />
            </Collapsible>
            <Collapsible id="graficos" title="Gráficos e análises" icon={<BarChart3 className="h-3.5 w-3.5" />} defaultMobileClosed>
              {analytics ? (
                <AnalyticsCenter analytics={analytics} currency={currency} />
              ) : (
                <Card className="mt-2 p-4 text-center text-xs text-ink-faint">Carregando análises…</Card>
              )}
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
            <ActiveFilterChips filters={filters} onChange={applyFilters} />
            <Collapsible id="lista" title="Lista de torneios" icon={<Trophy className="h-3.5 w-3.5" />}
              right={<span className="text-2xs text-ink-faint">{tournaments.length}</span>}>
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
            </Collapsible>
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
          leaks={leaks}
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
    filters.financial, filters.nota_band, filters.min_nota, filters.max_nota,
    filters.graves, filters.status, filters.leak,
  ].filter((v) => v != null && v !== "").length;
}

// Rótulos dos filtros avançados (fonte única p/ controles e chips).
const FINANCIAL_LABEL: Record<string, string> = {
  lucro_positivo: "Lucro positivo",
  lucro_negativo: "Lucro negativo",
  campeao: "Campeão",
  itm: "ITM",
  fora_itm: "Fora do ITM",
};
const BAND_LABEL: Record<string, string> = {
  "8plus": "Nota 8+",
  "6a8": "Nota 6–7.9",
  lt6: "Nota < 6",
  sem_nota: "Sem nota PKE",
};
const GRAVES_LABEL: Record<string, string> = {
  sem_grave: "Sem erro grave",
  com_grave: "Com erro grave",
  gte1: "1+ graves",
  gte3: "3+ graves",
  gte5: "5+ graves",
};
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

function StatsBar({ overview, currency }: {
  overview: TournamentOverview;
  currency: string;
}) {
  const profit = overview.profit_cents;
  return (
    <div className="mt-2">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Tile
          label="Saldo"
          value={fmtMoney(profit, currency, { signed: true })}
          tone={profit > 0 ? "green" : profit < 0 ? "red" : "ink"}
        />
        <Tile label="Torneios" value={String(overview.n_tournaments)} />
        <Tile label="ROI" value={fmtPct(overview.roi_pct)} tone={overview.roi_pct != null && overview.roi_pct > 0 ? "green" : overview.roi_pct != null && overview.roi_pct < 0 ? "red" : "ink"} />
        <Tile label="ITM" value={fmtPct(overview.itm_pct, 0)} />
      </div>
      {overview.pending_prize > 0 && (
        <p className="mt-2 text-2xs text-ink-faint">
          {overview.pending_prize} {overview.pending_prize === 1 ? "torneio" : "torneios"} sem prêmio confirmado · usando custo como base.
        </p>
      )}
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
  hint,
}: {
  label: string;
  value: string;
  tone?: "ink" | "green" | "red";
  hint?: string;
}) {
  const color = {
    ink: "text-ink",
    green: "text-action-green",
    red: "text-action-red",
  }[tone];
  return (
    <Card className="flex h-full flex-col gap-0.5 p-2.5 sm:p-3">
      <span className={cn("text-base font-bold nums sm:text-lg", color)}>{value}</span>
      <span className="flex items-center gap-1 text-2xs uppercase tracking-[0.1em] text-ink-faint">
        {label}
        {hint && (
          <span title={hint} aria-label={hint} className="cursor-help">
            <Info className="h-3 w-3 text-ink-faint/70" />
          </span>
        )}
      </span>
    </Card>
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

// Grupo de pílulas mutuamente exclusivas (clicar na ativa desmarca).
function PillGroup<T extends string>({ value, onChange, options }: {
  value: T | null;
  onChange: (v: T | null) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const active = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(active ? null : o.value)}
            className={cn(
              "rounded-full border px-3 py-1 text-2xs font-semibold transition-colors",
              active
                ? "border-gold/50 bg-gold/15 text-gold"
                : "border-border bg-surface-2 text-ink-dim hover:border-border-strong hover:text-ink",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

const LEAK_ALL = "__all__";

function Filters({
  filters,
  formats,
  rooms,
  leaks,
  onApply,
}: {
  filters: TournamentFilters;
  formats: string[];
  rooms: string[];
  leaks: string[];
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
  // avançados
  const [financial, setFinancial] = useState<FinancialFilter | null>(filters.financial ?? null);
  const [notaBand, setNotaBand] = useState<NotaBand | null>(filters.nota_band ?? null);
  const [minNota, setMinNota] = useState(filters.min_nota != null ? String(filters.min_nota) : "");
  const [maxNota, setMaxNota] = useState(filters.max_nota != null ? String(filters.max_nota) : "");
  const [graves, setGraves] = useState<GravesFilter | null>(filters.graves ?? null);
  const [status, setStatus] = useState<StatusFilter | null>(filters.status ?? null);
  const [leak, setLeak] = useState(filters.leak ?? LEAK_ALL);
  const hasAdv = !!(filters.financial || filters.nota_band || filters.min_nota != null
    || filters.max_nota != null || filters.graves || filters.status || filters.leak);
  const [advOpen, setAdvOpen] = useState(hasAdv);

  // Mantém os inputs sincronizados quando os filtros mudam por fora
  // (presets, clique em sessão, etc.).
  useEffect(() => {
    setFrom(filters.from_date ?? "");
    setTo(filters.to_date ?? "");
    setFmt(filters.format ?? FMT_ALL);
    setRoom(filters.room ?? ROOM_ALL);
    setMin(filters.min_buyin != null ? String(filters.min_buyin / 100) : "");
    setMax(filters.max_buyin != null ? String(filters.max_buyin / 100) : "");
    setFinancial(filters.financial ?? null);
    setNotaBand(filters.nota_band ?? null);
    setMinNota(filters.min_nota != null ? String(filters.min_nota) : "");
    setMaxNota(filters.max_nota != null ? String(filters.max_nota) : "");
    setGraves(filters.graves ?? null);
    setStatus(filters.status ?? null);
    setLeak(filters.leak ?? LEAK_ALL);
  }, [filters]);

  // banda de nota e min/max manual são mutuamente exclusivos
  function pickBand(b: NotaBand | null) {
    setNotaBand(b);
    if (b) { setMinNota(""); setMaxNota(""); }
  }
  function typeMinNota(v: string) { setMinNota(v); if (v) setNotaBand(null); }
  function typeMaxNota(v: string) { setMaxNota(v); if (v) setNotaBand(null); }

  function applyPreset(key: PresetKey) {
    const { from: f, to: t } = presetRange(key);
    onApply({ ...filters, from_date: f, to_date: t });
  }

  function apply() {
    const num = (s: string) => {
      const v = s.trim();
      if (!v) return null;
      const n = Number(v.replace(",", "."));
      return Number.isFinite(n) ? n : null;
    };
    onApply({
      from_date: from || null,
      to_date: to || null,
      format: fmt && fmt !== FMT_ALL ? fmt : null,
      room: room && room !== ROOM_ALL ? room : null,
      min_buyin: min ? parseCentsInput(min) : null,
      max_buyin: max ? parseCentsInput(max) : null,
      financial,
      nota_band: notaBand,
      min_nota: notaBand ? null : num(minNota),
      max_nota: notaBand ? null : num(maxNota),
      graves,
      status,
      leak: leak && leak !== LEAK_ALL ? leak : null,
    });
  }

  function clear() {
    setFrom(""); setTo(""); setFmt(FMT_ALL); setRoom(ROOM_ALL); setMin(""); setMax("");
    setFinancial(null); setNotaBand(null); setMinNota(""); setMaxNota("");
    setGraves(null); setStatus(null); setLeak(LEAK_ALL);
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

  const leakOptions = [
    { value: LEAK_ALL, label: "Todos os leaks" },
    ...leaks.map((l) => ({ value: l, label: leakLabel(l) ?? l })),
  ];

  const FINANCIAL_OPTS = (Object.keys(FINANCIAL_LABEL) as FinancialFilter[])
    .map((v) => ({ value: v, label: FINANCIAL_LABEL[v] }));
  const BAND_OPTS = (Object.keys(BAND_LABEL) as NotaBand[])
    .map((v) => ({ value: v, label: BAND_LABEL[v] }));
  const GRAVES_OPTS: { value: GravesFilter; label: string }[] = [
    { value: "sem_grave", label: "Sem grave" },
    { value: "gte1", label: "1+" },
    { value: "gte3", label: "3+" },
    { value: "gte5", label: "5+" },
  ];
  const STATUS_OPTS: { value: StatusFilter; label: string }[] =
    (["analisado", "nao_analisado", "sem_maos", "insuficiente", "analise_antiga"] as StatusFilter[])
      .map((v) => ({ value: v, label: STATUS_LABEL[v] }));

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

          {/* ── Avançados (PKE + resultado) ─────────────────────────────── */}
          <div className="col-span-2 mt-1 border-t border-border pt-2">
            <button
              type="button"
              onClick={() => setAdvOpen((v) => !v)}
              className="flex w-full items-center justify-between py-1 text-left"
            >
              <SectionLabel>Filtros avançados</SectionLabel>
              <ChevronDown className={cn("h-4 w-4 text-ink-faint transition-transform", advOpen && "rotate-180")} />
            </button>
          </div>

          {advOpen && (
            <div className="col-span-2 flex flex-col gap-3">
              <FilterField label="Resultado">
                <PillGroup value={financial} onChange={setFinancial} options={FINANCIAL_OPTS} />
              </FilterField>
              <FilterField label="Nota PKE">
                <div className="flex flex-col gap-2">
                  <PillGroup value={notaBand} onChange={pickBand} options={BAND_OPTS} />
                  <div className="flex items-center gap-2">
                    <input
                      value={minNota}
                      onChange={(e) => typeMinNota(e.target.value)}
                      placeholder="mín"
                      inputMode="decimal"
                      className="filter-input w-20"
                    />
                    <span className="text-2xs text-ink-faint">até</span>
                    <input
                      value={maxNota}
                      onChange={(e) => typeMaxNota(e.target.value)}
                      placeholder="máx"
                      inputMode="decimal"
                      className="filter-input w-20"
                    />
                  </div>
                </div>
              </FilterField>
              <FilterField label="Erros graves">
                <PillGroup value={graves} onChange={setGraves} options={GRAVES_OPTS} />
              </FilterField>
              <FilterField label="Status PKE">
                <PillGroup value={status} onChange={setStatus} options={STATUS_OPTS} />
              </FilterField>
              {leaks.length > 0 && (
                <FilterField label="Leak principal">
                  <Select
                    value={leak}
                    onValueChange={setLeak}
                    options={leakOptions}
                    ariaLabel="Filtrar por leak"
                    className="w-full"
                  />
                </FilterField>
              )}
            </div>
          )}

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

// Chips de filtros ativos — cada um remove sua chave; "Limpar tudo" zera.
function ActiveFilterChips({ filters, onChange }: {
  filters: TournamentFilters;
  onChange: (f: TournamentFilters) => void;
}) {
  const set = (patch: Partial<TournamentFilters>) => onChange({ ...filters, ...patch });
  const money = (c: number) => (c / 100).toFixed(2);
  const chips: { key: string; label: string; clear: () => void }[] = [];

  if (filters.from_date || filters.to_date) {
    const lbl = filters.from_date && filters.to_date
      ? (filters.from_date === filters.to_date ? filters.from_date : `${filters.from_date} → ${filters.to_date}`)
      : filters.from_date ? `De ${filters.from_date}` : `Até ${filters.to_date}`;
    chips.push({ key: "date", label: lbl, clear: () => set({ from_date: null, to_date: null }) });
  }
  if (filters.format) chips.push({ key: "format", label: filters.format, clear: () => set({ format: null }) });
  if (filters.room) chips.push({ key: "room", label: filters.room, clear: () => set({ room: null }) });
  if (filters.min_buyin != null) chips.push({ key: "minb", label: `Buy-in ≥ ${money(filters.min_buyin)}`, clear: () => set({ min_buyin: null }) });
  if (filters.max_buyin != null) chips.push({ key: "maxb", label: `Buy-in ≤ ${money(filters.max_buyin)}`, clear: () => set({ max_buyin: null }) });
  if (filters.financial) chips.push({ key: "fin", label: FINANCIAL_LABEL[filters.financial], clear: () => set({ financial: null }) });
  if (filters.nota_band) chips.push({ key: "band", label: BAND_LABEL[filters.nota_band], clear: () => set({ nota_band: null }) });
  if (filters.min_nota != null) chips.push({ key: "minn", label: `Nota ≥ ${filters.min_nota}`, clear: () => set({ min_nota: null }) });
  if (filters.max_nota != null) chips.push({ key: "maxn", label: `Nota ≤ ${filters.max_nota}`, clear: () => set({ max_nota: null }) });
  if (filters.graves) chips.push({ key: "graves", label: GRAVES_LABEL[filters.graves], clear: () => set({ graves: null }) });
  if (filters.status) chips.push({ key: "status", label: STATUS_LABEL[filters.status], clear: () => set({ status: null }) });
  if (filters.leak) chips.push({ key: "leak", label: `Leak: ${leakLabel(filters.leak)}`, clear: () => set({ leak: null }) });

  if (chips.length === 0) return null;
  return (
    <div className="mt-3 flex flex-wrap items-center gap-1.5">
      {chips.map((c) => (
        <button
          key={c.key}
          type="button"
          onClick={c.clear}
          className="inline-flex items-center gap-1 rounded-full border border-gold/40 bg-gold/10 px-2.5 py-1 text-2xs font-semibold text-gold hover:bg-gold/15"
        >
          {c.label}
          <X className="h-3 w-3" />
        </button>
      ))}
      {chips.length > 1 && (
        <button
          type="button"
          onClick={() => onChange({})}
          className="ml-1 text-2xs text-ink-faint underline-offset-2 hover:text-ink hover:underline"
        >
          Limpar tudo
        </button>
      )}
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
  if (sessions.length === 0) return null;
  const shown = open ? sessions : sessions.slice(0, 5);

  return (
    <Card className="overflow-hidden">
      <div className="grid gap-2 p-3 sm:grid-cols-2">
        {shown.map((s) => (
          <SessionRow
            key={s.day}
            s={s}
            currency={currency}
            active={activeDay === s.day}
            onPickDay={onPickDay}
          />
        ))}
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

// Card de sessão (dia): destaque em ROI · torneios · grind real; nota/graves
// ficam num detalhe secundário expansível (não roubam o foco).
function SessionRow({ s, currency, active, onPickDay }: {
  s: TournamentSession;
  currency: string;
  active: boolean;
  onPickDay: (day: string) => void;
}) {
  const navigate = useNavigate();
  const [detail, setDetail] = useState(false);
  const start = hhmm(s.start_at);
  const end = hhmm(s.end_at);
  const secs = s.grind_seconds ?? null;
  const dur = secs && secs > 0 ? fmtDuration(secs) : null;
  const interval = start ? `${start}${end && end !== start ? `–${end}` : ""}` : null;
  const blocks = s.n_blocks ?? 0;
  const ppH = s.profit_per_hour_cents;
  const tone =
    s.pending > 0 && s.cashed === 0 ? "text-ink-faint"
      : s.profit_cents > 0 ? "text-action-green"
        : s.profit_cents < 0 ? "text-action-red" : "text-ink";
  const roiTone = s.roi_pct == null ? "ink" : s.roi_pct > 0 ? "green" : s.roi_pct < 0 ? "red" : "ink";

  return (
    <div className={cn(
      "rounded-card border border-border bg-surface-1 p-3 transition-colors",
      active && "border-gold/40 bg-gold/10",
    )}>
      {/* Cabeçalho: data + resultado à direita */}
      <div className="flex items-start justify-between gap-3">
        <div className="text-xs font-semibold text-ink nums">{fmtShortDate(s.day)}</div>
        <div className={cn("shrink-0 text-right text-sm font-bold nums", tone)}>
          {fmtMoney(s.profit_cents, currency, { signed: true })}
        </div>
      </div>

      {/* Linha principal: ROI · torneios · grind real */}
      <div className="mt-2 grid grid-cols-3 gap-2 text-2xs">
        <SessionMini label="ROI" value={s.roi_pct != null ? fmtPct(s.roi_pct, 0) : "—"} tone={roiTone} />
        <SessionMini label="Torneios" value={String(s.n)} />
        <SessionMini label="Grind" value={dur ?? "—"} />
      </div>

      {/* Linha secundária: ritmo + lucro/h + leak */}
      <div className="mt-2 grid grid-cols-2 gap-2 text-2xs">
        <SessionMini label="Torneios/h" value={s.tph != null ? s.tph.toFixed(1) : "—"} />
        <SessionMini label="Lucro/h" value={ppH != null ? fmtMoney(ppH, currency, { signed: true }) : "—"} tone={ppH == null ? "ink" : ppH > 0 ? "green" : ppH < 0 ? "red" : "ink"} />
      </div>

      <div className="mt-2 text-2xs text-ink-faint">
        {dur ? (
          <span><Clock className="mr-1 inline h-2.5 w-2.5" />Grind {s.estimated ? "~" : ""}{dur}
            {blocks > 1 ? ` · ${blocks} blocos` : interval ? ` · ${interval}` : ""}
            {s.estimated ? " (estimado)" : ""} · </span>
        ) : (
          <span className="italic">Duração não disponível · </span>
        )}
        Leak: <span className="text-gold">{s.main_leak ? leakLabel(s.main_leak) : "—"}</span>
      </div>

      {/* Detalhe técnico (secundário, expansível) */}
      <button
        type="button"
        onClick={() => setDetail((v) => !v)}
        className="mt-2 flex w-full items-center gap-1 text-2xs text-ink-faint hover:text-ink"
      >
        <ChevronDown className={cn("h-3 w-3 transition-transform", detail && "rotate-180")} />
        Detalhe técnico (PKE)
      </button>
      {detail && (
        <div className="mt-1.5 grid grid-cols-2 gap-2 text-2xs sm:grid-cols-4">
          <SessionMini label="Nota PKE" value={s.media_notas != null ? s.media_notas.toFixed(1) : "—"} tone={s.media_notas != null && s.media_notas < 5 ? "red" : s.media_notas != null && s.media_notas >= 7 ? "green" : "ink"} />
          <SessionMini label="Erros graves" value={String(s.erros_graves ?? 0)} tone={(s.erros_graves ?? 0) > 0 ? "red" : "ink"} />
          <SessionMini label="ITM" value={s.itm_pct != null ? fmtPct(s.itm_pct, 0) : "—"} />
          <SessionMini label="Graves/h" value={s.graves_per_hour != null ? s.graves_per_hour.toFixed(1) : "—"} tone={(s.graves_per_hour ?? 0) > 0 ? "red" : "ink"} />
        </div>
      )}

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
}
