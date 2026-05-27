import { useState } from "react";
import * as Collapsible from "@radix-ui/react-collapsible";
import { ChevronDown } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { RangeMatrix } from "@/components/poker/RangeMatrix";
import { RangeLegend } from "@/components/poker/RangeLegend";
import type { Buckets } from "@/lib/types";
import { cn } from "@/lib/cn";

/** Bloco 4 — range completo colapsável, com a mão atual destacada. */
export function RangeMatrixCard({ buckets, highlight }: { buckets: Buckets; highlight: string }) {
  const [open, setOpen] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(min-width: 768px)").matches,
  );

  return (
    <Card className="overflow-hidden">
      <Collapsible.Root open={open} onOpenChange={setOpen}>
        <Collapsible.Trigger asChild>
          <button className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium text-ink hover:bg-surface-2">
            <span>Range completo</span>
            <span className="flex items-center gap-2 text-xs text-ink-dim">
              {open ? "Ocultar" : "Ver range"}
              <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
            </span>
          </button>
        </Collapsible.Trigger>
        <Collapsible.Content>
          <div className="grid gap-4 border-t border-border p-4 sm:grid-cols-[1fr_auto] sm:items-start">
            <RangeMatrix buckets={buckets} highlight={highlight} className="sm:max-w-[380px]" />
            <div className="sm:w-[150px]">
              <div className="mb-2 text-2xs font-semibold uppercase tracking-[0.12em] text-ink-faint">
                Legenda
              </div>
              <RangeLegend buckets={buckets} />
              <p className="mt-3 text-2xs leading-relaxed text-ink-faint">
                Borda dourada = sua mão ({highlight}).
              </p>
            </div>
          </div>
        </Collapsible.Content>
      </Collapsible.Root>
    </Card>
  );
}
