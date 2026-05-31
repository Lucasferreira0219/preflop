"""Gerador de spots de treino guiado pelo PKE.

Regras: só devolve spot que o motor consegue CORRIGIR (recommend não-insuficiente).
Não inventa range — amostra a mão e pergunta a ação; a resposta certa vem do motor.
Categorias começam pelas bem cobertas (push/fold, resteal, vs open, limp, rfi, bb, hu).
"""
from __future__ import annotations

import random

from .context import HandContext, RANK_ORDER, is_resteal_hand
from .knowledge import kb as _kb

# universo das 169 mãos
def _all_hands() -> list[str]:
    out = []
    rs = list(RANK_ORDER)
    for i, a in enumerate(rs):
        for j, b in enumerate(rs):
            if i == j:
                out.append(a + b)            # par
            elif i < j:
                out.append(a + b + "s")       # suited (a mais alto)
            else:
                out.append(b + a + "o")       # offsuit
    return sorted(set(out))

ALL_HANDS = _all_hands()
_RESTEAL_HANDS = [h for h in ALL_HANDS if is_resteal_hand(h)]

# pesos padrão (só categorias graduáveis no MVP)
DEFAULT_WEIGHTS = {
    "push_fold": 25, "resteal_short": 20, "vs_open_3bet": 15, "limp_punish": 15,
    "rfi": 10, "bb_defense": 5, "hu_btn": 5,
}

# especificação de cada categoria: como montar o contexto
CATEGORY_SPECS = {
    "push_fold":    dict(hero=["UTG", "MP", "HJ", "CO", "BTN"], stack=(6, 10),  action="first_in"),
    "resteal_short":dict(hero=["SB", "BB", "BTN"], opener=["CO", "BTN"], stack=(12, 20), action="vs_raise"),
    "vs_open_3bet": dict(hero=["MP", "HJ", "CO"], opener=["UTG", "UTG1", "MP", "HJ"], stack=(25, 40), action="vs_raise"),
    "limp_punish":  dict(hero=["HJ", "CO", "BTN"], opener=["UTG", "MP", "HJ"], stack=(20, 40), action="vs_limp"),
    "rfi":          dict(hero=["UTG", "UTG1", "MP", "HJ", "CO"], stack=(20, 40), action="first_in"),
    "bb_defense":   dict(hero=["BB"], opener=["CO", "BTN", "HJ"], stack=(20, 40), action="vs_raise"),
    "hu_btn":       dict(hero=["BTN"], stack=(12, 20), action="first_in", players=2),
}
_OPTIONS = {
    "push_fold": ["fold", "shove"],
    "resteal_short": ["fold", "call", "shove"],
    "vs_open_3bet": ["fold", "call", "3bet"],
    "limp_punish": ["fold", "raise"],
    "rfi": ["fold", "raise"],
    "bb_defense": ["fold", "call", "3bet"],
    "hu_btn": ["fold", "raise", "shove"],
}
_CONCEPT = {
    "push_fold": "push/fold short stack", "resteal_short": "resteal short stack",
    "vs_open_3bet": "vs open: 3-bet ou fold (exceto BTN/BB)", "limp_punish": "punir limp",
    "rfi": "RFI por posição", "bb_defense": "defesa de BB (não foldar naipadas)",
    "hu_btn": "heads-up no botão",
}
_POS_ORDER = ["UTG", "UTG1", "UTG2", "MP", "HJ", "CO", "BTN", "SB", "BB"]

_counter = 0


def _seat_idx(p):
    return _POS_ORDER.index(p) if p in _POS_ORDER else 99


def _relevant_range(cat, ctx, kb):
    if cat == "push_fold":
        return kb.shove_range(ctx.hero_pos)
    if cat == "rfi":
        return kb.rfi_range(ctx.eff_stack_bb, ctx.hero_pos)
    if cat == "limp_punish":
        return kb.rfi_range(ctx.eff_stack_bb, ctx.opener_pos)
    if cat == "resteal_short":
        return _RESTEAL_HANDS
    if cat in ("vs_open_3bet", "bb_defense"):
        vr = kb.vs_rfi(ctx.eff_stack_bb, ctx.hero_pos, ctx.opener_pos)
        return list({*(vr.get("3bet") or []), *(vr.get("call") or []), *(vr.get("shove") or [])})
    return ALL_HANDS


