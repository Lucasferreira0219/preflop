import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { BrandBar } from "@/components/layout/BrandBar";
import { MenuButton } from "@/components/layout/MenuButton";
import { IconButton } from "@/components/ui/IconButton";
import { Select } from "@/components/ui/Select";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Slider } from "@/components/ui/Slider";
import { Card, SectionLabel } from "@/components/ui/Card";
import { RangeMatrix } from "@/components/poker/RangeMatrix";
import { RangeLegend } from "@/components/poker/RangeLegend";
import { ConsultaInsights } from "@/components/consulta/ConsultaInsights";
import { api } from "@/lib/api";
import { ALL_POSITIONS, POSITIONS_BY_COUNT, POS_FULL, POS_LABEL, SCENARIO_SHORT, actionDisplayName, handDescription, normalizeAction } from "@/lib/poker";
import { lsGet, lsSet } from "@/lib/storage";
import { useApp } from "@/state/AppProvider";
import { MODE_LABEL } from "@/lib/mode";
import type { Insights, Mode, RangeResponse, Scenario } from "@/lib/types";
import { cn } from "@/lib/cn";

const PREFS_KEY = "preflop.consulta.prefs.v2";
const CAN_RFI: Record<string, boolean> = {
  UTG: true, UTG1: true, UTG2: true, MP: true, HJ: true, CO: true, BTN: true, SB: true, BB: false,
};
const PHASES = [
  { value: "auto", label: "Fase: auto" },
  { value: "early", label: "Early" },
  { value: "middle", label: "Middle" },
  { value: "late", label: "Late" },
  { value: "shortstack", label: "Short" },
];

function deriveScenario(hero: string | null, villain: string | null, active: string[]): Scenario | null {
  if (!hero) return null;
  if (villain === "none" || !villain) return "RFI";
  const hi = active.indexOf(hero);
  const vi = active.indexOf(villain);
  if (hi === -1 || vi === -1) return null;
  return vi < hi ? "vs_RFI" : "vs_3bet";
}

function defaultVillainFor(hero: string, active: string[]): string | null {
  if (CAN_RFI[hero]) return "none";
  const before = active.filter((p) => active.indexOf(p) < active.indexOf(hero));
  return before.length ? before[before.length - 1] : null;
}

