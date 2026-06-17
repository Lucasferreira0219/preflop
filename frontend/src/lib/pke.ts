/** pke.ts — utilidades de apresentação PKE (sem funcionalidades de treino). */
import type { Tournament } from "./types";

// ── Labels de leaks ───────────────────────────────────────────────────────────

const LEAK_LABELS: Record<string, string> = {
  push_too_tight: "Push muito tight",
  push_too_loose: "Push muito loose",
  resteal_too_tight: "Resteal muito tight",
  resteal_too_loose: "Resteal muito loose",
  call_shove_too_tight: "Call shove muito tight",
  call_shove_too_loose: "Call shove muito loose",
  fold_equity: "Não explora fold equity",
  icm_pressure: "Ignora pressão ICM",
  icm_overcautious: "ICM excessivamente cauteloso",
  bb_defense: "BB defense fraca",
  limp_punish: "Não pune limps",
  open_sizing: "Sizing de abertura incorreto",
  position_awareness: "Ignora posição",
  stack_depth: "Ignora profundidade de stack",
  bubble_factor: "Ignora fator bolha",
  pay_jump: "Ignora saltos de prêmio",
};

export function leakLabel(id: string | null | undefined): string | null {
  if (!id) return null;
  return LEAK_LABELS[id] ?? null;
}

// ── Status de torneio ─────────────────────────────────────────────────────────

export type TournamentStatusKey = "analisado" | "nao_analisado" | "sem_maos" | "insuficiente" | "analise_antiga";

export const STATUS_LABEL: Record<TournamentStatusKey, string> = {
  analisado: "Analisado",
  nao_analisado: "Não analisado",
  sem_maos: "Sem mãos",
  insuficiente: "Insuficiente",
  analise_antiga: "Análise antiga",
};

export const STATUS_CLS: Record<TournamentStatusKey, string> = {
  analisado: "bg-action-green/15 text-action-green",
  nao_analisado: "bg-surface-2 text-ink-faint",
  sem_maos: "bg-surface-2 text-ink-faint",
  insuficiente: "bg-gold/15 text-gold",
  analise_antiga: "bg-gold/15 text-gold",
};

export function tournamentStatus(t: Tournament): TournamentStatusKey {
  if (!t.hands_count) return "sem_maos";
  if (!t.pke_analyzed) return "nao_analisado";
  if (t.pke_outdated) return "analise_antiga";
  return "analisado";
}
