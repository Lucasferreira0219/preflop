import { forwardRef } from "react";
import { cn } from "@/lib/cn";

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
  label: string;
}

/** Botão só-ícone com área de clique decente (36px) e tooltip nativo. */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ active, label, className, children, ...props }, ref) => (
    <button
      ref={ref}
      title={label}
      aria-label={label}
      className={cn(
        "inline-flex h-9 w-9 items-center justify-center rounded-ctl border transition-colors",
        active
          ? "border-gold/40 bg-gold/15 text-gold"
          : "border-border bg-surface-2 text-ink-dim hover:border-border-strong hover:bg-surface-3 hover:text-ink",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  ),
);
IconButton.displayName = "IconButton";
