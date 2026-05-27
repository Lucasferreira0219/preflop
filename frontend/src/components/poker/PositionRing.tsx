import { POS_LABEL, ringSeats } from "@/lib/poker";
import type { Scenario } from "@/lib/types";
import { cn } from "@/lib/cn";

/**
 * Mini esquema oval de posições. Sóbrio (sem feltro de cassino): apenas um anel
 * elíptico sutil com os assentos. Hero em dourado, vilão em vermelho.
 */
export function PositionRing({
  heroPos,
  villainPos,
  scenario,
  stack,
  playerCount = 9,
  className,
}: {
  heroPos: string;
  villainPos: string | null;
  scenario: Scenario;
  stack: number;
  playerCount?: number;
  className?: string;
}) {
  const seats = ringSeats(heroPos, villainPos, scenario, playerCount);
  const villainAction =
    scenario === "vs_RFI" ? "ABRIU" : scenario === "vs_3bet" ? "3-BET" : null;

  return (
    <div className={cn("relative mx-auto aspect-[2/1] w-full max-w-[440px]", className)}>
      {/* Anel elíptico (mesa) sóbrio */}
      <div className="absolute inset-x-[6%] inset-y-[10%] rounded-[50%] border border-border-strong bg-surface-2/40" />
      <div className="absolute inset-x-[12%] inset-y-[22%] rounded-[50%] border border-border/60" />

      {/* Rótulo central do cenário */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
        <div className="text-2xs font-semibold uppercase tracking-[0.16em] text-ink-faint">
          {scenario === "RFI" ? "Você abre" : scenario === "vs_RFI" ? "Responda" : "vs 3-Bet"}
        </div>
      </div>

      {seats.map((s) => (
        <Seat
          key={s.pos}
          left={s.left}
          top={s.top}
          label={POS_LABEL[s.pos] || s.pos}
          isHero={s.isHero}
          isVillain={s.isVillain}
          folded={s.folded}
          sub={s.isHero ? `${stack}bb` : s.isVillain ? villainAction : null}
        />
      ))}
    </div>
  );
}

function Seat({
  left,
  top,
  label,
  isHero,
  isVillain,
  folded,
  sub,
}: {
  left: number;
  top: number;
  label: string;
  isHero: boolean;
  isVillain: boolean;
  folded: boolean;
  sub: string | null;
}) {
  return (
    <div
      className="absolute -translate-x-1/2 -translate-y-1/2"
      style={{ left: `${left}%`, top: `${top}%` }}
    >
      <div
        className={cn(
          "flex min-w-[42px] flex-col items-center rounded-lg border px-2 py-1 text-center nums transition-colors",
          isHero
            ? "border-gold/60 bg-gold/15 text-gold"
            : isVillain
              ? "border-action-red/55 bg-action-red/12 text-[#E89090]"
              : folded
                ? "border-border/50 bg-surface-1/60 text-ink-faint/70"
                : "border-border bg-surface-2 text-ink-dim",
        )}
      >
        <span className={cn("text-[12px] font-bold leading-none", folded && "line-through opacity-70")}>
          {label}
        </span>
        {sub && <span className="mt-0.5 text-[9px] font-semibold leading-none opacity-90">{sub}</span>}
        {isHero && (
          <span className="mt-0.5 text-[8px] font-bold uppercase tracking-wider text-gold/80">você</span>
        )}
      </div>
    </div>
  );
}
