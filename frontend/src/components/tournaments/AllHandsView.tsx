/** AllHandsView — aba "Todas" do torneio, foco em análise de range RFI pré-flop. */
import { useMemo, useState } from "react";
import type { RfiHand, RfiVerdict, RfiSpotType } from "@/lib/types";
import { cn } from "@/lib/cn";

type ShowMode = "all" | "rfi_only" | "errors_only";
type StackBand = "all" | "deep" | "medium" | "short" | "push_fold";

const POSITIONS = ["UTG", "UTG1", "UTG2", "MP", "HJ", "CO", "BTN", "SB", "BB"];

function getStackBand(bb: number | null): StackBand {
  if (bb == null) return "all";
  if (bb > 40) return "deep";
  if (bb > 20) return "medium";
  if (bb > 10) return "short";
  return "push_fold";
}

const CARD_CLS: Record<RfiVerdict, string> = {
  correct: "border-action-green/30 bg-action-green/5",
  minor_error: "border-gold/30 bg-gold/5",
  major_error: "border-action-red/30 bg-action-red/5",
  not_evaluated: "border-border bg-surface-1",
};

const BADGE_CLS: Record<RfiVerdict, string> = {
  correct: "bg-action-green/15 text-action-green",
  minor_error: "bg-gold/15 text-gold",
  major_error: "bg-action-red/15 text-action-red",
  not_evaluated: "bg-surface-2 text-ink-faint",
};

const VERDICT_LABEL: Record<RfiVerdict, string> = {
  correct: "Correto",
  minor_error: "Erro leve",
  major_error: "Erro grave",
  not_evaluated: "—",
};

const SPOT_BADGE: Record<RfiSpotType, string> = {
  RFI: "RFI",
  sb_first_in: "SB first-in",
  bb_defense: "Def BB",
  vs_raise: "vs Raise",
  vs_limp: "vs Limp",
  postflop_only: "Pós-flop",
  unknown: "—",
};

