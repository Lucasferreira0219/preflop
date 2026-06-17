// Linguagem e helpers do Caderno de Estudo (anotações). Só apresentação/navegação.
import type { Note, NoteType, ReviewStatus } from "./types";
import { trainModeFor } from "./pke";

export const NOTE_TYPE_LABEL: Record<NoteType, string> = {
  free: "Nota livre",
  hand_analysis: "Análise de mão",
  tournament_review: "Review de torneio",
  leak: "Leak",
  concept: "Conceito / regra",
  study_plan: "Plano de estudo",
  question: "Dúvida",
  recurring_error: "Erro recorrente",
  mental_game: "Mental game / tilt",
  grind_session: "Sessão de grind",
};

// Tipos selecionáveis no editor (ordem de exibição).
export const NOTE_TYPE_ORDER: NoteType[] = [
  "free", "hand_analysis", "tournament_review", "leak", "concept",
  "study_plan", "question", "recurring_error", "mental_game", "grind_session",
];

export const REVIEW_STATUS_LABEL: Record<ReviewStatus, string> = {
  not_reviewed: "Não revisado",
  reviewed: "Revisado",
  needs_work: "Precisa treinar",
  mastered: "Dominado",
};

export const REVIEW_STATUS_CLS: Record<ReviewStatus, string> = {
  not_reviewed: "bg-surface-2 text-ink-faint",
  reviewed: "bg-action-green/15 text-action-green",
  needs_work: "bg-gold/15 text-gold",
  mastered: "bg-action-blue/15 text-action-blue",
};

// Atalhos do editor (§5) — inserem um bloco markdown no conteúdo.
export const NOTE_SNIPPETS: { label: string; insert: string }[] = [
  { label: "Minha leitura", insert: "\n## Minha leitura\n" },
  { label: "O que pensei na hora", insert: "\n**O que eu pensei na hora:** " },
  { label: "PKE recomendou", insert: "\n**O que o PKE recomendou:** " },
  { label: "Erro", insert: "\n**Erro:** " },
  { label: "Correção", insert: "\n**Correção:** " },
  { label: "Regra prática", insert: "\n## Regra prática\n- " },
  { label: "Revisar depois", insert: "\n- [ ] Revisar depois\n" },
  { label: "Treino sugerido", insert: "\n**Treino sugerido:** " },
  { label: "Checklist", insert: "\n- [ ] " },
];

// Tags automáticas sugeridas no editor (§11) além das manuais.
export const AUTO_TAGS = [
  "push/fold", "resteal", "bolha", "ICM", "HU", "BB defense", "call shove",
  "limp punish", "RFI", "vs open", "short stack", "erro grave", "revisar", "importante",
];

/** Modo de treino para a nota (via leak_key ou spot). null se não houver. */
export function noteTrainMode(note: Note): string | null {
  return trainModeFor(note.leak_key) ?? trainModeFor(note.spot) ?? null;
}

/** "editado há…" — rótulo relativo simples a partir de epoch (segundos). */
export function fmtAgo(epoch: number, nowMs = Date.now()): string {
  const s = Math.max(0, Math.floor(nowMs / 1000) - epoch);
  if (s < 60) return "agora";
  const m = Math.floor(s / 60);
  if (m < 60) return `há ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.floor(h / 24);
  if (d < 30) return `há ${d} d`;
  const mo = Math.floor(d / 30);
  return `há ${mo} mês${mo > 1 ? "es" : ""}`;
}
