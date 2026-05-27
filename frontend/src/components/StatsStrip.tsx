import { Flame } from "lucide-react";
import { cn } from "@/lib/cn";
import type { Stats } from "@/lib/types";

/** Linha 3 do cabeçalho — indicadores de produto (precisão, streak, mão #). */
export function StatsStrip({ stats, handNumber }: { stats: Stats; handNumber: number }) {
  const hasData = stats.total > 0;
  const hot = stats.streak >= 5;
  return (
    <div className="flex items-stretch divide-x divide-border border-y border-border bg-surface-1">
      <Cell label="Precisão" className="flex-1">
        <span className={cn("nums", hasData ? "text-ink" : "text-ink-faint")}>
          {hasData ? `${stats.pct}%` : "—"}
        </span>
        {hasData && (
          <span className="ml-1.5 text-xs font-normal text-ink-faint nums">
            {stats.correct}/{stats.total}
          </span>
        )}
      </Cell>
      <Cell label="Streak" className="flex-1">
        <span className={cn("flex items-center gap-1.5 nums", hot ? "text-gold" : "text-ink")}>
          {hot && <Flame className="h-4 w-4" />}
          {stats.streak}
        </span>
        {stats.best_streak > 0 && (
          <span className="ml-1.5 text-xs font-normal text-ink-faint nums">rec {stats.best_streak}</span>
        )}
      </Cell>
      <Cell label="Mão" className="flex-1">
        <span className="text-ink nums">#{handNumber}</span>
      </Cell>
    </div>
  );
}

function Cell({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col justify-center px-4 py-2.5", className)}>
      <span className="text-2xs font-semibold uppercase tracking-[0.14em] text-ink-faint">
        {label}
      </span>
      <span className="mt-0.5 flex items-baseline text-lg font-bold leading-none">{children}</span>
    </div>
  );
}