export function AllHandsView({ hands }: { hands: RfiHand[] }) {
  const [showMode, setShowMode] = useState<ShowMode>("all");
  const [posFilter, setPosFilter] = useState<string | null>(null);
  const [stackFilter, setStackFilter] = useState<StackBand>("all");

  const stats = useMemo(() => {
    const rfi = hands.filter((h) => h.is_rfi_spot);
    const correct = rfi.filter((h) => h.verdict === "correct").length;
    const minor = rfi.filter((h) => h.verdict === "minor_error").length;
    const major = rfi.filter((h) => h.verdict === "major_error").length;
    return { total: hands.length, rfi: rfi.length, correct, minor, major };
  }, [hands]);

  const filtered = useMemo(() => {
    return hands.filter((h) => {
      if (showMode === "rfi_only" && !h.is_rfi_spot) return false;
      if (showMode === "errors_only" && h.verdict !== "minor_error" && h.verdict !== "major_error") return false;
      if (posFilter && h.hero_position !== posFilter) return false;
      if (stackFilter !== "all" && getStackBand(h.hero_stack_bb) !== stackFilter) return false;
      return true;
    });
  }, [hands, showMode, posFilter, stackFilter]);

  return (
    <div className="flex flex-col gap-3">
      {/* Cabeçalho de stats */}
      <div className="rounded-card border border-border bg-surface-1 px-3 py-2.5">
        <div className="mb-1.5 text-2xs font-semibold uppercase tracking-wide text-ink-faint">
          Análise de Range RFI — pré-flop
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
          <span>
            <span className="font-semibold text-ink">{stats.rfi}</span>{" "}
            <span className="text-ink-faint">spots RFI</span>
          </span>
          {stats.rfi > 0 && (
            <>
              <span className="font-semibold text-action-green">{stats.correct} corretos</span>
              {stats.minor > 0 && <span className="font-semibold text-gold">{stats.minor} erros leves</span>}
              {stats.major > 0 && <span className="font-semibold text-action-red">{stats.major} erros graves</span>}
            </>
          )}
          <span className="text-ink-faint">{stats.total} mãos total</span>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-col gap-1.5">
        {/* Modo */}
        <div className="flex flex-wrap gap-1.5">
          {(["all", "rfi_only", "errors_only"] as ShowMode[]).map((m) => (
            <button
              key={m}
              onClick={() => setShowMode(m)}
              className={cn(
                "rounded-full border px-3 py-0.5 text-2xs font-semibold transition-colors",
                showMode === m
                  ? "border-gold/50 bg-gold/15 text-gold"
                  : "border-border bg-surface-1 text-ink-dim hover:text-ink",
              )}
            >
              {m === "all" ? "Todas" : m === "rfi_only" ? "Só RFI" : "Só Erros"}
            </button>
          ))}
        </div>

        {/* Posição */}
        <div className="flex flex-wrap gap-1">
          <button
            onClick={() => setPosFilter(null)}
            className={cn(
              "rounded-full border px-2 py-0.5 text-2xs font-medium transition-colors",
              posFilter === null
                ? "border-ink/30 bg-ink/10 text-ink"
                : "border-border text-ink-faint hover:text-ink-dim",
            )}
          >
            Pos: Todas
          </button>
          {POSITIONS.map((p) => (
            <button
              key={p}
              onClick={() => setPosFilter(posFilter === p ? null : p)}
              className={cn(
                "rounded-full border px-2 py-0.5 text-2xs font-medium transition-colors",
                posFilter === p
                  ? "border-ink/30 bg-ink/10 text-ink"
                  : "border-border text-ink-faint hover:text-ink-dim",
              )}
            >
              {p}
            </button>
          ))}
        </div>

        {/* Stack */}
        <div className="flex flex-wrap gap-1">
          {(
            [
              ["all", "Stack: Todos"],
              ["deep", "Deep 40bb+"],
              ["medium", "Médio 20-40bb"],
              ["short", "Short 10-20bb"],
              ["push_fold", "Push/fold ≤10bb"],
            ] as [StackBand, string][]
          ).map(([k, label]) => (
            <button
              key={k}
              onClick={() => setStackFilter(k)}
              className={cn(
                "rounded-full border px-2 py-0.5 text-2xs font-medium transition-colors",
                stackFilter === k
                  ? "border-ink/30 bg-ink/10 text-ink"
                  : "border-border text-ink-faint hover:text-ink-dim",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Lista de mãos */}
      {filtered.length === 0 ? (
        <p className="py-8 text-center text-sm text-ink-faint">Nenhuma mão corresponde ao filtro.</p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {filtered.map((h) => (
            <RfiHandCard key={h.hand_id} hand={h} />
          ))}
        </div>
      )}
    </div>
  );
}

function RfiHandCard({ hand: h }: { hand: RfiHand }) {
  const verdict = h.verdict;
  const isRfi = h.is_rfi_spot;

  const cardCls = isRfi ? CARD_CLS[verdict] : "border-border bg-surface-1";
  const badgeCls = isRfi ? BADGE_CLS[verdict] : "bg-surface-2 text-ink-faint";
  const badgeLabel = isRfi ? VERDICT_LABEL[verdict] : SPOT_BADGE[h.spot_type] ?? h.spot_type;

  const showReason =
    isRfi && verdict !== "not_evaluated" && !!h.reason;
  const showRecommended =
    isRfi && verdict !== "correct" && verdict !== "not_evaluated" && !!h.recommended_action;

  return (
    <div className={cn("rounded-card border p-2.5", cardCls)}>
      {/* Linha principal */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5">
          {h.hand_number != null && (
            <span className="text-2xs text-ink-faint">#{h.hand_number}</span>
          )}
          {h.hero_position && (
            <span className="text-2xs font-bold text-ink">{h.hero_position}</span>
          )}
          {h.hero_cards && (
            <span className="font-mono text-sm font-bold text-ink">{h.hero_cards}</span>
          )}
          {h.hero_stack_bb != null && (
            <span className="text-2xs text-ink-faint">{h.hero_stack_bb}bb</span>
          )}
          {h.blinds && (
            <span className="text-2xs text-ink-faint opacity-60">({h.blinds})</span>
          )}
          {h.players_count != null && (
            <span className="text-2xs text-ink-faint opacity-60">{h.players_count}p</span>
          )}
        </div>
        <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-2xs font-semibold", badgeCls)}>
          {badgeLabel}
        </span>
      </div>

      {/* Ações */}
      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-2xs">
        {h.action_before_hero && (
          <span>
            <span className="text-ink-faint">Antes: </span>
            <span className="text-ink-dim">{h.action_before_hero}</span>
          </span>
        )}
        {h.hero_preflop_action && (
          <span>
            <span className="text-ink-faint">Ação: </span>
            <span className="text-ink-dim">{h.hero_preflop_action}</span>
          </span>
        )}
        {showRecommended && (
          <span>
            <span className="text-ink-faint">Recomendado: </span>
            <span className="font-semibold text-ink">{h.recommended_action}</span>
          </span>
        )}
      </div>

      {/* Motivo */}
      {showReason && (
        <p className="mt-1.5 text-2xs leading-relaxed text-ink-dim">{h.reason}</p>
      )}
    </div>
  );
}
