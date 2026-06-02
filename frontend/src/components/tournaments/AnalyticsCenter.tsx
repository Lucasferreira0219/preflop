import { useEffect, useMemo, useState } from "react";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Line, LineChart,
  ReferenceLine, ResponsiveContainer, Scatter, ScatterChart, Tooltip,
  XAxis, YAxis, ZAxis,
} from "recharts";
import { Card, SectionLabel } from "@/components/ui/Card";
import { Select } from "@/components/ui/Select";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { fmtMoney, fmtPct } from "@/lib/money";
import { leakLabel } from "@/lib/pke";
import {
  COLOR, GRAN_LABEL, TAB_LABEL, VALUE_MODE_LABEL,
  applyValueMode, fmtUnit, metricsForTab, notaColor, signColor, seriesFor, xLabel,
} from "@/lib/analyticsRegistry";
import type { ChartType, Granularity, MetricDef, TabId, ValueMode } from "@/lib/analyticsRegistry";
import type { AnalyticsPayload } from "@/lib/types";
import { cn } from "@/lib/cn";

const TABS: TabId[] = ["fin", "volume", "perf", "tec"];
const CHART_TYPE_LABEL: Record<"bar" | "line" | "area", string> = {
  bar: "Barras", line: "Linha", area: "Área",
};
const CHART_TYPE_OPTS: ("bar" | "line" | "area")[] = ["bar", "line", "area"];

// Rótulos das classes de decisão (espelha _SHOWN_LABEL do PKE — só apresentação).
const DECISION_LABEL: Record<string, string> = {
  correct: "Acerto", minor_error: "Erro leve", medium_error: "Erro médio",
  major_error: "Erro grave", cooler: "Cooler", insufficient: "Insuficiente",
};
const DECISION_COLOR: Record<string, string> = {
  correct: COLOR.green, minor_error: COLOR.gold, medium_error: "#E08A3C",
  major_error: COLOR.red, cooler: COLOR.slate, insufficient: "#5D6875",
};

export function AnalyticsCenter({ analytics, currency }: {
  analytics: AnalyticsPayload;
  currency: string;
}) {
  const [tab, setTab] = useState<TabId>("fin");
  const metrics = useMemo(() => metricsForTab(tab), [tab]);
  const [metricId, setMetricId] = useState(metrics[0]?.id);
  const metric = metrics.find((m) => m.id === metricId) ?? metrics[0];

  // granularidades visíveis (exclui "overall", que não tem seletor)
  const grans = (metric?.granularities ?? []).filter((g) => g !== "overall");
  const [gran, setGran] = useState<Granularity>(grans[0] ?? "day");
  const valueModes = metric?.valueModes ?? ["abs"];
  const [valueMode, setValueMode] = useState<ValueMode>(valueModes[0] ?? "abs");
  // séries temporais permitem trocar o tipo de gráfico (barras/linha/área).
  // padrão = área.
  const isTimeSeries = metric ? metric.chartType !== "distribution" && metric.chartType !== "scatter" : false;
  const [chartType, setChartType] = useState<ChartType>(isTimeSeries ? "area" : (metric?.chartType ?? "area"));

  // ao trocar de aba: seleciona a 1ª métrica da aba
  useEffect(() => { setMetricId(metricsForTab(tab)[0]?.id); }, [tab]);
  // ao trocar de métrica: reseta granularidade, modo de valor e tipo de gráfico
  useEffect(() => {
    const m = metricsForTab(tab).find((x) => x.id === metricId);
    if (!m) return;
    const g = m.granularities.filter((x) => x !== "overall");
    setGran(g[0] ?? "day");
    setValueMode((m.valueModes ?? ["abs"])[0] ?? "abs");
    const isTs = m.chartType !== "distribution" && m.chartType !== "scatter";
    setChartType(isTs ? "area" : m.chartType);
  }, [metricId, tab]);

  if (!metric) return null;

  return (
    <div className="mt-1">
      <SegmentedControl
        size="sm"
        value={tab}
        onChange={setTab}
        segments={TABS.map((t) => ({ value: t, label: TAB_LABEL[t] }))}
        className="w-full overflow-x-auto"
      />

      <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Select
          value={metric.id}
          onValueChange={setMetricId}
          options={metrics.map((m) => ({ value: m.id, label: m.label }))}
          ariaLabel="Métrica"
          className="w-full sm:w-56"
        />
        <div className="flex flex-wrap items-center gap-2">
          {grans.length > 1 && (
            <Select
              value={gran}
              onValueChange={(v) => setGran(v as Granularity)}
              options={grans.map((g) => ({ value: g, label: GRAN_LABEL[g] }))}
              ariaLabel="Granularidade"
              className="w-40"
            />
          )}
          {valueModes.length > 1 && (
            <SegmentedControl
              size="sm"
              value={valueMode}
              onChange={setValueMode}
              segments={valueModes.map((m) => ({ value: m, label: VALUE_MODE_LABEL[m] }))}
            />
          )}
          {isTimeSeries && (
            <SegmentedControl
              size="sm"
              value={chartType as "bar" | "line" | "area"}
              onChange={(v) => setChartType(v)}
              segments={CHART_TYPE_OPTS.map((c) => ({ value: c, label: CHART_TYPE_LABEL[c] }))}
            />
          )}
        </div>
      </div>

      <Card className="mt-2 p-3 sm:p-4">
        <AnalyticsChart metric={metric} gran={gran} valueMode={valueMode} chartType={chartType}
          analytics={analytics} currency={currency} />
      </Card>
    </div>
  );
}

