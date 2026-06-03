// Registry data-driven da central de análise. Cada métrica declara de onde
// vêm os dados (qual série por granularidade) e como extrair/formatar o valor —
// um único <AnalyticsChart> renderiza todas. Adicionar métrica = adicionar entrada.
import type { AnalyticsPayload } from "@/lib/types";
import { fmtMoney, fmtPct } from "@/lib/money";

export type TabId = "fin" | "volume" | "perf" | "tec";
export type Granularity =
  | "day" | "session" | "week" | "tournament" | "buyin" | "room" | "hour" | "overall";
export type ValueMode = "abs" | "cumulative" | "avg" | "moving";
export type ChartType = "bar" | "area" | "line" | "scatter" | "distribution";
export type Unit = "money" | "pct" | "hours" | "count" | "decimal" | "position";

export const TAB_LABEL: Record<TabId, string> = {
  fin: "Financeiro",
  volume: "Volume",
  perf: "Performance",
  tec: "Técnico",
};

export const GRAN_LABEL: Record<Granularity, string> = {
  day: "Por dia",
  session: "Por sessão",
  week: "Por semana",
  tournament: "Por torneio",
  buyin: "Por buy-in",
  room: "Por sala",
  hour: "Por horário",
  overall: "Geral",
};

export const VALUE_MODE_LABEL: Record<ValueMode, string> = {
  abs: "Absoluto",
  cumulative: "Acumulado",
  avg: "Média",
  moving: "Média móvel",
};

export interface MetricDef {
  id: string;
  tab: TabId;
  label: string;
  unit: Unit;
  chartType: ChartType;
  granularities: Granularity[];
  valueModes?: ValueMode[]; // default ["abs"]
  /** valor cru por linha (ex.: profit em centavos, horas, %); null = sem dado. */
  y: (row: any) => number | null;
  colorBySign?: boolean;
  empty?: string;
  /** fonte fixa (distribuição/scatter) — ignora granularidade. */
  source?: "status_dist" | "spots" | "error_types" | "correlation" | "leaks";
}

// Qual array do payload alimenta cada granularidade de série temporal.
const SERIES_KEY: Partial<Record<Granularity, keyof AnalyticsPayload>> = {
  day: "per_day",
  session: "per_session",
  week: "per_week",
  tournament: "per_tournament",
  buyin: "per_buyin",
  room: "per_room",
  hour: "per_hour",
};

export function seriesFor(payload: AnalyticsPayload, g: Granularity): any[] {
  const k = SERIES_KEY[g];
  return k ? ((payload[k] as any[]) ?? []) : [];
}

// "YYYY/MM/DD..." -> "DD/MM" (formato BR)
function ddmm(s: string): string {
  const m = (s ?? "").match(/^\d{4}\/(\d{2})\/(\d{2})/);
  return m ? `${m[2]}/${m[1]}` : (s ?? "");
}

export function xLabel(g: Granularity, row: any): string {
  switch (g) {
    case "day": return ddmm(row.day);
    case "session": {
      const hhmm = (row.start_at ?? "").slice(11, 16);
      return row.start_at ? `${ddmm(row.start_at)} ${hhmm}`.trim() : (row.session_id ?? "");
    }
    case "week": return row.week ?? "";
    case "tournament": return ddmm(row.played_at);
    case "buyin": return fmtMoney(row.buyin_cents, "USD");
    case "room": return row.room ?? "—";
    case "hour": return `${row.hour}h`;
    default: return "";
  }
}

export function fmtUnit(unit: Unit, v: number | null, currency = "USD"): string {
  if (v == null || Number.isNaN(v)) return "—";
  switch (unit) {
    case "money": return fmtMoney(Math.round(v), currency, { signed: true });
    case "pct": return fmtPct(v, 0);
    case "hours": return `${v.toFixed(1)} h`;
    case "position": return v.toFixed(1);
    case "decimal": return v.toFixed(1);
    case "count":
    default: return String(Math.round(v));
  }
}

