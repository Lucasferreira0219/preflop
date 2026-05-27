import { Card, SectionLabel } from "@/components/ui/Card";
import { POS_LABEL, SCENARIO_SHORT } from "@/lib/poker";
import type { Analytics, Improvement, PerfEntry } from "@/lib/types";
import { cn } from "@/lib/cn";

type Tone = "bad" | "good" | "neutral";
interface Insight {
  tone: Tone;
  text: string;
}

const POS_ORDER = ["UTG", "UTG1", "UTG2", "MP", "HJ", "CO", "BTN", "SB", "BB"];

function pctOf(e?: PerfEntry): number | null {
  if (!e || e.total === 0) return null;
  return Math.round((e.correct / e.total) * 100);
}

function worst(map: Record<string, PerfEntry>, minSample = 3): { key: string; pct: number } | null {
  let bestKey: string | null = null;
  let bestPct = 101;
  for (const [k, v] of Object.entries(map)) {
    if (v.total < minSample) continue;
    const pct = Math.round((v.correct / v.total) * 100);
    if (pct < bestPct) {
      bestPct = pct;
      bestKey = k;
    }
  }
  return bestKey ? { key: bestKey, pct: bestPct } : null;
}

export function deriveInsights(a: Analytics, imp: Improvement | null): Insight[] {
  const out: Insight[] = [];
  if (a.total === 0) return out;

  const ws = worst(a.by_scenario);
  if (ws) out.push({ tone: "bad", text: `Seu pior cenário atual: ${SCENARIO_SHORT[ws.key] || ws.key} (${ws.pct}%).` });

  const wp = worst(a.by_position);
  if (wp) out.push({ tone: "bad", text: `Posição com menor precisão: ${POS_LABEL[wp.key] || wp.key} (${wp.pct}%).` });

  // Melhor cenário (reforço positivo)
  let bestScenKey: string | null = null;
  let bestScenPct = -1;
  for (const [k, v] of Object.entries(a.by_scenario)) {
    if (v.total < 3) continue;
    const pct = Math.round((v.correct / v.total) * 100);
    if (pct > bestScenPct) {
      bestScenPct = pct;
      bestScenKey = k;
    }
  }
  if (bestScenKey && (!ws || bestScenKey !== ws.key)) {
    out.push({
      tone: "good",
      text: `Você vai bem em ${SCENARIO_SHORT[bestScenKey] || bestScenKey} (${bestScenPct}%).`,
    });
  }

  // Tendência via improvement
  if (imp && imp.delta_pct != null && imp.recent.total >= 5) {
    if (imp.delta_pct > 0)
      out.push({ tone: "good", text: `Tendência de alta: +${imp.delta_pct}pp vs o período anterior.` });
    else if (imp.delta_pct < 0)
      out.push({ tone: "bad", text: `Atenção: ${imp.delta_pct}pp vs o período anterior.` });
  }

  // Amostra baixa por posição (joga pouco)
  const lowPos = POS_ORDER.filter((p) => {
    const e = a.by_position[p];
    return e === undefined || (e.total > 0 && e.total < 5);
  });
  if (lowPos.length) {
    const labels = lowPos.map((p) => POS_LABEL[p] || p);
    const shown = labels.slice(0, 3).join(", ");
    out.push({
      tone: "neutral",
      text: `Amostra baixa em ${shown}${labels.length > 3 ? ` +${labels.length - 3}` : ""} — treine mais essas posições.`,
    });
  }

  return out;
}

export function InsightList({ analytics, improvement }: { analytics: Analytics; improvement: Improvement | null }) {
  const items = deriveInsights(analytics, improvement);
  if (!items.length) return null;
  return (
    <Card className="p-4 sm:p-5">
      <SectionLabel className="mb-3">Insights</SectionLabel>
      <ul className="flex flex-col gap-2.5">
        {items.map((it, i) => (
          <li key={i} className="flex items-start gap-2.5 text-[13px] leading-relaxed text-ink-dim">
            <span
              className={cn(
                "mt-[6px] h-1.5 w-1.5 shrink-0 rounded-full",
                it.tone === "bad" && "bg-action-red",
                it.tone === "good" && "bg-action-green",
                it.tone === "neutral" && "bg-ink-faint",
              )}
            />
            <span>{it.text}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
