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

export interface ReportHandHH {
  blinds?: string | null;
  ante?: boolean | null;
  n_players?: number | null;
  hero_stack_chips?: number | null;
  hero_stack_bb?: number | null;
  effective_stack_bb?: number | null;
  villain_stack_chips?: number | null;
  villain_stack_bb?: number | null;
  opener_pos?: string | null;
  opener_action?: string | null;
  opener_size_chips?: number | null;
  opener_size_bb?: number | null;
  villain_position?: string | null;
  villain_action?: string | null;
  n_limpers?: number | null;
  hero_action?: string | null;
  hero_action_size_bb?: number | null;
  faced_allin?: boolean | null;
  allin_amount_bb?: number | null;
  preflop_action_summary?: string | null;
  street?: string | null;
  board?: string[] | null;
  went_to_showdown?: boolean | null;
  hero_won?: boolean | null;
  pot_total?: number | null;
  hero_net_chips?: number | null;
  hero_busted?: boolean | null;
  villain_cards?: string | null;
  hero_cards?: string | null;
}

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
  source_type?: string | null;
  confidence?: string | null;
  range_status?: string | null;
  warning?: string | null;
  hh?: ReportHandHH;
  // classificação por mão (sem nota numérica na UI da mão)
  decision_label?: string;   // correct | minor_error | medium_error | major_error | cooler | insufficient
  impact_label?: string;     // low | medium | high | critical
  impact_weight?: number;
  internal_score?: number | null;  // só cálculo/debug — não exibir como nota
  shown_label?: string;      // "Acerto" | "Erro leve" | ...
  shown_impact?: string;     // "Impacto baixo" | ...
  // tolerância estratégica: faixa da linha (mais de uma linha pode ser boa)
  hero_action_quality?: string;  // best | standard_good | acceptable_good | ... | severe_error
  shown_quality?: string;        // "Melhor linha" | "Linha aceitável" | "Spot close" | ...
  quality_note?: string | null;  // explicação pedagógica quando há linhas alternativas
  acoes_aceitaveis?: string[];
  alternativas_avancadas?: string[];
  acoes_ruins?: string[];
  erros_graves_acoes?: string[];
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
  // NOTA PRINCIPAL (única, visível) — ponderada por impacto + caps
  pke_score: number | null;
  pke_score_explanation?: string | null;
  pke_grave_errors?: number;
  pke_main_leak?: string | null;
  pke_critical_hands?: number;
  media_notas: number | null;  // interno/debug — não exibir como nota principal
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

// ── Configurações / Manutenção PKE ──────────────────────────────────────────────

export interface PkeStatus {
  pke_version: string;
  rules_version: string;
  ranges_version: string;
  rules_updated_at: string | null;
  last_reprocess_at: string | null;
  tournaments_total: number;
  with_hand_history: number;
  without_hand_history: number;
  pke_analyzed: number;
  pke_outdated: number;
  pke_not_analyzed: number;
}

export interface ReprocessError {
  tournament_id: string;
  motivo: string;
  acao_sugerida: string;
}

export interface ReprocessResult {
  scope: string;
  processed: number;
  updated: number;
  skipped: number;
  failed: number;
  errors: ReprocessError[];
  started_at: string;
  finished_at: string;
  elapsed_s: number;
  sessions?: { recalculated: boolean; days?: number; error?: string };
}

// ── Planilha de torneios ──────────────────────────────────────────────────────

export type PrizeSource = "manual" | "auto" | null;

