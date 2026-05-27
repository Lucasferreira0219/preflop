import * as Collapsible from "@radix-ui/react-collapsible";
import { useState } from "react";
import { BookOpen, ChevronDown, GraduationCap, TriangleAlert } from "lucide-react";
import { Card, SectionLabel } from "@/components/ui/Card";
import type { Insights, Mode, Scenario } from "@/lib/types";
import { cn } from "@/lib/cn";

const GLOSSARY_BY_SCENARIO: Record<string, string[]> = {
  RFI: ["RFI", "Limp", "FoldEquity", "FragmentacaoRange"],
  vs_RFI: ["3bet", "ImpliedOdds", "Resteal"],
  vs_3bet: ["4bet", "ChipEV", "EV"],
};
const GLOSSARY_SNG_ALWAYS = ["RP", "ICM"];

function HandLine({ label, hands }: { label: string; hands?: string[] }) {
  if (!hands?.length) return null;
  return (
    <p className="text-[13px] leading-relaxed text-ink-dim">
      <span className="font-semibold text-ink">{label}:</span>{" "}
      <span className="nums">{hands.join(", ")}</span>
    </p>
  );
}

export function ConsultaInsights({
  ins,
  scenario,
  hasHero,
}: {
  ins: Insights | null;
  scenario: Scenario | null;
  hasHero: boolean;
}) {
  const [glossaryOpen, setGlossaryOpen] = useState(false);
  if (!ins) return null;

  const spot = ins.spot;
  const uni = ins.universal_derived;
  const phase = ins.phase;
  const mode = (ins.mode || "mtt") as Mode;

  // Erros comuns (spot + posição)
  const seen = new Set<string>();
  const mistakes = [...(spot?.common_mistakes || []), ...(ins.position_mistakes || [])].filter((m) => {
    if (seen.has(m)) return false;
    seen.add(m);
    return true;
  });

  // Glossário filtrado
  const glossKeys = [...(GLOSSARY_BY_SCENARIO[scenario || ""] || [])];
  if (mode === "sng") glossKeys.push(...GLOSSARY_SNG_ALWAYS);
  const glossItems = glossKeys
    .map((k) => ins.glossary?.[k])
    .filter((g): g is { term: string; definition: string } => !!g);

  const derived = ins.spot_derived || ins.scenario_derived;

  return (
    <div className="flex flex-col gap-3">
      {/* Sobre o spot */}
      {(spot || (uni && hasHero)) && (
        <Card className="p-4 sm:p-5">
          <div className="mb-2 flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-gold" />
            <h3 className="flex-1 text-sm font-semibold text-ink">
              {spot?.title || "Sobre este spot"}
            </h3>
            <span
              className={cn(
                "rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                derived ? "bg-surface-2 text-ink-faint" : "bg-gold/15 text-gold",
              )}
            >
              {derived ? "Derivado" : "Material"}
            </span>
          </div>
          {!spot && (
            <p className="mb-2 text-[13px] leading-relaxed text-ink-faint">
              Spot não coberto diretamente — extrapolado dos princípios gerais.
            </p>
          )}
          {(spot?.summary || uni?.summary) && (
            <p className="text-[13px] leading-relaxed text-ink-dim">{spot?.summary || uni?.summary}</p>
          )}
          <div className="mt-2 space-y-1">
            <HandLine label="Mãos-chave" hands={spot?.key_hands} />
            <HandLine label="3-Bet com" hands={spot?.key_hands_3bet} />
            <HandLine label="Call com" hands={spot?.key_hands_call} />
            <HandLine label="4-Bet com" hands={spot?.key_hands_4bet} />
          </div>
          {spot?.size_recommendation && (
            <p className="mt-2 text-[13px] leading-relaxed text-ink-dim">
              <span className="font-semibold text-ink">Tamanho:</span> {spot.size_recommendation}
            </p>
          )}
          {spot?.icm_note && (
            <div className="mt-3 rounded-ctl border-l-2 border-gold/60 bg-surface-2/60 px-3 py-2 text-[13px] leading-relaxed text-ink-dim">
              <span className="font-semibold text-gold/90">ICM:</span> {spot.icm_note}
            </div>
          )}
        </Card>
      )}

      {/* Como jogar — fase */}
      {phase?.how_to_play?.length ? (
        <Card className="p-4 sm:p-5">
          <div className="mb-2 flex items-center gap-2">
            <GraduationCap className="h-4 w-4 text-action-blue" />
            <h3 className="text-sm font-semibold text-ink">Como jogar — {phase.label}</h3>
          </div>
          {phase.summary && <p className="mb-2 text-[13px] leading-relaxed text-ink-dim">{phase.summary}</p>}
          <ul className="space-y-1.5">
            {phase.how_to_play.map((h, i) => (
              <li key={i} className="flex gap-2 text-[13px] leading-relaxed text-ink-dim">
                <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-action-blue/70" />
                <span>{h}</span>
              </li>
            ))}
          </ul>
          {phase.mentality && (
            <p className="mt-3 border-t border-border pt-3 text-[13px] leading-relaxed text-ink-dim">
              <span className="font-semibold text-ink">Mentalidade:</span> {phase.mentality}
            </p>
          )}
        </Card>
      ) : null}

      {/* Erros comuns */}
      {mistakes.length > 0 && (
        <Card className="p-4 sm:p-5">
          <div className="mb-2 flex items-center gap-2">
            <TriangleAlert className="h-4 w-4 text-action-red" />
            <h3 className="text-sm font-semibold text-ink">Erros comuns</h3>
          </div>
          <ul className="space-y-1.5">
            {mistakes.map((m, i) => (
              <li key={i} className="flex gap-2 text-[13px] leading-relaxed text-ink-dim">
                <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-action-red/70" />
                <span>{m}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* Glossário */}
      {glossItems.length > 0 && (
        <Card className="overflow-hidden">
          <Collapsible.Root open={glossaryOpen} onOpenChange={setGlossaryOpen}>
            <Collapsible.Trigger asChild>
              <button className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-ink hover:bg-surface-2">
                <span>Glossário desta situação</span>
                <ChevronDown className={cn("h-4 w-4 text-ink-dim transition-transform", glossaryOpen && "rotate-180")} />
              </button>
            </Collapsible.Trigger>
            <Collapsible.Content>
              <dl className="space-y-2.5 border-t border-border p-4">
                {glossItems.map((g) => (
                  <div key={g.term}>
                    <dt className="text-[13px] font-semibold text-ink">{g.term}</dt>
                    <dd className="text-[13px] leading-relaxed text-ink-dim">{g.definition}</dd>
                  </div>
                ))}
              </dl>
            </Collapsible.Content>
          </Collapsible.Root>
        </Card>
      )}
    </div>
  );
}
