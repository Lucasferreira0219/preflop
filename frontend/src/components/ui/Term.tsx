import { Tooltip } from "@/components/ui/Tooltip";
import { GLOSSARY_MAP } from "@/lib/glossary";
import { useApp } from "@/state/AppProvider";
import { cn } from "@/lib/cn";

/**
 * Termo técnico com ajuda embutida: sublinhado pontilhado + tooltip com a
 * explicação curta (hover/foco). Tocar abre o glossário completo (mobile).
 */
export function Term({
  id,
  children,
  className,
}: {
  id: string;
  children?: React.ReactNode;
  className?: string;
}) {
  const entry = GLOSSARY_MAP[id];
  const { setGlossaryOpen } = useApp();
  const label = children ?? entry?.term ?? id;
  if (!entry) return <>{label}</>;

  return (
    <Tooltip content={entry.short}>
      <button
        type="button"
        onClick={() => setGlossaryOpen(true)}
        className={cn(
          "cursor-help underline decoration-dotted decoration-ink-faint/70 underline-offset-[3px]",
          "transition-colors hover:decoration-gold focus-visible:decoration-gold",
          className,
        )}
      >
        {label}
      </button>
    </Tooltip>
  );
}