export function ConsultaPage() {
  const { mode, setMode, setDrawerOpen } = useApp();

  const saved = lsGet<{ stack?: number; playerCount?: number; phase?: string }>(PREFS_KEY, {});
  const [stack, setStack] = useState<number>(saved.stack ?? 35);
  const [playerCount, setPlayerCount] = useState<number>(saved.playerCount ?? 9);
  const [phase, setPhase] = useState<string>(saved.phase ?? "auto");
  const [heroPos, setHeroPos] = useState<string | null>(null);
  const [villain, setVillain] = useState<string | null>(null);
  const [villainsWithData, setVillainsWithData] = useState<Record<string, Scenario>>({});
  const [rangeData, setRangeData] = useState<RangeResponse | null>(null);
  const [insights, setInsights] = useState<Insights | null>(null);

  const active = useMemo(() => POSITIONS_BY_COUNT[playerCount] || ALL_POSITIONS, [playerCount]);
  const scenario = deriveScenario(heroPos, villain, active);

  const stateRef = useRef({ stack, playerCount, phase, heroPos, villain });
  stateRef.current = { stack, playerCount, phase, heroPos, villain };

  const persist = useCallback((patch: Partial<{ stack: number; playerCount: number; phase: string }>) => {
    const cur = stateRef.current;
    lsSet(PREFS_KEY, { stack: cur.stack, playerCount: cur.playerCount, phase: cur.phase, ...patch });
  }, []);

  const phaseArg = phase !== "auto" ? phase : null;

  const loadGenericInsights = useCallback(() => {
    api
      .getInsights(mode, stateRef.current.stack, null, null, null, stateRef.current.playerCount, stateRef.current.phase !== "auto" ? stateRef.current.phase : null)
      .then(setInsights)
      .catch(() => setInsights(null));
  }, [mode]);

  const refreshRange = useCallback(
    (hero: string, vil: string | null) => {
      const scen = deriveScenario(hero, vil, POSITIONS_BY_COUNT[stateRef.current.playerCount] || ALL_POSITIONS) || "RFI";
      const villArg = vil && vil !== "none" ? vil : null;
      const s = stateRef.current.stack;
      const pArg = stateRef.current.phase !== "auto" ? stateRef.current.phase : null;
      api
        .getRange(hero, scen, s, mode, villArg)
        .then(setRangeData)
        .catch((e) => console.error("get_range", e));
      api
        .getInsights(mode, s, hero, scen, villArg, stateRef.current.playerCount, pArg)
        .then(setInsights)
        .catch(() => setInsights(null));
    },
    [mode],
  );

  const loadVillains = useCallback(
    async (hero: string) => {
      try {
        const data = await api.listVillains(hero, stateRef.current.stack, mode);
        setVillainsWithData(data || {});
        return data || {};
      } catch {
        setVillainsWithData({});
        return {};
      }
    },
    [mode],
  );

  const selectHero = useCallback(
    async (pos: string) => {
      if (!active.includes(pos)) return;
      setHeroPos(pos);
      await loadVillains(pos);
      const v = defaultVillainFor(pos, POSITIONS_BY_COUNT[stateRef.current.playerCount] || ALL_POSITIONS);
      setVillain(v);
      if (v) refreshRange(pos, v);
    },
    [active, loadVillains, refreshRange],
  );

  const chooseVillain = useCallback(
    (v: string) => {
      if (!heroPos) return;
      setVillain(v);
      refreshRange(heroPos, v);
    },
    [heroPos, refreshRange],
  );

  // Carrega insights genéricos no início e quando muda contexto sem hero.
  useEffect(() => {
    if (!heroPos) loadGenericInsights();
    else {
      loadVillains(heroPos).then(() => refreshRange(heroPos, stateRef.current.villain));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  useEffect(() => {
    loadGenericInsights();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onStack = (v: number) => {
    setStack(v);
    persist({ stack: v });
    if (heroPos) loadVillains(heroPos).then(() => refreshRange(heroPos, villain));
    else loadGenericInsights();
  };
  const onPhase = (v: string) => {
    setPhase(v);
    persist({ phase: v });
    if (heroPos) refreshRange(heroPos, villain);
    else loadGenericInsights();
  };
  const onPlayerCount = (dir: number) => {
    const next = playerCount + dir;
    if (next < 2 || next > 9) return;
    setPlayerCount(next);
    persist({ playerCount: next });
    const nextActive = POSITIONS_BY_COUNT[next] || ALL_POSITIONS;
    if (heroPos && !nextActive.includes(heroPos)) {
      setHeroPos(null);
      setVillain(null);
      setRangeData(null);
      loadGenericInsights();
    }
  };

  const villainOrder = useMemo(() => {
    if (!heroPos) return [];
    const order: { key: string; label: string }[] = [];
    if (CAN_RFI[heroPos]) order.push({ key: "none", label: "Ninguém" });
    active.forEach((p) => {
      if (p !== heroPos) order.push({ key: p, label: POS_LABEL[p] });
    });
    return order;
  }, [heroPos, active]);

  const getTooltip = useCallback(
    (hand: string, _action: string) => {
      const buckets = rangeData?.buckets || {};
      const inActs = Object.keys(buckets).filter((act) => (buckets[act] || []).includes(hand));
      return (
        <div>
          <div className="font-semibold text-ink nums">{hand}</div>
          <div className="text-ink-faint">{handDescription(hand)}</div>
          <div className="mt-1.5 border-t border-border pt-1.5">
            {inActs.length ? (
              inActs.map((act) => (
                <div key={act} className="text-ink-dim">
                  {actionDisplayName(normalizeAction(act), rangeData?.scenario, stack)}
                </div>
              ))
            ) : (
              <span className="text-ink-faint">Fold</span>
            )}
          </div>
        </div>
      );
    },
    [rangeData, stack],
  );

  const scenarioTitle = useMemo(() => {
    if (!rangeData || rangeData.error) return "";
    const h = POS_LABEL[rangeData.my_pos] || rangeData.my_pos;
    if (rangeData.scenario === "RFI") return `${h} · Abertura (RFI) · ${rangeData.stack}bb`;
    const v = rangeData.villain_pos ? POS_LABEL[rangeData.villain_pos] : "";
    if (rangeData.scenario === "vs_RFI") return `${h} vs abertura do ${v} · ${rangeData.stack}bb`;
    return `${h} vs 3-bet do ${v} · ${rangeData.stack}bb`;
  }, [rangeData]);

  return (
    <div className="min-h-full">
      <header className="sticky top-0 z-30 border-b border-border bg-bg/85 backdrop-blur-md">
        <BrandBar
          title="Ranges e Regras"
          center={
            <SegmentedControl<Mode>
              size="sm"
              value={mode}
              onChange={setMode}
              segments={[
                { value: "mtt", label: MODE_LABEL.mtt },
                { value: "sng", label: MODE_LABEL.sng },
              ]}
            />
          }
          actions={<MenuButton />}
        />
        {/* Controles */}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-3 border-t border-border px-4 py-3 sm:px-5">
          <div className="flex min-w-[180px] flex-1 items-center gap-3">
            <span className="text-2xs font-semibold uppercase tracking-[0.12em] text-ink-faint">Stack</span>
            <Slider value={stack} min={10} max={100} onValueChange={onStack} ariaLabel="Stack" className="flex-1" />
            <span className="w-12 text-right text-sm font-semibold text-ink nums">{stack}bb</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-2xs font-semibold uppercase tracking-[0.12em] text-ink-faint">Jogadores</span>
            <div className="flex items-center gap-1.5">
              <IconButton label="Menos jogadores" onClick={() => onPlayerCount(-1)} className="h-8 w-8" disabled={playerCount <= 2}>
                <Minus className="h-4 w-4" />
              </IconButton>
              <span className="w-5 text-center text-sm font-semibold text-ink nums">{playerCount}</span>
              <IconButton label="Mais jogadores" onClick={() => onPlayerCount(1)} className="h-8 w-8" disabled={playerCount >= 9}>
                <Plus className="h-4 w-4" />
              </IconButton>
            </div>
          </div>
          <Select ariaLabel="Fase" value={phase} onValueChange={onPhase} options={PHASES} className="min-w-[120px]" />
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl px-3 py-4 sm:px-5 sm:py-6">
        {/* Seletor de posição */}
        <Card className="mb-3 p-4">
          <SectionLabel className="mb-2.5">Posição do herói</SectionLabel>
          <div className="flex flex-wrap gap-1.5">
            {ALL_POSITIONS.map((pos) => {
              const isActive = active.includes(pos);
              const selected = pos === heroPos;
              return (
                <button
                  key={pos}
                  disabled={!isActive}
                  title={POS_FULL[pos]}
                  onClick={() => selectHero(pos)}
                  className={cn(
                    "h-9 min-w-[48px] rounded-ctl border px-3 text-[13px] font-semibold transition-colors nums",
                    selected
                      ? "border-gold/50 bg-gold/15 text-gold"
                      : isActive
                        ? "border-border bg-surface-2 text-ink-dim hover:border-border-strong hover:text-ink"
                        : "cursor-not-allowed border-transparent bg-surface-1 text-ink-faint/40",
                  )}
                >
                  {POS_LABEL[pos]}
                </button>
              );
            })}
          </div>

          {heroPos && (
            <>
              <SectionLabel className="mb-2.5 mt-4">Quem agiu antes?</SectionLabel>
              <div className="flex flex-wrap gap-1.5">
                {villainOrder.map(({ key, label }) => {
                  const scen = deriveScenario(heroPos, key, active);
                  const hasData = key === "none" ? CAN_RFI[heroPos] : villainsWithData[key] !== undefined;
                  const selected = villain === key;
                  return (
                    <button
                      key={key}
                      onClick={() => hasData && chooseVillain(key)}
                      disabled={!hasData}
                      title={hasData ? SCENARIO_SHORT[scen || "RFI"] : "Sem range cadastrado"}
                      className={cn(
                        "h-9 min-w-[48px] rounded-ctl border px-3 text-[13px] font-semibold transition-colors nums",
                        selected
                          ? scen === "RFI"
                            ? "border-action-green/50 bg-action-green/15 text-action-green"
                            : scen === "vs_RFI"
                              ? "border-action-blue/50 bg-action-blue/15 text-action-blue"
                              : "border-poker-fourbet/50 bg-poker-fourbet/15 text-[#b79ee8]"
                          : hasData
                            ? "border-border bg-surface-2 text-ink-dim hover:border-border-strong hover:text-ink"
                            : "cursor-not-allowed border-transparent bg-surface-1 text-ink-faint/40",
                      )}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </Card>

        {!heroPos || !rangeData || rangeData.error ? (
          <Card className="p-10 text-center">
            <p className="text-sm text-ink-dim">
              {rangeData?.error || "Escolha uma posição para ver o range. As informações da fase aparecem ao lado."}
            </p>
          </Card>
        ) : (
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
            <Card className="p-4 sm:p-5">
              <CardTitleRow title={scenarioTitle} />
              <div className="grid gap-4 sm:grid-cols-[1fr_150px] sm:items-start">
                <RangeMatrix buckets={rangeData.buckets} getTooltip={getTooltip} className="sm:max-w-[420px]" />
                <div>
                  <div className="mb-2 text-2xs font-semibold uppercase tracking-[0.12em] text-ink-faint">Legenda</div>
                  <RangeLegend buckets={rangeData.buckets} />
                </div>
              </div>
            </Card>
            <ConsultaInsights ins={insights} scenario={scenario} hasHero={!!heroPos} />
          </div>
        )}

        {!heroPos && insights && (
          <ConsultaInsights ins={insights} scenario={null} hasHero={false} />
        )}
      </main>
    </div>
  );
}

function CardTitleRow({ title }: { title: string }) {
  return <h3 className="mb-3 text-sm font-semibold text-ink">{title}</h3>;
}
