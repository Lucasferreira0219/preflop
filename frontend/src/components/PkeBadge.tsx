import { BookOpen, CheckCircle2, Sparkles, Target } from "lucide-react";
import { BADGE_LABEL, type PkeBadgeVariant } from "@/lib/pke";
import { cn } from "@/lib/cn";

const STYLE: Record<PkeBadgeVariant, { icon: React.ReactNode; cls: string }> = {
  analisado: { icon: <Sparkles className="h-3 w-3" />, cls: "bg-gold/10 text-gold border-gold/30" },
  regra: { icon: <BookOpen className="h-3 w-3" />, cls: "bg-action-blue/10 text-action-blue border-action-blue/30" },
  treino_leaks: { icon: <Target className="h-3 w-3" />, cls: "bg-gold/10 text-gold border-gold/30" },
  correcao: { icon: <CheckCircle2 className="h-3 w-3" />, cls: "bg-action-green/10 text-action-green border-action-green/30" },
};

/** Selo que deixa visível onde o PokerKnowledgeEngine está atuando. */
export function PkeBadge({ variant, className }: { variant: PkeBadgeVariant; className?: string }) {
  const s = STYLE[variant];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-2xs font-semibold",
        s.cls,
        className,
      )}
    >
      {s.icon}
      {BADGE_LABEL[variant]}
    </span>
  );
}
