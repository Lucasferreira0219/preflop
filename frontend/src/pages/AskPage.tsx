import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  BookOpen,
  HelpCircle,
  Lightbulb,
  Loader2,
  Send,
} from "lucide-react";
import { BrandBar } from "@/components/layout/BrandBar";
import { MenuButton } from "@/components/layout/MenuButton";
import { Button } from "@/components/ui/Button";
import { Card, SectionLabel } from "@/components/ui/Card";
import { PkeBadge } from "@/components/PkeBadge";
import { api } from "@/lib/api";
import { useApp } from "@/state/AppProvider";
import type { PkeQueryContext, PkeQueryResponse } from "@/lib/types";
import { cn } from "@/lib/cn";

const POS = ["", "UTG", "UTG1", "UTG2", "MP", "HJ", "CO", "BTN", "SB", "BB"];
const PHASES = ["", "early", "middle", "bubble", "itm", "3handed", "heads_up"];
const PHASE_LABEL: Record<string, string> = {
  "": "Auto", early: "Early", middle: "Middle", bubble: "Bolha", itm: "ITM",
  "3handed": "3-handed", heads_up: "Heads-up",
};
const ACTIONS_BEFORE = ["", "folded_to_hero", "raise", "limp", "shove"];
const AB_LABEL: Record<string, string> = {
  "": "Auto", folded_to_hero: "Todos foldaram", raise: "Vilão deu raise",
  limp: "Vilão deu limp", shove: "Vilão deu all-in",
};

const ACT_BADGE: Record<string, { label: string; cls: string }> = {
  shove: { label: "SHOVE", cls: "bg-action-red/20 text-action-red" },
  raise: { label: "RAISE", cls: "bg-gold/20 text-gold" },
  "3bet": { label: "3-BET", cls: "bg-gold/20 text-gold" },
  "4bet": { label: "4-BET", cls: "bg-gold/20 text-gold" },
  call: { label: "CALL", cls: "bg-action-blue/20 text-action-blue" },
  fold: { label: "FOLD", cls: "bg-surface-2 text-ink-dim" },
  bet: { label: "BET", cls: "bg-gold/20 text-gold" },
  check: { label: "CHECK", cls: "bg-surface-2 text-ink-dim" },
};
const CONF: Record<string, { label: string; cls: string }> = {
  high: { label: "alta confiança", cls: "text-action-green" },
  medium: { label: "confiança média", cls: "text-gold" },
  insufficient: { label: "informação insuficiente", cls: "text-ink-faint" },
};

const EXAMPLES = [
  "A8o no BTN com 9bb é shove?",
  "Tenho QQ vs open do HJ, call ou 3bet?",
  "Como jogo contra limp?",
  "O que é risk premium?",
];

