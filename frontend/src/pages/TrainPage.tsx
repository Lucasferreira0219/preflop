import { useCallback, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowLeft, BarChart3, BookOpen, Check, ChevronRight, Flag, HelpCircle, Loader2, RotateCcw, Target, X,
} from "lucide-react";
import { BrandBar } from "@/components/layout/BrandBar";
import { Button } from "@/components/ui/Button";
import { Card, SectionLabel } from "@/components/ui/Card";
import { PkeBadge } from "@/components/PkeBadge";
import { PerformanceDashboard } from "@/components/analytics/PerformanceDashboard";
import { api } from "@/lib/api";
import { useApp } from "@/state/AppProvider";
import type { SimCorrection, SimError, SimSession, SimSpot } from "@/lib/types";
import { cn } from "@/lib/cn";

const MODES = [
  { key: "livre", label: "Treino livre" },
  { key: "leaks", label: "Meus leaks" },
  { key: "push_fold", label: "Push/Fold" },
  { key: "resteal_short", label: "Resteal" },
  { key: "vs_open_3bet", label: "vs Open" },
  { key: "limp_punish", label: "Limp punish" },
  { key: "rfi", label: "RFI" },
  { key: "bb_defense", label: "Defesa BB" },
  { key: "hu_btn", label: "HU botão" },
];
const ACTIONS = [
  { a: "fold", label: "Fold", cls: "border-border text-ink-dim" },
  { a: "call", label: "Call", cls: "border-action-blue/40 text-action-blue" },
  { a: "raise", label: "Raise", cls: "border-gold/40 text-gold" },
  { a: "3bet", label: "3-bet", cls: "border-gold/40 text-gold" },
  { a: "shove", label: "Shove", cls: "border-action-red/40 text-action-red" },
  { a: "check", label: "Check", cls: "border-border text-ink-dim" },
];
const CAT_LABEL: Record<string, string> = {
  push_fold: "Push/Fold", resteal_short: "Resteal", vs_open_3bet: "vs Open",
  limp_punish: "Limp punish", rfi: "RFI", bb_defense: "Defesa BB", hu_btn: "HU botão",
};
const PHASE_LABEL: Record<string, string> = {
  early: "Early", middle: "Middle", bubble: "Bolha", itm: "ITM", "3handed": "3-handed", heads_up: "Heads-up",
};
const ACT_LABEL: Record<string, string> = {
  shove: "Shove (all-in)", raise: "Raise", "3bet": "3-bet", call: "Call", fold: "Fold", check: "Check", bet: "Aposta",
};

function beforeLabel(s: SimSpot): string {
  if (s.action_before_hero === "folded_to_hero") return "Todos foldaram até você";
  if (s.action_before_hero.startsWith("limp")) return `${s.opener_position} deu limp`;
  if (s.action_before_hero.startsWith("shove")) return `${s.opener_position} foi all-in`;
  return `${s.opener_position} abriu (raise)`;
}
function notaCls(n: number | null) {
  if (n == null) return "bg-surface-2 text-ink-faint";
  if (n >= 9) return "bg-action-green/20 text-action-green";
  if (n >= 6) return "bg-gold/20 text-gold";
  if (n >= 4) return "bg-orange-500/20 text-orange-400";
  return "bg-action-red/20 text-action-red";
}

