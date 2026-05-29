// Contratos da API FastAPI (espelham server.py / *_api.py / stats_engine.py).

export type Mode = "mtt" | "sng";
export type Scenario = "RFI" | "vs_RFI" | "vs_3bet";
export type SpotSource = "curso" | "derivado" | "sem_material";
export type ActionId =
  | "raise"
  | "rfi"
  | "3bet"
  | "4bet"
  | "shove"
  | "resteal"
  | "call"
  | "fold";

export interface Question {
  pos: string;
  scenario: Scenario;
  hand: string;
  stack: number;
  mode: Mode;
  villain_pos: string | null;
  phase?: string | null;
  source?: SpotSource;
}

export interface Stats {
  total: number;
  correct: number;
  wrong: number;
  pct: number;
  streak: number;
  best_streak: number;
}

export interface ActionInfo {
  name: string;
  color: string;
  emoji?: string;
  long_desc?: string;
}

export interface Spot {
  title?: string;
  summary?: string;
  key_hands?: string[];
  key_hands_3bet?: string[];
  key_hands_call?: string[];
  key_hands_4bet?: string[];
  size_recommendation?: string;
  common_mistakes?: string[];
  icm_note?: string;
  source_md?: string;
  _derived?: boolean;
}

export interface Phase {
  label: string;
  stack_range?: [number, number];
  rp_avg_pct?: number | null;
  players_typical?: string;
  summary?: string;
  how_to_play?: string[];
  mentality?: string;
  frequency_tips?: string;
}

export interface UniversalDerived {
  summary?: string;
  principles?: string[];
  common_mistakes?: string[];
}

export interface StackContext {
  label?: string;
  narrative?: string;
}

export interface Insights {
  spot: Spot | null;
  spot_derived?: boolean;
  scenario_derived?: boolean;
  universal_derived?: UniversalDerived | null;
  phase: Phase | null;
  phase_explicit?: boolean;
  stack_context?: StackContext | null;
  position_mistakes?: string[];
  open_pct?: number | null;
  action?: ActionInfo | null;
  // Presentes apenas no endpoint get_insights da Consulta:
  glossary?: Record<string, { term: string; definition: string }>;
  actions?: Record<string, ActionInfo>;
  mode?: Mode;
  stack?: number;
}

export type Buckets = Record<string, string[]>;

export interface SubmitResult {
  result: "correct" | "wrong";
  correct: ActionId;
  correct_action: ActionId;
  buckets: Buckets;
  stats: Stats;
  insights: Insights | null;
}

export interface RangeResponse {
  scenario: Scenario;
  my_pos: string;
  stack: number;
  villain_pos?: string;
  buckets: Buckets;
  error?: string;
}

export interface PerfEntry {
  total: number;
  correct: number;
}

export interface Mistake {
  ts: number;
  hand: string;
  pos: string;
  scenario: Scenario;
  stack: number;
  answered: ActionId;
  correct: ActionId;
}

export interface DailyEntry {
  day: string;
  total: number;
  correct: number;
  pct: number;
}

export interface Analytics extends Stats {
  from_ts: number | null;
  to_ts: number | null;
  by_position: Record<string, PerfEntry>;
  by_scenario: Record<string, PerfEntry>;
  by_stack: Record<string, PerfEntry>;
  last_mistakes: Mistake[];
  top_wrong_hands: [string, number][];
  daily: DailyEntry[];
}

export interface DeltaEntry {
  recent_pct: number | null;
  previous_pct: number | null;
  recent_total: number;
  previous_total: number;
  delta: number | null;
}

export interface Improvement {
  window_days: number;
  recent: { total: number; correct: number; pct: number };
  previous: { total: number; correct: number; pct: number };
  delta_pct: number | null;
  by_position: Record<string, DeltaEntry>;
  by_scenario: Record<string, DeltaEntry>;
  by_stack: Record<string, DeltaEntry>;
}

// ── Mãos importadas do PokerStars ──────────────────────────────────────────────

export interface ImportedHand {
  hand_id: string;
  tournament_id: string;
  played_at: string | null;
  hero_pos: string | null;
  hero_cards: string | null;
  stack_bb: number | null;
  scenario: string;
  hero_action: string | null;
  course_action: ActionId | null;
  is_correct: number | null; // 1 / 0 / null (sem nota)
  source: SpotSource | null;
  motivo: string;
}

export interface ImportSummary {
  parsed: number;
  new: number;
  duplicates: number;
  graded: number;
  correct: number;
  wrong: number;
  not_modeled: number;
  hands: ImportedHand[];
  error?: string;
}

// ── Planilha de torneios ──────────────────────────────────────────────────────

export type PrizeSource = "manual" | "auto" | null;

export interface Tournament {
  tournament_id: string;
  played_at: string | null;
  hero: string | null;
  tournament_name: string | null;
  game_type: string | null;
  format: string | null;
  buy_in_cents: number | null;
  fee_cents: number | null;
  currency: string;
  n_entries: number | null;
  prize_pool_cents: number | null;
  finish_pos: number | null;
  prize_cents: number | null;
  prize_known: boolean;
  prize_source: PrizeSource;
  profit_cents: number | null;
  notes: string | null;
}

export interface FinishPositionUsage {
  pos: number;
  n: number;
}

export interface TournamentType {
  type_key: string;
  name: string;
  buy_in_cents: number | null;
  fee_cents: number | null;
  format: string | null;
  currency: string;
  typical_entries: number | null;
  n_tournaments: number;
  n_manual_overrides: number;
  payouts_cents: number[];
  has_payout_table: boolean;
  finish_positions: FinishPositionUsage[];
}

export interface TournamentImportResult {
  parsed: number;
  new: number;
  updated: number;
  duplicates: number;
  tournaments: Tournament[];
  error?: string;
}

export interface TournamentFilters {
  from_date?: string | null;
  to_date?: string | null;
  format?: string | null;
  min_buyin?: number | null;
  max_buyin?: number | null;
}

export interface TournamentFormatBreakdown {
  n: number;
  cost: number;
  prize: number;
  itm: number;
  cashed: number;
}

export interface CumulativePoint {
  tournament_id: string;
  played_at: string | null;
  running: number;
}

export interface TournamentOverview {
  n_tournaments: number;
  cost_total_cents: number;
  prize_total_cents: number;
  profit_cents: number;
  roi_pct: number | null;
  itm_pct: number | null;
  avg_buyin_cents: number | null;
  pending_prize: number;
  cashed: number;
  cumulative: CumulativePoint[];
  by_format: Record<string, TournamentFormatBreakdown>;
}
