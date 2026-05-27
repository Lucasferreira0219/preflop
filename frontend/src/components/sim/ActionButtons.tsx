import type { ActionButton } from "@/lib/poker";
import { Tooltip } from "@/components/ui/Tooltip";
import { cn } from "@/lib/cn";

type Variant = ActionButton["variant"];

// Ajuda curta em linguagem simples (tooltip por botão).
const HELP: Record<Variant, string> = {
  open: "Abrir (RFI): ser o primeiro a aumentar o pote.",
  threebet: "3-bet: reaumentar depois que alguém já aumentou.",
  fourbet: "4-bet: reaumentar de novo, depois de uma 3-bet.",
  shove: "Shove: ir all-in (apostar todas as fichas).",
  resteal: "Resteal: all-in por cima de quem abriu, pra roubar o pote.",
  call: "Call: pagar a aposta para continuar na mão.",
  fold: "Fold: desistir da mão e não colocar mais fichas.",
};

// Estilos sólidos e sóbrios (sem gradiente/glow). Ação agressiva recebe a cor;
// fold é claramente de-enfatizado.
const STYLES: Record<Variant, string> = {
  open: "bg-action-green/90 text-white hover:bg-action-green border-action-green/60",
  threebet: "bg-action-blue/90 text-white hover:bg-action-blue border-action-blue/60",
  fourbet: "bg-poker-fourbet/90 text-white hover:bg-poker-fourbet border-poker-fourbet/60",
  shove: "bg-action-red/90 text-white hover:bg-action-red border-action-red/60",
  resteal: "bg-action-red/90 text-white hover:bg-action-red border-action-red/60",
  call: "bg-gold/90 text-[#1a1407] hover:bg-gold border-gold/60",
  fold: "bg-surface-2 text-ink-dim hover:bg-surface-3 hover:text-ink border-border",
};

export function ActionButtons({
  actions,
  onPick,
  disabled,
}: {
  actions: ActionButton[];
  onPick: (id: ActionButton["id"]) => void;
  disabled?: boolean;
}) {
  return (
    <div
      className="grid gap-2.5"
      style={{ gridTemplateColumns: `repeat(${actions.length}, minmax(0, 1fr))` }}
    >
      {actions.map((a) => (
        <Tooltip key={a.id} content={HELP[a.variant]}>
          <button
            disabled={disabled}
            onClick={() => onPick(a.id)}
            className={cn(
              "group relative flex h-[60px] items-center justify-center gap-2.5 rounded-card border font-semibold transition-colors",
              "disabled:cursor-not-allowed disabled:opacity-50",
              STYLES[a.variant],
            )}
          >
            <span
              className={cn(
                "grid h-6 w-6 place-items-center rounded-md text-xs font-bold",
                a.variant === "fold"
                  ? "bg-surface-1 text-ink-faint"
                  : a.variant === "call"
                    ? "bg-black/15 text-[#1a1407]"
                    : "bg-black/20 text-white/90",
              )}
            >
              {a.key}
            </span>
            <span className="text-[15px]">{a.label}</span>
          </button>
        </Tooltip>
      ))}
    </div>
  );
}