export function TrainPage() {
  const navigate = useNavigate();
  const { openRule } = useApp();
  const [params] = useSearchParams();
  const initialMode = params.get("mode") || "livre";
  const fromLeak = params.get("from") === "leak" || initialMode === "leaks";
  const [mode, setMode] = useState(initialMode);
  const [reviewing, setReviewing] = useState(false);
  const [spot, setSpot] = useState<SimSpot | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fb, setFb] = useState<SimCorrection | null>(null);
  const [session, setSession] = useState<SimSession | null>(null);
  const [finished, setFinished] = useState(false);
  const [showStats, setShowStats] = useState(false);

  const refreshSession = useCallback(async () => {
    try { setSession(await api.pkeSimSession()); } catch { /* ignore */ }
  }, []);

  const loadSpot = useCallback(async (m: string) => {
    setLoading(true);
    setFb(null);
    setError(null);
    setFinished(false);
    try {
      const s = await api.pkeSimNew(m);
      if ((s as any).error) { setError((s as any).error); setSpot(null); }
      else setSpot(s);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao gerar spot.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadSpot(initialMode); refreshSession(); }, [loadSpot, refreshSession, initialMode]);

  async function answer(a: string) {
    if (!spot || fb) return;
    try {
      const r = await api.pkeSimAnswer(spot.spot_id, a);
      if ((r as any).error) { setError((r as any).error); return; }
      setFb(r);
      await refreshSession();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao avaliar.");
    }
  }

  function pickMode(m: string) { setReviewing(false); setMode(m); loadSpot(m); }
  function nextSpot() { loadSpot(reviewing ? "review" : mode); }
  function startReview() { setReviewing(true); setFinished(false); loadSpot("review"); }
  async function finish() { await refreshSession(); setFinished(true); }
  async function newSession() { await api.pkeSimReset(); setReviewing(false); setSession(null); setFinished(false); loadSpot(mode); }

  return (
    <div className="min-h-full">
      <header className="sticky top-0 z-30 border-b border-border bg-bg/85 backdrop-blur-md">
        <BrandBar
          title="Treinar"
          actions={
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" onClick={() => setShowStats((v) => !v)}>
                <BarChart3 className="h-4 w-4" /><span className="hidden sm:inline">Evolução</span>
              </Button>
              <Button variant="ghost" size="sm" onClick={finish}><Flag className="h-4 w-4" /><span className="hidden sm:inline">Encerrar</span></Button>
              <Button variant="ghost" size="sm" onClick={() => navigate("/")}><ArrowLeft className="h-4 w-4" /><span className="hidden sm:inline">Início</span></Button>
            </div>
          }
        />
      </header>

      {showStats ? (
        <div className="mx-auto w-full max-w-2xl px-3 py-4 sm:px-5 sm:py-6">
          <PerformanceDashboard onBack={() => setShowStats(false)} />
        </div>
      ) : (
      <div className="mx-auto w-full max-w-xl px-4 py-5">
        {/* Modos */}
        <div className="flex flex-wrap gap-1.5">
          {MODES.map((m) => (
            <button key={m.key} onClick={() => pickMode(m.key)}
              className={cn("rounded-full border px-3 py-1 text-2xs font-semibold transition-colors",
                mode === m.key ? "border-gold/50 bg-gold/15 text-gold" : "border-border bg-surface-1 text-ink-dim hover:text-ink")}>
              {m.label}
            </button>
          ))}
        </div>

        {fromLeak && (
          <div className="mt-3">
            <PkeBadge variant="treino_leaks" />
          </div>
        )}

        {/* Stats da sessão */}
        {session && session.maos > 0 && (
          <div className="mt-3 flex items-center gap-3 rounded-ctl border border-border bg-surface-1 px-3 py-2 text-xs">
            <span className="text-ink-dim">Mãos <b className="text-ink nums">{session.maos}</b></span>
            <span className="text-ink-dim">Acertos <b className="text-action-green nums">{session.acertos}</b></span>
            <span className="text-ink-dim">Média <b className={cn("nums", session.media_notas != null && session.media_notas >= 7 ? "text-action-green" : session.media_notas != null && session.media_notas < 5 ? "text-action-red" : "text-gold")}>{session.media_notas ?? "—"}</b></span>
          </div>
        )}

        {reviewing && !finished && (
          <div className="mt-3 flex items-center gap-1.5 rounded-ctl border border-gold/30 bg-gold/10 px-3 py-1.5 text-2xs font-semibold text-gold">
            <Target className="h-3.5 w-3.5" /> Revisando seus erros
          </div>
        )}

        {finished ? (
          <SessionSummary session={session} onNew={newSession}
            onContinue={() => setFinished(false)} onReview={startReview} />
        ) : (
          <>
            {error && (
              <Card className="mt-4 flex items-center gap-2 border-action-red/30 p-3 text-sm text-action-red">
                <X className="h-4 w-4 shrink-0" />{error}
              </Card>
            )}

            {loading && (
              <Card className="mt-4 flex items-center justify-center gap-2 p-8 text-sm text-ink-dim">
                <Loader2 className="h-4 w-4 animate-spin" /> Gerando spot…
              </Card>
            )}

            {!loading && spot && (
              <>
                <HandCard spot={spot} />
                {/* Botões de ação */}
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {ACTIONS.map((b) => (
                    <button key={b.a} onClick={() => answer(b.a)} disabled={!!fb}
                      className={cn("rounded-card border-2 py-3 text-sm font-bold transition-colors",
                        b.cls, fb ? "opacity-40" : "hover:bg-surface-2 active:bg-surface-3")}>
                      {b.label}
                    </button>
                  ))}
                </div>

                {fb && <Feedback fb={fb} onNext={nextSpot} onOpenRule={openRule} />}
              </>
            )}
          </>
        )}
      </div>
      )}
    </div>
  );
}

