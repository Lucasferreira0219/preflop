import { useMemo, useRef, useState } from "react";
import {
  BookOpen,
  ChevronDown,
  Dumbbell,
  Eye,
  Loader2,
  MessageCircleQuestion,
  RefreshCw,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, SectionLabel } from "@/components/ui/Card";
import { PkeBadge } from "@/components/PkeBadge";
import { EXERCISE_TO_SPOT, ruleIdOf, trainModeFor } from "@/lib/pke";
import type { ReportHand, ReportLeak, TournamentReport } from "@/lib/types";
import { cn } from "@/lib/cn";

// ── rótulos (só apresentação — nenhuma regra estratégica aqui) ──────────────────
const SPOT_LABEL: Record<string, string> = {
  push_fold: "Push/Fold", rfi: "RFI", vs_open: "vs Open", bb_defense: "Defesa BB",
  resteal_short: "Resteal", vs_limp: "Limp punish", blind_war_sb: "Blind war SB",
  heads_up: "Heads-up", bubble_call: "Call vs shove", postflop: "Pós-flop",
};
const PHASE_LABEL: Record<string, string> = {
  early: "Early", middle: "Middle", bubble: "Bolha", itm: "ITM",
  "3handed": "3-handed", heads_up: "Heads-up",
};
const ACT: Record<string, string> = {
  shove: "Shove (all-in)", raise: "Raise", "3bet": "3-bet", "4bet": "4-bet",
  call: "Call", fold: "Fold", bet: "Aposta", limp: "Limp", check: "Check",
};
const DRILL_LABEL: Record<string, string> = {
  push_fold: "Push/Fold", resteal_short: "Resteal", vs_open_3bet: "vs Open (3-bet)",
  vs_limp: "Limp punish", bubble_call: "Bolha/ICM", bb_defense: "Defesa BB",
  postflop_cbet_ip: "Pós-flop c-bet",
};
const OUTCOME: Record<string, { label: string; cls: string }> = {
  decisao_boa: { label: "Decisão boa", cls: "bg-action-green/15 text-action-green" },
  erro: { label: "Erro", cls: "bg-action-red/15 text-action-red" },
  cooler: { label: "Cooler", cls: "bg-action-blue/15 text-action-blue" },
  insuficiente: { label: "Insuficiente", cls: "bg-surface-2 text-ink-faint" },
};

function lbl(map: Record<string, string>, k: string | null | undefined) {
  return k ? map[k] ?? k : "—";
}

function notaCls(n: number | null): string {
  if (n == null) return "bg-surface-2 text-ink-faint";
  if (n >= 9) return "bg-action-green/15 text-action-green";
  if (n >= 6) return "bg-gold/15 text-gold";
  if (n >= 4) return "bg-orange-500/15 text-orange-400";
  return "bg-action-red/15 text-action-red";
}

type Filter = "todos" | "erros" | "graves" | "boas" | "coolers" | "insuf";
const FILTERS: { key: Filter; label: string }[] = [
  { key: "todos", label: "Todos" },
  { key: "graves", label: "Erros graves" },
  { key: "erros", label: "Erros" },
  { key: "boas", label: "Boas" },
  { key: "coolers", label: "Coolers" },
  { key: "insuf", label: "Insuficientes" },
];

