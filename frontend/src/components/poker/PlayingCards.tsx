import { type Card as CardT, SUIT_IS_RED, SUIT_SYMBOL } from "@/lib/poker";
import { cn } from "@/lib/cn";

function CardFace({ card, size }: { card: CardT; size: "md" | "lg" }) {
  const red = SUIT_IS_RED[card.suit];
  const sym = SUIT_SYMBOL[card.suit];
  const dims = size === "lg" ? "h-[104px] w-[74px] text-[15px]" : "h-[84px] w-[60px] text-[13px]";
  const center = size === "lg" ? "text-4xl" : "text-3xl";
  return (
    <div
      className={cn(
        "relative flex shrink-0 flex-col justify-between rounded-lg bg-[#FAFBFC] p-2 shadow-[0_6px_16px_-6px_rgba(0,0,0,0.7)] ring-1 ring-black/10",
        dims,
      )}
      style={{ color: red ? "#C0392B" : "#15202B" }}
    >
      <div className="flex flex-col items-start leading-none font-bold">
        <span>{card.rank}</span>
        <span className="text-[0.85em]">{sym}</span>
      </div>
      <span className={cn("absolute inset-0 flex items-center justify-center font-semibold", center)}>
        {sym}
      </span>
      <div className="flex rotate-180 flex-col items-start leading-none font-bold">
        <span>{card.rank}</span>
        <span className="text-[0.85em]">{sym}</span>
      </div>
    </div>
  );
}

export function PlayingCards({
  cards,
  size = "lg",
  className,
}: {
  cards: [CardT, CardT];
  size?: "md" | "lg";
  className?: string;
}) {
  return (
    <div className={cn("flex items-end justify-center gap-2.5", className)}>
      <div className="-rotate-[5deg]">
        <CardFace card={cards[0]} size={size} />
      </div>
      <div className="rotate-[5deg]">
        <CardFace card={cards[1]} size={size} />
      </div>
    </div>
  );
}