function HandCard({ spot }: { spot: SimSpot }) {
  return (
    <Card className="mt-4 p-4">
      <div className="flex items-center justify-between gap-2 text-2xs text-ink-faint">
        <span className="rounded-full bg-surface-2 px-2 py-0.5 font-semibold text-ink-dim">{CAT_LABEL[spot.category] ?? spot.category}</span>
        <span>{PHASE_LABEL[spot.phase ?? ""] ?? spot.phase} · {spot.players_left} jogadores</span>
      </div>
      <div className="mt-3 flex items-center justify-center gap-3">
        <span className="rounded-ctl border border-border bg-surface-2 px-3 py-2 text-sm font-semibold text-ink-dim">{spot.hero_position}</span>
        <span className="font-mono text-4xl font-bold tracking-wide text-ink">{spot.hero_cards}</span>
        <span className="rounded-ctl border border-border bg-surface-2 px-3 py-2 text-sm font-bold text-ink nums">{Math.round(spot.effective_stack_bb)}bb</span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 border-t border-border pt-3 text-2xs text-ink-faint sm:grid-cols-3">
        <Info label="Blinds">{spot.blinds}</Info>
        <Info label="Ante">{spot.ante ? "Sim" : "Não"}</Info>
        <Info label="Ação antes">{beforeLabel(spot)}</Info>
      </div>
      <p className="mt-3 text-center text-sm text-ink">{spot.question}</p>
    </Card>
  );
}

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="uppercase tracking-[0.08em]">{label}</span>
      <span className="text-ink-dim">{children}</span>
    </div>
  );
}

function Feedback({ fb, onNext, onOpenRule }: { fb: SimCorrection; onNext: () => void; onOpenRule?: (id: string) => void }) {
  return (
    <Card className={cn("mt-3 p-4", fb.correct ? "border-action-green/30" : "border-action-red/30")}>
      <div className="mb-2 flex justify-end">
        <PkeBadge variant="correcao" />
      </div>
      <div className="flex items-center gap-3">
        <span className={cn("grid h-11 w-11 shrink-0 place-items-center rounded-xl text-lg font-bold tabular-nums", notaCls(fb.score))}>
          {fb.score ?? "—"}
        </span>
        <div>
          <div className={cn("flex items-center gap-1.5 text-sm font-bold", fb.correct ? "text-action-green" : "text-action-red")}>
            {fb.correct ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
            {fb.correct ? "Correto" : "Incorreto"}
          </div>
          <div className="text-xs text-ink-dim">
            Melhor ação: <b className="text-ink">{ACT_LABEL[fb.recommended_action ?? ""] ?? fb.recommended_action ?? "—"}</b>
          </div>
        </div>
      </div>

      {fb.explanation && <p className="mt-3 text-[13px] leading-relaxed text-ink-dim">{fb.explanation}</p>}

      {fb.rule_refs.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-2xs">
          <BookOpen className="h-3.5 w-3.5 text-action-blue" />
          {fb.rule_refs.map((r) => (
            <button
              key={r.id}
              onClick={() => onOpenRule?.(r.id)}
              disabled={!onOpenRule}
              className="rounded bg-surface-2 px-1.5 py-0.5 text-ink-dim transition-colors hover:text-ink disabled:cursor-default"
            >
              <b className="text-ink">{r.id}</b>{r.source ? ` · ${r.source}` : ""}{r.page != null ? ` p${r.page}` : ""}
            </button>
          ))}
        </div>
      )}

      {fb.common_mistake && (
        <p className="mt-2 flex items-start gap-1.5 text-2xs text-ink-faint">
          <HelpCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-action-red" /> Erro comum: {fb.common_mistake}
        </p>
      )}

      <Button variant="primary" size="sm" className="mt-4 w-full" onClick={onNext}>
        Próxima mão <ChevronRight className="h-4 w-4" />
      </Button>
    </Card>
  );
}

