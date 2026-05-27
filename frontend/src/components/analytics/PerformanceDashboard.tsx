import { useEffect, useMemo, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { StatCard } from "./StatCard";
import { EvolutionChart } from "./EvolutionChart";
import { PerfBreakdown } from "./PerfBreakdown";
import { InsightList } from "./Insights";
import { api } from "@/lib/api";
import { POS_LABEL, SCENARIO_SHORT } from "@/lib/poker";
import type { Analytics, Improvement, PerfEntry } from "@/lib/types";

type Period = "all" | "7" | "30";
const POS_ORDER = ["UTG", "UTG1", "UTG2", "MP", "HJ", "CO", "BTN", "SB", "BB"];
const SCEN_ORDER = ["RFI", "vs_RFI", "vs_3bet"];

function worstKey(map: Record<string, PerfEntry>): string | null {
  let bestKey: string | null = null;
  let bestPct = 101;
  for (const [k, v] of Object.entries(map)) {
    if (v.total < 3) continue;
    const pct = Math.round((v.correct / v.total) * 100);
    if (pct < bestPct) {
      bestPct = pct;
      bestKey = k;
    }
  }
  return bestKey;
}

function rangeFor(period: Period): [number | null, number | null] {
  if (period === "all") return [null, null];
  const now = Math.floor(Date.now() / 1000);
  return [now - parseInt(period) * 86400, now];
}

export function PerformanceDashboard({ onBack }: { onBack: () => void }) {
  const [period, setPeriod] = useState<Period>("all");
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [improvement, setImprovement] = useState<Improvement | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    const [from, to] = rangeFor(period);
    Promise.all([api.getAnalytics(from, to), api.getImprovement(7)])
      .then(([a, imp]) => {
        if (!alive) return;
        setAnalytics(a);
        setImprovement(imp);
      })
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [period]);

  const stackOrder = useMemo(
    () =>
      analytics
        ? Object.keys(analytics.by_stack)
            .map(Number)
            .sort((a, b) => a - b)
            .map(String)
        : [],
    [analytics],
  );

  const a = analytics;
  const worstPos = a ? worstKey(a.by_position) : null;
  const worstScen = a ? worstKey(a.by_scenario) : null;

  return (
    <div className="flex flex-col gap-3">
      {/* Cabeçalho da análise */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack} className="px-2">
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Button>
          <h2 className="text-base font-semibold text-ink">Análise de desempenho</h2>
        </div>
        <SegmentedControl<Period>
          size="sm"
          value={period}
          onChange={setPeriod}
          segments={[
            { value: "all", label: "Tudo" },
            { value: "7", label: "7d" },
            { value: "30", label: "30d" },
          ]}
        />
      </div>

      {!a || a.total === 0 ? (
        <div className="rounded-card border border-border bg-surface-1 p-10 text-center text-sm text-ink-dim">
          {loading ? "Carregando…" : "Nenhuma mão registrada neste período. Jogue algumas mãos para ver sua análise."}
        </div>
      ) : (
        <>
          {/* Seção 1 — Resumo geral */}
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
            <StatCard label="Mãos jogadas" value={a.total} />
            <StatCard label="Precisão" value={`${a.pct}%`} accent="gold" sub={`${a.correct}/${a.total}`} />
            <StatCard label="Streak atual" value={a.streak} accent="gold" />
            <StatCard label="Melhor streak" value={a.best_streak} />
            <StatCard
              label="Pos. difícil"
              value={worstPos ? POS_LABEL[worstPos] || worstPos : "—"}
              accent="red"
              small
            />
            <StatCard
              label="Cenário difícil"
              value={worstScen ? SCENARIO_SHORT[worstScen] || worstScen : "—"}
              accent="red"
              small
            />
          </div>

          {/* Seção 2 — Evolução */}
          <EvolutionChart daily={a.daily} improvement={improvement} />

          {/* Seções 3-5 — breakdowns */}
          <div className="grid gap-3 lg:grid-cols-2">
            <PerfBreakdown
              title="Performance por posição"
              order={POS_ORDER}
              data={a.by_position}
              label={(k) => POS_LABEL[k] || k}
              deltas={improvement?.by_position}
            />
            <PerfBreakdown
              title="Performance por cenário"
              order={SCEN_ORDER}
              data={a.by_scenario}
              label={(k) => SCENARIO_SHORT[k] || k}
              deltas={improvement?.by_scenario}
            />
          </div>

          {stackOrder.length > 0 && (
            <PerfBreakdown
              title="Performance por stack depth"
              order={stackOrder}
              data={a.by_stack}
              label={(k) => `${k}bb`}
              deltas={improvement?.by_stack}
            />
          )}

          {/* Seção 6 — Insights */}
          <InsightList analytics={a} improvement={improvement} />
        </>
      )}
    </div>
  );
}