export function AskPage() {
  const navigate = useNavigate();
  const { openRule } = useApp();
  const [params] = useSearchParams();
  const [question, setQuestion] = useState("");
  const [ctx, setCtx] = useState<PkeQueryContext>({});
  const [resp, setResp] = useState<PkeQueryResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [showCtx, setShowCtx] = useState(false);

  // Vindo de "Perguntar sobre essa mão": pré-preenche contexto e já responde.
  useEffect(() => {
    const q = params.get("q") ?? "";
    const c: PkeQueryContext = {};
    const cards = params.get("cards");
    const pos = params.get("pos");
    const stack = params.get("stack");
    const phase = params.get("phase");
    const action = params.get("action");
    if (cards) c.hero_cards = cards;
    if (pos) c.hero_position = pos;
    if (stack && !Number.isNaN(Number(stack))) c.effective_stack_bb = Number(stack);
    if (phase) c.phase = phase;
    if (action) c.action_before_hero = action;
    if (!q && Object.keys(c).length === 0) return;
    setQuestion(q);
    setCtx(c);
    setShowCtx(Object.keys(c).length > 0);
    setLoading(true);
    api
      .pkeQuery(q, c)
      .then(setResp)
      .catch(() => setResp(null))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function set<K extends keyof PkeQueryContext>(k: K, v: PkeQueryContext[K]) {
    setCtx((c) => {
      const next = { ...c };
      if (v === "" || v == null || (typeof v === "number" && Number.isNaN(v))) delete next[k];
      else next[k] = v;
      return next;
    });
  }

  async function ask(q = question) {
    if (!q.trim() && Object.keys(ctx).length === 0) return;
    setLoading(true);
    try {
      setResp(await api.pkeQuery(q, ctx));
    } catch {
      setResp(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-full">
      <header className="sticky top-0 z-30 border-b border-border bg-bg/85 backdrop-blur-md">
        <BrandBar
          title="Perguntar ao PKE"
          actions={<MenuButton className="h-8 w-8" />}
        />
      </header>

      <div className="mx-auto w-full max-w-2xl px-4 py-6">
        {/* Campo de pergunta */}
        <Card className="p-3">
          <div className="flex items-end gap-2">
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  ask();
                }
              }}
              rows={2}
              placeholder="Pergunte: ex. 'A8o no BTN com 9bb é shove?'"
              className="flex-1 resize-none bg-transparent text-sm text-ink outline-none placeholder:text-ink-faint"
            />
            <Button variant="primary" size="sm" onClick={() => ask()} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </Card>

        {/* Exemplos */}
        <div className="mt-2 flex flex-wrap gap-1.5">
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              onClick={() => { setQuestion(ex); ask(ex); }}
              className="rounded-full border border-border bg-surface-1 px-2.5 py-1 text-2xs text-ink-dim hover:text-ink"
            >
              {ex}
            </button>
          ))}
        </div>

        {/* Contexto opcional */}
        <button
          onClick={() => setShowCtx((v) => !v)}
          className="mt-3 text-2xs font-semibold uppercase tracking-[0.1em] text-ink-faint hover:text-ink"
        >
          {showCtx ? "− Esconder contexto" : "+ Adicionar contexto (opcional)"}
        </button>
        {showCtx && (
          <Card className="mt-2 grid grid-cols-2 gap-2 p-3 sm:grid-cols-3">
            <Fld label="Mão">
              <input className="ctx-input" placeholder="A8o" value={ctx.hero_cards ?? ""}
                     onChange={(e) => set("hero_cards", e.target.value.trim())} />
            </Fld>
            <Fld label="Posição">
              <select className="ctx-input" value={ctx.hero_position ?? ""}
                      onChange={(e) => set("hero_position", e.target.value)}>
                {POS.map((p) => <option key={p} value={p}>{p || "—"}</option>)}
              </select>
            </Fld>
            <Fld label="Stack (bb)">
              <input className="ctx-input" inputMode="decimal" placeholder="9" value={ctx.effective_stack_bb ?? ""}
                     onChange={(e) => set("effective_stack_bb", e.target.value ? Number(e.target.value) : undefined)} />
            </Fld>
            <Fld label="Fase">
              <select className="ctx-input" value={ctx.phase ?? ""}
                      onChange={(e) => set("phase", e.target.value)}>
                {PHASES.map((p) => <option key={p} value={p}>{PHASE_LABEL[p]}</option>)}
              </select>
            </Fld>
            <Fld label="Ação antes">
              <select className="ctx-input" value={ctx.action_before_hero ?? ""}
                      onChange={(e) => set("action_before_hero", e.target.value)}>
                {ACTIONS_BEFORE.map((a) => <option key={a} value={a}>{AB_LABEL[a]}</option>)}
              </select>
            </Fld>
            <Fld label="Vilão (pos)">
              <select className="ctx-input" value={ctx.opener_position ?? ""}
                      onChange={(e) => set("opener_position", e.target.value)}>
                {POS.map((p) => <option key={p} value={p}>{p || "—"}</option>)}
              </select>
            </Fld>
            <Fld label="Jogadores">
              <input className="ctx-input" inputMode="numeric" placeholder="6" value={ctx.players_left ?? ""}
                     onChange={(e) => set("players_left", e.target.value ? Number(e.target.value) : undefined)} />
            </Fld>
            <Fld label="Ante">
              <select className="ctx-input" value={ctx.ante ? "1" : ""}
                      onChange={(e) => set("ante", e.target.value === "1")}>
                <option value="">Não</option>
                <option value="1">Sim</option>
              </select>
            </Fld>
          </Card>
        )}

        {/* Resposta */}
        {resp && <Answer resp={resp} onOpenRule={openRule} />}
      </div>

      <style>{`.ctx-input{width:100%;border:1px solid var(--tw-border,#273241);border-radius:.5rem;
        background:rgba(255,255,255,.03);padding:.35rem .5rem;font-size:.8rem;color:inherit;outline:none}`}</style>
    </div>
  );
}

