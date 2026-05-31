"""Range Synthesis / Approximation.

Quando NÃO existe range exato cadastrado, gera uma decisão prática aproximada a
partir das regras dos PDFs, spots similares e heurísticas de ICM / low stakes —
sempre rotulada (source_type, confidence, range_status, used_proxy, warning).

NUNCA finge precisão de solver. INSUFFICIENT só quando falta info ESSENCIAL
(mão, posição, stack, ação antes do hero).
"""
from __future__ import annotations

from .context import HandContext, hand_class

WARN_HRC = "Estimativa derivada. Para precisão exata, usar HRC/ICMizer."

# ── ICM: call vs all-in na bolha (sem range exato cadastrado) ─────────────────────
# Calls na bolha ficam MUITO mais tight por Risk Premium. Tiers conservadores.
_BUBBLE_CALL_BASE = {"AA", "KK", "QQ", "JJ", "AKs", "AKo", "AQs"}
_BUBBLE_CALL_CL = {"TT", "99", "AQo", "AJs", "KQs"}            # chip leader pressiona/paga mais
_BUBBLE_CALL_SHORT = {"TT", "99", "88", "ATs", "AJo", "KQs", "A5s"}  # short assume mais risco


def bubble_call_decision(ctx: HandContext) -> dict:
    """Heurística de ICM para call de shove na bolha. Devolve dict com action +
    rótulos de aproximação. Requer hero_cards (caso contrário é INSUFFICIENT)."""
    cls = hand_class(ctx.hero_cards)
    role = (ctx.icm or {}).get("role", "mid")
    callset = set(_BUBBLE_CALL_BASE)
    if role == "CL":
        callset |= _BUBBLE_CALL_CL
    if role == "short" or ctx.eff_stack_bb <= 10:
        callset |= _BUBBLE_CALL_SHORT
    action = "call" if cls in callset else "fold"
    expl = ("Não há range exato cadastrado para call de shove na bolha, mas os PDFs indicam "
            "que o calling range encolhe muito por causa do Risk Premium (ICM). ")
    if action == "call":
        expl += f"Como {role}, {cls} está no topo que dá pra pagar."
    else:
        expl += f"{cls} fica em zona de fold cauteloso — pague só o topo."
    return {
        "action": action,
        "source_type": "DERIVED_FROM_PDF",
        "confidence": "medium_low",
        "range_status": "approximate",
        "used_proxy": {"base_spot": "call vs shove tight (ICM bolha)",
                        "adjustment": f"bubble_icm_role_{role}"},
        "warning": WARN_HRC,
        "explain": expl,
        "rule_ids": ["BUBBLE.PLAN"],
    }


# ── Pós-flop: guideline de c-bet (sem range/solver pós-flop) ──────────────────────
def postflop_decision(ctx: HandContext) -> dict:
    ip = ctx.is_ip_vs(ctx.opener_pos)
    if ip:
        return {
            "action": "bet", "size": "33%",
            "source_type": "DERIVED_FROM_PDF", "confidence": "medium", "range_status": "approximate",
            "used_proxy": {"base_spot": "c-bet IP vs BB (Guia de Bolso)", "adjustment": "guideline_postflop"},
            "warning": "Guideline pós-flop, não range exato. Em micro stakes, evite blefes grandes.",
            "explain": "Em posição como agressor pré-flop vs BB: c-bet baixa (25–33%) com alta frequência. "
                       "Sem solver pós-flop — guideline do material.",
            "rule_ids": ["CBET.IP_BB"],
        }
    return {
        "action": "check", "size": None,
        "source_type": "DERIVED_FROM_PDF", "confidence": "medium_low", "range_status": "approximate",
        "used_proxy": {"base_spot": "c-bet OOP seletivo (Guia de Bolso)", "adjustment": "guideline_postflop"},
        "warning": "Guideline pós-flop, não range exato.",
        "explain": "Fora de posição: seja seletivo — c-bete mão de valor e cuidado com boards que não "
                   "conectam com seu range. Evite blefes grandes em micro stakes.",
        "rule_ids": ["CBET.OOP"],
    }


def stack_proxy_note(requested_bb: float, bucket_bb: int) -> dict | None:
    """Marca aproximação quando o stack pedido não é o bucket usado."""
    if round(requested_bb) == bucket_bb:
        return None
    return {"base_spot": f"grid de {bucket_bb}bb", "adjustment": f"stack {int(requested_bb)}bb≈{bucket_bb}bb"}
