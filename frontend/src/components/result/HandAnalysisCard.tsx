import { Card, SectionLabel } from "@/components/ui/Card";
import { ACTION_COLOR, actionDisplayName, normalizeAction } from "@/lib/poker";
import type { Insights, Question, Spot, SubmitResult } from "@/lib/types";

function pickKeyHands(spot: Spot | null, correct: string): string[] {
  if (!spot) return [];
  const norm = normalizeAction(correct);
  if (norm === "3bet" && spot.key_hands_3bet) return spot.key_hands_3bet;
  if (norm === "call" && spot.key_hands_call) return spot.key_hands_call;
  if (norm === "4bet" && spot.key_hands_4bet) return spot.key_hands_4bet;
  return (
    spot.key_hands ||
    spot.key_hands_3bet ||
    spot.key_hands_call ||
    spot.key_hands_4bet ||
    []
  );
}

/** Bloco 2 — ANÁLISE DA MÃO (essencial). Reúne ação correta, porquê, observação
 *  estratégica e leitura didática a partir dos insights do backend. */
export function HandAnalysisCard({
  result,
  question,
}: {
  result: SubmitResult;
  question: Question;
}) {
  const ins: Insights | null = result.insights;
  const correct = result.correct_action;
  const norm = normalizeAction(correct);

  const action = ins?.action;
  const actionName = action?.name || actionDisplayName(correct, question.scenario, question.stack);
  const actionColor = action?.color || ACTION_COLOR[norm] || "#5D6875";

  const spot = ins?.spot ?? null;
  const uni = ins?.universal_derived;
  const phase = ins?.phase;

  const why = spot?.summary || uni?.summary || action?.long_desc || "";
  const strategicNote = spot?.icm_note || ins?.stack_context?.narrative || phase?.mentality || "";
  const keyHands = pickKeyHands(spot, correct);

  // Erros comuns (deduplicados)
  const seen = new Set<string>();
  const mistakes: string[] = [];
  [
    ...(spot?.common_mistakes || []),
    ...(uni?.common_mistakes || []),
    ...(ins?.position_mistakes || []),
  ].forEach((m) => {
    if (m && !seen.has(m)) {
      seen.add(m);
      mistakes.push(m);
    }
  });

  const derivedFlag = ins?.spot_derived
    ? "Spot derivado dos princípios do material"
    : ins?.scenario_derived
      ? "Range derivado dos princípios do material"
      : null;

  return (
    <Card className="p-4 sm:p-5">
      <SectionLabel className="mb-3">Análise da mão</SectionLabel>

      {/* Ação correta */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-ink-dim">Ação correta:</span>
        <span
          className="inline-flex items-center rounded-md px-2.5 py-1 text-sm font-semibold text-white"
          style={{ backgroundColor: actionColor }}
        >
          {action?.emoji ? `${action.emoji} ` : ""}
          {actionName}
        </span>
      </div>

      {action?.long_desc && (
        <p className="mt-2.5 text-[13px] leading-relaxed text-ink-dim">{action.long_desc}</p>
      )}

      {/* Por quê */}
      {why && why !== action?.long_desc && (
        <div className="mt-4">
          <div className="text-[13px] font-semibold text-ink">Por que {actionName}?</div>
          <p className="mt-1 text-[13px] leading-relaxed text-ink-dim">{why}</p>
        </div>
      )}

      {/* Observação estratégica */}
      {strategicNote && (
        <div className="mt-4 rounded-ctl border-l-2 border-gold/60 bg-surface-2/60 px-3 py-2.5">
          <div className="text-2xs font-semibold uppercase tracking-[0.12em] text-gold/90">
            Observação estratégica
          </div>
          <p className="mt-1 text-[13px] leading-relaxed text-ink-dim">{strategicNote}</p>
        </div>
      )}

      {/* Mãos-chave do range */}
      {keyHands.length > 0 && (
        <div className="mt-4">
          <div className="text-[13px] font-semibold text-ink">Mãos-chave do range</div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {keyHands.map((h) => (
              <span
                key={h}
                className="rounded-md border border-border bg-surface-2 px-2 py-1 text-xs font-medium text-ink-dim nums"
              >
                {h}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Leitura didática — erros comuns */}
      {mistakes.length > 0 && (
        <div className="mt-4">
          <div className="text-[13px] font-semibold text-ink">Evite estes erros</div>
          <ul className="mt-1.5 space-y-1.5">
            {mistakes.slice(0, 4).map((m, i) => (
              <li key={i} className="flex gap-2 text-[13px] leading-relaxed text-ink-dim">
                <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-ink-faint" />
                <span>{m}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Rodapé: fase / origem */}
      {(phase || derivedFlag) && (
        <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border pt-3 text-2xs text-ink-faint">
          {phase && (
            <span className="font-medium uppercase tracking-wide">
              {phase.label}
              {phase.rp_avg_pct != null ? ` · RP ~${phase.rp_avg_pct}%` : ""}
              {ins?.open_pct != null ? ` · ${ins.open_pct}% open` : ""}
            </span>
          )}
          {derivedFlag && <span className="italic">⚙ {derivedFlag}</span>}
        </div>
      )}

      {/* Fallback mínimo */}
      {!why && !strategicNote && !mistakes.length && !keyHands.length && !action?.long_desc && (
        <p className="mt-2 text-[13px] leading-relaxed text-ink-dim">
          A ação recomendada neste spot é <strong className="text-ink">{actionName}</strong>.
        </p>
      )}
    </Card>
  );
}
