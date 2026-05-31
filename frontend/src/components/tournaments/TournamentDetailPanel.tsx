import { useCallback, useEffect, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { useNavigate } from "react-router-dom";
import { Download, Dumbbell, Eye, Loader2, X } from "lucide-react";
import { PkeReport } from "@/components/tournaments/PkeReport";
import { PkeBadge } from "@/components/PkeBadge";
import { Button } from "@/components/ui/Button";
import { api } from "@/lib/api";
import { useApp } from "@/state/AppProvider";
import { askHandUrl } from "@/lib/askLink";
import { leakLabel } from "@/lib/pke";
import type { ReportHand, Tournament, TournamentReport } from "@/lib/types";

function money(cents: number | null | undefined, currency = "USD"): string {
  if (cents == null) return "—";
  const sym = currency === "BRL" ? "R$" : currency === "EUR" ? "€" : "$";
  return `${sym}${(cents / 100).toFixed(2)}`;
}

/** Overlay de review completa de um torneio (reusa PkeReport). Estado global em useApp. */
export function TournamentDetailPanel() {
  const { tournamentDetailId, closeTournament, openRule } = useApp();
  const navigate = useNavigate();
  const [report, setReport] = useState<TournamentReport | null>(null);
  const [tour, setTour] = useState<Tournament | null>(null);
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const tid = tournamentDetailId;

  const load = useCallback(async () => {
    if (!tid) return;
    setLoading(true);
    try {
      const [rep, list] = await Promise.all([
        api.analyzeTournament(tid),
        api.listTournaments(),
      ]);
      setReport("error" in rep && rep.error ? null : rep);
      setTour(list.find((t) => t.tournament_id === tid) ?? null);
    } catch {
      setReport(null);
    } finally {
      setLoading(false);
    }
  }, [tid]);

  useEffect(() => {
    if (!tid) {
      setReport(null);
      setTour(null);
      return;
    }
    load();
  }, [tid, load]);

  function goTrainLeaks() {
    closeTournament();
    navigate("/treinar?mode=leaks&from=leak");
  }
  function goTrainLeak(mode: string) {
    closeTournament();
    navigate(`/treinar?mode=${mode}&from=leak`);
  }
  function goAsk(m: ReportHand) {
    closeTournament();
    navigate(askHandUrl(m));
  }
  function seeCriticalHands() {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }
  function exportReview() {
    if (!report) return;
    const md = buildMarkdown(report, tour);
    const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `review-torneio-${tid}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const profit = tour?.profit_cents;

  return (
    <Dialog.Root open={tid != null} onOpenChange={(v) => !v && closeTournament()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/55 backdrop-blur-[2px] data-[state=open]:animate-fade-in" />
        <Dialog.Content className="fixed inset-x-0 bottom-0 z-40 flex max-h-[92vh] flex-col rounded-t-2xl border border-border bg-bg shadow-pop outline-none data-[state=open]:animate-slide-up sm:inset-y-0 sm:right-0 sm:left-auto sm:max-h-none sm:h-full sm:w-[560px] sm:rounded-none sm:border-l">
          {/* Cabeçalho */}
          <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
            <div className="min-w-0">
              <Dialog.Title className="flex items-center gap-2 text-sm font-semibold text-ink">
                <span className="truncate">{tour?.tournament_name || `Torneio #${tid}`}</span>
                <PkeBadge variant="analisado" />
              </Dialog.Title>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-2xs text-ink-faint">
                {tour?.played_at && <span>{tour.played_at}</span>}
                {tour?.buy_in_cents != null && (
                  <span>Buy-in {money((tour.buy_in_cents || 0) + (tour.fee_cents || 0), tour.currency)}</span>
                )}
                {tour?.finish_pos != null && <span>{tour.finish_pos}º lugar</span>}
                {profit != null && (
                  <span className={profit > 0 ? "text-action-green" : profit < 0 ? "text-action-red" : ""}>
                    {profit > 0 ? "+" : ""}{money(profit, tour?.currency)}
                  </span>
                )}
              </div>
            </div>
            <Dialog.Close asChild>
              <button aria-label="Fechar" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-ctl text-ink-dim hover:bg-surface-2 hover:text-ink">
                <X className="h-4 w-4" />
              </button>
            </Dialog.Close>
          </div>

          {/* Ações */}
          <div className="flex flex-wrap gap-1.5 border-b border-border px-5 py-2.5">
            <Button variant="primary" size="sm" onClick={goTrainLeaks}>
              <Dumbbell className="h-4 w-4" /> Treinar leaks deste torneio
            </Button>
            <Button variant="ghost" size="sm" onClick={load} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Dumbbell className="h-4 w-4" />}
              Reanalisar
            </Button>
            <Button variant="ghost" size="sm" onClick={seeCriticalHands}>
              <Eye className="h-4 w-4" /> Ver mãos críticas
            </Button>
            <Button variant="ghost" size="sm" onClick={exportReview} disabled={!report}>
              <Download className="h-4 w-4" /> Exportar review
            </Button>
          </div>

          {/* Corpo */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 pb-8">
            {loading && (
              <div className="flex items-center justify-center gap-2 py-12 text-sm text-ink-dim">
                <Loader2 className="h-4 w-4 animate-spin" /> Analisando torneio com o PKE…
              </div>
            )}
            {!loading && !report && (
              <p className="py-12 text-center text-sm text-ink-faint">
                Nenhuma mão deste torneio para o PKE analisar.
              </p>
            )}
            {!loading && report && (
              <PkeReport
                report={report}
                reanalyzing={loading}
                onReanalyze={load}
                onTrainLeaks={goTrainLeaks}
                onTrainLeak={goTrainLeak}
                onOpenRule={openRule}
                onAskHand={goAsk}
              />
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function buildMarkdown(r: TournamentReport, t: Tournament | null): string {
  const L: string[] = [];
  L.push(`# Review do torneio #${r.tournament_id}`);
  if (t) {
    L.push("");
    if (t.tournament_name) L.push(`**${t.tournament_name}**`);
    if (t.played_at) L.push(`Data: ${t.played_at}`);
    if (t.profit_cents != null) L.push(`Lucro: ${money(t.profit_cents, t.currency)}`);
  }
  L.push("");
  L.push(`## Resumo PKE`);
  L.push(`- Nota média: ${r.media_notas ?? "—"}`);
  L.push(`- Mãos críticas: ${r.maos_criticas}`);
  L.push(`- Erros graves: ${r.erros_graves}`);
  if (r.fase_com_mais_erros) L.push(`- Fase pior: ${r.fase_com_mais_erros}`);
  if (r.leaks.length) {
    L.push("");
    L.push(`## Leaks detectados`);
    for (const l of r.leaks) {
      L.push(`- **${leakLabel(l.id) ?? l.label}** (${l.gravidade}, ${l.frequencia_hits}×) — ${l.como_corrigir}` +
        (l.regra_violada ? ` [${l.regra_violada}]` : ""));
    }
  }
  if (r.piores_decisoes.length) {
    L.push("");
    L.push(`## Piores decisões`);
    for (const m of r.piores_decisoes) {
      L.push(`- ${m.pos} ${m.cards} (${m.fase}) nota ${m.nota}: jogou ${m.linha}, certo ${m.recomendado}`);
    }
  }
  return L.join("\n");
}
