"""Motor de nota (0-10) — determinístico e auditável (§5 da spec)."""
from __future__ import annotations

from .context import HandContext
from .decision import Recommendation

_SYNONYMS = {
    "raise": "raise", "open": "raise", "iso": "raise", "minraise": "raise",
    "3bet": "3bet", "3-bet": "3bet", "three-bet": "3bet", "threebet": "3bet",
    "4bet": "4bet", "4-bet": "4bet",
    "shove": "shove", "jam": "shove", "all-in": "shove", "allin": "shove", "push": "shove",
    "call": "call", "fold": "fold", "limp": "limp", "bet": "bet", "check": "check",
}


def norm_action(a: str | None) -> str | None:
    if not a:
        return None
    return _SYNONYMS.get(a.strip().lower().replace(" ", ""), a.strip().lower())


def _gravity(score: int) -> str:
    if score >= 8:
        return "nenhuma" if score == 10 else "leve"
    if score >= 6:
        return "leve"
    if score >= 4:
        return "media"
    if score >= 1:
        return "grave"
    return "punt"


def score_decision(ctx: HandContext, rec: Recommendation, hero_action: str,
                   hero_size: str | None = None) -> dict:
    if rec.insufficient or rec.primary is None:
        return {"score": None, "gravity": None, "error_type": None,
                "rationale": "Sem base suficiente para nota (regra-nível apenas).",
                "modifiers": []}

    hero = norm_action(hero_action)
    primary = norm_action(rec.primary)
    acceptable = {norm_action(a) for a in rec.acceptable}
    forbidden = {norm_action(a) for a in rec.forbidden}
    mods: list[dict] = []
    error_type = None

    # base
    if hero == primary:
        if hero_size is not None and rec.size and norm_size(hero_size) != norm_size(rec.size):
            base = 8
            error_type = "size_fora_da_tabela"
            mods.append({"fator": "size diferente do recomendado", "delta": -2})
        else:
            base = 10
    elif hero in acceptable:
        base = 7
        error_type = "alternativa_inferior"
    elif hero in forbidden:
        base = 2
        error_type = _forbidden_error(ctx, rec, hero)
    else:
        base = 5
        error_type = "acao_subotima"

    score = base

    # modificadores (§5.2)
    if ctx.phase == "bubble" and hero in forbidden and hero == "call":
        score -= 2
        mods.append({"fator": "call anti-ICM na bolha", "delta": -2})
    if ctx.eff_stack_bb < 10 and hero == "raise" and primary in ("shove", "fold"):
        score = min(score, 4)
        error_type = error_type or "raise_fold_sub10"
        mods.append({"fator": "raise/fold com <10bb (criou spot)", "delta": "cap 4"})
    if ctx.spot == "resteal_short" and hero == "call":
        score = min(score, 3)
        mods.append({"fator": "call em vez de resteal (sem fold equity)", "delta": "cap 3"})

    score = max(0, min(10, score))
    return {"score": score, "base": base, "gravity": _gravity(score),
            "error_type": error_type, "modifiers": mods,
            "rationale": _rationale(hero, primary, base, mods)}


def _forbidden_error(ctx: HandContext, rec: Recommendation, hero: str) -> str:
    if hero == "call" and rec.primary in ("3bet", "shove"):
        return "call_em_vez_de_3bet_ou_shove"
    if hero == "raise" and rec.primary in ("shove", "fold"):
        return "raise_em_vez_de_pushfold"
    if hero == "limp":
        return "limp_indevido"
    return "viola_regra_base"


def norm_size(s: str | None) -> str | None:
    if not s:
        return None
    return s.strip().lower().replace(" ", "")


def _rationale(hero, primary, base, mods) -> str:
    txt = f"Hero={hero}, recomendado={primary}, base={base}."
    if mods:
        txt += " Modificadores: " + "; ".join(
            f"{m['fator']} ({m['delta']})" for m in mods)
    return txt
