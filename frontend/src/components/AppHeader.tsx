import { BarChart3, BookOpen, PanelRight, RotateCcw, Shuffle } from "lucide-react";
import { BrandBar } from "@/components/layout/BrandBar";
import { StatsStrip } from "@/components/StatsStrip";
import { IconButton } from "@/components/ui/IconButton";
import { Select } from "@/components/ui/Select";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { useApp } from "@/state/AppProvider";
import { MODE_LABEL } from "@/lib/mode";
import { POS_LABEL, ALL_POSITIONS } from "@/lib/poker";
import type { Mode, Stats } from "@/lib/types";

export interface SimHeaderProps {
  stats: Stats;
  handNumber: number;
  stackValue: string;
  onStackChange: (v: string) => void;
  focusPos: string;
  onFocusPos: (v: string) => void;
  focusScenario: string;
  onFocusScenario: (v: string) => void;
  onReset: () => void;
  onOpenAnalytics: () => void;
  analyticsActive?: boolean;
}

/** Cabeçalho do Simulador em 3 linhas: marca/modo/ações · filtros · stats. */
export function AppHeader(props: SimHeaderProps) {
  const { mode, setMode, stacks, setDrawerOpen, setGlossaryOpen } = useApp();

  const ANY = "any"; // sentinel — Radix Select.Item não pode ter value=""
  const stackOptions = [
    { value: "0", label: "Aleatório" },
    ...stacks.map((s) => ({ value: String(s), label: `${s}bb` })),
  ];
  const posOptions = [
    { value: ANY, label: "Posição: todas" },
    ...ALL_POSITIONS.map((p) => ({ value: p, label: POS_LABEL[p] })),
  ];
  const scenOptions = [
    { value: ANY, label: "Cenário: todos" },
    { value: "RFI", label: "Abrir (RFI)" },
    { value: "vs_RFI", label: "vs Abertura" },
    { value: "vs_3bet", label: "vs 3-Bet" },
  ];

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-bg/85 backdrop-blur-md">
      {/* Linha 1 */}
      <BrandBar
        title="Simulador"
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
        actions={
          <>
            <IconButton label="Reiniciar estatísticas" onClick={props.onReset}>
              <RotateCcw className="h-[18px] w-[18px]" />
            </IconButton>
            <IconButton
              label="Análise de desempenho"
              active={props.analyticsActive}
              onClick={props.onOpenAnalytics}
            >
              <BarChart3 className="h-[18px] w-[18px]" />
            </IconButton>
            <IconButton label="Glossário" onClick={() => setGlossaryOpen(true)}>
              <BookOpen className="h-[18px] w-[18px]" />
            </IconButton>
            <IconButton label="Menu" onClick={() => setDrawerOpen(true)}>
              <PanelRight className="h-[18px] w-[18px]" />
            </IconButton>
          </>
        }
      />

      {/* Linha 2 — filtros */}
      <div className="flex flex-wrap items-center gap-2 border-t border-border px-4 py-2.5 sm:px-5">
        <div className="flex items-center gap-1.5 text-ink-faint">
          <Shuffle className="h-4 w-4" />
          <span className="text-2xs font-semibold uppercase tracking-[0.12em]">Filtros</span>
        </div>
        <Select
          ariaLabel="Stack"
          value={props.stackValue}
          onValueChange={props.onStackChange}
          options={stackOptions}
          className="min-w-[120px]"
        />
        <Select
          ariaLabel="Posição focada"
          value={props.focusPos || ANY}
          onValueChange={(v) => props.onFocusPos(v === ANY ? "" : v)}
          options={posOptions}
          className="min-w-[130px]"
        />
        <Select
          ariaLabel="Cenário focado"
          value={props.focusScenario || ANY}
          onValueChange={(v) => props.onFocusScenario(v === ANY ? "" : v)}
          options={scenOptions}
          className="min-w-[140px]"
        />
      </div>

      {/* Linha 3 — stats */}
      <StatsStrip stats={props.stats} handNumber={props.handNumber} />
    </header>
  );
}
