import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Clock,
  Pause,
  Play,
  Plus,
  Trash2,
} from "lucide-react";
import { BrandBar } from "@/components/layout/BrandBar";
import { MenuButton } from "@/components/layout/MenuButton";
import { Button } from "@/components/ui/Button";
import { Card, SectionLabel } from "@/components/ui/Card";
import {
  BigWinBadge,
  RoomTag,
  fmtDuration,
  isBigWin,
  medalFor,
} from "@/components/tournaments/badges";
import { NewTournamentModal } from "@/components/tournaments/NewTournamentModal";
import { TournamentImport } from "@/components/tournaments/TournamentImport";
import { api } from "@/lib/api";
import { fmtMoney, fmtPct, fmtShortDate } from "@/lib/money";
import { leakLabel } from "@/lib/pke";
import type {
  GrindBlock,
  ManualTournamentInput,
  Tournament,
  TournamentSession,
} from "@/lib/types";
import { cn } from "@/lib/cn";

function todayStr(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}/${m}/${day}`;
}

/** epoch (s) → "HH:MM" local. */
function hhmmTs(ts: number | null | undefined): string {
  if (!ts) return "—";
  const d = new Date(ts * 1000);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** segundos → "HH:MM:SS" (relógio do cronômetro). */
function fmtClock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return [h, m, sec].map((v) => String(v).padStart(2, "0")).join(":");
}

export function SessionsPage() {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<TournamentSession[]>([]);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [dayTournaments, setDayTournaments] = useState<Tournament[]>([]);
  const [blocks, setBlocks] = useState<GrindBlock[]>([]);
  const [active, setActive] = useState<GrindBlock | null>(null);
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  const [error, setError] = useState<string | null>(null);
  const [rooms, setRooms] = useState<string[]>([]);
  const [formats, setFormats] = useState<string[]>([]);
  const [showNew, setShowNew] = useState(false);
  const today = todayStr();

  // tick de 1s só quando há cronômetro rodando
  const tickRef = useRef<number | null>(null);
  useEffect(() => {
    if (active) {
      tickRef.current = window.setInterval(
        () => setNow(Math.floor(Date.now() / 1000)),
        1000,
      );
      return () => {
        if (tickRef.current) window.clearInterval(tickRef.current);
      };
    }
  }, [active]);

  const loadAll = useCallback(async () => {
    const [sess, act, rms, fmts] = await Promise.all([
      api.tournamentsSessions(),
      api.grindActive(),
      api.listRooms(),
      api.listTournamentFormats(),
    ]);
    setRooms(rms);
    setFormats(fmts);
    // "Hoje" sempre presente e no topo — assim dá pra cronometrar mesmo num dia
    // que ainda não tem torneio importado.
    const withToday: TournamentSession[] = sess.some((s) => s.day === today)
      ? sess
      : [
          {
            day: today, start_at: null, end_at: null, n: 0,
            cost_cents: 0, prize_cents: 0, profit_cents: 0,
            roi_pct: null, itm_pct: null, cashed: 0, pending: 0, grind_seconds: 0,
          },
          ...sess,
        ];
    setSessions(withToday);
    setActive(act);
    setSelectedDay((prev) => {
      if (prev && withToday.some((s) => s.day === prev)) return prev;
      return today;
    });
  }, [today]);

  const loadDay = useCallback(async (day: string) => {
    const [list, blks] = await Promise.all([
      api.listTournaments({ from_date: day, to_date: day }),
      api.grindBlocksForDay(day),
    ]);
    setDayTournaments(list);
    setBlocks(blks);
  }, []);

  useEffect(() => {
    loadAll().catch((e) => setError(e instanceof Error ? e.message : "Falha ao carregar."));
  }, [loadAll]);

  useEffect(() => {
    if (selectedDay) loadDay(selectedDay).catch(() => {});
  }, [selectedDay, loadDay, active]);

  async function toggleTimer() {
    try {
      if (active) await api.grindStop();
      else await api.grindStart();
      const act = await api.grindActive();
      setActive(act);
      await loadAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha no cronômetro.");
    }
  }

  async function removeBlock(id: number) {
    if (!confirm("Apagar este bloco de grind?")) return;
    await api.deleteGrindBlock(id);
    await loadAll();
    if (selectedDay) await loadDay(selectedDay);
  }

  async function refreshData() {
    await loadAll();
    if (selectedDay) await loadDay(selectedDay);
  }

  async function addManual(data: ManualTournamentInput) {
    const res = await api.addTournament(data);
    if (res && "error" in res && res.error) {
      setError(res.error);
      return;
    }
    setShowNew(false);
    setError(null);
    await refreshData();
  }

  async function removeTournament(id: string) {
    if (!confirm("Apagar este torneio da planilha?")) return;
    await api.deleteTournament(id);
    await refreshData();
  }

  const days = useMemo(() => sessions.map((s) => s.day), [sessions]);
  const selectedSession = sessions.find((s) => s.day === selectedDay) ?? null;
  const selIdx = selectedDay ? days.indexOf(selectedDay) : -1;
  // lista vem do mais recente → mais antigo; "anterior" (mais antigo) = idx+1
  const goOlder = () => selIdx >= 0 && selIdx < days.length - 1 && setSelectedDay(days[selIdx + 1]);
  const goNewer = () => selIdx > 0 && setSelectedDay(days[selIdx - 1]);

  const isToday = selectedDay === today;
  // tempo de grind do dia: blocos fechados (da sessão) + bloco ativo (se for hoje)
  const closedSecs = selectedSession?.grind_seconds ?? 0;
  const liveSecs = active && active.day === selectedDay ? now - active.started_ts : 0;
  const dayGrindSecs = closedSecs + Math.max(0, liveSecs);

  return (
    <div className="min-h-full">
      <header className="sticky top-0 z-30 border-b border-border bg-bg/85 backdrop-blur-md">
        <BrandBar
          title="Sessões"
          actions={
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" onClick={() => navigate("/tournaments")}>
                <ArrowLeft className="h-4 w-4" />
                <span className="hidden sm:inline">Torneios</span>
              </Button>
              <MenuButton className="h-8 w-8" />
            </div>
          }
        />
      </header>

      <div className="mx-auto w-full max-w-5xl px-3 py-4 sm:px-6 sm:py-6">
        {error && (
          <Card className="mb-3 border-action-red/30 p-3 text-sm text-action-red">{error}</Card>
        )}

        {/* Cronômetro de grind */}
        <GrindTimer
          isToday={isToday}
          running={!!active}
          dayGrindSecs={dayGrindSecs}
          activeSince={active && active.day === selectedDay ? active.started_ts : null}
          onToggle={toggleTimer}
          selectedDayLabel={selectedDay ? fmtShortDate(selectedDay) : "—"}
        />

        {/* Ações: importar (arrasta ou clica) / cadastrar — fluxo
            "grind → registra torneios → stats do dia atualizam na hora" */}
        <TournamentImport onImported={refreshData} className="mt-3" />
        <div className="mt-2">
          <Button variant="ghost" size="sm" onClick={() => setShowNew(true)}>
            <Plus className="h-4 w-4" />
            Novo torneio
          </Button>
        </div>

        {days.length === 0 ? (
          <Card className="mt-4 p-6 text-center text-sm text-ink-dim sm:p-8">
            Nenhuma sessão ainda. Aperte <strong className="text-ink">Iniciar grind</strong> acima
            pra começar a cronometrar, ou importe torneios na aba Torneios.
          </Card>
        ) : (
          <div className="mt-3 grid gap-3 lg:grid-cols-[260px_1fr]">
            {/* Lista de dias */}
            <DayList
              sessions={sessions}
              selectedDay={selectedDay}
              onSelect={setSelectedDay}
            />

            {/* Detalhe do dia */}
            <div className="flex flex-col gap-3">
              <DayHeader
                day={selectedDay}
                canOlder={selIdx >= 0 && selIdx < days.length - 1}
                canNewer={selIdx > 0}
                onOlder={goOlder}
                onNewer={goNewer}
              />
              {selectedSession && (
                <DayKpis session={selectedSession} grindSecs={dayGrindSecs} />
              )}
              <GrindBlocks blocks={blocks} activeId={active?.id ?? null} now={now} onDelete={removeBlock} />
              <DayTournaments tournaments={dayTournaments} onDelete={removeTournament} />
            </div>
          </div>
        )}
      </div>

      {showNew && (
        <NewTournamentModal
          rooms={rooms}
          formats={formats}
          defaultCurrency="USD"
          defaultDay={selectedDay}
          onCancel={() => setShowNew(false)}
          onSave={addManual}
        />
      )}
    </div>
  );
}

// ── Cronômetro ────────────────────────────────────────────────────────────────

function GrindTimer({
  isToday,
  running,
  dayGrindSecs,
  activeSince,
  onToggle,
  selectedDayLabel,
}: {
  isToday: boolean;
  running: boolean;
  dayGrindSecs: number;
  activeSince: number | null;
  onToggle: () => void;
  selectedDayLabel: string;
}) {
  return (
    <Card className={cn("p-4 sm:p-5", running && "border-action-green/40")}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <SectionLabel>
            <span className="inline-flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              Tempo de grind · {isToday ? "Hoje" : selectedDayLabel}
            </span>
          </SectionLabel>
          <div
            className={cn(
              "mt-1 font-bold tabular-nums tracking-tight nums text-3xl sm:text-4xl",
              running ? "text-action-green" : "text-ink",
            )}
          >
            {fmtClock(dayGrindSecs)}
          </div>
          {running && activeSince != null && (
            <div className="mt-1 flex items-center gap-1.5 text-2xs text-action-green">
              <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-action-green" />
              Em andamento desde {hhmmTs(activeSince)}
            </div>
          )}
        </div>

        {isToday ? (
          <Button variant={running ? "ghost" : "primary"} onClick={onToggle}>
            {running ? (
              <>
                <Pause className="h-4 w-4" /> Parar grind
              </>
            ) : (
              <>
                <Play className="h-4 w-4" /> Iniciar grind
              </>
            )}
          </Button>
        ) : (
          <span className="text-2xs text-ink-faint">
            Cronômetro disponível só para o dia de hoje.
          </span>
        )}
      </div>
    </Card>
  );
}

// ── Lista de dias ──────────────────────────────────────────────────────────────

function DayList({
  sessions,
  selectedDay,
  onSelect,
}: {
  sessions: TournamentSession[];
  selectedDay: string | null;
  onSelect: (day: string) => void;
}) {
  return (
    <Card className="max-h-[300px] overflow-y-auto p-0 lg:max-h-[640px]">
      <div className="flex gap-2 overflow-x-auto p-2 lg:flex-col lg:overflow-x-visible">
        {sessions.map((s) => {
          const tone =
            s.profit_cents > 0 ? "text-action-green" : s.profit_cents < 0 ? "text-action-red" : "text-ink";
          return (
            <button
              key={s.day}
              type="button"
              onClick={() => onSelect(s.day)}
              className={cn(
                "flex shrink-0 flex-col gap-0.5 rounded-ctl border px-3 py-2 text-left transition-colors lg:shrink",
                selectedDay === s.day
                  ? "border-gold/50 bg-gold/10"
                  : "border-border bg-surface-1 hover:border-border-strong hover:bg-surface-2",
              )}
            >
              <span className="text-xs font-semibold text-ink nums">{fmtShortDate(s.day)}</span>
              <span className="flex items-center gap-1.5 text-2xs text-ink-faint nums">
                <span>{s.n} {s.n === 1 ? "torn." : "torns."}</span>
                {s.grind_seconds > 0 && <span>· {fmtDuration(s.grind_seconds)}</span>}
              </span>
              <span className={cn("text-xs font-bold nums", tone)}>
                {fmtMoney(s.profit_cents, "USD", { signed: true })}
              </span>
            </button>
          );
        })}
      </div>
    </Card>
  );
}

// ── Cabeçalho do dia + setas ────────────────────────────────────────────────────

function DayHeader({
  day,
  canOlder,
  canNewer,
  onOlder,
  onNewer,
}: {
  day: string | null;
  canOlder: boolean;
  canNewer: boolean;
  onOlder: () => void;
  onNewer: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <button
        onClick={onOlder}
        disabled={!canOlder}
        className="rounded-ctl border border-border bg-surface-1 p-2 text-ink-dim hover:bg-surface-2 hover:text-ink disabled:opacity-30"
        aria-label="Dia anterior"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <div className="text-center">
        <div className="text-base font-semibold text-ink nums sm:text-lg">
          {day ? fmtShortDate(day) : "—"}
        </div>
      </div>
      <button
        onClick={onNewer}
        disabled={!canNewer}
        className="rounded-ctl border border-border bg-surface-1 p-2 text-ink-dim hover:bg-surface-2 hover:text-ink disabled:opacity-30"
        aria-label="Próximo dia"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}

// ── KPIs do dia ─────────────────────────────────────────────────────────────────

function DayKpis({ session, grindSecs }: { session: TournamentSession; grindSecs: number }) {
  const navigate = useNavigate();
  const n = session.n;
  const abi = n ? session.cost_cents / n : null;
  const perGame = n ? session.profit_cents / n : null;
  const profitTone =
    session.profit_cents > 0 ? "green" : session.profit_cents < 0 ? "red" : "ink";
  const media = session.media_notas;
  const mediaTone = media == null ? "ink" : media >= 7 ? "green" : media < 5 ? "red" : "ink";
  const leak = leakLabel(session.main_leak);

  return (
    <Card className="p-3 sm:p-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Kpi label="Saldo do dia" value={fmtMoney(session.profit_cents, "USD", { signed: true })} tone={profitTone} />
        <Kpi label="Torneios" value={String(n)} />
        <Kpi label="ROI" value={fmtPct(session.roi_pct)} tone={session.roi_pct != null && session.roi_pct > 0 ? "green" : session.roi_pct != null && session.roi_pct < 0 ? "red" : "ink"} />
        <Kpi label="ITM" value={fmtPct(session.itm_pct, 0)} />
        <Kpi label="Nota PKE" value={media != null ? media.toFixed(1) : "—"} tone={mediaTone} />
        <Kpi label="Erros graves" value={String(session.erros_graves ?? 0)} tone={(session.erros_graves ?? 0) > 0 ? "red" : "ink"} />
        <Kpi label="$/torneio" value={fmtMoney(perGame, "USD", { signed: true })} tone={perGame != null && perGame > 0 ? "green" : perGame != null && perGame < 0 ? "red" : "ink"} />
        <Kpi label="Tempo de grind" value={fmtDuration(grindSecs)} />
      </div>
      {leak && (
        <div className="mt-2 text-2xs text-ink-faint">
          Leak principal do dia: <span className="font-semibold text-gold">{leak}</span>
        </div>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <Button variant="ghost" size="sm" onClick={() => window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" })}>
          Revisar sessão
        </Button>
      </div>
    </Card>
  );
}

function Kpi({ label, value, tone = "ink" }: { label: string; value: string; tone?: "ink" | "green" | "red" }) {
  const color = { ink: "text-ink", green: "text-action-green", red: "text-action-red" }[tone];
  return (
    <div className="flex flex-col gap-0.5 rounded-ctl bg-surface-2/50 px-2.5 py-2">
      <span className={cn("text-sm font-bold nums", color)}>{value}</span>
      <span className="text-2xs uppercase tracking-[0.08em] text-ink-faint">{label}</span>
    </div>
  );
}

// ── Blocos de grind ──────────────────────────────────────────────────────────────

function GrindBlocks({
  blocks,
  activeId,
  now,
  onDelete,
}: {
  blocks: GrindBlock[];
  activeId: number | null;
  now: number;
  onDelete: (id: number) => void;
}) {
  if (blocks.length === 0) return null;
  return (
    <Card className="p-3 sm:p-4">
      <SectionLabel>Blocos de grind</SectionLabel>
      <div className="mt-2 flex flex-col gap-1.5">
        {blocks.map((b) => {
          const running = b.id === activeId || b.ended_ts == null;
          const dur = (b.ended_ts ?? now) - b.started_ts;
          return (
            <div
              key={b.id}
              className="flex items-center justify-between gap-2 rounded-ctl border border-border/60 bg-surface-1 px-3 py-1.5 text-xs"
            >
              <span className="flex items-center gap-2 nums text-ink-dim">
                <Clock className="h-3 w-3 text-ink-faint" />
                {hhmmTs(b.started_ts)} – {running ? "agora" : hhmmTs(b.ended_ts)}
                {running && (
                  <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-action-green" />
                )}
              </span>
              <span className="flex items-center gap-2">
                <span className="font-semibold text-ink nums">{fmtDuration(dur)}</span>
                {!running && (
                  <button
                    onClick={() => onDelete(b.id)}
                    className="rounded p-1 text-ink-faint hover:bg-action-red/15 hover:text-action-red"
                    aria-label="Apagar bloco"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

// ── Torneios do dia ──────────────────────────────────────────────────────────────

function DayTournaments({
  tournaments,
  onDelete,
}: {
  tournaments: Tournament[];
  onDelete: (id: string) => void;
}) {
  if (tournaments.length === 0) {
    return (
      <Card className="p-4 text-center text-xs text-ink-faint">
        Nenhum torneio neste dia.
      </Card>
    );
  }
  // engine devolve asc por data; mostra na ordem jogada
  return (
    <Card className="p-0">
      <div className="border-b border-border px-3 py-2">
        <SectionLabel>Torneios do dia ({tournaments.length})</SectionLabel>
      </div>
      <div className="flex flex-col">
        {tournaments.map((t) => {
          const profit = t.profit_cents;
          const profitTone =
            profit == null ? "text-ink-faint" : profit > 0 ? "text-action-green" : profit < 0 ? "text-action-red" : "text-ink";
          const medal = medalFor(t.finish_pos);
          const big = isBigWin(t);
          return (
            <div
              key={t.tournament_id}
              className="flex items-center justify-between gap-2 border-b border-border/50 px-3 py-2 last:border-b-0"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 text-sm text-ink">
                  {medal && <span aria-hidden>{medal}</span>}
                  <span className="font-medium">{t.format ?? "Sem rótulo"}</span>
                  {big && <BigWinBadge />}
                  <RoomTag room={t.room} />
                </div>
                <div className="truncate text-2xs text-ink-faint" title={t.tournament_name ?? ""}>
                  {t.tournament_name ?? "—"}
                  {t.finish_pos != null && (
                    <span className="ml-1 nums">
                      · {t.finish_pos}
                      {t.n_entries ? `/${t.n_entries}` : ""}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <div className={cn("text-right text-sm font-bold nums", profitTone)}>
                  {profit != null ? fmtMoney(profit, t.currency, { signed: true }) : "—"}
                </div>
                <button
                  onClick={() => onDelete(t.tournament_id)}
                  className="rounded p-1.5 text-ink-faint hover:bg-action-red/15 hover:text-action-red"
                  aria-label="Excluir torneio"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
