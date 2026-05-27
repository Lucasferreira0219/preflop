import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, SectionLabel } from "@/components/ui/Card";
import type { DailyEntry, Improvement } from "@/lib/types";
import { cn } from "@/lib/cn";

const GOLD = "#D2A54A";

export function EvolutionChart({
  daily,
  improvement,
}: {
  daily: DailyEntry[];
  improvement: Improvement | null;
}) {
  const data = daily.slice(-30).map((d) => ({
    day: d.day.slice(5),
    pct: d.pct,
    total: d.total,
    correct: d.correct,
  }));

  const delta = improvement?.delta_pct ?? null;
  const deltaTone = delta == null ? "neutral" : delta > 0 ? "up" : delta < 0 ? "down" : "neutral";

  return (
    <Card className="p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <SectionLabel>Evolução · precisão por dia</SectionLabel>
        {improvement && (improvement.recent.total > 0 || improvement.previous.total > 0) && (
          <div className="flex items-center gap-2 text-xs">
            <span className="text-ink-faint nums">
              {improvement.previous.total ? `${improvement.previous.pct}%` : "—"}
            </span>
            <span className="text-ink-faint">→</span>
            <span className="font-semibold text-ink nums">
              {improvement.recent.total ? `${improvement.recent.pct}%` : "—"}
            </span>
            <span
              className={cn(
                "rounded px-1.5 py-0.5 text-2xs font-semibold nums",
                deltaTone === "up" && "bg-action-green/15 text-action-green",
                deltaTone === "down" && "bg-action-red/15 text-action-red",
                deltaTone === "neutral" && "bg-surface-2 text-ink-faint",
              )}
            >
              {delta == null ? "—" : `${delta > 0 ? "+" : ""}${delta}pp`}
            </span>
          </div>
        )}
      </div>

      {data.length < 2 ? (
        <div className="flex h-[180px] items-center justify-center text-sm text-ink-faint">
          Jogue em mais dias para ver sua evolução.
        </div>
      ) : (
        <div className="mt-4 h-[200px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 6, right: 6, bottom: 0, left: -22 }}>
              <defs>
                <linearGradient id="evoFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={GOLD} stopOpacity={0.28} />
                  <stop offset="100%" stopColor={GOLD} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#273241" strokeDasharray="0" vertical={false} />
              <XAxis
                dataKey="day"
                tick={{ fill: "#5D6875", fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: "#273241" }}
                minTickGap={20}
              />
              <YAxis
                domain={[0, 100]}
                ticks={[0, 50, 100]}
                tick={{ fill: "#5D6875", fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                width={42}
                unit="%"
              />
              <Tooltip content={<EvoTooltip />} cursor={{ stroke: "#33414F", strokeWidth: 1 }} />
              <Area
                type="monotone"
                dataKey="pct"
                stroke={GOLD}
                strokeWidth={2}
                fill="url(#evoFill)"
                dot={{ r: 2.5, fill: GOLD, strokeWidth: 0 }}
                activeDot={{ r: 4, fill: GOLD, stroke: "#0B1016", strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}

function EvoTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-ctl border border-border bg-surface-2 px-3 py-2 text-xs shadow-pop">
      <div className="font-semibold text-ink nums">{p.pct}% precisão</div>
      <div className="mt-0.5 text-ink-faint nums">
        {p.correct}/{p.total} mãos · {p.day}
      </div>
    </div>
  );
}