def _sample_hand(cat, ctx, kb):
    rng = _relevant_range(cat, ctx, kb)
    # ~55% dentro do range relevante (decisão de agir), resto fora (decisão de fold)
    if rng and random.random() < 0.55:
        return random.choice(rng)
    return random.choice(ALL_HANDS)


def _build_ctx(cat: str) -> HandContext:
    spec = CATEGORY_SPECS[cat]
    kb = _kb()
    hero = random.choice(spec["hero"])
    lo, hi = spec["stack"]
    eff = random.randint(lo, hi)
    players = spec.get("players", random.randint(5, 8))
    opener = None
    if "opener" in spec:
        # garante que o opener age antes do hero
        cands = [o for o in spec["opener"] if _seat_idx(o) < _seat_idx(hero)] or spec["opener"]
        opener = random.choice(cands)
    ctx = HandContext(
        players_left=players, paid_places=3, ante=False,
        bb_chips=200, eff_stack_bb=float(eff),
        hero_pos=hero, preflop_action=spec["action"], opener_pos=opener,
        villains=[{"pos": opener, "action": "raise" if spec["action"] == "vs_raise" else "limp"}] if opener else [],
    )
    ctx.hero_cards = _sample_hand(cat, ctx, kb)
    return ctx


def _weighted_pick(weights: dict) -> str:
    cats = [c for c in weights if c in CATEGORY_SPECS and weights[c] > 0]
    if not cats:
        cats = list(DEFAULT_WEIGHTS)
        w = [DEFAULT_WEIGHTS[c] for c in cats]
    else:
        w = [weights[c] for c in cats]
    return random.choices(cats, weights=w, k=1)[0]


def generate_spot(category: str | None = None, weights: dict | None = None, max_tries: int = 16):
    """Devolve (spot_dict, ctx) gradável, ou (None, None) se não conseguir."""
    from . import engine
    eng = engine()
    for _ in range(max_tries):
        cat = category if category in CATEGORY_SPECS else _weighted_pick(weights or DEFAULT_WEIGHTS)
        ctx = _build_ctx(cat)
        rec = eng.recommend(ctx)
        if rec.insufficient or rec.primary is None:
            continue  # descarta spot que o PKE não corrige
        return make_spot(cat, ctx), ctx
    return None, None


def make_spot(cat: str, ctx: HandContext) -> dict:
    """Monta o dict de spot a partir do contexto (reutilizado em geração e replay)."""
    global _counter
    _counter += 1
    bb = ctx.bb_chips
    return {
        "spot_id": f"sim_{_counter}",
        "category": cat,
        "phase": ctx.phase,
        "players_left": ctx.players_left,
        "blinds": f"{bb // 2}/{bb}",
        "ante": ctx.ante,
        "hero_position": ctx.hero_pos,
        "hero_cards": ctx.hero_cards,
        "effective_stack_bb": ctx.eff_stack_bb,
        "action_before_hero": _describe_before(ctx),
        "opener_position": ctx.opener_pos,
        "question": _question(cat, ctx),
        "options": _OPTIONS.get(cat, ["fold", "call", "raise", "shove"]),
        "expected_concept": _CONCEPT.get(cat),
    }


def _describe_before(ctx: HandContext) -> str:
    if ctx.preflop_action == "first_in":
        return "folded_to_hero"
    if ctx.preflop_action == "vs_limp":
        return f"limp:{ctx.opener_pos}"
    if ctx.preflop_action == "vs_shove":
        return f"shove:{ctx.opener_pos}"
    return f"raise:{ctx.opener_pos}"


def _question(cat: str, ctx: HandContext) -> str:
    base = f"{ctx.hero_pos} com {ctx.hero_cards} e {int(ctx.eff_stack_bb)}bb"
    if ctx.preflop_action == "vs_raise":
        return f"Qual a melhor ação? {base}, {ctx.opener_pos} abriu raise."
    if ctx.preflop_action == "vs_limp":
        return f"Qual a melhor ação? {base}, {ctx.opener_pos} deu limp."
    return f"Qual a melhor ação no {base}?"
