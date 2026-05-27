import { useCallback, useEffect, useRef, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { HandDecisionCard } from "@/components/sim/HandDecisionCard";
import { ActionButtons } from "@/components/sim/ActionButtons";
import { ResultScreen } from "@/components/result/ResultScreen";
import { PerformanceDashboard } from "@/components/analytics/PerformanceDashboard";
import { api } from "@/lib/api";
import { getActions, handToCards, type ActionButton, type Card as CardT } from "@/lib/poker";
import {
  historySave,
  lsGet,
  lsSet,
  sm2Accept,
  sm2Key,
  sm2Load,
  sm2Update,
} from "@/lib/storage";
import { useApp } from "@/state/AppProvider";
import type { Question, Stats, SubmitResult } from "@/lib/types";

type Screen = "question" | "result" | "analytics";
const PREFS_KEY = "preflop.sim.prefs.v2";

interface Prefs {
  stack: string;
  focusPos: string;
  focusScenario: string;
}

const EMPTY_STATS: Stats = { total: 0, correct: 0, wrong: 0, pct: 0, streak: 0, best_streak: 0 };

export function SimulatorPage() {
  const { mode } = useApp();

  const [prefs, setPrefs] = useState<Prefs>(() =>
    Object.assign({ stack: "0", focusPos: "", focusScenario: "" }, lsGet<Partial<Prefs>>(PREFS_KEY, {})),
  );
  const prefsRef = useRef(prefs);
  prefsRef.current = prefs;

  const [stats, setStats] = useState<Stats>(EMPTY_STATS);
  const [screen, setScreen] = useState<Screen>("question");
  const [question, setQuestion] = useState<Question | null>(null);
  const [cards, setCards] = useState<[CardT, CardT] | null>(null);
  const [actions, setActions] = useState<ActionButton[]>([]);
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [userAction, setUserAction] = useState<string>("");
  const [pending, setPending] = useState(false);
  const prevScreen = useRef<Screen>("question");

  const sm2 = useRef<Record<string, number>>(sm2Load());

  const persistPrefs = useCallback((next: Prefs) => {
    setPrefs(next);
    lsSet(PREFS_KEY, next);
  }, []);

  // ── Buscar nova pergunta (com SM-2: pula mãos já dominadas) ──────────────────
  const nextQuestion = useCallback(
    async (attempt = 0) => {
      const p = prefsRef.current;
      const stackVal = parseInt(p.stack) || null;
      const res = await api.newQuestion(
        9,
        stackVal,
        p.focusPos || null,
        p.focusScenario || null,
        mode,
      );
      if ("error" in res) {
        console.error(res.error);
        return;
      }
      const q = res as Question;
      if (attempt < 3 && !sm2Accept(sm2.current, sm2Key(q))) {
        return nextQuestion(attempt + 1);
      }
      setQuestion(q);
      setCards(handToCards(q.hand));
      setActions(getActions(q));
      setResult(null);
      setUserAction("");
      setScreen("question");
    },
    [mode],
  );

  // Carrega stats no mount; refetch pergunta quando o modo muda.
  useEffect(() => {
    api.getStats().then(setStats);
  }, []);

  useEffect(() => {
    nextQuestion();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  // ── Submeter resposta ────────────────────────────────────────────────────────
  const submit = useCallback(
    async (action: string) => {
      if (!question || pending) return;
      setPending(true);
      try {
        const res = await api.submitAnswer(action);
        sm2Update(sm2.current, sm2Key(question), res.result === "correct");
        historySave({
          hand: question.hand,
          pos: question.pos,
          scenario: question.scenario,
          stack: question.stack,
          user: action,
          correct: res.correct_action,
          ok: res.result === "correct",
        });
        setStats(res.stats);
        setResult(res);
        setUserAction(action);
        setScreen("result");
      } finally {
        setPending(false);
      }
    },
    [question, pending],
  );

  const onReset = useCallback(() => {
    api.resetStats().then(setStats);
  }, []);

  const openAnalytics = useCallback(() => {
    prevScreen.current = screen === "analytics" ? "question" : screen;
    setScreen("analytics");
  }, [screen]);

  const closeAnalytics = useCallback(() => {
    setScreen(prevScreen.current === "analytics" ? "question" : prevScreen.current);
  }, []);

  // Mudança de filtro: persiste e, se estiver numa pergunta, busca outra na hora.
  const onFilter = useCallback(
    (patch: Partial<Prefs>) => {
      const next = { ...prefsRef.current, ...patch };
      persistPrefs(next);
      if (screen === "question") {
        // usa os novos prefs imediatamente
        prefsRef.current = next;
        nextQuestion();
      }
    },
    [screen, persistPrefs, nextQuestion],
  );

  // ── Atalhos de teclado ───────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === "input" || tag === "select" || tag === "textarea") return;
      if (screen === "question" && /^[1-9]$/.test(e.key)) {
        const idx = parseInt(e.key) - 1;
        if (actions[idx] && !pending) {
          e.preventDefault();
          submit(actions[idx].id);
        }
      } else if (screen === "result" && (e.key === " " || e.key === "Enter")) {
        e.preventDefault();
        nextQuestion();
      } else if ((e.key === "r" || e.key === "R") && e.shiftKey) {
        e.preventDefault();
        onReset();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [screen, actions, pending, submit, nextQuestion, onReset]);

  const handNumber = stats.total + (screen === "result" ? 0 : 1);

  return (
    <div className="min-h-full">
      <AppHeader
        stats={stats}
        handNumber={handNumber}
        stackValue={prefs.stack}
        onStackChange={(v) => onFilter({ stack: v })}
        focusPos={prefs.focusPos}
        onFocusPos={(v) => onFilter({ focusPos: v })}
        focusScenario={prefs.focusScenario}
        onFocusScenario={(v) => onFilter({ focusScenario: v })}
        onReset={onReset}
        onOpenAnalytics={() => (screen === "analytics" ? closeAnalytics() : openAnalytics())}
        analyticsActive={screen === "analytics"}
      />

      <main className="mx-auto w-full max-w-2xl px-3 py-4 sm:px-5 sm:py-6">
        {screen === "analytics" ? (
          <PerformanceDashboard onBack={closeAnalytics} />
        ) : screen === "result" && result && question ? (
          <ResultScreen
            result={result}
            question={question}
            userAction={userAction}
            onNext={() => nextQuestion()}
          />
        ) : question && cards ? (
          <div className="flex flex-col gap-3.5">
            <HandDecisionCard
              hand={question.hand}
              cards={cards}
              pos={question.pos}
              scenario={question.scenario}
              stack={question.stack}
              villainPos={question.villain_pos}
              source={question.source}
            />
            <ActionButtons actions={actions} onPick={submit} disabled={pending} />
          </div>
        ) : (
          <div className="grid place-items-center py-20 text-sm text-ink-faint">Carregando mão…</div>
        )}
      </main>
    </div>
  );
}
