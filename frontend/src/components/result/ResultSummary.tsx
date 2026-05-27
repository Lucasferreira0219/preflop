import { Check, X } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { actionDisplayName, handDescription } from "@/lib/poker";
import type { Question, SubmitResult } from "@/lib/types";
import { cn } from "@/lib/cn";

/** Bloco 1 — Feedback: correto/errado, nome da mão, frase clara da escolha. */
export function ResultSummary({
  result,
  question,
  userAction,
}: {
  result: SubmitResult;
  question: Question;
  userAction: string;
}) {
  const correct = result.result === "correct";
  const correctLabel = actionDisplayName(result.correct_action, question.scenario, question.stack);
  const userLabel = actionDisplayName(userAction, question.scenario, question.stack);

  return (
    <Card className="flex items-center gap-4 p-4 sm:p-5">
      <div
        className={cn(
          "grid h-12 w-12 shrink-0 place-items-center rounded-full border",
          correct
            ? "border-action-green/40 bg-action-green/15 text-action-green"
            : "border-action-red/40 bg-action-red/15 text-action-red",
        )}
      >
        {correct ? <Check className="h-6 w-6" /> : <X className="h-6 w-6" />}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2.5">
          <span
            className={cn(
              "text-xs font-bold uppercase tracking-[0.14em]",
              correct ? "text-action-green" : "text-action-red",
            )}
          >
            {correct ? "Correto" : "Errado"}
          </span>
          <span className="h-3.5 w-px bg-border" />
          <span className="text-sm font-bold text-ink nums">{question.hand}</span>
          <span className="hidden truncate text-xs text-ink-dim sm:inline">
            {handDescription(question.hand)}
          </span>
        </div>
        <p className="mt-1 text-[15px] leading-snug text-ink">
          {correct ? (
            <>
              Ação correta: <strong className="font-semibold">{correctLabel}</strong>.
            </>
          ) : (
            <>
              Você escolheu <strong className="font-semibold text-ink-dim">{userLabel}</strong>. O
              correto era <strong className="font-semibold">{correctLabel}</strong>.
            </>
          )}
        </p>
      </div>
    </Card>
  );
}
