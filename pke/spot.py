"""Classificador de spot: mapeia o contexto numa das categorias de treino/análise."""
from __future__ import annotations

from .context import HandContext


def classify_spot(ctx: HandContext) -> str:
    eff = ctx.eff_stack_bb
    pos = ctx.hero_pos
    pa = ctx.preflop_action
    phase = ctx.phase

    # pós-flop (futuro próximo) — placeholders já roteáveis
    if ctx.street != "preflop":
        return "postflop"

    if phase == "heads_up":
        return "heads_up"

    if pa == "first_in":
        if pos == "SB":
            return "blind_war_sb"
        if eff <= 10:
            return "push_fold"
        return "rfi"

    if pa == "vs_limp":
        return "vs_limp"

    if pa in ("vs_raise", "vs_shove"):
        if pa == "vs_shove":
            return "bubble_call" if phase in ("bubble", "itm") else "vs_shove"
        # vs open raise
        if eff <= 20 and ctx.opener_pos in ("CO", "BTN") and pos in ("BTN", "SB", "BB"):
            return "resteal_short"
        if pos == "BB":
            return "bb_defense"
        return "vs_open"

    return "unknown"