function SessionSummary({ session, onNew, onContinue, onReview }: {
  session: SimSession | null; onNew: () => void; onContinue: () => void; onReview: () => void;
}) {
  if (!session || session.maos === 0) {
    return (
      <Card className="mt-4 p-6 text-center text-sm text-ink-dim">
        Nenhuma mão respondida ainda nesta sessão.
        <div className="mt-3"><Button variant="primary" size="sm" onClick={onContinue}>Treinar</Button></div>
      </Card>
    );
  }
  const VERDICT: Record<string, string> = {
    bom: "text-action-green", melhorando: "text-gold", "ainda fraco": "text-action-red",
    "não treinado": "text-ink-faint",
  };
  return (
    <div className="mt-4 flex flex-col gap-3">
      <Card className="p-4">
        <SectionLabel className="mb-2">Resumo da sessão</SectionLabel>
        <div className="grid grid-cols-3 gap-2">
          <Stat label="Mãos" value={session.maos} />
          <Stat label="Acertos" value={session.acertos} tone="green" />
          <Stat label="Média" value={session.media_notas ?? "—"} />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-ctl bg-surface-2/50 p-2.5">
            <div className="text-2xs uppercase tracking-[0.08em] text-ink-faint">Melhor categoria</div>
            <div className="text-action-green">{CAT_LABEL[session.melhor_categoria ?? ""] ?? "—"}</div>
          </div>
          <div className="rounded-ctl bg-surface-2/50 p-2.5">
            <div className="text-2xs uppercase tracking-[0.08em] text-ink-faint">Pior categoria</div>
            <div className="text-action-red">{CAT_LABEL[session.pior_categoria ?? ""] ?? "—"}</div>
          </div>
        </div>
      </Card>

      {/* Desempenho nos leaks treinados (modo Meus leaks) */}
      {session.desempenho_leaks.length > 0 && (
        <Card className="p-4">
          <SectionLabel className="mb-2 flex items-center gap-1.5">
            <Target className="h-3.5 w-3.5" /> Como você foi nos seus leaks
            {session.source_tid && <span className="ml-1 text-ink-faint normal-case">(torneio #{session.source_tid})</span>}
          </SectionLabel>
          <div className="flex flex-col gap-1">
            {session.desempenho_leaks.map((d) => (
              <div key={d.category} className="flex items-center justify-between rounded-ctl border border-border/60 bg-surface-1 px-3 py-1.5 text-xs">
                <span className="text-ink">{CAT_LABEL[d.category] ?? d.category}</span>
                <span className={cn("nums", VERDICT[d.verdict] ?? "text-ink-dim")}>
                  {d.media != null ? `média ${d.media} · ${d.verdict}` : d.verdict}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Revisão de erros */}
      {session.erros.length > 0 && (
        <Card className="p-4">
          <div className="mb-2 flex items-center justify-between">
            <SectionLabel>Erros para revisar ({session.erros.length})</SectionLabel>
            <Button variant="primary" size="sm" onClick={onReview}>
              <Target className="h-4 w-4" /> Treinar esses erros
            </Button>
          </div>
          <div className="flex flex-col gap-2">
            {session.erros.map((e, i) => <ErrorRow key={i} e={e} />)}
          </div>
        </Card>
      )}

      {session.recomendar_treinar && (
        <p className="rounded-ctl bg-gold/10 px-3 py-2 text-xs text-gold">
          Recomendado treinar a seguir: <b>{CAT_LABEL[session.recomendar_treinar] ?? session.recomendar_treinar}</b>
        </p>
      )}
      <div className="flex gap-2">
        <Button variant="primary" size="sm" className="flex-1" onClick={onContinue}>Continuar treinando</Button>
        <Button variant="ghost" size="sm" onClick={onNew}><RotateCcw className="h-4 w-4" /> Nova sessão</Button>
      </div>
    </div>
  );
}

function ErrorRow({ e }: { e: SimError }) {
  return (
    <div className="rounded-ctl border border-action-red/20 bg-surface-1 p-2.5 text-xs">
      <div className="flex items-center gap-2">
        <span className={cn("grid h-7 w-7 shrink-0 place-items-center rounded-lg text-2xs font-bold tabular-nums", notaCls(e.score))}>
          {e.score ?? "—"}
        </span>
        <span className="rounded border border-border bg-surface-2 px-1.5 py-0.5 text-2xs text-ink-dim">{e.hero_position}</span>
        <span className="font-mono text-sm font-bold text-ink">{e.hero_cards}</span>
        <span className="text-2xs text-ink-faint">{Math.round(e.effective_stack_bb)}bb · {CAT_LABEL[e.category] ?? e.category}</span>
      </div>
      <div className="mt-1.5 text-ink-dim">
        Você: <span className="text-action-red">{ACT_LABEL[e.hero_answer] ?? e.hero_answer}</span>
        {"  ·  "}Certo: <span className="font-semibold text-action-green">{ACT_LABEL[e.recommended_action ?? ""] ?? e.recommended_action}</span>
      </div>
      {e.rule_refs.length > 0 && (
        <div className="mt-1 text-2xs text-ink-faint">
          {e.rule_refs.map((r) => `${r.id}${r.page != null ? ` p${r.page}` : ""}`).join(" · ")}
        </div>
      )}
      {e.explanation && <div className="mt-1 text-2xs text-ink-faint">{e.explanation}</div>}
    </div>
  );
}

function Stat({ label, value, tone = "ink" }: { label: string; value: number | string; tone?: "ink" | "green" }) {
  return (
    <div className="rounded-ctl bg-surface-2/50 p-2.5 text-center">
      <div className={cn("text-xl font-bold nums", tone === "green" ? "text-action-green" : "text-ink")}>{value}</div>
      <div className="text-2xs uppercase tracking-[0.08em] text-ink-faint">{label}</div>
    </div>
  );
}
