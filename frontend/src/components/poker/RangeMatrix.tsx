import { useState } from "react";
import { ACTION_COLOR, RANKS, buildLookup, encodeHand } from "@/lib/poker";
import type { Buckets } from "@/lib/types";
import { cn } from "@/lib/cn";

/** Grade 13×13 colorida por ação. Reutilizada no resultado e na consulta. */
export function RangeMatrix({
  buckets,
  highlight,
  getTooltip,
  className,
}: {
  buckets: Buckets;
  highlight?: string;
  getTooltip?: (hand: string, action: string) => React.ReactNode;
  className?: string;
}) {
  const lookup = buildLookup(buckets);
  const [hover, setHover] = useState<{ x: number; y: number; node: React.ReactNode } | null>(null);

  return (
    <div className={cn("relative", className)}>
      <div
        className="grid aspect-square w-full gap-[2px]"
        style={{ gridTemplateColumns: "repeat(13, minmax(0, 1fr))" }}
      >
        {RANKS.map((r1, i) =>
          RANKS.map((r2, j) => {
            const hand = encodeHand(r1, r2, i, j);
            const action = lookup[hand] || "fold";
            const isFold = action === "fold";
            const isHi = hand === highlight;
            return (
              <div
                key={hand}
                onMouseEnter={(e) =>
                  getTooltip &&
                  setHover({ x: e.clientX, y: e.clientY, node: getTooltip(hand, action) })
                }
                onMouseMove={(e) =>
                  getTooltip && setHover((h) => (h ? { ...h, x: e.clientX, y: e.clientY } : h))
                }
                onMouseLeave={() => setHover(null)}
                className={cn(
                  "flex items-center justify-center rounded-[3px] text-[clamp(6px,1.1vw,11px)] font-semibold leading-none transition-transform",
                  isFold ? "text-ink-faint" : "text-white/95",
                  isHi && "z-10 scale-[1.08] ring-2 ring-gold ring-offset-1 ring-offset-surface-1",
                  getTooltip && "cursor-default hover:brightness-110",
                )}
                style={{ backgroundColor: ACTION_COLOR[action] || "#1B2530" }}
              >
                {hand}
              </div>
            );
          }),
        )}
      </div>

      {hover && hover.node && (
        <div
          className="pointer-events-none fixed z-50 max-w-[220px] rounded-ctl border border-border bg-surface-2 px-3 py-2 text-xs text-ink shadow-pop"
          style={{ left: hover.x + 14, top: hover.y + 14 }}
        >
          {hover.node}
        </div>
      )}
    </div>
  );
}
