"""Explainer: monta a Decision (formato de 20 campos) com proveniência separada."""
from __future__ import annotations

from .context import HandContext, hand_class
from .decision import Recommendation
from .knowledge import KnowledgeBase


def _rule_citations(kb: KnowledgeBase, rule_ids: list[str]) -> list[str]:
    out = []
    for rid in rule_ids:
        r = kb.rule(rid)
        if r:
            src = r.get("source", {})
            out.append(f"{rid} ({src.get('pdf','?')} p{src.get('page','?')})")
        else:
            out.append(rid)
    return out


def build_decision(ctx: HandContext, rec: Recommendation, hero_action: str,
                   score: dict, kb: KnowledgeBase) -> dict:
    viloes = [{"pos": v.get("pos"), "stack_bb": v.get("stack_bb"), "action": v.get("action")}
              for v in ctx.villains]
    return {
        "situacao_mesa": f"{ctx.table_max}-max, {ctx.players_left} vivos"
                         + (", bolha" if ctx.phase == "bubble" else ""),
        "fase": ctx.phase,
        "jogadores_restantes": ctx.players_left,
        "premiacao": ctx.prize_structure,
        "ante": ctx.ante,
        "eff_stack_bb": ctx.eff_stack_bb,
        "hero_pos": ctx.hero_pos,
        "viloes": viloes,
        "acao_antes": _describe_action_before(ctx),
        "hero_cards": hand_class(ctx.hero_cards),
        "linha_hero": hero_action,
        "acao_recomendada": rec.primary if not rec.insufficient else None,
        "size_recomendado": rec.size,
        "motivo": rec.explain,
        "gravidade": score.get("gravity"),
        "nota": score.get("score"),
        "tipo_erro": score.get("error_type"),
        "regra_pdf": _rule_citations(kb, rec.rule_ids),
        "range_ref": rec.range_ref,
        "ajuste_exploratorio": _exploratory(ctx),
        "explicacao_iniciante": rec.explain,
        "resumo": _one_liner(rec, score),
        "conflitos": [],
        "insuficiente": rec.insufficient,
        "falta_info": rec.ask,
        # camada de síntese / aproximação
        "source_type": rec.source_type,
        "confidence": rec.confidence,
        "range_status": rec.range_status,
        "used_proxy": rec.used_proxy,
        "warning": rec.warning,
        "proveniencia": {
            "acao_recomendada": rec.provenance,
            "ajuste_exploratorio": "EXPLORATORY",
            "explicacao_iniciante": "PEDAGOGICAL",
            "motivo": "RULE" if rec.rule_ids else "INFERENCE",
        },
    }


def _describe_action_before(ctx: HandContext) -> str:
    if ctx.preflop_action == "first_in":
        return "fold até o Hero"
    if ctx.preflop_action == "vs_limp":
        return f"limp:{ctx.opener_pos}"
    if ctx.preflop_action == "vs_shove":
        return f"shove:{ctx.opener_pos}"
    return f"raise:{ctx.opener_pos}"


def _exploratory(ctx: HandContext) -> str | None:
    if ctx.spot in ("vs_open", "resteal_short"):
        return "vs field tight (abre forte), apertar; vs field loose, alargar."
    if ctx.spot == "bb_defense":
        return "vs open muito grande, defender mais tight; vs miniraise, defender largo."
    return None


def _one_liner(rec: Recommendation, score: dict) -> str:
    if rec.insufficient:
        return "Falta informação para uma recomendação exata."
    s = score.get("score")
    if s is None:
        return f"Recomendado: {rec.primary}."
    if s >= 9:
        return f"{rec.primary} — decisão padrão correta."
    if s >= 6:
        return f"{rec.primary} era melhor; sua linha é aceitável mas inferior."
    return f"{rec.primary} era o certo; sua linha é um erro {score.get('gravity')}."
