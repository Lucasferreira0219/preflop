import { cn } from "@/lib/cn";

/** Card de métrica compacto e denso (Seção 1 da análise). */
export function StatCard({
  label,
  value,
  sub,
  accent = "default",
  small,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  accent?: "default" | "gold" | "green" | "red";
  small?: boolean;
}) {
  const valueColor = {
    default: "text-ink",
    gold: "text-gold",
    green: "text-action-green",
    red: "text-action-red",
  }[accent];

  return (
    <div className="rounded-card border border-border bg-surface-1 p-3.5">
      <div className="text-2xs font-semibold uppercase tracking-[0.12em] text-ink-faint">{label}</div>
      <div className={cn("mt-1.5 font-bold leading-none nums", small ? "text-lg" : "text-2xl", valueColor)}>
        {value}
      </div>
      {sub && <div className="mt-1 text-2xs text-ink-faint nums">{sub}</div>}
    </div>
  );
}
