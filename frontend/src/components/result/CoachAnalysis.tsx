import { Card, SectionLabel } from "@/components/ui/Card";
import { ACTION_COLOR, actionDisplayName, normalizeAction } from "@/lib/poker";
import { coachExplain } from "@/lib/coach";
import { GLOSSARY_MAP } from "@/lib/glossary";
import { SourceBadge } from "@/components/SourceBadge";
import { useApp } from "@/state/AppProvider";
import type { Question, SubmitResult } from "@/lib/types";

const SOURCE_NOTE: Record<string, string> = {
  derivado:
    "Este spot não está no material do curso. A resposta vem de uma extrapolação dos princípios que o curso ensina (3-bet só premium, call seletivo por posição) — trate como orientação, não como gabarito do curso.",
  sem_material:
    "O modo MTT não tem material de referência neste curso (que é de SnG). Use esta mão como treino geral, não validado pelo curso.",
};

/** Análise didática em formato de treinador (modo estudo):
 *  Decisão correta · Por quê · O que aprender · Tradução dos termos. */
export function CoachAnalysis({ result, question }: { result: SubmitResult; question: Question }) {
  const { setGlossaryOpen } = useApp();
  const correct = result.correct_action;
  const norm = normalizeAction(correct);
  const label = actionDisplayName(correct, question.scenario, question.stack);
  const color = ACTION_COLOR[norm] || "#5D6875";

  const coach = coachExplain({
    hand: question.hand,
    scenario: question.scenario,
    correctAction: correct,
    pos: question.pos,
    stack: question.stack,
  });

  const terms = coach.terms.map((id) => GLOSSARY_MAP[id]).filter(Boolean);

  const sourceNote = question.source ? SOURCE_NOTE[question.source] : undefined;

  return (
    <Card className="p-4 sm:p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <SectionLabel>Análise da mão</SectionLabel>
        <SourceBadge source={question.source} />
      </div>

      {/* 1 · Decisão correta */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-ink-dim">Decisão correta:</span>
        <span
          className="inline-flex items-center rounded-md px-2.5 py-1 text-sm font-semibold text-white"
          style={{ backgroundColor: color }}
        >
          {label}
        </span>
      </div>

      {/* 2 · Por que? */}
      <div className="mt-4">
        <div className="text-[13px] font-semibold text-ink">Por que {label}?</div>
        <p className="mt-1 text-[13px] leading-relaxed text-ink-dim">{coach.why}</p>
      </div>

      {/* 3 · O que aprender? */}
      <div className="mt-3 rounded-ctl border-l-2 border-gold/60 bg-surface-2/60 px-3 py-2.5">
        <div className="text-2xs font-semibold uppercase tracking-[0.12em] text-gold/90">
          O que aprender
        </div>
        <p className="mt-1 text-[13px] leading-relaxed text-ink-dim">{coach.lesson}</p>
      </div>

      {/* 4 · Tradução dos termos */}
      {terms.length > 0 && (
        <div className="mt-4">
          <div className="mb-1.5 flex items-center justify-between">
            <div className="text-[13px] font-semibold text-ink">Termos desta mão</div>
            <button
              onClick={() => setGlossaryOpen(true)}
              className="text-2xs font-medium text-ink-faint underline decoration-dotted underline-offset-2 hover:text-gold"
            >
              ver glossário
            </button>
          </div>
          <dl className="space-y-1.5">
            {terms.map((t) => (
              <div key={t.id} className="text-[13px] leading-relaxed">
                <span className="font-semibold text-ink">{t.term}</span>
                <span className="text-ink-dim"> — {t.short}</span>
              </div>
            ))}
          </dl>
        </div>
      )}

      {/* Proveniência — avisa quando o spot não vem do material do curso */}
      {sourceNote && (
        <p className="mt-4 border-t border-border pt-3 text-2xs leading-relaxed text-ink-faint">
          {sourceNote}
        </p>
      )}
    </Card>
  );
}
