import { useCallback, useEffect, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { useNavigate } from "react-router-dom";
import { BookOpen, Download, Dumbbell, Eye, Loader2, MoreHorizontal, RefreshCw, X } from "lucide-react";
import { HandList, Leaks, Summary, Treino } from "@/components/tournaments/PkeReport";
import { PkeBadge } from "@/components/PkeBadge";
import { Button } from "@/components/ui/Button";
import { api } from "@/lib/api";
import { useApp } from "@/state/AppProvider";
import { askHandUrl } from "@/lib/askLink";
import { leakLabel, ruleIdOf } from "@/lib/pke";
import type { ReportHand, Tournament, TournamentReport } from "@/lib/types";
import { cn } from "@/lib/cn";

type DetailTab = "resumo" | "leaks" | "maos" | "treino";

function money(cents: number | null | undefined, currency = "USD"): string {
  if (cents == null) return "—";
  const sym = currency === "BRL" ? "R$" : currency === "EUR" ? "€" : "$";
  return `${sym}${(cents / 100).toFixed(2)}`;
}

export function TournamentDetailPanel() {
  const { tournamentDetailId, closeTournament, openRule } = useApp();
  const navigate = useNavigate();
  const [report, setReport] = useState<TournamentReport | null>(null);
  const [tour, setTour] = useState<Tournament | null>(null);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<DetailTab>("resumo");
  const [menuOpen, setMenuOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const tid = tournamentDetailId;

  const load = useCallback(async () => {
    if (!tid) return;
    setLoading(true);
    try {
      const [rep, list] = await Promise.all([api.analyzeTournament(tid), api.listTournaments()]);
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
      setTab("resumo");
      return;
    }
    setTab("resumo");
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
    setTab("maos");
    scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
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
  function openMainRule() {
    const rule = ruleIdOf(report?.leaks[0]?.regra_violada ?? "");
    if (rule) openRule(rule);
  }

  const profit = tour?.profit_cents;
  const tabs: { key: DetailTab; label: string }[] = [
    { key: "resumo", label: "Resumo" },
    { key: "leaks", label: "Leaks" },
    { key: "maos", label: "Mãos críticas" },
    { key: "treino", label: "Treino sugerido" },
  ];

  return (
    <Dialog.Root open={tid != null} onOpenChange={(v) => !v && closeTournament()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/55 backdrop-blur-[2px] data-[state=open]:animate-fade-in" />
        <Dialog.Content className="fixed inset-x-0 bottom-0 z-50 flex max-h-[94vh] flex-col rounded-t-2xl border border-border bg-bg shadow-pop outline-none data-[state=open]:animate-slide-up sm:inset-y-0 sm:left-auto sm:right-0 sm:h-full sm:max-h-none sm:w-[620px] sm:rounded-none sm:border-l">
          <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3 sm:px-5 sm:py-4">
            <div className="min-w-0">
              <Dialog.Title className="flex min-w-0 items-center gap-2 text-sm font-semibold text-ink">
                <span className="truncate">{tour?.tournament_name || `Torneio #${tid}`}</span>
                {report && <PkeBadge variant="analisado" />}
              </Dialog.Title>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-2xs text-ink-faint">
                {tour?.played_at && <span>{tour.played_at}</span>}
                {tour?.buy_in_cents != null && <span>Buy-in {money((tour.buy_in_cents || 0) + (tour.fee_cents || 0), tour.currency)}</span>}
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

          <div className="flex items-center gap-1.5 overflow-x-auto border-b border-border px-4 py-2.5 sm:px-5">
            <Button variant="primary" size="sm" className="shrink-0" onClick={goTrainLeaks} disabled={!report?.leaks.length}>
              <Dumbbell className="h-4 w-4" /> Treinar leaks
            </Button>
            <Button variant="ghost" size="sm" className="shrink-0" onClick={seeCriticalHands} disabled={!report}>
              <Eye className="h-4 w-4" /> Ver mãos críticas
            </Button>
            <Button variant="ghost" size="sm" className="shrink-0" onClick={load} disabled={loading} aria-label="Reanalisar">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              <span className="hidden min-[430px]:inline">Reanalisar</span>
            </Button>
            <div className="relative ml-auto shrink-0">
              <button type="button" aria-label="Mais ações" onClick={() => setMenuOpen((v) => !v)} className="grid h-8 w-8 place-items-center rounded-ctl text-ink-dim hover:bg-surface-2 hover:text-ink">
                <MoreHorizontal className="h-4 w-4" />
              </button>
              {menuOpen && (
                <div className="absolute right-0 top-9 z-50 w-44 rounded-card border border-border bg-surface-1 p-1 shadow-pop">
                  <button className="flex w-full items-center gap-2 rounded-ctl px-3 py-2 text-left text-sm text-ink-dim hover:bg-surface-2 hover:text-ink" onClick={() => { setMenuOpen(false); exportReview(); }} disabled={!report}>
                    <Download className="h-4 w-4" /> Exportar review
                  </button>
                  <button className="flex w-full items-center gap-2 rounded-ctl px-3 py-2 text-left text-sm text-ink-dim hover:bg-surface-2 hover:text-ink" onClick={() => { setMenuOpen(false); openMainRule(); }} disabled={!report?.leaks[0]?.regra_violada}>
                    <BookOpen className="h-4 w-4" /> Ver regra principal
                  </button>
                </div>
              )}
            </div>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 pb-8 sm:px-5">
            {loading && (
              <div className="flex items-center justify-center gap-2 py-12 text-sm text-ink-dim">
                <Loader2 className="h-4 w-4 animate-spin" /> Analisando torneio com o PKE…
              </div>
            )}
            {!loading && !report && (
              <p className="py-12 text-center text-sm text-ink-faint">Nenhuma mão deste torneio para o PKE analisar.</p>
            )}
            {!loading && report && (
              <div className="flex flex-col gap-4 py-4">
                <div className="flex gap-1.5 overflow-x-auto pb-1">
                  {tabs.map((t) => (
                    <button key={t.key} onClick={() => setTab(t.key)} className={cn("shrink-0 rounded-full border px-3 py-1 text-2xs font-semibold transition-colors", tab === t.key ? "border-gold/50 bg-gold/15 text-gold" : "border-border bg-surface-1 text-ink-dim hover:text-ink")}>
                      {t.label}
                    </button>
                  ))}
                </div>
                {tab === "resumo" && <Summary report={report} />}
                {tab === "leaks" && <Leaks leaks={report.leaks} onTrainLeak={goTrainLeak} onOpenRule={openRule} onFilterSpot={() => setTab("maos")} />}
                {tab === "maos" && <HandList report={report} onTrainLeak={goTrainLeak} onOpenRule={openRule} onAskHand={goAsk} />}
                {tab === "treino" && (
                  <div className="flex flex-col gap-3">
                    <Treino drills={report.treino_sugerido} onTrainLeak={goTrainLeak} />
                    <Button variant="primary" onClick={goTrainLeaks} disabled={!report.leaks.length}>
                      <Dumbbell className="h-4 w-4" /> Treinar leaks deste torneio
                    </Button>
                  </div>
                )}
              </div>
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
    for (const l of r.leaks) L.push(`- **${leakLabel(l.id) ?? l.label}** (${l.gravidade}, ${l.frequencia_hits}×) — ${l.como_corrigir}${l.regra_violada ? ` [${l.regra_violada}]` : ""}`);
  }
  if (r.piores_decisoes.length) {
    L.push("");
    L.push(`## Piores decisões`);
    for (const m of r.piores_decisoes) L.push(`- ${m.pos} ${m.cards} (${m.fase}) nota ${m.nota}: jogou ${m.linha}, certo ${m.recomendado}`);
  }
  return L.join("\n");
}
