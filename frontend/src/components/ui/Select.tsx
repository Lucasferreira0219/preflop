import * as RSelect from "@radix-ui/react-select";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";

export interface SelectOption {
  value: string;
  label: string;
}

export function Select({
  value,
  onValueChange,
  options,
  ariaLabel,
  className,
}: {
  value: string;
  onValueChange: (v: string) => void;
  options: SelectOption[];
  ariaLabel?: string;
  className?: string;
}) {
  return (
    <RSelect.Root value={value} onValueChange={onValueChange}>
      <RSelect.Trigger
        aria-label={ariaLabel}
        className={cn(
          "inline-flex h-9 items-center justify-between gap-2 rounded-ctl border border-border bg-surface-2 px-3 text-sm text-ink",
          "hover:border-border-strong data-[state=open]:border-border-strong outline-none nums",
          className,
        )}
      >
        <RSelect.Value />
        <RSelect.Icon>
          <ChevronDown className="h-4 w-4 text-ink-dim" />
        </RSelect.Icon>
      </RSelect.Trigger>
      <RSelect.Portal>
        <RSelect.Content
          position="popper"
          sideOffset={6}
          className="z-50 overflow-hidden rounded-ctl border border-border bg-surface-2 shadow-pop"
        >
          <RSelect.Viewport className="p-1">
            {options.map((opt) => (
              <RSelect.Item
                key={opt.value}
                value={opt.value}
                className={cn(
                  "relative flex h-8 cursor-pointer select-none items-center rounded-md pl-7 pr-3 text-sm text-ink-dim outline-none nums",
                  "data-[highlighted]:bg-surface-3 data-[highlighted]:text-ink data-[state=checked]:text-ink",
                )}
              >
                <RSelect.ItemIndicator className="absolute left-2">
                  <Check className="h-3.5 w-3.5 text-gold" />
                </RSelect.ItemIndicator>
                <RSelect.ItemText>{opt.label}</RSelect.ItemText>
              </RSelect.Item>
            ))}
          </RSelect.Viewport>
        </RSelect.Content>
      </RSelect.Portal>
    </RSelect.Root>
  );
}
