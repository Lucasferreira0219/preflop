// Cliente da API REST do FastAPI. Mantém o padrão _BASE (deploy atrás de /preflop).
import type {
  Analytics,
  ImportSummary,
  ImportTournamentFilesResult,
  GrindBlock,
  Improvement,
  Insights,
  ManualTournamentInput,
  Mode,
  PkeQueryContext,
  PkeQueryResponse,
  PkeRule,
  Question,
  StudyOverview,
  SimCorrection,
  SimSession,
  SimSpot,
  RangeResponse,
  Scenario,
  Stats,
  SubmitResult,
  Tournament,
  TournamentFilters,
  TournamentImportResult,
  TournamentOverview,
  TournamentReport,
  TournamentSession,
  TournamentType,
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

// POST com body objeto (endpoints /api/pke/* que não usam o array padrão).
async function _postObj<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`API ${path} HTTP ${res.status}`);
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

  importHands: (text: string, mode: Mode = "sng") =>
    call<ImportSummary>("import_hands", [text, mode]),

  analyzeTournament: (tournamentId: string) =>
    call<TournamentReport>("analyze_tournament", [tournamentId]),

  // Consulta PKE: body é um objeto {question, context} (não o array padrão).
  pkeQuery: async (question: string, context: PkeQueryContext) => {
    const res = await fetch(`${BASE}/api/pke/query`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question, context }),
    });
    if (!res.ok) throw new Error(`API pke/query HTTP ${res.status}`);
    return (await res.json()) as PkeQueryResponse;
  },

  // ── Simulador PKE (bodies são objetos) ──────────────────────────────────────
  pkeSimNew: (mode: string, category?: string) =>
    _postObj<SimSpot>("/api/pke/sim/new", { mode, category }),
  pkeSimAnswer: (spotId: string, heroAnswer: string) =>
    _postObj<SimCorrection>("/api/pke/sim/answer", { spot_id: spotId, hero_answer: heroAnswer }),
  pkeSimSession: () => _postObj<SimSession>("/api/pke/sim/session", {}),
  pkeSimReset: () => _postObj<{ ok: boolean }>("/api/pke/sim/reset", {}),
  pkeRule: (id: string) => _postObj<PkeRule>("/api/pke/rule", { id }),

  studyOverview: () => call<StudyOverview>("study_overview", []),

  // ── Planilha de torneios ────────────────────────────────────────────────────
  importTournaments: (text: string) =>
    call<TournamentImportResult>("import_tournaments", [text]),

  importTournamentFiles: (text: string) =>
    call<ImportTournamentFilesResult>("import_tournament_files", [text]),

  listTournaments: (filters: TournamentFilters = {}) =>
    call<Tournament[]>("list_tournaments", [filters]),

  tournamentsOverview: (filters: TournamentFilters = {}) =>
    call<TournamentOverview>("tournaments_overview", [filters]),

  updateTournament: (
    tournamentId: string,
    prizeCents: number | null = null,
    finishPos: number | null = null,
    notes: string | null = null,
  ) =>
    call<Tournament | { error: string }>("update_tournament", [
      tournamentId,
      prizeCents,
      finishPos,
      notes,
    ]),

  deleteTournament: (tournamentId: string) =>
    call<{ deleted: number; error?: string }>("delete_tournament", [tournamentId]),

  listTournamentFormats: () => call<string[]>("list_tournament_formats", []),

  listRooms: () => call<string[]>("list_rooms", []),

  addTournament: (data: ManualTournamentInput) =>
    call<Tournament | { error: string }>("add_tournament", [data]),

  tournamentsSessions: (filters: TournamentFilters = {}) =>
    call<TournamentSession[]>("tournaments_sessions", [filters]),

  // ── Cronômetro de grind ───────────────────────────────────────────────────
  grindActive: () => call<GrindBlock | null>("grind_active", []),
  grindStart: () => call<GrindBlock>("grind_start", []),
  grindStop: () => call<GrindBlock | Record<string, never>>("grind_stop", []),
  grindBlocksForDay: (day: string) =>
    call<GrindBlock[]>("grind_blocks_for_day", [day]),
  deleteGrindBlock: (id: number) =>
    call<{ deleted: number }>("delete_grind_block", [id]),

  listTournamentTypes: () => call<TournamentType[]>("list_tournament_types", []),

  setTournamentPayout: (
    typeKey: string,
    payoutsCents: number[],
    label: string | null = null,
  ) =>
    call<{ ok?: boolean; type_key?: string; payouts_cents?: number[]; format?: string | null; error?: string }>(
      "set_tournament_payout",
      [typeKey, payoutsCents, label],
    ),

  deleteTournamentPayout: (typeKey: string) =>
    call<{ deleted: number; error?: string }>("delete_tournament_payout", [typeKey]),
};
