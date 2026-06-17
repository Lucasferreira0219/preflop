/** PkeReport — componentes de exibição do relatório de torneio.
 *  Contém apenas: Summary (resumo estatístico), Leaks (lista de leaks),
 *  HandList (lista de mãos críticas). Sem treino, sem PKE score, sem regras. */
import { useState } from "react";
import { NotebookPen } from "lucide-react";
import { Card, SectionLabel } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { leakLabel } from "@/lib/pke";
import type { ReportHand, ReportLeak, TournamentReport } from "@/lib/types";
import { cn } from "@/lib/cn";

// ── Summary ───────────────────────────────────────────────────────────────────

export function Summary({ report }: { report: TournamentReport }) {
  const stats: { label: string; value: string | number; tone?: "green" | "red" | "ink" }[] = [
    { label: "Mãos analisadas", value: report.maos_com_nota },
    { label: "Mãos críticas", value: report.maos_criticas, tone: report.maos_criticas > 0 ? "red" : "ink" },
    { label: "Erros graves", value: report.erros_graves, tone: report.erros_graves > 0 ? "red" : "ink" },
  ];
  if (report.fase_com_mais_erros) {
    stats.push({ label: "Fase com mais erros", value: report.fase_com_mais_erros });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {stats.map((s) => (
          <StatTile key={s.label} label={s.label} value={String(s.value)} tone={s.tone} />
        ))}
      </div>
      {report.leaks.length > 0 && (
        <Card className="p-3">
          <SectionLabel className="mb-2">Leaks detectados</SectionLabel>
          <ul className="flex flex-col gap-1.5">
            {report.leaks.slice(0, 3).map((l) => (
              <li key={l.id} className="text-[13px] text-ink-dim">
                <span className="font-semibold text-ink">{leakLabel(l.id) ?? l.label}</span>
                {" — "}{l.como_corrigir}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

// ── Leaks ─────────────────────────────────────────────────────────────────────

export function Leaks({
  leaks,
  onFilterSpot,
  onExportLeak,
}: {
  leaks: ReportLeak[];
  onFilterSpot: () => void;
  onExportLeak: (l: ReportLeak) => void;
}) {
  if (leaks.length === 0) {
    return <p className="py-8 text-center text-sm text-ink-faint">Nenhum leak detectado neste torneio.</p>;
  }
  return (
    <div className="flex flex-col gap-3">
      {leaks.map((l) => (
        <LeakCard key={l.id} leak={l} onFilterSpot={onFilterSpot} onExport={() => onExportLeak(l)} />
      ))}
    </div>
  );
}

function LeakCard({ leak, onFilterSpot, onExport }: {
  leak: ReportLeak;
  onFilterSpot: () => void;
  onExport: () => void;
}) {
  const sev = leak.gravidade;
  const sevCls = sev === "grave" ? "border-action-red/30 bg-action-red/5"
    : sev === "moderado" ? "border-gold/30 bg-gold/5"
    : "border-border bg-surface-1";
  return (
    <Card className={cn("p-3", sevCls)}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-ink">{leakLabel(leak.id) ?? leak.label}</div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-2xs text-ink-faint">
            <span>{leak.frequencia_hits}× detectado</span>
            {leak.gravidade && <span className="capitalize">{leak.gravidade}</span>}
            {leak.fase_predominante && <span>{leak.fase_predominante}</span>}
          </div>
        </div>
      </div>
      <p className="mt-2 text-[13px] leading-relaxed text-ink-dim">{leak.como_corrigir}</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <Button size="sm" variant="ghost" onClick={onFilterSpot}>
          Ver mãos
        </Button>
        <Button size="sm" variant="ghost" onClick={onExport}>
          <NotebookPen className="h-3.5 w-3.5" /> Anotar
        </Button>
      </div>
    </Card>
  );
}

// ── HandList ──────────────────────────────────────────────────────────────────

export function HandList({
  report,
  onExportHand,
}: {
  report: TournamentReport;
  onExportHand: (m: ReportHand) => void;
}) {
  const hands = report.piores_decisoes;
  if (hands.length === 0) {
    return <p className="py-8 text-center text-sm text-ink-faint">Nenhuma mão crítica neste torneio.</p>;
  }
  return (
    <div className="flex flex-col gap-2">
      {hands.map((m) => (
        <HandCard key={m.hand_id} hand={m} onExport={() => onExportHand(m)} />
      ))}
    </div>
  );
}

function HandCard({ hand, onExport }: { hand: ReportHand; onExport: () => void }) {
  const [open, setOpen] = useState(false);
  const isGrave = hand.gravidade === "grave";
  return (
    <Card className={cn("p-3", isGrave ? "border-action-red/20" : "")}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5 text-sm">
            {hand.cards && <span className="font-semibold text-ink">{hand.cards}</span>}
            {hand.pos && <span className="text-ink-dim">{hand.pos}</span>}
            {hand.fase && <span className="text-2xs text-ink-faint">{hand.fase}</span>}
          </div>
          {(hand.linha || hand.recomendado) && (
            <div className="mt-1 text-2xs text-ink-faint">
              {hand.linha && <span>Jogado: <span className="text-ink-dim">{hand.linha}</span></span>}
              {hand.recomendado && <span className="ml-2">Correto: <span className="text-ink-dim">{hand.recomendado}</span></span>}
            </div>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button size="sm" variant="ghost" onClick={onExport}>
            <NotebookPen className="h-3.5 w-3.5" />
          </Button>
          <button
            onClick={() => setOpen((v) => !v)}
            className="text-2xs text-ink-faint hover:text-ink"
          >
            {open ? "Fechar" : "Detalhes"}
          </button>
        </div>
      </div>
      {open && hand.erro && (
        <p className="mt-2 text-[13px] leading-relaxed text-ink-dim">{hand.erro}</p>
      )}
    </Card>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function StatTile({ label, value, tone = "ink" }: { label: string; value: string; tone?: "ink" | "green" | "red" }) {
  const c = { ink: "text-ink", green: "text-action-green", red: "text-action-red" }[tone];
  return (
    <div className="rounded-ctl bg-surface-2/50 px-2.5 py-2">
      <div className={cn("text-base font-bold nums", c)}>{value}</div>
      <div className="text-2xs uppercase tracking-[0.08em] text-ink-faint">{label}</div>
    </div>
  );
}
