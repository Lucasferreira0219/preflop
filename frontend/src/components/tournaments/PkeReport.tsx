import { useEffect, useMemo, useRef, useState } from "react";
import {
  BookOpen,
  ChevronDown,
  Dumbbell,
  Eye,
  Loader2,
  MessageCircleQuestion,
  NotebookPen,
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

// status da decisão (sem nota numérica) e impacto — só cores/labels
const DEC_BADGE: Record<string, { label: string; cls: string; bar: string }> = {
  correct: { label: "Acerto", cls: "bg-action-green/15 text-action-green", bar: "bg-action-green/60" },
  minor_error: { label: "Erro leve", cls: "bg-gold/15 text-gold", bar: "bg-gold/50" },
  medium_error: { label: "Erro médio", cls: "bg-orange-500/15 text-orange-400", bar: "bg-orange-500/60" },
  major_error: { label: "Erro grave", cls: "bg-action-red/15 text-action-red", bar: "bg-action-red/70" },
  cooler: { label: "Cooler", cls: "bg-action-blue/15 text-action-blue", bar: "bg-action-blue/60" },
  insufficient: { label: "Insuficiente", cls: "bg-surface-2 text-ink-faint", bar: "bg-border" },
};
const IMP_BADGE: Record<string, { label: string; cls: string }> = {
  low: { label: "Impacto baixo", cls: "bg-surface-2 text-ink-faint" },
  medium: { label: "Impacto médio", cls: "bg-surface-2 text-ink-dim" },
  high: { label: "Impacto alto", cls: "bg-gold/10 text-gold" },
  critical: { label: "Impacto crítico", cls: "bg-action-red/15 text-action-red" },
};

// faixa de qualidade da linha (tolerância estratégica) — cores por faixa
const QUAL_BADGE: Record<string, string> = {
  best: "bg-action-green/15 text-action-green",
  standard_good: "bg-action-green/15 text-action-green",
  acceptable_good: "bg-action-green/10 text-action-green",
  acceptable_but_inferior: "bg-gold/15 text-gold",
  close: "bg-action-blue/15 text-action-blue",
  minor_error: "bg-gold/15 text-gold",
  medium_error: "bg-orange-500/15 text-orange-400",
  major_error: "bg-action-red/15 text-action-red",
  severe_error: "bg-action-red/20 text-action-red",
  cooler: "bg-action-blue/15 text-action-blue",
  insufficient: "bg-surface-2 text-ink-faint",
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
  onExportHand,
  onExportLeak,
}: {
  report: TournamentReport;
  onReanalyze?: () => void;
  reanalyzing?: boolean;
  onTrainLeaks?: () => void;
  onTrainLeak?: (mode: string) => void;
  onOpenRule?: (id: string) => void;
  onAskHand?: (hand: ReportHand) => void;
  onExportHand?: (hand: ReportHand) => void;
  onExportLeak?: (leak: ReportLeak) => void;
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
      if (filter === "graves") return m.decision_label === "major_error";
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
          onExportLeak={onExportLeak}
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
          <HandCard key={m.hand_id} m={m} onTrainLeak={onTrainLeak} onOpenRule={onOpenRule} onAskHand={onAskHand} onExportHand={onExportHand} />
        ))}
        {maos.length === 0 && (
          <Card className="p-4 text-center text-xs text-ink-faint">Nenhuma mão com esse filtro.</Card>
        )}
      </div>
    </div>
  );
}

