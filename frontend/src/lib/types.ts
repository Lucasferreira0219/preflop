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

// ── Consulta PKE (pergunta em linguagem natural) ───────────────────────────────

export interface PkeRuleRef {
  id: string;
  source: string | null;
  page: number | null;
}

// Texto canônico de uma regra (modal "Ver regra").
export interface PkeRule {
  found: boolean;
  id: string;
  source?: { pdf: string | null; page: number | null } | null;
  source_label?: string | null;
  explain_pt?: string | null;
  common_mistake?: string | null;
  scope?: Record<string, unknown> | null;
}

export interface PkeQueryContext {
  hero_cards?: string;
  hero_position?: string;
  effective_stack_bb?: number;
  players_left?: number;
  phase?: string;
  action_before_hero?: string;
  opener_position?: string;
  ante?: boolean;
}

export interface PkeQueryResponse {
  answer: string;
  recommended_action: string | null;
  confidence: string; // high | medium | insufficient
  rule_refs: PkeRuleRef[];
  provenance: { main_answer: string; phase: string; explanation: string };
  missing_info: string[];
  beginner_explanation: string | null;
  common_mistake: string | null;
}

// ── Simulador PKE ───────────────────────────────────────────────────────────────

export interface SimSpot {
  spot_id: string;
  category: string;
  phase: string | null;
  players_left: number;
  blinds: string;
  ante: boolean;
  hero_position: string;
  hero_cards: string;
  effective_stack_bb: number;
  action_before_hero: string;
  opener_position: string | null;
  question: string;
  options: string[];
  expected_concept: string | null;
  error?: string;
}

export interface SimCorrection {
  correct: boolean;
  score: number | null;
  recommended_action: string | null;
  rule_refs: PkeRuleRef[];
  explanation: string | null;
  common_mistake: string | null;
  next_training_weight: Record<string, string>;
  category: string;
  error?: string;
}

export interface SimError {
  category: string;
  hero_position: string;
  hero_cards: string;
  effective_stack_bb: number;
  phase: string | null;
  action_before_hero: string;
  opener_position: string | null;
  hero_answer: string;
  recommended_action: string | null;
  score: number | null;
  rule_refs: PkeRuleRef[];
  explanation: string | null;
}

export interface SimSession {
  maos: number;
  acertos: number;
  media_notas: number | null;
  por_categoria: { category: string; n: number; correct: number; media: number }[];
  pior_categoria: string | null;
  melhor_categoria: string | null;
  leaks_treino: { category: string; n: number; correct: number; media: number }[];
  recomendar_treinar: string | null;
  erros: SimError[];
  leak_focus: string[];
  source_tid: string | null;
  desempenho_leaks: { category: string; n: number; media: number | null; verdict: string }[];
  tem_revisao: boolean;
}

// ── Relatório do PokerKnowledgeEngine (análise de torneio) ─────────────────────

export interface ReportHand {
  hand_id: string;
  fase: string | null;
  spot: string | null;
  cards: string | null;
  pos: string | null;
  eff_bb: number | null;
  linha: string | null;
  recomendado: string | null;
  size_recomendado: string | null;
  nota: number | null;
  outcome: string; // decisao_boa | erro | cooler | insuficiente
  gravidade: string | null;
  erro: string | null;
  regra: string[];
  explicacao: string | null;
  resumo: string | null;
  ajuste_exploratorio: string | null;
  motivos_criticos: string[];
  insuficiente: boolean;
  falta_info: string[];
}

export interface ReportLeak {
  id: string;
  label: string;
  frequencia_hits: number;
  gravidade: string;
  perda_media_nota: number;
  fase_predominante: string | null;
  exemplo: string | null;
  regra_violada: string | null;
  como_corrigir: string;
  exercicio: string | null;
}

export interface TournamentReport {
  tournament_id: string;
  maos_no_torneio: number | null;
  maos_criticas: number;
  maos_com_nota: number;
  media_notas: number | null;
  erros_graves: number;
  fase_com_mais_erros: string | null;
  erros_por_fase: Record<string, number>;
  tipos_erro_top: { tipo: string; n: number }[];
  contagem_outcome: Record<string, number>;
  maos: ReportHand[];
  piores_decisoes: ReportHand[];
  melhores_decisoes: ReportHand[];
  leaks: ReportLeak[];
  treino_sugerido: string[];
  error?: string;
}

// Resumo da Home ("Continuar estudo" + "Plano de estudo de hoje").
export interface StudyOverview {
  tem_torneio: boolean;
  last_tid: string | null;
  media_notas: number | null;
  erros_graves: number;
  leaks: ReportLeak[];
  tem_revisao?: boolean;
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
  room: string;
  origin?: string; // 'import' | 'manual'
  notes: string | null;
  // PKE persistido por torneio (aditivo).
  pke_analyzed?: boolean;
  pke_score_avg?: number | null;
  pke_critical_hands?: number | null;
  pke_grave_errors?: number | null;
  pke_main_leak?: string | null;
  pke_leaks?: ReportLeak[];
  pke_last_analyzed_at?: number | null;
  hands_count?: number | null;
}

export interface ManualTournamentInput {
  tournament_name?: string | null;
  room?: string | null;
  format?: string | null;
  played_at?: string | null;
  buy_in_cents?: number | null;
  fee_cents?: number | null;
  currency?: string | null;
  n_entries?: number | null;
  finish_pos?: number | null;
  prize_cents?: number | null;
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

// Import unificado (financeiro + mãos/PKE + análise por torneio).
export interface ImportTournamentFilesResult {
  tournaments: Tournament[];
  hands: ImportSummary;
  financeiro: { parsed: number; new: number; updated: number; duplicates: number };
  tids: string[];
  error?: string;
}

export interface TournamentFilters {
  from_date?: string | null;
  to_date?: string | null;
  format?: string | null;
  room?: string | null;
  min_buyin?: number | null;
  max_buyin?: number | null;
}

export interface PositionBuckets {
  champion: number; // 1º lugar
  podium: number; // 2º–3º
  itm: number; // premiado, fora do pódio
  out: number; // sem prêmio
}

export interface TournamentSession {
  day: string; // YYYY/MM/DD
  start_at: string | null;
  end_at: string | null;
  n: number;
  cost_cents: number;
  prize_cents: number;
  profit_cents: number;
  roi_pct: number | null;
  itm_pct: number | null;
  cashed: number;
  pending: number;
  grind_seconds: number;
  // PKE por dia (aditivo).
  analisados?: number;
  media_notas?: number | null;
  erros_graves?: number;
  main_leak?: string | null;
}

export interface GrindBlock {
  id: number;
  day: string; // YYYY/MM/DD
  started_ts: number; // epoch (s)
  ended_ts: number | null; // null = em andamento
  note: string | null;
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
  avg_profit_cents: number | null;
  pending_prize: number;
  cashed: number;
  big_wins: number;
  big_win_multiplier: number;
  position_buckets: PositionBuckets;
  cumulative: CumulativePoint[];
  by_format: Record<string, TournamentFormatBreakdown>;
}