// Cor por sinal/faixa (para barras). Verde positivo, vermelho negativo, gold neutro.
export const COLOR = { green: "#2BA672", red: "#D6535B", gold: "#D2A54A", slate: "#7C8AA5" };
export function signColor(v: number, unit: Unit): string {
  if (unit === "position") return COLOR.slate; // posição menor é melhor; neutro
  return v > 0 ? COLOR.green : v < 0 ? COLOR.red : COLOR.gold;
}
export function notaColor(v: number): string {
  return v >= 7 ? COLOR.green : v < 5 ? COLOR.red : COLOR.gold;
}

// ── Registry ──────────────────────────────────────────────────────────────────
const TS: Granularity[] = ["day", "session", "week"];

export const REGISTRY: MetricDef[] = [
  // ── Financeiro ──
  { id: "profit", tab: "fin", label: "Lucro", unit: "money", chartType: "bar",
    granularities: ["day", "session", "week", "tournament", "room", "buyin"],
    valueModes: ["abs", "cumulative"], colorBySign: true,
    y: (r) => r.profit_cents, empty: "Sem lucro calculado — confirme prêmios/posições." },
  { id: "bankroll", tab: "fin", label: "Banca acumulada", unit: "money", chartType: "area",
    granularities: ["day", "tournament"], valueModes: ["cumulative"], colorBySign: true,
    y: (r) => r.profit_cents, empty: "Importe pelo menos 2 torneios pra ver a curva." },
  { id: "roi", tab: "fin", label: "ROI", unit: "pct", chartType: "bar",
    granularities: ["day", "session", "week", "room", "buyin"], colorBySign: true,
    y: (r) => r.roi_pct, empty: "Sem ROI por período ainda." },
  { id: "buyin_invested", tab: "fin", label: "Buy-in investido", unit: "money", chartType: "bar",
    granularities: ["day", "session", "week"], valueModes: ["abs", "cumulative"],
    y: (r) => r.cost_cents, empty: "Sem dados de investimento." },
  { id: "prize", tab: "fin", label: "Prêmio recebido", unit: "money", chartType: "bar",
    granularities: ["day", "session", "week"], valueModes: ["abs", "cumulative"],
    y: (r) => r.prize_cents, empty: "Sem prêmios confirmados." },

  // ── Volume ──
  { id: "games", tab: "volume", label: "Jogos", unit: "count", chartType: "bar",
    granularities: ["day", "session", "week", "hour"], valueModes: ["abs", "cumulative"],
    y: (r) => r.n, empty: "Sem torneios no período." },
  { id: "grind_hours", tab: "volume", label: "Horas de grind", unit: "hours", chartType: "bar",
    granularities: ["day", "session", "week"], valueModes: ["abs", "cumulative"],
    y: (r) => (r.grind_seconds ? r.grind_seconds / 3600 : null),
    empty: "Sem horas de grind (importe mãos para calcular)." },
  { id: "tph", tab: "volume", label: "Torneios por hora", unit: "decimal", chartType: "bar",
    granularities: ["day", "session"], y: (r) => r.tph,
    empty: "Sem horas de grind para calcular o ritmo." },

  // ── Performance ──
  { id: "itm", tab: "perf", label: "ITM", unit: "pct", chartType: "bar",
    granularities: ["day", "session", "week"], valueModes: ["abs", "moving"],
    y: (r) => r.itm_pct, empty: "Sem prêmios confirmados para calcular ITM." },
  { id: "champions", tab: "perf", label: "1º lugares", unit: "count", chartType: "bar",
    granularities: ["day", "session", "week"], valueModes: ["abs", "cumulative"],
    y: (r) => r.champion, empty: "Sem vitórias no período." },
  { id: "podiums", tab: "perf", label: "Pódios (1º–3º)", unit: "count", chartType: "bar",
    granularities: ["day", "session", "week"], valueModes: ["abs", "cumulative"],
    y: (r) => (r.champion ?? 0) + (r.podium ?? 0), empty: "Sem pódios no período." },
  { id: "avg_finish", tab: "perf", label: "Posição média", unit: "position", chartType: "line",
    granularities: ["day", "session", "week"], y: (r) => r.avg_finish,
    empty: "Sem posições finais registradas." },
  { id: "win_rate", tab: "perf", label: "Taxa de vitória", unit: "pct", chartType: "line",
    granularities: ["day", "session", "week"], y: (r) => r.win_rate_pct,
    empty: "Sem posições finais registradas." },
  { id: "positions", tab: "perf", label: "Distribuição de posições", unit: "count",
    chartType: "distribution", granularities: ["overall"], source: "status_dist",
    y: () => null, empty: "Sem posições para distribuir." },

  // ── Técnico / PKE ──
  { id: "nota", tab: "tec", label: "Nota PKE", unit: "decimal", chartType: "bar",
    granularities: ["day", "session", "week"], valueModes: ["abs", "moving"],
    y: (r) => r.media_notas, empty: "Nenhum dia analisado pelo PKE ainda." },
  { id: "graves", tab: "tec", label: "Erros graves", unit: "count", chartType: "bar",
    granularities: ["day", "session", "week", "hour"], valueModes: ["abs", "cumulative"],
    y: (r) => r.erros_graves, empty: "Sem erros graves no período." },
  { id: "graves_per_hour", tab: "tec", label: "Erros graves por hora", unit: "decimal",
    chartType: "bar", granularities: ["day", "session"], y: (r) => r.graves_per_hour,
    empty: "Sem horas de grind para calcular." },
  { id: "status_dist", tab: "tec", label: "Status das mãos críticas", unit: "count",
    chartType: "distribution", granularities: ["overall"], source: "status_dist",
    valueModes: ["abs"], y: () => null, empty: "Nenhuma mão crítica analisada ainda." },
  { id: "spots", tab: "tec", label: "Spots com mais erro", unit: "pct",
    chartType: "distribution", granularities: ["overall"], source: "spots",
    y: () => null, empty: "Sem spots analisados ainda." },
  { id: "error_types", tab: "tec", label: "Tipos de erro", unit: "count",
    chartType: "distribution", granularities: ["overall"], source: "error_types",
    y: () => null, empty: "Sem erros classificados ainda." },
  { id: "leaks", tab: "tec", label: "Leaks por período", unit: "count",
    chartType: "distribution", granularities: ["overall"], source: "leaks",
    y: () => null, empty: "Nenhum leak detectado ainda." },
  { id: "correlation", tab: "tec", label: "Resultado × qualidade", unit: "money",
    chartType: "scatter", granularities: ["overall"], source: "correlation",
    y: (r) => r.profit_cents, empty: "Sem torneios analisados para correlacionar." },
];

export function metricsForTab(tab: TabId): MetricDef[] {
  return REGISTRY.filter((m) => m.tab === tab);
}
export function metricById(id: string): MetricDef | undefined {
  return REGISTRY.find((m) => m.id === id);
}

/** Aplica o modo de valor a uma série [{x, y}] (y pode ser null). */
export function applyValueMode(
  points: { x: string; y: number | null; row: any }[],
  mode: ValueMode,
  movingWindow = 5,
): { x: string; y: number | null; row: any }[] {
  if (mode === "cumulative") {
    let acc = 0;
    return points.map((p) => { acc += p.y ?? 0; return { ...p, y: acc }; });
  }
  if (mode === "avg") {
    return points.map((p) => ({ ...p, y: p.y != null && p.row?.n ? p.y / p.row.n : p.y }));
  }
  if (mode === "moving") {
    return points.map((p, i) => {
      const slice = points.slice(Math.max(0, i - movingWindow + 1), i + 1)
        .map((q) => q.y).filter((v): v is number => v != null);
      return { ...p, y: slice.length ? slice.reduce((a, b) => a + b, 0) / slice.length : null };
    });
  }
  return points;
}