// ── resumo ──────────────────────────────────────────────────────────────────────
export function Summary({ report }: { report: TournamentReport }) {
  // NOTA ÚNICA visível = ponderada por impacto (fallback média só se faltar).
  const score = report.pke_score ?? report.media_notas;
  const cls = score == null ? "text-ink-faint"
    : score >= 7 ? "text-action-green" : score >= 5 ? "text-gold" : "text-action-red";
  const graves = report.pke_grave_errors ?? report.erros_graves;
  return (
    <Card className="p-4">
      <div className="flex items-center gap-4">
        <div className="text-center">
          <div className={cn("text-4xl font-bold tabular-nums", cls)}>
            {score != null ? score.toFixed(1) : "—"}
          </div>
          <div className="text-2xs uppercase tracking-[0.1em] text-ink-faint">Nota PKE</div>
        </div>
        <div className="grid flex-1 grid-cols-2 gap-2 sm:grid-cols-3">
          <Mini label="Críticas" value={report.maos_criticas} />
          <Mini label="Erros graves" value={graves} tone="red" />
          <Mini label="Fase pior" text={lbl(PHASE_LABEL, report.fase_com_mais_erros)} />
        </div>
      </div>
      {report.pke_score_explanation && (
        <p className="mt-3 border-t border-border pt-3 text-[13px] leading-relaxed text-ink-dim">
          {report.pke_score_explanation}
        </p>
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
export function Leaks({
  leaks,
  onTrainLeak,
  onOpenRule,
  onFilterSpot,
  onExportLeak,
}: {
  leaks: ReportLeak[];
  onTrainLeak?: (mode: string) => void;
  onOpenRule?: (id: string) => void;
  onFilterSpot?: (spot: string | null) => void;
  onExportLeak?: (leak: ReportLeak) => void;
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
                {onExportLeak && (
                  <LeakBtn onClick={() => onExportLeak(l)}>
                    <NotebookPen className="h-3.5 w-3.5" /> Criar anotação deste leak
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

export function Treino({ drills, onTrainLeak }: { drills: string[]; onTrainLeak?: (mode: string) => void }) {
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

// ── lista de mãos com filtros (export para uso em abas) ───────────────────────
export function HandList({
  report,
  initialSpot,
  onTrainLeak,
  onOpenRule,
  onAskHand,
  onExportHand,
}: {
  report: TournamentReport;
  initialSpot?: string | null;
  onTrainLeak?: (mode: string) => void;
  onOpenRule?: (id: string) => void;
  onAskHand?: (hand: ReportHand) => void;
  onExportHand?: (hand: ReportHand) => void;
}) {
  const [filter, setFilter] = useState<Filter>("todos");
  const [fase, setFase] = useState("all");
  const [spot, setSpot] = useState(initialSpot ?? "all");

  useEffect(() => {
    if (initialSpot) setSpot(initialSpot);
  }, [initialSpot]);

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
      if (filter === "graves") return m.decision_label === "major_error";
      if (filter === "boas") return m.outcome === "decisao_boa";
      if (filter === "coolers") return m.outcome === "cooler";
      if (filter === "insuf") return m.outcome === "insuficiente";
      return true;
    };
    return report.maos.filter(pass).sort((a, b) => (a.nota ?? 999) - (b.nota ?? 999));
  }, [report.maos, filter, fase, spot]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => (
            <button key={f.key} onClick={() => setFilter(f.key)}
              className={cn("rounded-full border px-3 py-1 text-2xs font-semibold transition-colors",
                filter === f.key ? "border-gold/50 bg-gold/15 text-gold" : "border-border bg-surface-1 text-ink-dim hover:text-ink")}>
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
      <div className="flex flex-col gap-2">
        {maos.map((m) => (
          <HandCard key={m.hand_id} m={m} onTrainLeak={onTrainLeak} onOpenRule={onOpenRule} onAskHand={onAskHand} onExportHand={onExportHand} />
        ))}
        {maos.length === 0 && (
          <Card className="p-4 text-center text-xs text-ink-faint">Nenhuma mão com esse filtro.</Card>
        )}
      </div>
    </div>
  );
}

// ── mão (colapsada → expande) ──────────────────────────────────────────────────
function HandCard({
  m,
  onTrainLeak,
  onOpenRule,
  onAskHand,
  onExportHand,
}: {
  m: ReportHand;
  onTrainLeak?: (mode: string) => void;
  onOpenRule?: (id: string) => void;
  onAskHand?: (hand: ReportHand) => void;
  onExportHand?: (hand: ReportHand) => void;
}) {
  const [open, setOpen] = useState(false);
  const dec = DEC_BADGE[m.decision_label ?? ""] ?? DEC_BADGE.insufficient;
  const imp = IMP_BADGE[m.impact_label ?? ""];
  const qualKey = m.hero_action_quality ?? m.decision_label ?? "";
  const qualCls = QUAL_BADGE[qualKey] ?? dec.cls;
  const qualText = m.shown_quality ?? m.shown_label ?? dec.label;
  const mode = trainModeFor(m.spot);
  const ruleId = ruleIdOf(m.regra[0]);
  return (
    <Card className="overflow-hidden p-0">
      <button onClick={() => setOpen((v) => !v)} className="flex w-full items-center gap-3 p-3 text-left">
        {/* marcador de severidade (sem nota numérica) */}
        <span className={cn("h-9 w-1.5 shrink-0 rounded-full", dec.bar)} />
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
          <div className="mt-0.5 flex flex-wrap items-center gap-1">
            <span className={cn("rounded-full px-2 py-0.5 text-2xs font-semibold", qualCls)}>
              {qualText}
            </span>
            {imp && (
              <span className={cn("rounded-full px-2 py-0.5 text-2xs font-medium", imp.cls)}>
                {m.shown_impact ?? imp.label}
              </span>
            )}
          </div>
        </div>
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-ink-faint transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="border-t border-border bg-surface-1/50 p-3 text-xs">
          <HandDetail m={m} />

          {(onAskHand || onExportHand || (ruleId && onOpenRule) || (mode && onTrainLeak)) && (
            <div className="mt-3 flex flex-wrap gap-1.5 border-t border-border pt-3">
              {onExportHand && (
                <LeakBtn primary onClick={() => onExportHand(m)}>
                  <NotebookPen className="h-3.5 w-3.5" /> Enviar para anotações
                </LeakBtn>
              )}
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

// ── Detalhe completo da mão crítica (resumo de hand history) ─────────────────────
function HandDetail({ m }: { m: ReportHand }) {
  const hh = m.hh ?? {};
  const chips = (n: number | null | undefined) => (n == null ? "—" : Number(n).toLocaleString("pt-BR"));
  const bbv = (n: number | null | undefined) => (n == null ? null : `${n}bb`);
  const approx = m.source_type === "DERIVED_FROM_PDF" || m.source_type === "HEURISTIC_LOW_STAKES";
  const wonTxt = hh.hero_won === true ? "ganhou" : hh.hero_won === false ? "perdeu" : "—";

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {/* esquerda: situação + ação */}
      <div className="flex flex-col gap-3">
        <Block title="Situação">
          <Row k="Blinds" v={`${hh.blinds ?? "—"}${hh.ante ? " · com ante" : ""}`} />
          <Row k="Jogadores" v={hh.n_players != null ? `${hh.n_players} restantes` : "—"} />
          <Row k="Stack Hero" v={`${chips(hh.hero_stack_chips)} fichas${bbv(hh.hero_stack_bb) ? ` / ${bbv(hh.hero_stack_bb)}` : ""}`} />
          <Row k={`Stack ${hh.villain_position ?? "vilão"}`} v={hh.villain_stack_chips != null ? `${chips(hh.villain_stack_chips)} fichas / ${bbv(hh.villain_stack_bb)}` : "não disponível"} />
          <Row k="Stack efetivo" v={bbv(hh.effective_stack_bb ?? m.eff_bb) ?? "—"} />
          {m.fase === "bubble" && <Row k="Situação" v="Bolha (ICM ativo)" />}
        </Block>
        <Block title="Ação da mão">
          <p className="text-ink-dim">{hh.preflop_action_summary || "—"}</p>
          {hh.faced_allin && (
            <p className="mt-1 text-ink-faint">All-in enfrentado: {bbv(hh.allin_amount_bb) ?? "—"}</p>
          )}
        </Block>
      </div>

      {/* direita: decisão + regra + resultado */}
      <div className="flex flex-col gap-3">
        <Block title="Decisão">
          <Row k="Você jogou" v={lbl(ACT, m.linha)} />
          <Row k="Recomendado" v={m.insuficiente ? "—" : `${lbl(ACT, m.recomendado)}${m.size_recomendado ? ` (${m.size_recomendado})` : ""}`} />
          {((m.acoes_aceitaveis?.length ?? 0) > 1 || (m.alternativas_avancadas?.length ?? 0) > 0) && (
            <Row
              k="Linhas aceitáveis"
              v={
                <>
                  {(m.acoes_aceitaveis ?? []).map((a) => lbl(ACT, a)).join(" / ")}
                  {(m.alternativas_avancadas?.length ?? 0) > 0 && (
                    <span className="text-ink-faint"> · avançada: {(m.alternativas_avancadas ?? []).map((a) => lbl(ACT, a)).join(" / ")}</span>
                  )}
                </>
              }
            />
          )}
          {m.explicacao && <p className="mt-1 leading-relaxed text-ink-dim">{m.explicacao}</p>}
          {m.quality_note && (
            <p className="mt-1 rounded bg-action-blue/10 px-2 py-1 text-[11px] text-action-blue">{m.quality_note}</p>
          )}
          {approx && (
            <p className="mt-1 rounded bg-gold/10 px-2 py-1 text-[11px] text-gold">
              Aproximação ({m.confidence}). {m.warning ?? "Para precisão exata, usar HRC/ICMizer."}
            </p>
          )}
          {m.outcome === "cooler" && (
            <p className="mt-1 flex items-center gap-1.5 rounded bg-action-blue/10 px-2 py-1 text-action-blue">
              <Sparkles className="h-3.5 w-3.5" /> Decisão correta — perdeu a mão, mas jogou certo.
            </p>
          )}
          {m.insuficiente && m.falta_info.length > 0 && (
            <p className="mt-1 text-ink-faint">Falta: {m.falta_info.join(", ")}</p>
          )}
        </Block>

        {m.regra.length > 0 && (
          <Block title="Regra usada">
            <div className="flex flex-wrap gap-1">
              {m.regra.map((r) => (
                <span key={r} className="rounded bg-surface-2 px-1.5 py-0.5 text-[10px] text-ink-dim">{r}</span>
              ))}
            </div>
          </Block>
        )}

        <Block title="Resultado">
          {hh.went_to_showdown == null && hh.pot_total == null ? (
            <p className="text-ink-faint">Não disponível.</p>
          ) : (
            <>
              <Row k="Showdown" v={hh.went_to_showdown ? "sim" : "não"} />
              <Row k="Hero" v={wonTxt} />
              <Row k="Pote" v={hh.pot_total != null ? `${chips(hh.pot_total)} fichas` : "—"} />
              {hh.hero_net_chips != null && <Row k="Saldo Hero" v={`${chips(hh.hero_net_chips)} fichas`} />}
              <Row k="Vilão mostrou" v={hh.villain_cards ?? (hh.went_to_showdown ? "não revelado" : "—")} />
              {hh.board && hh.board.length > 0 && <Row k="Board" v={hh.board.join(" ")} />}
              <Row k="Hero bustou" v={hh.hero_busted ? "sim" : "não"} />
            </>
          )}
        </Block>
      </div>
    </div>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-ctl border border-border/60 bg-surface-1 p-2.5">
      <div className="mb-1.5 text-2xs font-semibold uppercase tracking-[0.1em] text-ink-faint">{title}</div>
      {children}
    </div>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-2 py-0.5">
      <span className="text-2xs text-ink-faint">{k}</span>
      <span className="text-right text-xs text-ink">{v}</span>
    </div>
  );
}