export interface Tournament {
  tournament_id: string;
  ps_tournament_id?: string | null;
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
  pke_outdated?: boolean;
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

export type FinancialFilter =
  | "lucro_positivo" | "lucro_negativo" | "campeao" | "itm" | "fora_itm";
export type NotaBand = "8plus" | "6a8" | "lt6" | "sem_nota";
export type GravesFilter = "sem_grave" | "com_grave" | "gte1" | "gte3" | "gte5";
export type StatusFilter =
  | "analisado" | "nao_analisado" | "sem_maos" | "insuficiente" | "analise_antiga";

export interface TournamentFilters {
  from_date?: string | null;
  to_date?: string | null;
  format?: string | null;
  room?: string | null;
  min_buyin?: number | null;
  max_buyin?: number | null;
  // ── filtros avançados (PKE + resultado) ──────────────────────────────────
  financial?: FinancialFilter | null;
  min_nota?: number | null;
  max_nota?: number | null;
  nota_band?: NotaBand | null;
  graves?: GravesFilter | null;
  status?: StatusFilter | null;
  leak?: string | null;
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
  grind_seconds: number;       // grind REAL por blocos
  estimated?: boolean;         // algum torneio sem mãos importadas
  n_blocks?: number;           // nº de blocos de grind no dia
  // janela de jogo (dos torneios) + métricas por hora (aditivo).
  play_seconds?: number | null;
  tph?: number | null;
  profit_per_hour_cents?: number | null;
  graves_per_hour?: number | null;
  // PKE por dia (aditivo).
  analisados?: number;
  media_notas?: number | null;
  erros_graves?: number;
  main_leak?: string | null;
}

// ── Central de análise (séries agregadas) ─────────────────────────────────────
// Métricas comuns a per_day/per_session/per_week/per_buyin/per_room/per_hour.
export interface AnalyticsBucket {
  n: number;
  cost_cents: number;
  prize_cents: number;
  profit_cents: number | null;
  roi_pct: number | null;
  itm_pct: number | null;
  cashed: number;
  pending: number;
  itm: number;
  champion: number;
  podium: number;
  out: number;
  grind_seconds: number;
  estimated: boolean;
  tph: number | null;
  profit_per_hour_cents: number | null;
  graves_per_hour: number | null;
  avg_finish: number | null;
  win_rate_pct: number | null;
  analisados: number;
  erros_graves: number;
  media_notas: number | null;
  main_leak: string | null;
}
export interface AnalyticsDay extends AnalyticsBucket { day: string; n_blocks: number }
export interface AnalyticsSession extends AnalyticsBucket {
  session_id: string; day: string; start_at: string; end_at: string;
}
export interface AnalyticsWeek extends AnalyticsBucket { week: string; week_start: string | null }
export interface AnalyticsBuyin extends AnalyticsBucket { buyin_cents: number }
export interface AnalyticsRoom extends AnalyticsBucket { room: string }
export interface AnalyticsHour extends AnalyticsBucket { hour: number }
export interface AnalyticsTournament {
  tournament_id: string;
  played_at: string | null;
  label: string;
  profit_cents: number | null;
  roi_pct: number | null;
  finish_pos: number | null;
  n_entries: number | null;
  buy_in_cents: number;
  room: string;
  media_notas: number | null;
  erros_graves: number;
}
export interface StatusDist {
  correct: number; minor_error: number; medium_error: number;
  major_error: number; cooler: number; insufficient: number;
}
export interface AnalyticsPayload {
  meta: {
    n_tournaments: number; n_hands: number; n_days: number;
    n_sessions: number; grind_gap_min: number;
  };
  per_day: AnalyticsDay[];
  per_session: AnalyticsSession[];
  per_week: AnalyticsWeek[];
  per_tournament: AnalyticsTournament[];
  per_buyin: AnalyticsBuyin[];
  per_room: AnalyticsRoom[];
  per_hour: AnalyticsHour[];
  status_dist: StatusDist;
  error_types: { type: string; n: number }[];
  spots: { scenario: string; n: number; errors: number; error_pct: number }[];
  fase: { fase: string; n: number; errors: number; error_pct: number }[];
  correlation: { media_notas: number; profit_cents: number | null; roi_pct: number | null; n: number }[];
  leaks_by_period: { day: string; leak: string; n: number }[];
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