// ── Dispatcher (sem hooks — escolhe o tipo de gráfico) ─────────────────────────
function AnalyticsChart({ metric, gran, valueMode, chartType, analytics, currency }: {
  metric: MetricDef; gran: Granularity; valueMode: ValueMode; chartType: ChartType;
  analytics: AnalyticsPayload; currency: string;
}) {
  if (metric.chartType === "distribution") return <DistributionChart metric={metric} analytics={analytics} />;
  if (metric.chartType === "scatter") return <CorrelationChart analytics={analytics} currency={currency} />;
  return <TimeSeriesChart metric={metric} gran={gran} valueMode={valueMode} chartType={chartType} analytics={analytics} currency={currency} />;
}

// ── Séries temporais (bar / area / line) ───────────────────────────────────────
function TimeSeriesChart({ metric, gran, valueMode, chartType, analytics, currency }: {
  metric: MetricDef; gran: Granularity; valueMode: ValueMode; chartType: ChartType;
  analytics: AnalyticsPayload; currency: string;
}) {
  const points = useMemo(() => {
    const raw = seriesFor(analytics, gran).map((row) => (
      { x: xLabel(gran, row), y: metric.y(row), row }
    ));
    return applyValueMode(raw, valueMode);
  }, [analytics, gran, metric, valueMode]);

  const hasData = points.some((p) => p.y != null);
  if (!hasData) return <Empty text={metric.empty ?? "Sem dados ainda."} />;

  const fmtY = (v: number) => fmtUnit(metric.unit, v, currency);
  const tickY = (v: number) =>
    metric.unit === "money" ? fmtMoney(Math.round(v), currency, { placeholder: "0" })
      : metric.unit === "pct" ? `${Math.round(v)}%`
        : metric.unit === "hours" ? `${v}h` : String(v);

  const tone = (() => {
    const last = [...points].reverse().find((p) => p.y != null)?.y ?? 0;
    return signColor(last, metric.unit);
  })();
  // Métricas financeiras (lucro/ROI/banca): zero visível, lucro acima / prejuízo abaixo.
  const zero = !!metric.colorBySign;
  const yDomain: any = zero
    ? [(min: number) => Math.min(0, min), (max: number) => Math.max(0, max)]
    : ["auto", "auto"];

  const common = (
    <>
      <CartesianGrid stroke="#273241" vertical={false} />
      <XAxis dataKey="x" tick={{ fill: "#5D6875", fontSize: 10 }} tickLine={false}
        axisLine={{ stroke: "#273241" }} minTickGap={10} />
      <YAxis tick={{ fill: "#5D6875", fontSize: 10 }} tickLine={false} axisLine={false}
        width={48} tickFormatter={tickY} domain={yDomain}
        allowDecimals={metric.unit !== "count"} />
      {zero && <ReferenceLine y={0} stroke="#5D6875" strokeWidth={1} />}
      <Tooltip content={<ChartTooltip fmt={fmtY} metric={metric} currency={currency} />} cursor={{ fill: "#1A222E" }} />
    </>
  );

  return (
    <>
      <div className="mb-1 flex items-center justify-between">
        <SectionLabel>{metric.label}</SectionLabel>
        <span className="text-2xs text-ink-faint">{GRAN_LABEL[gran]}</span>
      </div>
      <div className="h-[200px] w-full sm:h-[240px]">
        <ResponsiveContainer width="100%" height="100%">
          {chartType === "area" ? (
            <AreaChart data={points} margin={{ top: 6, right: 6, bottom: 0, left: -6 }}>
              <defs>
                <linearGradient id="anFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={tone} stopOpacity={0.28} />
                  <stop offset="100%" stopColor={tone} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              {common}
              <Area type="monotone" dataKey="y" stroke={tone} strokeWidth={2} fill="url(#anFill)"
                baseValue={zero ? 0 : undefined} connectNulls dot={points.length <= 8 ? { r: 2, fill: tone } : false} />
            </AreaChart>
          ) : chartType === "line" ? (
            <LineChart data={points} margin={{ top: 6, right: 6, bottom: 0, left: -6 }}>
              {common}
              <Line type="monotone" dataKey="y" stroke={zero ? tone : COLOR.gold} strokeWidth={2}
                connectNulls dot={{ r: 2, fill: zero ? tone : COLOR.gold }} />
            </LineChart>
          ) : (
            <BarChart data={points} margin={{ top: 6, right: 6, bottom: 0, left: -6 }}>
              {common}
              <Bar dataKey="y" radius={[3, 3, 0, 0]} maxBarSize={46}>
                {points.map((p, i) => (
                  <Cell key={i}
                    fill={metric.id === "nota" && p.y != null ? notaColor(p.y)
                      : metric.colorBySign && p.y != null ? signColor(p.y, metric.unit)
                        : COLOR.gold}
                    fillOpacity={p.row?.estimated ? 0.45 : 1} />
                ))}
              </Bar>
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
      {points.some((p) => p.row?.estimated) && (
        <p className="mt-1 text-2xs text-ink-faint">Barras esmaecidas = duração estimada (torneio sem mãos importadas).</p>
      )}
    </>
  );
}

// ── Distribuições (status, spots, tipos de erro, leaks, posições) ──────────────
function DistributionChart({ metric, analytics }: {
  metric: MetricDef; analytics: AnalyticsPayload;
}) {
  const rows = useMemo(() => distributionData(metric, analytics), [metric, analytics]);
  if (!rows.length || rows.every((r) => r.value === 0)) return <Empty text={metric.empty ?? "Sem dados ainda."} />;
  const total = rows.reduce((a, r) => a + r.value, 0) || 1;
  const max = Math.max(1, ...rows.map((r) => r.value));
  const isPct = metric.unit === "pct";
  return (
    <>
      <SectionLabel>{metric.label}</SectionLabel>
      <div className="mt-3 flex flex-col gap-2">
        {rows.map((r) => {
          const w = isPct ? r.value : (r.value / max) * 100;
          return (
            <div key={r.label} className="flex items-center gap-2">
              <div className="w-28 shrink-0 truncate text-xs text-ink-dim" title={r.label}>{r.label}</div>
              <div className="h-3 flex-1 overflow-hidden rounded-full bg-surface-2">
                <div className="h-full rounded-full transition-all"
                  style={{ width: `${Math.min(100, w)}%`, backgroundColor: r.color }} />
              </div>
              <div className="w-20 shrink-0 text-right text-xs nums text-ink">
                {isPct ? `${r.value.toFixed(0)}%` : r.value}
                {!isPct && <span className="ml-1 text-2xs text-ink-faint">{((r.value / total) * 100).toFixed(0)}%</span>}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

function distributionData(metric: MetricDef, a: AnalyticsPayload): { label: string; value: number; color: string }[] {
  if (metric.source === "status_dist" && metric.id === "status_dist") {
    const d = a.status_dist;
    return (["correct", "minor_error", "medium_error", "major_error", "cooler", "insufficient"] as const)
      .map((k) => ({ label: DECISION_LABEL[k], value: d[k] ?? 0, color: DECISION_COLOR[k] }));
  }
  if (metric.id === "positions") {
    const sum = (k: string) => a.per_day.reduce((acc, d: any) => acc + (d[k] ?? 0), 0);
    return [
      { label: "1º lugar", value: sum("champion"), color: COLOR.gold },
      { label: "2º–3º", value: sum("podium"), color: COLOR.slate },
      { label: "ITM", value: sum("itm"), color: COLOR.green },
      { label: "Fora", value: sum("out"), color: "#3A4757" },
    ];
  }
  if (metric.source === "spots") {
    return a.spots.map((s) => ({ label: s.scenario, value: s.error_pct, color: COLOR.red }));
  }
  if (metric.source === "error_types") {
    return a.error_types.map((e) => ({ label: e.type, value: e.n, color: COLOR.gold }));
  }
  if (metric.source === "leaks") {
    const agg: Record<string, number> = {};
    for (const l of a.leaks_by_period) agg[l.leak] = (agg[l.leak] ?? 0) + l.n;
    return Object.entries(agg)
      .sort((x, y) => y[1] - x[1])
      .map(([leak, n]) => ({ label: leakLabel(leak) ?? leak, value: n, color: COLOR.gold }));
  }
  return [];
}

// ── Correlação resultado × qualidade (scatter) ─────────────────────────────────
function CorrelationChart({ analytics, currency }: { analytics: AnalyticsPayload; currency: string }) {
  const pts = analytics.correlation
    .filter((c) => c.media_notas != null && c.profit_cents != null)
    .map((c) => ({ nota: c.media_notas, profit: (c.profit_cents ?? 0) / 100, n: c.n }));
  if (!pts.length) return <Empty text="Sem torneios analisados para correlacionar." />;
  return (
    <>
      <div className="mb-1 flex items-center justify-between">
        <SectionLabel>Resultado × qualidade</SectionLabel>
        <span className="text-2xs text-ink-faint">cada ponto = 1 torneio</span>
      </div>
      <div className="h-[220px] w-full sm:h-[260px]">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 6, right: 10, bottom: 0, left: -6 }}>
            <CartesianGrid stroke="#273241" />
            <XAxis type="number" dataKey="nota" name="Nota" domain={[0, 10]}
              tick={{ fill: "#5D6875", fontSize: 10 }} tickLine={false} axisLine={{ stroke: "#273241" }}
              label={{ value: "Nota PKE", position: "insideBottom", offset: -2, fill: "#5D6875", fontSize: 10 }} />
            <YAxis type="number" dataKey="profit" name="Lucro"
              tick={{ fill: "#5D6875", fontSize: 10 }} tickLine={false} axisLine={false} width={44}
              tickFormatter={(v: number) => fmtMoney(Math.round(v * 100), currency, { placeholder: "0" })} />
            <ZAxis type="number" dataKey="n" range={[40, 200]} />
            <ReferenceLine y={0} stroke="#33414F" />
            <ReferenceLine x={6} stroke="#33414F" strokeDasharray="3 3" />
            <Tooltip cursor={{ stroke: "#33414F" }} content={<ScatterTooltip currency={currency} />} />
            <Scatter data={pts}>
              {pts.map((p, i) => (
                <Cell key={i} fill={p.profit > 0 ? COLOR.green : p.profit < 0 ? COLOR.red : COLOR.gold} />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-1 text-2xs text-ink-faint">Acima da linha = lucro; à direita de 6 = jogou bem. Canto sup. esq. = ganhou jogando mal (variância).</p>
    </>
  );
}

// ── Auxiliares ─────────────────────────────────────────────────────────────────
function Empty({ text }: { text: string }) {
  return <p className="py-10 text-center text-xs text-ink-faint sm:text-sm">{text}</p>;
}

function ChartTooltip({ active, payload, fmt, metric, currency }: any) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  const row = p.row ?? {};
  const showRoi = metric?.id !== "roi" && row.roi_pct != null;
  const showProfit = metric?.id !== "profit" && metric?.id !== "bankroll" && row.profit_cents != null;
  return (
    <div className="min-w-[120px] rounded-ctl border border-border bg-surface-2 px-3 py-2 text-xs shadow-pop">
      <div className="mb-1 font-semibold text-ink nums">{p.x}</div>
      <div className="flex items-center justify-between gap-3 nums">
        <span className="text-ink-faint">{metric?.label}</span>
        <span className="font-semibold text-ink">{fmt(p.y ?? 0)}</span>
      </div>
      {row.n != null && (
        <div className="flex items-center justify-between gap-3 nums">
          <span className="text-ink-faint">Torneios</span><span className="text-ink-dim">{row.n}</span>
        </div>
      )}
      {showProfit && (
        <div className="flex items-center justify-between gap-3 nums">
          <span className="text-ink-faint">Lucro</span>
          <span className={row.profit_cents > 0 ? "text-action-green" : row.profit_cents < 0 ? "text-action-red" : "text-ink-dim"}>
            {fmtMoney(row.profit_cents, currency, { signed: true })}
          </span>
        </div>
      )}
      {showRoi && (
        <div className="flex items-center justify-between gap-3 nums">
          <span className="text-ink-faint">ROI</span>
          <span className={row.roi_pct > 0 ? "text-action-green" : row.roi_pct < 0 ? "text-action-red" : "text-ink-dim"}>
            {fmtPct(row.roi_pct, 0)}
          </span>
        </div>
      )}
    </div>
  );
}

function ScatterTooltip({ active, payload, currency }: any) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-ctl border border-border bg-surface-2 px-3 py-2 text-xs shadow-pop">
      <div className="font-semibold text-ink nums">{fmtMoney(Math.round(p.profit * 100), currency, { signed: true })}</div>
      <div className="mt-0.5 text-ink-faint nums">Nota {p.nota?.toFixed(1)} · {p.n} mãos críticas</div>
    </div>
  );
}
