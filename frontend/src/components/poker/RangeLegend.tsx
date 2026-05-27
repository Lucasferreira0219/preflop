import { ACTION_COLOR, ACTION_NAME, buildLookup } from "@/lib/poker";
import type { Buckets } from "@/lib/types";
import { cn } from "@/lib/cn";

const ORDER = ["rfi", "raise", "3bet", "4bet", "shove", "call", "fold"];

// Combos por tipo de mão (baralho de 1326 combos): par=6, suited=4, offsuit=12.
const TOTAL_COMBOS = 1326;
function comboCount(hand: string): number {
  if (hand.length === 2) return 6; // par
  return hand.endsWith("s") ? 4 : 12;
}

/** Percentual por ação ponderado por COMBOS (1326), como o material do curso.
 *  (Antes usava contagem de mãos /169, o que inflava ranges largos.) */
export function rangeFrequencies(buckets: Buckets): Array<{ action: string; combos: number; pct: number }> {
  const lookup = buildLookup(buckets);
  const combos: Record<string, number> = {};
  Object.entries(lookup).forEach(([hand, a]) => {
    combos[a] = (combos[a] || 0) + comboCount(hand);
  });
  const assigned = Object.values(combos).reduce((s, n) => s + n, 0);
  const fold = TOTAL_COMBOS - assigned;
  if (fold > 0) combos.fold = fold;

  const out: Array<{ action: string; combos: number; pct: number }> = [];
  const shown = new Set<string>();
  ORDER.forEach((act) => {
    const key = act === "raise" ? "rfi" : act;
    if (shown.has(key)) return;
    const n = combos[act] || (act === "rfi" ? combos.raise || 0 : 0);
    if (n <= 0) return;
    shown.add(key);
    out.push({ action: key, combos: n, pct: Math.round((n / TOTAL_COMBOS) * 100) });
  });
  return out;
}

/** Chips de frequência discretos e alinhados (Bloco 3 do resultado). */
export function FrequencyChips({ buckets, className }: { buckets: Buckets; className?: string }) {
  const freqs = rangeFrequencies(buckets);
  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {freqs.map((f) => (
        <div
          key={f.action}
          className="inline-flex items-center gap-2 rounded-ctl border border-border bg-surface-2 px-2.5 py-1.5"
        >
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-[3px]"
            style={{ backgroundColor: ACTION_COLOR[f.action] }}
          />
          <span className="text-xs text-ink-dim">{ACTION_NAME[f.action] || f.action}</span>
          <span className="text-xs font-semibold text-ink nums">{f.pct}%</span>
        </div>
      ))}
    </div>
  );
}

/** Legenda vertical com descrição (usada na Consulta). */
export function RangeLegend({ buckets }: { buckets: Buckets }) {
  const freqs = rangeFrequencies(buckets);
  return (
    <div className="flex flex-col gap-1.5">
      {freqs.map((f) => (
        <div key={f.action} className="flex items-center gap-2.5">
          <span
            className="h-3 w-3 shrink-0 rounded-[3px]"
            style={{ backgroundColor: ACTION_COLOR[f.action] }}
          />
          <span className="flex-1 text-xs text-ink-dim">{ACTION_NAME[f.action] || f.action}</span>
          <span className="text-xs font-semibold text-ink nums">{f.pct}%</span>
        </div>
      ))}
    </div>
  );
}