export function PkeReport({
  report,
  onReanalyze,
  reanalyzing,
  onTrainLeaks,
  onTrainLeak,
  onOpenRule,
  onAskHand,
}: {
  report: TournamentReport;
  onReanalyze?: () => void;
  reanalyzing?: boolean;
  onTrainLeaks?: () => void;
  onTrainLeak?: (mode: string) => void;
  onOpenRule?: (id: string) => void;
  onAskHand?: (hand: ReportHand) => void;
}) {
  const [filter, setFilter] = useState<Filter>("todos");
  const [fase, setFase] = useState<string>("all");
  const [spot, setSpot] = useState<string>("all");
  const listRef = useRef<HTMLDivElement>(null);

  const focusSpot = (s: string | null) => {
    if (!s) return;
    setFilter("todos");
    setSpot(s);
    requestAnimationFrame(() => listRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  const fases = useMemo(
    () => [...new Set(report.maos.map((m) => m.fase).filter(Boolean))] as string[],
    [report.maos],
  );
  const spots = useMemo(
    () => [...new Set(report.maos.map((m) => m.spot).filter(Boolean))] as string[],
    [report.maos],
  );

  const maos = useMemo(() => {
    const pass = (m: ReportHand) => {
      if (fase !== "all" && m.fase !== fase) return false;
      if (spot !== "all" && m.spot !== spot) return false;
      if (filter === "erros") return m.outcome === "erro";
      if (filter === "graves") return m.nota != null && m.nota <= 4;
      if (filter === "boas") return m.outcome === "decisao_boa";
      if (filter === "coolers") return m.outcome === "cooler";
      if (filter === "insuf") return m.outcome === "insuficiente";
      return true;
    };
    // pior → melhor; insuficientes (nota null) por último
    return report.maos.filter(pass).sort((a, b) => (a.nota ?? 999) - (b.nota ?? 999));
  }, [report.maos, filter, fase, spot]);

  if (report.maos_criticas === 0) {
    return (
      <Card className="mt-5 p-5 text-center text-sm text-ink-dim">
        Nenhuma mão crítica neste torneio para o PKE analisar.
        {report.maos_no_torneio === 0 && " (Nenhuma mão deste torneio no banco.)"}
      </Card>
    );
  }

  return (
    <div className="mt-6 flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <SectionLabel>Análise PKE do torneio</SectionLabel>
          <PkeBadge variant="analisado" />
        </div>
        <div className="flex items-center gap-1">
          {onTrainLeaks && report.leaks.length > 0 && (
            <Button variant="primary" size="sm" onClick={onTrainLeaks}>
              <Dumbbell className="h-4 w-4" /> Treinar meus leaks
            </Button>
          )}
          {onReanalyze && (
            <Button variant="ghost" size="sm" onClick={onReanalyze} disabled={reanalyzing}>
              {reanalyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Reanalisar
            </Button>
          )}
        </div>
      </div>

      <Summary report={report} />
      {report.leaks.length > 0 && (
        <Leaks
          leaks={report.leaks}
          onTrainLeak={onTrainLeak}
          onOpenRule={onOpenRule}
          onFilterSpot={focusSpot}
        />
      )}
      {report.treino_sugerido.length > 0 && (
        <Treino drills={report.treino_sugerido} onTrainLeak={onTrainLeak} />
      )}

      {/* Filtros */}
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={cn(
                "rounded-full border px-3 py-1 text-2xs font-semibold transition-colors",
                filter === f.key
                  ? "border-gold/50 bg-gold/15 text-gold"
                  : "border-border bg-surface-1 text-ink-dim hover:text-ink",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2 text-2xs">
          <Pick value={fase} onChange={setFase} all="Todas as fases"
                options={fases.map((f) => ({ v: f, l: lbl(PHASE_LABEL, f) }))} />
          <Pick value={spot} onChange={setSpot} all="Todos os spots"
                options={spots.map((s) => ({ v: s, l: lbl(SPOT_LABEL, s) }))} />
        </div>
      </div>

      {/* Lista de mãos */}
      <div ref={listRef} className="flex flex-col gap-2 scroll-mt-20">
        {maos.map((m) => (
          <HandCard key={m.hand_id} m={m} onTrainLeak={onTrainLeak} onOpenRule={onOpenRule} onAskHand={onAskHand} />
        ))}
        {maos.length === 0 && (
          <Card className="p-4 text-center text-xs text-ink-faint">Nenhuma mão com esse filtro.</Card>
        )}
      </div>
    </div>
  );
}

// ── resumo ──────────────────────────────────────────────────────────────────────
function Summary({ report }: { report: TournamentReport }) {
  const media = report.media_notas;
  const mediaCls = media == null ? "text-ink-faint"
    : media >= 7 ? "text-action-green" : media >= 5 ? "text-gold" : "text-action-red";
  return (
    <Card className="p-4">
      <div className="flex items-center gap-4">
        <div className="text-center">
          <div className={cn("text-4xl font-bold tabular-nums", mediaCls)}>
            {media != null ? media.toFixed(1) : "—"}
          </div>
          <div className="text-2xs uppercase tracking-[0.1em] text-ink-faint">Média</div>
        </div>
        <div className="grid flex-1 grid-cols-2 gap-2 sm:grid-cols-4">
          <Mini label="Críticas" value={report.maos_criticas} />
          <Mini label="Com nota" value={report.maos_com_nota} />
          <Mini label="Erros graves" value={report.erros_graves} tone="red" />
          <Mini label="Fase pior" text={lbl(PHASE_LABEL, report.fase_com_mais_erros)} />
        </div>
      </div>
      {report.tipos_erro_top.length > 0 && (
        <div className="mt-3 border-t border-border pt-3">
          <div className="mb-1.5 text-2xs uppercase tracking-[0.1em] text-ink-faint">
            Principais tipos de erro
          </div>
          <div className="flex flex-wrap gap-1.5">
            {report.tipos_erro_top.map((t) => (
              <span key={t.tipo} className="rounded-full bg-surface-2 px-2 py-1 text-2xs text-ink-dim">
                {t.tipo.replace(/_/g, " ")} · {t.n}
              </span>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}

function Mini({ label, value, text, tone = "ink" }: { label: string; value?: number; text?: string; tone?: "ink" | "red" }) {
  return (
    <div className="rounded-ctl bg-surface-2/50 px-2.5 py-1.5">
      <div className={cn("text-base font-bold tabular-nums", tone === "red" ? "text-action-red" : "text-ink")}>
        {value != null ? value : text ?? "—"}
      </div>
      <div className="text-2xs uppercase tracking-[0.08em] text-ink-faint">{label}</div>
    </div>
  );
}

// ── leaks ────────────────────────────────────────────────────────────────────────
function Leaks({
  leaks,
  onTrainLeak,
  onOpenRule,
  onFilterSpot,
}: {
  leaks: ReportLeak[];
  onTrainLeak?: (mode: string) => void;
  onOpenRule?: (id: string) => void;
  onFilterSpot?: (spot: string | null) => void;
}) {
  return (
    <Card className="p-4">
      <SectionLabel className="mb-2 flex items-center gap-1.5">
        <ShieldAlert className="h-3.5 w-3.5" /> Leaks detectados
      </SectionLabel>
      <div className="flex flex-col gap-2">
        {leaks.map((l) => {
          const mode = trainModeFor(l.exercicio);
          const ruleId = ruleIdOf(l.regra_violada);
          const spot = l.exercicio ? EXERCISE_TO_SPOT[l.exercicio] : null;
          return (
            <div key={l.id} className="rounded-ctl border border-border bg-surface-1 p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-ink">{l.label}</span>
                <span className={cn("rounded-full px-2 py-0.5 text-2xs font-semibold",
                  l.gravidade === "alta" ? "bg-action-red/15 text-action-red" : "bg-gold/15 text-gold")}>
                  {l.gravidade} · {l.frequencia_hits}×
                </span>
              </div>
              <div className="mt-1 text-2xs text-ink-faint">
                Fase: {lbl(PHASE_LABEL, l.fase_predominante)} · perda média {l.perda_media_nota} pts
              </div>
              {l.exemplo && <div className="mt-1 text-xs text-ink-dim">Ex.: {l.exemplo}</div>}
              <div className="mt-1.5 text-xs text-ink">✔ {l.como_corrigir}</div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {mode && onTrainLeak && (
                  <LeakBtn primary onClick={() => onTrainLeak(mode)}>
                    <Dumbbell className="h-3.5 w-3.5" /> Treinar este leak
                  </LeakBtn>
                )}
                {ruleId && onOpenRule && (
                  <LeakBtn onClick={() => onOpenRule(ruleId)}>
                    <BookOpen className="h-3.5 w-3.5" /> Ver regra
                  </LeakBtn>
                )}
                {spot && onFilterSpot && (
                  <LeakBtn onClick={() => onFilterSpot(spot)}>
                    <Eye className="h-3.5 w-3.5" /> Ver mãos desse erro
                  </LeakBtn>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function LeakBtn({ children, onClick, primary }: { children: React.ReactNode; onClick: () => void; primary?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-2xs font-semibold transition-colors",
        primary
          ? "border-gold/50 bg-gold/15 text-gold hover:bg-gold/25"
          : "border-border bg-surface-2 text-ink-dim hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}

function Treino({ drills, onTrainLeak }: { drills: string[]; onTrainLeak?: (mode: string) => void }) {
  return (
    <Card className="p-4">
      <SectionLabel className="mb-2 flex items-center gap-1.5">
        <Dumbbell className="h-3.5 w-3.5" /> Treino sugerido
      </SectionLabel>
      <div className="flex flex-wrap gap-1.5">
        {drills.map((d) => {
          const mode = trainModeFor(d);
          return (
            <button
              key={d}
              disabled={!mode || !onTrainLeak}
              onClick={() => mode && onTrainLeak?.(mode)}
              className="rounded-full border border-gold/30 bg-gold/10 px-3 py-1 text-2xs font-semibold text-gold transition-colors hover:bg-gold/20 disabled:cursor-default disabled:opacity-60"
            >
              {lbl(DRILL_LABEL, d)}
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-2xs text-ink-faint">
        Toque numa categoria para treinar agora — os spots são gerados pelos seus leaks.
      </p>
    </Card>
  );
}

// ── mão (colapsada → expande) ──────────────────────────────────────────────────
function HandCard({
  m,
  onTrainLeak,
  onOpenRule,
  onAskHand,
}: {
  m: ReportHand;
  onTrainLeak?: (mode: string) => void;
  onOpenRule?: (id: string) => void;
  onAskHand?: (hand: ReportHand) => void;
}) {
  const [open, setOpen] = useState(false);
  const out = OUTCOME[m.outcome] ?? OUTCOME.insuficiente;
  const mode = trainModeFor(m.spot);
  const ruleId = ruleIdOf(m.regra[0]);
  return (
    <Card className="overflow-hidden p-0">
      <button onClick={() => setOpen((v) => !v)} className="flex w-full items-center gap-3 p-3 text-left">
        <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-lg text-sm font-bold tabular-nums", notaCls(m.nota))}>
          {m.nota != null ? m.nota : "—"}
        </span>
        <div className="flex shrink-0 items-center gap-2">
          <span className="rounded-ctl border border-border bg-surface-2 px-2 py-0.5 text-2xs font-semibold text-ink-dim">
            {m.pos ?? "?"}
          </span>
          <span className="font-mono text-sm font-bold text-ink">{m.cards ?? "—"}</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5 text-2xs text-ink-faint">
            <span>{lbl(SPOT_LABEL, m.spot)}</span>
            <span>·</span>
            <span>{lbl(PHASE_LABEL, m.fase)}</span>
            {m.eff_bb != null && <><span>·</span><span>{Math.round(m.eff_bb)}bb</span></>}
          </div>
          <div className="truncate text-xs text-ink">{m.resumo}</div>
        </div>
        <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-2xs font-semibold", out.cls)}>{out.label}</span>
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-ink-faint transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="border-t border-border bg-surface-1/50 p-3 text-xs">
          <div className="grid grid-cols-2 gap-2">
            <Field label="Você jogou">{lbl(ACT, m.linha)}</Field>
            <Field label="Recomendado">
              {m.insuficiente ? <span className="text-ink-faint">—</span> : lbl(ACT, m.recomendado)}
              {m.size_recomendado && <span className="text-ink-faint"> ({m.size_recomendado})</span>}
            </Field>
          </div>
          {m.regra.length > 0 && (
            <div className="mt-2">
              <span className="text-ink-faint">Regra: </span>
              {m.regra.map((r) => (
                <span key={r} className="mr-1 rounded bg-surface-2 px-1.5 py-0.5 text-[10px] text-ink-dim">{r}</span>
              ))}
            </div>
          )}
          {m.explicacao && <p className="mt-2 leading-relaxed text-ink-dim">{m.explicacao}</p>}
          {m.insuficiente && m.falta_info.length > 0 && (
            <p className="mt-1 text-ink-faint">Falta: {m.falta_info.join(", ")}</p>
          )}
          {m.outcome === "cooler" && (
            <p className="mt-2 flex items-center gap-1.5 rounded-ctl bg-action-blue/10 px-2 py-1.5 text-action-blue">
              <Sparkles className="h-3.5 w-3.5" /> Decisão correta — você perdeu a mão, mas jogou certo (cooler).
            </p>
          )}
          {m.ajuste_exploratorio && (
            <p className="mt-2 text-ink-faint">Ajuste exploratório: {m.ajuste_exploratorio}</p>
          )}

          {(onAskHand || (ruleId && onOpenRule) || (mode && onTrainLeak)) && (
            <div className="mt-3 flex flex-wrap gap-1.5 border-t border-border pt-3">
              {onAskHand && (
                <LeakBtn onClick={() => onAskHand(m)}>
                  <MessageCircleQuestion className="h-3.5 w-3.5" /> Perguntar sobre essa mão
                </LeakBtn>
              )}
              {ruleId && onOpenRule && (
                <LeakBtn onClick={() => onOpenRule(ruleId)}>
                  <BookOpen className="h-3.5 w-3.5" /> Ver regra usada
                </LeakBtn>
              )}
              {mode && onTrainLeak && (
                <LeakBtn onClick={() => onTrainLeak(mode)}>
                  <Dumbbell className="h-3.5 w-3.5" /> Treinar spot parecido
                </LeakBtn>
              )}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-2xs uppercase tracking-[0.08em] text-ink-faint">{label}</span>
      <span className="text-sm text-ink">{children}</span>
    </div>
  );
}

function Pick({ value, onChange, all, options }: {
  value: string; onChange: (v: string) => void; all: string; options: { v: string; l: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-ctl border border-border bg-surface-2 px-2 py-1 text-2xs text-ink-dim outline-none"
    >
      <option value="all">{all}</option>
      {options.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
    </select>
  );
}
