"""PokerKnowledgeEngine (PKE) — camada central de conhecimento/decisão para SNG.

Usado por Simulador, Consulta e Torneios. Base canônica = PDFs (Guia de Bolso mestre).

Uso típico:
    from pke import engine, HandContext
    ctx = HandContext(eff_stack_bb=10, hero_pos="BTN", hero_cards="A8o",
                      preflop_action="first_in", players_left=6)
    dec = engine().evaluate_decision(ctx, hero_action="raise")
    #   -> dict com nota, regra citada, tipo de erro, explicação
"""
from __future__ import annotations

from .context import HandContext, hand_class, in_range, is_resteal_hand
from .decision import Recommendation, enrich, recommended_actions
from .explainer import build_decision
from .knowledge import KnowledgeBase, kb as _kb
from .scorer import score_decision

__all__ = ["PokerKnowledgeEngine", "engine", "HandContext"]


class PokerKnowledgeEngine:
    def __init__(self) -> None:
        self.kb: KnowledgeBase = _kb()

    # ── usado por Torneios e pelo grading do Simulador ──────────────────────────
    def recommend(self, ctx: HandContext) -> Recommendation:
        enrich(ctx)
        return recommended_actions(ctx, self.kb)

    def evaluate_decision(self, ctx: HandContext, hero_action: str,
                          hero_size: str | None = None) -> dict:
        rec = self.recommend(ctx)
        score = score_decision(ctx, rec, hero_action, hero_size)
        return build_decision(ctx, rec, hero_action, score, self.kb)

    # ── usado pela Consulta (linguagem natural + contexto) ──────────────────────
    def query(self, question: str, context: dict | None = None) -> dict:
        from .query import run_query
        return run_query(question, context)

    def answer_query(self, ctx: HandContext) -> dict:
        rec = self.recommend(ctx)
        return {
            "spot": ctx.spot,
            "fase": ctx.phase,
            "acao": rec.primary if not rec.insufficient else None,
            "size": rec.size,
            "resposta": rec.explain,
            "regras": [self._cite(rid) for rid in rec.rule_ids],
            "range_ref": rec.range_ref,
            "insuficiente": rec.insufficient,
            "falta_info": rec.ask,
            "proveniencia": rec.provenance,
        }

    def applicable_rules(self, ctx: HandContext) -> list[dict]:
        """Regras canônicas cujo escopo casa com o contexto (para Consulta/auditoria)."""
        enrich(ctx)
        out = []
        for r in self.kb.rules:
            scope = r.get("scope", {})
            if "spot" in scope and scope["spot"] != ctx.spot:
                continue
            if "phase" in scope and ctx.phase not in scope["phase"]:
                continue
            if "eff_bb_max" in scope and ctx.eff_stack_bb > scope["eff_bb_max"]:
                continue
            if "eff_bb_min" in scope and ctx.eff_stack_bb < scope["eff_bb_min"]:
                continue
            out.append(self._cite(r["id"]))
        return out

    def _cite(self, rule_id: str) -> dict:
        r = self.kb.rule(rule_id) or {}
        src = r.get("source", {})
        return {"id": rule_id, "fonte": f"{src.get('pdf','?')} p{src.get('page','?')}",
                "tipo": r.get("type", "RULE"), "explica": r.get("explain_pt")}


_engine: PokerKnowledgeEngine | None = None


def engine() -> PokerKnowledgeEngine:
    global _engine
    if _engine is None:
        _engine = PokerKnowledgeEngine()
    return _engine
