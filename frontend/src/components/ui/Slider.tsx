import * as RSlider from "@radix-ui/react-slider";
import { cn } from "@/lib/cn";

export function Slider({
  value,
  min,
  max,
  step = 1,
  onValueChange,
  ariaLabel,
  className,
}: {
  value: number;
  min: number;
  max: number;
  step?: number;
  onValueChange: (v: number) => void;
  ariaLabel?: string;
  className?: string;
}) {
  return (
    <RSlider.Root
      className={cn("relative flex h-5 w-full touch-none select-none items-center", className)}
      value={[value]}
      min={min}
      max={max}
      step={step}
      onValueChange={(v) => onValueChange(v[0])}
      aria-label={ariaLabel}
    >
      <RSlider.Track className="relative h-1.5 grow rounded-full bg-surface-3">
        <RSlider.Range className="absolute h-full rounded-full bg-gold/70" />
      </RSlider.Track>
      <RSlider.Thumb
        className="block h-4 w-4 rounded-full border border-gold/60 bg-gold outline-none transition-transform hover:scale-110"
      />
    </RSlider.Root>
  );
}
