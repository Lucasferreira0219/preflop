import { Card } from "@/components/ui/Card";
import { Tooltip } from "@/components/ui/Tooltip";
import { PositionRing } from "@/components/poker/PositionRing";
import { PlayingCards } from "@/components/poker/PlayingCards";
import { POS_FULL, POS_LABEL, SCENARIO_SHORT, handDescription, type Card as CardT } from "@/lib/poker";
import { POS_HINT, SCENARIO_HELP } from "@/lib/glossary";
import { SourceBadge } from "@/components/SourceBadge";
import type { Scenario, SpotSource } from "@/lib/types";
import { cn } from "@/lib/cn";

function scenarioLine(scenario: Scenario, villainPos: string | null): string {
  if (scenario === "RFI") return "Abrir (RFI)";
  const v = villainPos ? POS_LABEL[villainPos] || villainPos : "vilão";
  if (scenario === "vs_RFI") return `vs Abertura · ${v}`;
  return `vs 3-Bet · ${v}`;
}

export function HandDecisionCard({
  hand,
  cards,
  pos,
  scenario,
  stack,
  villainPos,
  source,
}: {
  hand: string;
  cards: [CardT, CardT];
  pos: string;
  scenario: Scenario;
  stack: number;
  villainPos: string | null;
  source?: SpotSource;
}) {
  return (
    <Card className="overflow-hidden">
      {source && (
        <div className="flex justify-end px-3 pt-3">
          <SourceBadge source={source} />
        </div>
      )}
      {/* Contexto da mão — cada item tem ajuda curta */}
      <div className="grid grid-cols-3 divide-x divide-border border-b border-border">
        <Ctx label="Stack" value={`${stack} BB`} help="Stack: quantas fichas você tem, medido em BBs (big blinds)." />
        <Ctx label="Posição" value={POS_LABEL[pos] || pos} help={`${POS_FULL[pos]} — ${POS_HINT[pos] || "sua ordem de jogada na mesa."}`} />
        <Ctx label="Cenário" value={SCENARIO_SHORT[scenario]} help={`${scenarioLine(scenario, villainPos)} — ${SCENARIO_HELP[scenario]}`} />
      </div>

      <div className="px-4 pt-4 sm:px-6">
        <PositionRing heroPos={pos} villainPos={villainPos} scenario={scenario} stack={stack} />
      </div>

      {/* Cartas — foco visual */}
      <div className="flex flex-col items-center px-4 pb-2 pt-1">
        <PlayingCards cards={cards} size="lg" />
        <div className="mt-3 text-center">
          <span className="text-sm font-semibold text-ink nums">{hand}</span>
          <span className="ml-2 text-xs text-ink-dim">{handDescription(hand)}</span>
        </div>
      </div>

      <div className="border-t border-border px-4 py-3 text-center">
        <span className="text-[13px] font-medium uppercase tracking-[0.12em] text-ink-dim">
          Qual é a sua ação?
        </span>
      </div>
    </Card>
  );
}

function Ctx({ label, value, help }: { label: string; value: string; help: string }) {
  return (
    <div className="px-3 py-2.5 text-center">
      <Tooltip content={help}>
        <button
          type="button"
          className={cn(
            "text-2xs font-semibold uppercase tracking-[0.14em] text-ink-faint",
            "cursor-help underline decoration-dotted decoration-ink-faint/50 underline-offset-2 hover:text-ink-dim",
          )}
        >
          {label}
        </button>
      </Tooltip>
      <div className="mt-0.5 text-base font-bold leading-tight text-ink nums">{value}</div>
    </div>
  );
}
