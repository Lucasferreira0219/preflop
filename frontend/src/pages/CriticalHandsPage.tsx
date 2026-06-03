import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowLeft, Download, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { HandList } from "@/components/tournaments/PkeReport";
import type { ReportHand, TournamentReport } from "@/lib/types";
import { cn } from "@/lib/cn";

type DateRange = "all" | "today" | "week" | "month";

function startOf(range: DateRange): string | null {
  if (range === "all") return null;
  const now = new Date();
  if (range === "today") {
    return `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, "0")}/${String(now.getDate()).padStart(2, "0")}`;
  }
  const d = new Date(now);
  if (range === "week") d.setDate(d.getDate() - 6);
  if (range === "month") d.setDate(d.getDate() - 29);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
}

const DATE_OPTS: { key: DateRange; label: string }[] = [
  { key: "all",   label: "Tudo" },
  { key: "today", label: "Hoje" },
  { key: "week",  label: "7 dias" },
  { key: "month", label: "30 dias" },
];

function exportMarkdown(maos: ReportHand[]) {
  const lines: string[] = [
    "# Revisão de Erros Críticos — Preflop MTT",
    `> Exportado em ${new Date().toLocaleString("pt-BR")} · ${maos.length} mãos`,
    "",
    "---",
    "",
  ];

  maos.forEach((m, i) => {
    const hh = (m as ReportHand & { hh?: Record<string, unknown> }).hh ?? {};
    lines.push(`## Mão ${i + 1} — ${m.cards ?? "?"} (${m.pos ?? "?"}) · ${m.spot ?? "?"} · ${m.fase ?? "?"}`);
    lines.push("");
    lines.push(`**Stack efetivo:** ${m.eff_bb ?? "?"}bb · **Resultado:** ${m.decision_label ?? "?"} · **Nota PKE:** ${m.nota ?? "?"}/10`);
    lines.push("");

    // Situação
    lines.push("### Situação");
    if (hh.blinds)          lines.push(`- Blinds: ${hh.blinds}`);
    if (hh.n_players)       lines.push(`- Jogadores: ${hh.n_players}`);
    if (hh.hero_stack_bb)   lines.push(`- Stack do herói: ${hh.hero_stack_bb}bb`);
    if (hh.villain_stack_bb) lines.push(`- Stack do vilão: ${hh.villain_stack_bb}bb`);
    if (hh.opener_pos)      lines.push(`- Posição do abridor: ${hh.opener_pos}`);
    if (hh.preflop_action_summary) lines.push(`- Ação preflop: ${hh.preflop_action_summary}`);
    lines.push("");

    // Decisão
    lines.push("### Decisão");
    lines.push(`- **Jogado:** ${m.linha ?? "?"}`);
    lines.push(`- **Recomendado:** ${m.recomendado ?? "?"}`);
    if (m.acoes_aceitaveis?.length) lines.push(`- **Também aceitável:** ${m.acoes_aceitaveis.join(", ")}`);
    if (m.acoes_ruins?.length)      lines.push(`- **Ruim:** ${m.acoes_ruins.join(", ")}`);
    lines.push("");

    // Explicação
    if (m.explicacao) {
      lines.push("### Análise do PKE");
      lines.push(m.explicacao);
      lines.push("");
    }
    if (m.resumo) {
      lines.push(`> **Resumo:** ${m.resumo}`);
      lines.push("");
    }
    if (m.regra?.length) {
      lines.push(`**Regra(s) aplicada(s):** ${m.regra.join(" · ")}`);
      lines.push("");
    }

    lines.push("---");
    lines.push("");
  });

  const blob = new Blob([lines.join("\n")], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `erros-criticos-${new Date().toISOString().slice(0, 10)}.md`;
  a.click();
  URL.revokeObjectURL(url);
}

export function CriticalHandsPage() {
  const navigate = useNavigate();
  const [allMaos, setAllMaos] = useState<ReportHand[]>([]);
  const [loading, setLoading] = useState(true);
  const [onlyErrors, setOnlyErrors] = useState(true);
  const [dateRange, setDateRange] = useState<DateRange>("all");

  useEffect(() => {
    setLoading(true);
    api.allCriticalHands(onlyErrors, 200)
      .then((r) => setAllMaos(r.maos ?? []))
      .finally(() => setLoading(false));
  }, [onlyErrors]);

  const maos = useMemo(() => {
    const from = startOf(dateRange);
    if (!from) return allMaos;
    return allMaos.filter((m) => {
      const d = (m as ReportHand & { played_at?: string }).played_at;
      return d && d >= from;
    });
  }, [allMaos, dateRange]);

  async function goExportHand(m: ReportHand) {
    const tid = (m as ReportHand & { tournament_id?: string }).tournament_id;
    const payload = { ...m, tournament_id: tid } as unknown as Record<string, unknown>;
    const res = await api.noteFromHand(payload);
    if (res && "existing" in res) {
      if (confirm("Essa mão já tem uma anotação. Abrir a existente?\n(Cancelar = criar uma nova mesmo assim)")) {
        navigate(`/notes?open=${res.existing.note_id}`);
      } else {
        const created = await api.noteFromHand(payload, true);
        navigate(`/notes?open=${(created as { note_id: string }).note_id}`);
      }
      return;
    }
    navigate(`/notes?open=${(res as { note_id: string }).note_id}`);
  }

  const pill = (active: boolean, danger?: boolean) =>
    cn(
      "rounded-full px-3 py-1 text-xs font-semibold transition-colors",
      active
        ? danger
          ? "bg-action-red/20 text-action-red"
          : "bg-gold/20 text-gold"
        : "text-ink-faint hover:text-ink",
    );

  return (
    <div className="flex h-dvh flex-col bg-bg">
      {/* Header */}
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-surface-1 px-4">
        <button
          onClick={() => navigate(-1)}
          className="grid h-9 w-9 place-items-center rounded-lg text-ink-dim hover:bg-surface-2"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <AlertTriangle className="h-5 w-5 text-action-red" />
        <span className="text-sm font-bold tracking-wide text-ink">Erros Críticos</span>
        {!loading && maos.length > 0 && (
          <button
            onClick={() => exportMarkdown(maos)}
            className="ml-auto flex items-center gap-1.5 rounded-lg border border-border bg-surface-2 px-3 py-1.5 text-xs font-semibold text-ink-dim hover:text-ink"
          >
            <Download className="h-3.5 w-3.5" />
            Exportar .md
          </button>
        )}
        {!loading && maos.length === 0 && (
          <span className="ml-auto text-xs text-ink-faint">0 mãos</span>
        )}
      </header>

      {/* Filters */}
      <div className="flex shrink-0 flex-col gap-1.5 border-b border-border bg-surface-1 px-4 py-2">
        <div className="flex gap-2">
          <button onClick={() => setOnlyErrors(true)} className={pill(onlyErrors, true)}>
            Só erros
          </button>
          <button onClick={() => setOnlyErrors(false)} className={pill(!onlyErrors)}>
            Todas críticas
          </button>
        </div>
        <div className="flex gap-2">
          {DATE_OPTS.map(({ key, label }) => (
            <button key={key} onClick={() => setDateRange(key)} className={pill(dateRange === key)}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {loading ? (
          <div className="flex h-40 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-ink-dim" />
          </div>
        ) : maos.length === 0 ? (
          <div className="flex h-40 flex-col items-center justify-center gap-2 text-ink-faint">
            <AlertTriangle className="h-8 w-8 opacity-40" />
            <p className="text-sm">Nenhuma mão crítica nesse período.</p>
            <p className="text-xs">Tente ampliar o filtro de data.</p>
          </div>
        ) : (
          <HandList report={{ maos, leaks: [], drills: [] } as unknown as TournamentReport} onExportHand={goExportHand} />
        )}
      </div>
    </div>
  );
}
