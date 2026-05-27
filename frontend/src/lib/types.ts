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
