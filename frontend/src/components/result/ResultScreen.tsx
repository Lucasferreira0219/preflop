import { ArrowRight } from "lucide-react";
import { Card, SectionLabel } from "@/components/ui/Card";
import { ResultSummary } from "./ResultSummary";
import { CoachAnalysis } from "./CoachAnalysis";
import { RangeMatrixCard } from "./RangeMatrixCard";
import { FrequencyChips } from "@/components/poker/RangeLegend";
import { Button } from "@/components/ui/Button";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { useApp } from "@/state/AppProvider";
import type { Question, SubmitResult } from "@/lib/types";

/** Tela de resultado. Modo rápido = veredicto + próxima. Modo estudo = análise
 *  didática completa (decisão · por quê · o que aprender · termos) + frequências + range. */
export function ResultScreen({
  result,
  question,
  userAction,
  onNext,
}: {
  result: SubmitResult;
  question: Question;
  userAction: string;
  onNext: () => void;
}) {
  const { studyMode, setStudyMode } = useApp();

  return (
    <div className="flex flex-col gap-3">
      {/* Toggle de modo de treino */}
      <div className="flex items-center justify-end gap-2">
        <span className="text-2xs font-semibold uppercase tracking-[0.12em] text-ink-faint">Modo</span>
        <SegmentedControl<"rapido" | "estudo">
          size="sm"
          value={studyMode ? "estudo" : "rapido"}
          onChange={(v) => setStudyMode(v === "estudo")}
          segments={[
            { value: "rapido", label: "Rápido" },
            { value: "estudo", label: "Estudo" },
          ]}
        />
      </div>

      {/* Bloco 1 — Feedback (sempre) */}
      <ResultSummary result={result} question={question} userAction={userAction} />

      {studyMode && (
        <>
          {/* Bloco 2 — Análise didática */}
          <CoachAnalysis result={result} question={question} />

          {/* Bloco 3 — Frequências */}
          <Card className="p-4 sm:p-5">
            <SectionLabel className="mb-3">Com que frequência jogar cada ação</SectionLabel>
            <FrequencyChips buckets={result.buckets} />
          </Card>

          {/* Bloco 4 — Range completo */}
          <RangeMatrixCard buckets={result.buckets} highlight={question.hand} />
        </>
      )}

      {/* Bloco 5 — Próxima mão */}
      <div className="flex justify-center pt-1">
        <Button variant="gold" size="lg" onClick={onNext} className="min-w-[200px]">
          Próxima mão
          <ArrowRight className="h-4 w-4" />
          <span className="ml-1 rounded bg-black/15 px-1.5 py-0.5 text-2xs font-medium text-gold/80">
            espaço
          </span>
        </Button>
      </div>
    </div>
  );
}
