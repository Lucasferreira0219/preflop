// Linguagem compartilhada do PKE no frontend — só apresentação/navegação.
// Nenhuma regra estratégica aqui: mapeia identificadores do motor para os
// modos de treino, spots e rótulos exibidos. Fonte da verdade continua no PKE.

// Rótulos de categoria/drill (unifica DRILL_LABEL/CAT_LABEL antes espalhados).
export const CAT_LABEL: Record<string, string> = {
  push_fold: "Push/Fold",
  resteal_short: "Resteal",
  vs_open_3bet: "vs Open",
  limp_punish: "Limp punish",
  rfi: "RFI",
  bb_defense: "Defesa BB",
  hu_btn: "HU botão",
  leaks: "Meus leaks",
  livre: "Treino livre",
};

// leak.exercicio / treino_sugerido → modo válido do TrainPage (CATEGORY_SPECS).
// Atenção ao mismatch: a análise usa vs_limp/heads_up; o treino usa limp_punish/hu_btn.
export const EXERCISE_TO_MODE: Record<string, string> = {
  push_fold: "push_fold",
  vs_open_3bet: "vs_open_3bet",
  resteal_short: "resteal_short",
  vs_limp: "limp_punish",
  limp_punish: "limp_punish",
  rfi: "rfi",
  bb_defense: "bb_defense",
  heads_up: "hu_btn",
  hu_btn: "hu_btn",
};

// spot (m.spot da análise) → modo de treino, para "Treinar spot parecido".
export const SPOT_TO_MODE: Record<string, string> = {
  push_fold: "push_fold",
  vs_open: "vs_open_3bet",
  resteal_short: "resteal_short",
  vs_limp: "limp_punish",
  rfi: "rfi",
  bb_defense: "bb_defense",
  heads_up: "hu_btn",
};

// leak.exercicio → spot, para filtrar a lista de mãos do relatório.
export const EXERCISE_TO_SPOT: Record<string, string> = {
  push_fold: "push_fold",
  vs_open_3bet: "vs_open",
  resteal_short: "resteal_short",
  vs_limp: "vs_limp",
  rfi: "rfi",
  heads_up: "heads_up",
};

/** Modo de treino para um exercício ou spot; null se não houver treino dedicado. */
export function trainModeFor(key?: string | null): string | null {
  if (!key) return null;
  return EXERCISE_TO_MODE[key] ?? SPOT_TO_MODE[key] ?? null;
}

/** Extrai o id puro da regra de "OPENSHOVE.10BB (guia_de_bolso p12)". */
export function ruleIdOf(raw?: string | null): string | null {
  if (!raw) return null;
  const id = raw.split(" (")[0].trim();
  return id || null;
}

// Rótulos dos leaks por id (espelha tournament_analysis.detect_leaks — só apresentação).
export const LEAK_LABEL: Record<string, string> = {
  nao_shova_short: "Não shova short stack",
  call_em_vez_de_3bet: "Dá call em vez de 3-bet",
  passivo_resteal: "Passivo no resteal short",
  nao_pune_limp: "Não pune limp",
  abre_fraco_ep: "Abre mãos fora do range",
  folda_btn_em_range: "Folda demais no BTN",
  passivo_hu: "Passivo no heads-up",
};
export function leakLabel(id?: string | null): string | null {
  return id ? LEAK_LABEL[id] ?? id : null;
}

// Status da análise PKE de um torneio (deriva de campos persistidos).
export type TournamentStatus =
  | "analisado" | "nao_analisado" | "sem_maos" | "insuficiente" | "analise_antiga";
export const STATUS_LABEL: Record<TournamentStatus, string> = {
  analisado: "Analisado",
  nao_analisado: "Não analisado",
  sem_maos: "Sem mãos",
  insuficiente: "Insuficiente",
  analise_antiga: "Análise antiga",
};
export const STATUS_CLS: Record<TournamentStatus, string> = {
  analisado: "bg-action-green/15 text-action-green",
  nao_analisado: "bg-gold/15 text-gold",
  sem_maos: "bg-surface-2 text-ink-faint",
  insuficiente: "bg-surface-2 text-ink-dim",
  analise_antiga: "bg-gold/15 text-gold",
};
// Espelha _row_status() do backend (tournaments_engine.py) — mesma ordem de ramos:
// análise antiga tem prioridade sobre analisado/insuficiente.
export function tournamentStatus(t: {
  pke_analyzed?: boolean;
  pke_critical_hands?: number | null;
  pke_outdated?: boolean;
  hands_count?: number | null;
}): TournamentStatus {
  if (t.pke_analyzed) {
    if (t.pke_outdated) return "analise_antiga";
    return (t.pke_critical_hands ?? 0) > 0 ? "analisado" : "insuficiente";
  }
  if ((t.hands_count ?? 0) > 0) return "nao_analisado";
  return "sem_maos";
}

// Badges que mostram onde o motor está atuando.
export type PkeBadgeVariant = "analisado" | "regra" | "treino_leaks" | "correcao";
export const BADGE_LABEL: Record<PkeBadgeVariant, string> = {
  analisado: "Analisado pelo PKE",
  regra: "Regra do Guia de Bolso",
  treino_leaks: "Treino gerado pelos seus leaks",
  correcao: "Correção pelo PKE",
};
