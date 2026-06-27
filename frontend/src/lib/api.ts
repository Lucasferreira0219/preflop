// Cliente da API REST do FastAPI. Mantém o padrão _BASE (deploy atrás de /preflop).
import type {
  Analytics,
  AnalyticsPayload,
  Note,
  NoteFilters,
  NotesStats,
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
  PkeStatus,
  Question,
  ReprocessResult,
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

// POST com body objeto (endpoints /api/pke/* e /api/settings/* que não usam o array padrão).
async function _postObj<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`API ${path} HTTP ${res.status}`);
  return (await res.json()) as T;
}

async function _getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { method: "GET" });
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

  allCriticalHands: (onlyErrors = true, limit = 200) =>
    fetch(`${BASE}/api/all_critical_hands`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ only_errors: onlyErrors, limit }),
    }).then((r) => r.json()) as Promise<{ maos: import("./types").ReportHand[]; total: number }>,

  tournamentAllHands: (tournamentId: string) =>
    fetch(`${BASE}/api/tournament_all_hands`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tournament_id: tournamentId }),
    }).then((r) => r.json()) as Promise<{ maos: import("./types").ReportHand[]; total: number }>,

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

  // ── Configurações / Manutenção PKE ──────────────────────────────────────────
  getPkeStatus: () => _getJson<PkeStatus>("/api/settings/pke_status"),
  reprocessPke: (scope: string, recalculate_sessions = true) =>
    _postObj<ReprocessResult>("/api/settings/reprocess_pke", { scope, recalculate_sessions }),
  recalculateSessions: () =>
    _postObj<{ recalculated: boolean; days?: number }>("/api/settings/recalculate_sessions", {}),
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

  listLeaks: () => call<string[]>("list_leaks", []),

  // ── Caderno de Estudo (anotações) ───────────────────────────────────────────
  listNotes: (filters: NoteFilters = {}) => call<Note[]>("list_notes", [filters]),
  getNote: (id: string) => call<Note | { error: string }>("get_note", [id]),
  createNote: (data: Partial<Note>) => call<Note>("create_note", [data]),
  updateNote: (id: string, patch: Partial<Note>) => call<Note>("update_note", [id, patch]),
  deleteNote: (id: string, hard = false) =>
    call<{ archived?: number; deleted?: number; hard?: boolean; error?: string }>("delete_note", [id, hard]),
  noteFromHand: (payload: Record<string, unknown>, force = false) =>
    call<Note | { existing: Note }>("note_from_hand", [payload, force]),
  noteFromTournament: (payload: Record<string, unknown>) =>
    call<Note>("note_from_tournament", [payload]),
  noteFromLeak: (payload: Record<string, unknown>) =>
    call<Note>("note_from_leak", [payload]),
  notesStats: () => call<NotesStats>("notes_stats", []),

  addTournament: (data: ManualTournamentInput) =>
    call<Tournament | { error: string }>("add_tournament", [data]),

  tournamentsSessions: (filters: TournamentFilters = {}) =>
    call<TournamentSession[]>("tournaments_sessions", [filters]),

  tournamentsAnalytics: (filters: TournamentFilters = {}) =>
    call<AnalyticsPayload>("tournaments_analytics", [filters]),

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
