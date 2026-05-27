// Cliente da API REST do FastAPI. Mantém o padrão _BASE (deploy atrás de /preflop).
import type {
  Analytics,
  Improvement,
  Insights,
  Mode,
  Question,
  RangeResponse,
  Scenario,
  Stats,
  SubmitResult,
} from "./types";

export const BASE = /^\/preflop(?=\/|$)/.test(location.pathname) ? "/preflop" : "";

async function call<T>(method: string, args: unknown[] = []): Promise<T> {
  const res = await fetch(`${BASE}/api/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(args),
  });
  if (!res.ok) throw new Error(`API ${method} HTTP ${res.status}`);
  return (await res.json()) as T;
}

export const api = {
  newQuestion: (
    playerCount = 9,
    stackBb: number | null = null,
    focusPos: string | null = null,
    focusScenario: string | null = null,
    mode: Mode = "mtt",
  ) =>
    call<Question | { error: string }>("new_question", [
      playerCount,
      stackBb,
      focusPos,
      focusScenario,
      mode,
    ]),

  submitAnswer: (userAction: string) => call<SubmitResult>("submit_answer", [userAction]),

  getStats: () => call<Stats>("get_stats", []),
  resetStats: () => call<Stats>("reset_stats", []),

  getAnalytics: (fromTs: number | null = null, toTs: number | null = null) =>
    call<Analytics>("get_analytics", [fromTs, toTs]),

  getImprovement: (windowDays = 7) => call<Improvement>("get_improvement", [windowDays]),

  getRange: (
    pos: string,
    scenario: Scenario,
    stackBb: number,
    mode: Mode = "mtt",
    villain: string | null = null,
  ) => call<RangeResponse>("get_range", [pos, scenario, stackBb, mode, villain]),

  listVillains: (pos: string, stackBb: number, mode: Mode = "mtt") =>
    call<Record<string, Scenario>>("list_villains", [pos, stackBb, mode]),

  getInsights: (
    mode: Mode,
    stack: number,
    pos: string | null = null,
    scenario: Scenario | null = null,
    villain: string | null = null,
    playerCount = 9,
    phase: string | null = null,
  ) => call<Insights>("get_insights", [mode, stack, pos, scenario, villain, playerCount, phase]),
};
