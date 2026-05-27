import { Card, SectionLabel } from "@/components/ui/Card";
import type { DeltaEntry, PerfEntry } from "@/lib/types";
import { cn } from "@/lib/cn";

const LOW_SAMPLE = 5;

function band(pct: number): string {
  if (pct >= 80) return "bg-action-green";
  if (pct >= 60) return "bg-gold";
  return "bg-action-red";
}

/** Seção 3-5 — barras horizontais refinadas: acerto + volume + flag de amostra. */
export function PerfBreakdown({
  title,
  order,
  data,
  label,
  deltas,
}: {
  title: string;
  order: string[];
  data: Record<string, PerfEntry>;
  label: (key: string) => string;
  deltas?: Record<string, DeltaEntry>;
}) {
  const rows = order.filter((k) => data[k] !== undefined || true); // mantém ordem, mostra "sem dados"
  return (
    <Card className="p-4 sm:p-5">
      <SectionLabel className="mb-3.5">{title}</SectionLabel>
      <div className="flex flex-col gap-2.5">
        {rows.map((key) => {
          const d = data[key];
          const has = !!d && d.total > 0;
          const pct = has ? Math.round((d.correct / d.total) * 100) : 0;
          const low = has && d.total < LOW_SAMPLE;
          const delta = deltas?.[key]?.delta;

          return (
            <div key={key} className="flex items-center gap-3">
              <div className="w-16 shrink-0 text-[13px] font-medium text-ink-dim">{label(key)}</div>

              <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-surface-3">
                {has && (
                  <div
                    className={cn("absolute inset-y-0 left-0 rounded-full", band(pct), low && "opacity-50")}
                    style={{ width: `${Math.max(pct, 2)}%` }}
                  />
                )}
              </div>

              <div className="flex w-[124px] shrink-0 items-center justify-end gap-1.5 text-right">
                {!has ? (
                  <span className="text-2xs text-ink-faint">sem dados</span>
                ) : (
                  <>
                    {low && (
                      <span className="rounded bg-surface-2 px-1.5 py-0.5 text-[10px] font-medium text-ink-faint">
                        amostra baixa
                      </span>
                    )}
                    <span className="text-[13px] font-semibold text-ink nums">{pct}%</span>
                    <span className="text-2xs text-ink-faint nums">
                      {d!.correct}/{d!.total}
                    </span>
                    {delta != null && delta !== 0 && (
                      <span
                        className={cn(
                          "text-[10px] font-semibold nums",
                          delta > 0 ? "text-action-green" : "text-action-red",
                        )}
                      >
                        {delta > 0 ? "+" : ""}
                        {delta}
                      </span>
                    )}
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
