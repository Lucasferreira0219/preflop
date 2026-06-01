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


# ── faixas de qualidade da linha do Hero (tolerância estratégica) ─────────────────
# Ordem da MELHOR para a PIOR — usada por _worse() para nunca "melhorar" um erro.
QUALITY_ORDER = [
    "best", "standard_good", "acceptable_good", "acceptable_but_inferior",
    "close", "minor_error", "medium_error", "major_error", "severe_error",
]
_QUALITY_RANK = {q: i for i, q in enumerate(QUALITY_ORDER)}

# Faixa → nota interna (0–10). Mantém a agregação e os caps existentes:
#   ≥8 = acerto, 6–7.9 = erro leve, 4–5.9 = médio, <4 = grave (major/severe).
QUALITY_SCORE = {
    "best": 10, "standard_good": 10, "acceptable_good": 9,
    "acceptable_but_inferior": 8, "close": 6, "minor_error": 6,
    "medium_error": 4, "major_error": 2, "severe_error": 1,
    "insufficient": None,
}


def _worse(a: str, b: str) -> str:
    """Devolve a faixa mais severa entre a e b."""
    return a if _QUALITY_RANK.get(a, 0) >= _QUALITY_RANK.get(b, 0) else b


def score_decision(ctx: HandContext, rec: Recommendation, hero_action: str,
                   hero_size: str | None = None) -> dict:
    if rec.insufficient or rec.primary is None:
        return {"score": None, "gravity": None, "error_type": None,
                "hero_action_quality": "insufficient", "quality_note": None,
                "recommended_action": None, "acceptable_actions": [],
                "advanced_alternatives": [], "bad_actions": [], "severe_mistakes": [],
                "rationale": "Sem base suficiente para nota (regra-nível apenas).",
                "modifiers": []}

    hero = norm_action(hero_action)
    primary = norm_action(rec.primary)
    acceptable = {norm_action(a) for a in rec.acceptable}
    advanced = {norm_action(a) for a in rec.advanced}
    bad = {norm_action(a) for a in rec.bad}
    severe = {norm_action(a) for a in rec.severe}
    forbidden = {norm_action(a) for a in rec.forbidden}
    approximate = getattr(rec, "approximate", False)
    mods: list[dict] = []
    error_type = None
    note = None

    # ── 1) classificação base por faixa de tolerância ────────────────────────────
    if hero == primary:
        if hero_size is not None and rec.size and norm_size(hero_size) != norm_size(rec.size):
            quality = "acceptable_but_inferior"
            error_type = "size_fora_da_tabela"
            mods.append({"fator": "size diferente do recomendado", "delta": "→8"})
        else:
            quality = "best"
    elif hero in acceptable:
        quality = "standard_good"
        note = "Sua linha não é a preferida pelo motor, mas é aceitável — não é erro."
    elif hero in advanced:
        quality = "acceptable_good"
        note = rec.advanced_note or (
            "Linha avançada: aceitável, mas exige plano. A linha mais simples também serve.")
    elif hero in severe:
        quality = "severe_error"
        error_type = _forbidden_error(ctx, rec, hero)
        note = "Essa linha foge das opções aceitáveis. Com esse stack, jogue shove/fold."
    elif hero in forbidden:
        quality = "major_error"
        error_type = _forbidden_error(ctx, rec, hero)
    elif hero in bad:
        quality = "medium_error"
        error_type = "acao_inferior"
    else:
        quality = "medium_error"
        error_type = "acao_subotima"

    # ── 2) severidades específicas de spot (erros caros continuam caros) ─────────
    tolerated = hero in acceptable or hero in advanced
    if (ctx.spot == "push_fold" and hero == "raise"
            and (ctx.eff_stack_bb or 99) < 10 and primary in ("shove", "fold")):
        quality = _worse(quality, "severe_error")
        error_type = error_type or "raise_fold_sub10"
        mods.append({"fator": "raise/fold com <10bb (criou spot)", "delta": "crítico"})
    if ctx.spot == "resteal_short" and hero == "call" and not tolerated:
        quality = _worse(quality, "major_error")
        error_type = error_type or "call_em_vez_de_resteal"
        mods.append({"fator": "call em vez de resteal (sem fold equity)", "delta": "grave"})
    if ctx.phase == "bubble" and hero == "call" and primary == "fold" and not tolerated:
        quality = _worse(quality, "major_error")
        error_type = error_type or "call_loose_bolha_icm"
        mods.append({"fator": "call anti-ICM na bolha", "delta": "grave"})

    # ── 3) spots APROXIMADOS: não punir forte quando é genuinamente close ────────
    if approximate:
        if quality == "best":
            quality = "standard_good"            # acerto aproximado não é "10 cravado"
            mods.append({"fator": "spot aproximado (sem range exato)", "delta": "máx 8"})
        elif quality == "medium_error" and hero not in severe and hero not in forbidden:
            quality = "close"                    # decisão marginal por falta de range
            error_type = error_type or "decisao_close_aproximada"
            note = note or "A mão está próxima da borda do range — decisão marginal."
            mods.append({"fator": "spot aproximado — decisão close", "delta": "close"})

    score = QUALITY_SCORE[quality]
    # aproximação: violação clara ainda pune, mas sem extremo (mín 3)
    if approximate and quality in ("major_error", "severe_error"):
        score = max(3, score)
    # aproximação: acerto não é nota cheia
    if approximate and quality in ("best", "standard_good"):
        score = min(8, score)

    score = max(0, min(10, score))

    return {"score": score, "gravity": _gravity(score), "error_type": error_type,
            "hero_action_quality": quality, "quality_note": note,
            "recommended_action": primary,
            "acceptable_actions": sorted(acceptable | {primary}),
            "advanced_alternatives": sorted(advanced),
            "bad_actions": sorted(bad | forbidden),
            "severe_mistakes": sorted(severe),
            "approximate": approximate, "modifiers": mods,
            "rationale": _rationale(hero, primary, quality, mods)}


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


def _rationale(hero, primary, quality, mods) -> str:
    txt = f"Hero={hero}, recomendado={primary}, qualidade={quality}."
    if mods:
        txt += " Modificadores: " + "; ".join(
            f"{m['fator']} ({m['delta']})" for m in mods)
    return txt
