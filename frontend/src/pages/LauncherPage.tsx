import { useNavigate } from "react-router-dom";
import { ArrowRight, Grid3x3, LineChart, Target } from "lucide-react";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { useApp } from "@/state/AppProvider";
import { MODE_LABEL } from "@/lib/mode";
import type { Mode } from "@/lib/types";
import { cn } from "@/lib/cn";

export function LauncherPage() {
  const { mode, setMode } = useApp();
  const navigate = useNavigate();

  return (
    <div className="mx-auto flex min-h-full w-full max-w-2xl flex-col justify-center px-5 py-10">
      <div className="mb-8 flex flex-col items-center text-center">
        <span className="mb-4 grid h-14 w-14 place-items-center rounded-2xl border border-gold/30 bg-gold/10 text-2xl text-gold">
          ♠
        </span>
        <h1 className="text-2xl font-bold tracking-tight text-ink">Preflop</h1>
        <p className="mt-1 text-sm text-ink-dim">Treino de ranges preflop</p>
      </div>

      <div className="mb-7 flex justify-center">
        <SegmentedControl<Mode>
          value={mode}
          onChange={setMode}
          segments={[
            { value: "mtt", label: MODE_LABEL.mtt },
            { value: "sng", label: MODE_LABEL.sng },
          ]}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <LaunchCard
          icon={<Target className="h-5 w-5" />}
          title="Simulador"
          desc="Pratique decisões com mãos aleatórias e acompanhe sua evolução."
          onClick={() => navigate("/sim")}
        />
        <LaunchCard
          icon={<Grid3x3 className="h-5 w-5" />}
          title="Consulta"
          desc="Visualize ranges completos por posição, cenário e profundidade."
          onClick={() => navigate("/consulta")}
        />
        <LaunchCard
          icon={<LineChart className="h-5 w-5" />}
          title="Torneios"
          desc="Planilha dos torneios jogados. Saldo, ROI, ITM e curva da banca."
          onClick={() => navigate("/tournaments")}
        />
      </div>

      <p className="mt-8 text-center text-2xs uppercase tracking-[0.16em] text-ink-faint">
        Modo atual · {MODE_LABEL[mode]}
      </p>
    </div>
  );
}

function LaunchCard({
  icon,
  title,
  desc,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "group flex flex-col rounded-card border border-border bg-surface-1 p-5 text-left shadow-card transition-colors",
        "hover:border-border-strong hover:bg-surface-2",
      )}
    >
      <span className="mb-4 grid h-10 w-10 place-items-center rounded-ctl border border-border bg-surface-2 text-ink-dim group-hover:text-gold">
        {icon}
      </span>
      <span className="flex items-center gap-1.5 text-base font-semibold text-ink">
        {title}
        <ArrowRight className="h-4 w-4 -translate-x-1 text-ink-faint opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100" />
      </span>
      <span className="mt-1.5 text-[13px] leading-relaxed text-ink-dim">{desc}</span>
    </button>
  );
}
