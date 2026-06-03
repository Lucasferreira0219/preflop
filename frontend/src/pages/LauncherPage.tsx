import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight, BookOpen, Dumbbell, Grid3x3, LineChart, Loader2,
  MessageCircleQuestion, RotateCcw, Settings, Target, Upload,
} from "lucide-react";
import { MenuButton } from "@/components/layout/MenuButton";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Card } from "@/components/ui/Card";
import { PkeBadge } from "@/components/PkeBadge";
import { useApp } from "@/state/AppProvider";
import { api } from "@/lib/api";
import { MODE_LABEL } from "@/lib/mode";
import { CAT_LABEL, ruleIdOf, trainModeFor } from "@/lib/pke";
import type { Mode, StudyOverview } from "@/lib/types";
import { cn } from "@/lib/cn";

type PlanItem =
  | { kind: "train"; label: string; mode: string }
  | { kind: "review"; label: string }
  | { kind: "rule"; label: string; ruleId: string };

function buildPlan(s: StudyOverview): PlanItem[] {
  const items: PlanItem[] = [];
  const seen = new Set<string>();
  for (const l of s.leaks) {
    const mode = trainModeFor(l.exercicio);
    if (mode && !seen.has(mode)) {
      seen.add(mode);
      items.push({ kind: "train", label: `Treinar ${CAT_LABEL[mode] ?? mode} — 10 mãos`, mode });
    }
  }
  if (s.tem_revisao) items.push({ kind: "review", label: "Revisar mãos com nota baixa" });
  const firstRule = s.leaks.map((l) => ruleIdOf(l.regra_violada)).find(Boolean);
  if (firstRule) items.push({ kind: "rule", label: `Ler regra ${firstRule}`, ruleId: firstRule });
  return items;
}

