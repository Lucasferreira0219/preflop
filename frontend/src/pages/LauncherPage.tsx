import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight, BookOpen, LineChart, Loader2,
  Settings, Upload,
} from "lucide-react";
import { MenuButton } from "@/components/layout/MenuButton";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Card } from "@/components/ui/Card";
import { useApp } from "@/state/AppProvider";
import { api } from "@/lib/api";
import { MODE_LABEL } from "@/lib/mode";
import type { Mode } from "@/lib/types";
import { cn } from "@/lib/cn";

export function LauncherPage() {
  const { mode, setMode } = useApp();
  const navigate = useNavigate();
  const [hasTournament, setHasTournament] = useState<boolean | null>(null);

  useEffect(() => {
    api.studyOverview()
      .then((s) => setHasTournament(s?.tem_torneio ?? false))
      .catch(() => setHasTournament(false));
  }, []);

  return (
    <div className="mx-auto flex min-h-full w-full max-w-2xl flex-col px-5 py-8">
      <div className="mb-2 flex justify-end">
        <MenuButton />
      </div>
      <div className="mb-6 flex flex-col items-center text-center">
        <span className="mb-3 grid h-12 w-12 place-items-center rounded-2xl border border-gold/30 bg-gold/10 text-xl text-gold">
          ♠
        </span>
        <h1 className="text-2xl font-bold tracking-tight text-ink">Preflop</h1>
        <p className="mt-1 text-sm text-ink-dim">Acompanhe seus torneios</p>
      </div>

      <div className="mb-6 flex justify-center">
        <SegmentedControl<Mode>
          value={mode}
          onChange={setMode}
          segments={[
            { value: "mtt", label: MODE_LABEL.mtt },
            { value: "sng", label: MODE_LABEL.sng },
          ]}
        />
      </div>

      {hasTournament === null ? (
        <Card className="mb-5 flex items-center justify-center gap-2 p-8 text-sm text-ink-dim">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
        </Card>
      ) : !hasTournament ? (
        <Card className="mb-4 p-5">
          <div className="mb-1 text-base font-semibold text-ink">Comece importando um torneio</div>
          <p className="text-[13px] leading-relaxed text-ink-dim">
            Importe seus históricos do PokerStars para acompanhar resultados, ROI e sessões.
          </p>
          <button
            onClick={() => navigate("/tournaments")}
            className="mt-4 inline-flex items-center gap-1.5 rounded-ctl border border-gold/50 bg-gold/15 px-4 py-2 text-sm font-semibold text-gold transition-colors hover:bg-gold/25"
          >
            <Upload className="h-4 w-4" /> Importar mãos
          </button>
        </Card>
      ) : null}

      {/* Áreas */}
      <div className="grid gap-3 sm:grid-cols-2">
        <LaunchCard
          icon={<LineChart className="h-5 w-5" />}
          title="Meus Torneios"
          desc="Importe e revise resultados. Saldo, ROI, ITM e curva da banca."
          onClick={() => navigate("/tournaments")}
        />
        <LaunchCard
          icon={<BookOpen className="h-5 w-5" />}
          title="Anotações"
          desc="Caderno de estudo. Salve mãos, leaks, dúvidas e planos."
          onClick={() => navigate("/notes")}
        />
        <LaunchCard
          icon={<Settings className="h-5 w-5" />}
          title="Configurações"
          desc="Manutenção: reprocessar torneios quando ranges/nota mudarem."
          onClick={() => navigate("/settings")}
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
