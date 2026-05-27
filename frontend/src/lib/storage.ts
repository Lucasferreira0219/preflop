// localStorage com guarda + SM-2 (repetição espaçada) + histórico de mãos.
import type { Question, Scenario } from "./types";

export function lsGet<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    if (v == null) return fallback;
    return JSON.parse(v) as T;
  } catch {
    return fallback;
  }
}

export function lsSet<T>(key: string, value: T) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

// ── SM-2 simplificado ──────────────────────────────────────────────────────────
const SM2_KEY = "preflop.sm2.v1";

export function sm2Key(q: Pick<Question, "hand" | "pos" | "scenario" | "stack">): string {
  return `${q.hand}|${q.pos}|${q.scenario}|${q.stack}`;
}

export function sm2Load(): Record<string, number> {
  return lsGet<Record<string, number>>(SM2_KEY, {});
}

export function sm2Update(map: Record<string, number>, key: string, correct: boolean) {
  const cur = map[key] || 0;
  map[key] = correct ? Math.min(3, cur + 1) : Math.max(0, cur - 2);
  lsSet(SM2_KEY, map);
}

/** Aceita ou pula a pergunta atual conforme o domínio (score alto = pula mais). */
export function sm2Accept(map: Record<string, number>, key: string): boolean {
  const score = map[key] || 0;
  const threshold = [1.0, 0.7, 0.4, 0.25][score] ?? 1.0;
  return Math.random() < threshold;
}

export function sm2Counts(map: Record<string, number>): { total: number; weak: number } {
  const vals = Object.values(map);
  return { total: vals.length, weak: vals.filter((s) => s < 2).length };
}

// ── Histórico local de mãos ──────────────────────────────────────────────────
const HISTORY_KEY = "preflop.history.v1";
const HISTORY_MAX = 100;

export interface HistoryItem {
  ts: number;
  hand: string;
  pos: string;
  scenario: Scenario;
  stack: number;
  user: string;
  correct: string;
  ok: boolean;
}

export function historyLoad(): HistoryItem[] {
  return lsGet<HistoryItem[]>(HISTORY_KEY, []);
}

export function historySave(item: Omit<HistoryItem, "ts">): HistoryItem[] {
  const hist = historyLoad();
  hist.unshift({ ts: Date.now(), ...item });
  if (hist.length > HISTORY_MAX) hist.length = HISTORY_MAX;
  lsSet(HISTORY_KEY, hist);
  return hist;
}
