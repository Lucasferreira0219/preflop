// Helpers e badges compartilhados entre a planilha de torneios e a tela de sessões.
import { Flame } from "lucide-react";

// Espelha BIG_WIN_MULTIPLIER do backend (tournaments_engine.py): prêmio ≥ Nx custo.
export const BIG_WIN_MULT = 30;

/** Medalha por posição final (1º/2º/3º). */
export function medalFor(pos: number | null | undefined): string | null {
  if (pos === 1) return "🥇";
  if (pos === 2) return "🥈";
  if (pos === 3) return "🥉";
  return null;
}

/** Big Win: cravou prêmio ≥ BIG_WIN_MULT× o custo do torneio. */
export function isBigWin(t: {
  prize_cents: number | null;
  buy_in_cents: number | null;
  fee_cents: number | null;
  prize_known: boolean;
}): boolean {
  const cost = (t.buy_in_cents ?? 0) + (t.fee_cents ?? 0);
  return t.prize_known && cost > 0 && (t.prize_cents ?? 0) >= cost * BIG_WIN_MULT;
}

export function RoomTag({ room }: { room?: string | null }) {
  if (!room) return null;
  return (
    <span className="rounded-full border border-border bg-surface-2 px-1.5 py-0.5 text-[10px] font-medium normal-case tracking-normal text-ink-dim">
      {room}
    </span>
  );
}

export function BigWinBadge() {
  return (
    <span
      className="inline-flex items-center gap-0.5 rounded-full border border-gold/40 bg-gold/15 px-1.5 py-0.5 text-[10px] font-semibold text-gold"
      title={`Big Win — prêmio ≥ ${BIG_WIN_MULT}× o buy-in`}
    >
      <Flame className="h-2.5 w-2.5" />
      Big Win
    </span>
  );
}

/** Segundos → "2h 34min" / "34min" / "—". */
export function fmtDuration(seconds: number | null | undefined): string {
  if (!seconds || seconds <= 0) return "—";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}min`;
  if (m > 0) return `${m}min`;
  return `${seconds}s`;
}