export function LauncherPage() {
  const { mode, setMode, openRule } = useApp();
  const navigate = useNavigate();
  const [study, setStudy] = useState<StudyOverview | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.studyOverview()
      .then(setStudy)
      .catch(() => setStudy(null))
      .finally(() => setLoading(false));
  }, []);

  const topLeak = study?.leaks?.[0] ?? null;
  const plan = study?.tem_torneio ? buildPlan(study) : [];

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
        <p className="mt-1 text-sm text-ink-dim">Seu estudo guiado pelo PKE</p>
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

      {/* Próxima ação recomendada */}
      {loading ? (
        <Card className="mb-5 flex items-center justify-center gap-2 p-8 text-sm text-ink-dim">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando seu estudo…
        </Card>
      ) : study?.tem_torneio ? (
        <Card className="mb-4 p-5">
          <div className="mb-3 flex items-center justify-between gap-2">
            <span className="text-2xs font-semibold uppercase tracking-[0.12em] text-ink-faint">
              Continuar estudo
            </span>
            <PkeBadge variant="treino_leaks" />
          </div>

          {topLeak ? (
            <>
              <div className="text-base font-semibold text-ink">{topLeak.label}</div>
              <div className="mt-1 text-[13px] text-ink-dim">
                Último leak detectado
                {study.media_notas != null && (
                  <> · média do torneio <b className="text-ink">{study.media_notas.toFixed(1)}</b></>
                )}
              </div>
            </>
          ) : (
            <div className="text-[13px] text-ink-dim">
              Nenhum leak grave no último torneio. Bom trabalho — siga treinando para manter.
            </div>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              onClick={() => navigate("/treinar?mode=leaks")}
              className="inline-flex items-center gap-1.5 rounded-ctl border border-gold/50 bg-gold/15 px-4 py-2 text-sm font-semibold text-gold transition-colors hover:bg-gold/25"
            >
              <Target className="h-4 w-4" /> Treinar meus leaks
            </button>
            <button
              onClick={() => navigate("/tournaments")}
              className="inline-flex items-center gap-1.5 rounded-ctl border border-border bg-surface-2 px-4 py-2 text-sm font-semibold text-ink-dim transition-colors hover:text-ink"
            >
              <Upload className="h-4 w-4" /> Importar mais mãos
            </button>
          </div>
        </Card>
      ) : (
        <Card className="mb-4 p-5">
          <div className="mb-1 text-base font-semibold text-ink">Comece importando um torneio</div>
          <p className="text-[13px] leading-relaxed text-ink-dim">
            O PKE analisa suas mãos, encontra seus leaks e monta seu plano de estudo.
          </p>
          <button
            onClick={() => navigate("/tournaments")}
            className="mt-4 inline-flex items-center gap-1.5 rounded-ctl border border-gold/50 bg-gold/15 px-4 py-2 text-sm font-semibold text-gold transition-colors hover:bg-gold/25"
          >
            <Upload className="h-4 w-4" /> Importar mãos
          </button>
        </Card>
      )}

      {/* Plano de estudo de hoje */}
      {plan.length > 0 && (
        <Card className="mb-5 p-4">
          <div className="mb-2 text-2xs font-semibold uppercase tracking-[0.12em] text-ink-faint">
            Plano de estudo de hoje
          </div>
          <div className="flex flex-col gap-1.5">
            {plan.map((it, i) => (
              <PlanRow
                key={i}
                item={it}
                onClick={() => {
                  if (it.kind === "train") navigate(`/treinar?mode=${it.mode}&from=leak`);
                  else if (it.kind === "review") navigate("/treinar?mode=review");
                  else openRule(it.ruleId);
                }}
              />
            ))}
          </div>
        </Card>
      )}

      {/* Áreas */}
      <div className="grid gap-3 sm:grid-cols-2">
        <LaunchCard
          icon={<LineChart className="h-5 w-5" />}
          title="Meus Torneios"
          desc="Importe e revise resultados. Saldo, ROI, ITM e curva da banca."
          onClick={() => navigate("/tournaments")}
        />
        <LaunchCard
          icon={<Dumbbell className="h-5 w-5" />}
          title="Treinar"
          desc="Pratique spots e seus leaks. O motor corrige e cita a regra."
          onClick={() => navigate("/treinar")}
        />
        <LaunchCard
          icon={<Grid3x3 className="h-5 w-5" />}
          title="Ranges e Regras"
          desc="Veja ranges completos por posição, cenário e profundidade."
          onClick={() => navigate("/consulta")}
        />
        <LaunchCard
          icon={<MessageCircleQuestion className="h-5 w-5" />}
          title="Perguntar ao PKE"
          desc="Tire dúvidas de estratégia. Resposta pelo Guia de Bolso, com regra citada."
          onClick={() => navigate("/perguntar")}
        />
        <LaunchCard
          icon={<BookOpen className="h-5 w-5" />}
          title="Anotações"
          desc="Caderno de estudo. Salve mãos, leaks, dúvidas e planos — ligados ao PKE."
          onClick={() => navigate("/notes")}
        />
        <LaunchCard
          icon={<Settings className="h-5 w-5" />}
          title="Configurações"
          desc="Manutenção PKE: reprocessar torneios quando regras/ranges/nota mudarem."
          onClick={() => navigate("/settings")}
        />
      </div>

      <p className="mt-8 text-center text-2xs uppercase tracking-[0.16em] text-ink-faint">
        Modo atual · {MODE_LABEL[mode]}
      </p>
    </div>
  );
}

function PlanRow({ item, onClick }: { item: PlanItem; onClick: () => void }) {
  const icon =
    item.kind === "train" ? <Dumbbell className="h-4 w-4 text-gold" />
      : item.kind === "review" ? <RotateCcw className="h-4 w-4 text-action-blue" />
        : <BookOpen className="h-4 w-4 text-action-blue" />;
  return (
    <button
      onClick={onClick}
      className="group flex items-center gap-2.5 rounded-ctl border border-border bg-surface-1 px-3 py-2.5 text-left transition-colors hover:border-border-strong hover:bg-surface-2"
    >
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-ctl border border-border bg-surface-2">
        {icon}
      </span>
      <span className="flex-1 text-[13px] text-ink">{item.label}</span>
      <ArrowRight className="h-4 w-4 shrink-0 -translate-x-1 text-ink-faint opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100" />
    </button>
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
