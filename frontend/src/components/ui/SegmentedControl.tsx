import { cn } from "@/lib/cn";

export interface Segment<T extends string> {
  value: T;
  label: React.ReactNode;
}

/**
 * Controle segmentado sólido (sem glow). Usado pra MTT/SnG e filtros de período.
 * Implementação própria (não Radix) pra ter o "thumb" deslizante simples.
 */
export function SegmentedControl<T extends string>({
  value,
  onChange,
  segments,
  size = "md",
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  segments: Segment<T>[];
  size?: "sm" | "md";
  className?: string;
}) {
  const h = size === "sm" ? "h-8" : "h-9";
  const text = size === "sm" ? "text-[13px]" : "text-sm";
  return (
    <div
      role="tablist"
      className={cn(
        "inline-flex items-center gap-1 rounded-ctl border border-border bg-surface-1 p-1",
        className,
      )}
    >
      {segments.map((seg) => {
        const selected = seg.value === value;
        return (
          <button
            key={seg.value}
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(seg.value)}
            className={cn(
              "inline-flex items-center justify-center rounded-md px-3 font-medium transition-colors",
              h,
              text,
              selected
                ? "bg-surface-3 text-ink shadow-[0_1px_0_0_rgba(255,255,255,0.04)_inset]"
                : "text-ink-dim hover:text-ink",
            )}
          >
            {seg.label}
          </button>
        );
      })}
    </div>
  );
}
