import { forwardRef } from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "gold" | "subtle" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-action-blue text-white hover:bg-[#3D6BEC] active:bg-[#3560D8] border border-transparent",
  gold:
    "bg-gold/15 text-gold border border-gold/35 hover:bg-gold/25 active:bg-gold/30",
  subtle:
    "bg-surface-2 text-ink border border-border hover:bg-surface-3 hover:border-border-strong",
  ghost:
    "bg-transparent text-ink-dim border border-transparent hover:bg-surface-2 hover:text-ink",
  danger:
    "bg-transparent text-action-red border border-transparent hover:bg-action-red/12",
};

const SIZES: Record<Size, string> = {
  sm: "h-8 px-3 text-[13px] gap-1.5 rounded-ctl",
  md: "h-10 px-4 text-sm gap-2 rounded-ctl",
  lg: "h-12 px-6 text-[15px] gap-2 rounded-ctl",
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "subtle", size = "md", className, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        "inline-flex select-none items-center justify-center font-medium transition-colors",
        "disabled:cursor-not-allowed disabled:opacity-40",
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...props}
    />
  ),
);
Button.displayName = "Button";