function Fld({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-2xs uppercase tracking-[0.08em] text-ink-faint">{label}</span>
      {children}
    </label>
  );
}

function Answer({ resp, onOpenRule }: { resp: PkeQueryResponse; onOpenRule?: (id: string) => void }) {
  const badge = resp.recommended_action ? ACT_BADGE[resp.recommended_action] : null;
  const conf = CONF[resp.confidence] ?? CONF.medium;
  return (
    <div className="mt-5 flex flex-col gap-3">
      {/* Card principal */}
      <Card className="p-4">
        <div className="flex items-start justify-between gap-3">
          <p className="text-[15px] font-medium leading-relaxed text-ink">{resp.answer}</p>
          {badge && (
            <span className={cn("shrink-0 rounded-lg px-3 py-1.5 text-sm font-bold", badge.cls)}>
              {badge.label}
            </span>
          )}
        </div>
        <div className={cn("mt-2 text-2xs font-semibold uppercase tracking-[0.1em]", conf.cls)}>
          {conf.label}
        </div>
      </Card>

      {resp.beginner_explanation && resp.beginner_explanation !== resp.answer && (
        <MiniCard icon={<Lightbulb className="h-4 w-4 text-gold" />} title="Por quê?">
          {resp.beginner_explanation}
        </MiniCard>
      )}

      {resp.rule_refs.length > 0 && (
        <MiniCard icon={<BookOpen className="h-4 w-4 text-action-blue" />} title="Regra usada">
          <div className="mb-2"><PkeBadge variant="regra" /></div>
          <div className="flex flex-wrap gap-1.5">
            {resp.rule_refs.map((r) => (
              <button
                key={r.id}
                onClick={() => onOpenRule?.(r.id)}
                disabled={!onOpenRule}
                className="rounded-ctl border border-border bg-surface-2 px-2 py-1 text-2xs text-ink-dim transition-colors hover:border-border-strong hover:text-ink disabled:cursor-default"
              >
                <span className="font-semibold text-ink">{r.id}</span>
                {r.source && <span> · {r.source}</span>}
                {r.page != null && <span> p{r.page}</span>}
              </button>
            ))}
          </div>
        </MiniCard>
      )}

      {resp.common_mistake && (
        <MiniCard icon={<HelpCircle className="h-4 w-4 text-action-red" />} title="Erro comum">
          {resp.common_mistake}
        </MiniCard>
      )}

      {resp.missing_info.length > 0 && (
        <MiniCard icon={<AlertTriangle className="h-4 w-4 text-gold" />} title="Faltou informação">
          Me diga: {resp.missing_info.join(", ")}.
        </MiniCard>
      )}

      <div className="text-2xs text-ink-faint">
        Proveniência: resposta {resp.provenance.main_answer} · fase {resp.provenance.phase} ·
        explicação {resp.provenance.explanation}
      </div>
    </div>
  );
}

function MiniCard({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <Card className="p-3">
      <SectionLabel className="mb-1.5 flex items-center gap-1.5">{icon} {title}</SectionLabel>
      <div className="text-[13px] leading-relaxed text-ink-dim">{children}</div>
    </Card>
  );
}
