import { BookCheck, FlaskConical, HelpCircle } from "lucide-react";
import { Tooltip } from "@/components/ui/Tooltip";
import type { SpotSource } from "@/lib/types";
import { cn } from "@/lib/cn";

const META: Record<SpotSource, { label: string; help: string; cls: string; icon: React.ReactNode }> = {
  curso: {
    label: "Spot do curso",
    help: "Este spot tem base direta no material do curso (Reg Life SnG).",
    cls: "border-action-green/40 bg-action-green/12 text-action-green",
    icon: <BookCheck className="h-3.5 w-3.5" />,
  },
  derivado: {
    label: "Derivado",
    help: "Não está no material do curso. É uma extrapolação dos princípios que o curso ensina (3-bet só premium, call seletivo por posição). Use como orientação, não como gabarito do curso.",
    cls: "border-gold/40 bg-gold/12 text-gold",
    icon: <FlaskConical className="h-3.5 w-3.5" />,
  },
  sem_material: {
    label: "MTT · sem material",
    help: "O curso fornecido é de SnG. O modo MTT não tem material de referência — trate como treino geral, não validado pelo curso.",
    cls: "border-border-strong bg-surface-2 text-ink-faint",
    icon: <HelpCircle className="h-3.5 w-3.5" />,
  },
};

/** Selo de proveniência do spot: curso · derivado · sem material. */
export function SourceBadge({ source, className }: { source?: SpotSource; className?: string }) {
  if (!source) return null;
  const m = META[source];
  return (
    <Tooltip content={m.help}>
      <button
        type="button"
        className={cn(
          "inline-flex cursor-help items-center gap-1.5 rounded-full border px-2.5 py-1 text-2xs font-semibold",
          m.cls,
          className,
        )}
      >
        {m.icon}
        {m.label}
      </button>
    </Tooltip>
  );
}
