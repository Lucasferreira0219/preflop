"""Classificador de fase do SNG + modelo simples de ICM/risk premium.

Fases: early, middle, bubble, itm/3handed, heads_up. Flag 'short' (<=10bb) é
ortogonal — push/fold tem prioridade de AÇÃO mesmo em early.
"""
from __future__ import annotations

from .context import HandContext

# risk premium base por fase (modelo grosso, low ticket — marcado como INFERENCE)
_RP_BASE = {"early": 0.0, "middle": 0.03, "bubble": 0.18, "itm": 0.08, "3handed": 0.10, "heads_up": 0.0}


def classify_phase(ctx: HandContext) -> str:
    paid = ctx.paid_places or 3
    left = ctx.players_left
    if left <= 2:
        return "heads_up"
    if left == 3 and paid <= 3:
        return "3handed"
    if left == paid + 1:
        return "bubble"
    if left <= paid:
        return "itm"
    # acima da bolha: early vs middle pelo nº de jogadores
    if left >= 7:
        return "early"
    return "middle"


def icm_model(ctx: HandContext) -> dict:
    phase = ctx.phase or classify_phase(ctx)
    base = _RP_BASE.get(phase if phase != "3handed" else "3handed", 0.0)
    # papel do hero pelo stack relativo (aproximação)
    role = "mid"
    stacks = [v.get("stack_bb", 0) for v in ctx.villains] + [ctx.eff_stack_bb]
    if stacks:
        mx = max(stacks)
        if ctx.eff_stack_bb >= mx:
            role = "CL"
        elif ctx.eff_stack_bb <= min(stacks) + 1e-9:
            role = "short"
    return {"pressure": round(base, 3), "risk_premium": round(base, 3), "role": role, "_provenance": "INFERENCE"}
