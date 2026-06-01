"""Consulta em linguagem natural usando o MESMO motor (PKE).

Não duplica estratégia: entende a pergunta + contexto, monta HandContext e chama
recommend/score (decisão) ou o glossário (conceito). Anti-alucinação preservada.
"""
from __future__ import annotations

import re

from .context import HandContext, hand_class
from .knowledge import kb as _kb
from .scorer import norm_action, score_decision

# ── léxico de parsing (apresentação/entendimento, não estratégia) ────────────────
_POS_WORDS = {
    "utg+2": "UTG2", "utg2": "UTG2", "utg+1": "UTG1", "utg1": "UTG1", "utg": "UTG",
    "mp": "MP", "hj": "HJ", "hijack": "HJ", "co": "CO", "cutoff": "CO",
    "btn": "BTN", "button": "BTN", "botão": "BTN", "botao": "BTN",
    "sb": "SB", "small blind": "SB", "bb": "BB", "big blind": "BB",
}
_CONCEPTS = {  # termo natural -> chave do glossário
    "risk premium": "RP", "risk-premium": "RP", " rp ": "RP",
    "icm": "ICM", "fold equity": "FoldEquity", "fold-equity": "FoldEquity",
    "resteal": "Resteal", "push/fold": "PushFold", "push fold": "PushFold",
    "pushfold": "PushFold", "bolha": "Bolha", "limp": "Limp", "blind war": "BlindWar",
    "implied": "ImpliedOdds", "chipev": "ChipEV", "fragmenta": "FragmentacaoRange",
}
_ACT_WORDS = {  # ação mencionada na pergunta
    "raise": "raise", "aumentar": "raise", "abrir": "raise",
    "3bet": "3bet", "3-bet": "3bet", "call": "call", "pagar": "call", "paguei": "call",
    "shove": "shove", "all-in": "shove", "allin": "shove", "fold": "fold", "foldar": "fold",
    "limp": "limp", "check": "check",
}
_PRETTY_PDF = {"guia_de_bolso": "Guia de Bolso"}
# ação rule-level por spot (quando falta peça pra avaliação exata)
_SPOT_ACTION = {
    "vs_open": "3bet", "resteal_short": "shove", "vs_limp": "raise",
    "heads_up": "raise", "rfi": "raise", "bb_defense": "call", "blind_war_sb": "raise",
}
_SPOT_RULE = {
    "push_fold": "OPENSHOVE.10BB", "rfi": "RFI.RANGE", "vs_open": "VSRFI.3BET_ONLY",
    "bb_defense": "BB.NOFOLD_SUITED", "resteal_short": "RESTEAL.SHORT",
    "vs_limp": "LIMP.PUNISH", "heads_up": "HU.BTN", "bubble_call": "BUBBLE.PLAN",
    "blind_war_sb": "SB.RAISE_ONLY",
}


def _is_definition(q: str) -> bool:
    return bool(re.search(r"\bo que (é|e|significa|são|sao)\b|\bsignifica\b|\bdefin|\bexpli(que|ca)\b", q))


def _find_concept(q: str) -> str | None:
    qq = f" {q} "
    for term in sorted(_CONCEPTS, key=len, reverse=True):
        if term in qq:
            return _CONCEPTS[term]
    return None


def _parse_cards(q: str) -> str | None:
    # remove "9bb" pra não confundir, depois procura classe de mão
    s = re.sub(r"\d+\s*bb", " ", q, flags=re.I)
    m = re.search(r"\b([AKQJTakqjt2-9]{2}[soSO]?)\b", s)
    return hand_class(m.group(1).upper()) if m else None


def _parse_pos(q: str) -> str | None:
    s = re.sub(r"\d+\s*bb", " ", q, flags=re.I)
    for word in sorted(_POS_WORDS, key=len, reverse=True):
        if re.search(rf"\b{re.escape(word)}\b", s):
            return _POS_WORDS[word]
    return None


def _parse_stack(q: str) -> float | None:
    m = re.search(r"(\d+(?:[.,]\d+)?)\s*bb", q, flags=re.I)
    return float(m.group(1).replace(",", ".")) if m else None


def _parse_opener(q: str):
    m = re.search(r"(?:open|abre|abriu|raise|aumenta|limp|limpou|shove|all-?in)\s+(?:do|de|no|da)?\s*([a-z+0-9]+)",
                  q, flags=re.I)
    if m:
        return _POS_WORDS.get(m.group(1).lower())
    return None


def _action_before(context: dict, q: str):
    """Devolve (preflop_action, opener_pos)."""
    ab = (context.get("action_before_hero") or "").lower()
    if ab in ("folded_to_hero", "first_in", "folded to me") or "ninguém abriu" in q or "todos foldaram" in q:
        return "first_in", None
    op = context.get("opener_position")
    if op:
        op = _POS_WORDS.get(op.lower(), op.upper())
    if "limp" in q or ab.startswith("limp"):
        return "vs_limp", op or _parse_opener(q)
    if any(k in q for k in ("vs open", "contra open", "open do", "abre do", "raise do", "vs raise")) \
       or ab.startswith(("raise", "open")):
        return "vs_raise", op or _parse_opener(q)
    if "shove" in ab or "all-in do" in q or "pagar shove" in q or "call shove" in q:
        return "vs_shove", op or _parse_opener(q)
    return "first_in", None


def _detect_spot(q: str, ctx: HandContext) -> str | None:
    if "resteal" in q:
        return "resteal_short"
    if ctx.preflop_action == "vs_limp" or "limp" in q:
        return "vs_limp"
    if ctx.preflop_action == "vs_shove" or "call shove" in q or "pagar" in q and "bolha" in q:
        return "bubble_call"
    if ctx.preflop_action == "vs_raise" or any(k in q for k in ("vs open", "open do", "abre", "raise do")):
        return "bb_defense" if ctx.hero_pos == "BB" else "vs_open"
    if "heads" in q or "hu " in f" {q} " or ctx.players_left == 2:
        return "heads_up"
    # first in
    if ctx.eff_stack_bb is not None and ctx.eff_stack_bb <= 10:
        return "push_fold"
    if ctx.hero_pos == "SB":
        return "blind_war_sb"
    return "rfi"


def _first_action_word(q: str) -> str | None:
    best = None
    best_i = len(q) + 1
    for w, a in _ACT_WORDS.items():
        m = re.search(rf"\b{re.escape(w)}\b", q)
        if m and m.start() < best_i:
            best_i, best = m.start(), a
    return best


def _candidate_action(q: str) -> str | None:
    """Só considera ação candidata quando o Hero pergunta sobre FAZÊ-LA
    (evita confundir a ação do vilão, ex.: 'limp do MP')."""
    if re.search(r"foi (ruim|errad|erro)|errei|por que.*(ruim|errad)", q):
        return _first_action_word(q)
    m = re.search(r"(?:posso|devo|dou|dar|fazer|faço|faço|melhor)\s+(?:um\s+)?"
                  r"(raise|aumentar|abrir|3-?bet|call|pagar|shove|all-?in|allin|fold|foldar|limp|check)",
                  q)
    if m:
        return _ACT_WORDS.get(m.group(1).replace("-", ""), _ACT_WORDS.get(m.group(1)))
    return None


def _cite(rule_ids):
    kb = _kb()
    out = []
    for rid in rule_ids:
        r = kb.rule(rid)
        src = (r or {}).get("source", {})
        out.append({"id": rid, "source": _PRETTY_PDF.get(src.get("pdf"), src.get("pdf")),
                    "page": src.get("page")})
    return out


# ── montagem do contexto ──────────────────────────────────────────────────────────

def _build_ctx(question: str, context: dict):
    q = (question or "").lower()
    pa, opener = _action_before(context, q)
    cards = context.get("hero_cards") or _parse_cards(q)
    cards = hand_class(cards) if cards else None
    pos = context.get("hero_position") or _parse_pos(q)
    if pos:
        pos = _POS_WORDS.get(pos.lower(), pos.upper())
    stack = context.get("effective_stack_bb")
    stack = float(stack) if stack is not None else _parse_stack(q)
    players = context.get("players_left")
    if "heads" in q or " hu " in f" {q} ":
        players = 2
    if "bolha" in q and players is None:
        players = 4

    ctx = HandContext(
        players_left=players or 9,
        paid_places=3,
        ante=bool(context.get("ante")),
        eff_stack_bb=stack if stack is not None else 100.0,
        hero_pos=pos or "BTN",
        hero_cards=cards,
        preflop_action=pa,
        opener_pos=opener,
        villains=[{"pos": opener, "action": "raise"}] if opener else [],
    )
    missing = []
    if pos is None:
        missing.append("hero_position")
    if stack is None:
        missing.append("effective_stack_bb")
    has_core = not missing
    return ctx, _candidate_action(q), has_core, missing


# ── respostas ─────────────────────────────────────────────────────────────────────

def _concept_answer(key: str) -> dict:
    g = _kb().glossary.get(key, {})
    term = g.get("term", key)
    definition = g.get("definition", "")
    if not definition:
        return _insufficient("Não há base cadastrada para esse conceito.")
    return {
        "answer": f"{term}: {definition}",
        "recommended_action": None,
        "confidence": "high",
        "rule_refs": [],
        "provenance": {"main_answer": "REFERENCE", "phase": "INFERENCE", "explanation": "PEDAGOGICAL"},
        "missing_info": [],
        "beginner_explanation": definition,
        "common_mistake": None,
    }


def _insufficient(msg: str, missing=None, rule_ids=None) -> dict:
    return {
        "answer": msg, "recommended_action": None, "confidence": "insufficient",
        "rule_refs": _cite(rule_ids or []),
        "provenance": {"main_answer": "RULE" if rule_ids else "INFERENCE",
                       "phase": "INFERENCE", "explanation": "PEDAGOGICAL"},
        "missing_info": missing or [], "beginner_explanation": msg, "common_mistake": None,
    }


def _decision_answer(ctx: HandContext, cand: str | None) -> dict:
    from . import engine
    rec = engine().recommend(ctx)

    if rec.insufficient:
        return {
            "answer": rec.explain,
            "recommended_action": None,
            # só falta a mão → medium (resposta parcial); sem base nenhuma → insufficient
            "confidence": "medium" if rec.ask else "insufficient",
            "source_type": rec.source_type, "range_status": rec.range_status,
            "used_proxy": rec.used_proxy, "warning": rec.warning,
            "rule_refs": _cite(rec.rule_ids),
            "provenance": {"main_answer": rec.provenance, "phase": "INFERENCE", "explanation": "PEDAGOGICAL"},
            "missing_info": rec.ask,
            "beginner_explanation": rec.explain,
            "common_mistake": rec.common_mistake,
        }

    primary = rec.primary
    answer = f"{_ACT_LABEL(primary)}. {rec.explain}"
    common = rec.common_mistake

    # pergunta sobre uma ação específica ("posso dar raise?", "call foi ruim?")
    if cand and norm_action(cand) != norm_action(primary):
        sc = score_decision(ctx, rec, cand)
        ncand = norm_action(cand)
        accept = {norm_action(a) for a in rec.acceptable}
        adv = {norm_action(a) for a in rec.advanced}
        if ncand in {norm_action(a) for a in rec.severe}:
            answer = (f"Não — {_ACT_LABEL(primary)} é melhor. {_ACT_LABEL(cand)} aqui é erro crítico.")
            common = common or rec.common_mistake or f"{_ACT_LABEL(cand)} quando o certo é {_ACT_LABEL(primary)}."
        elif ncand in {norm_action(a) for a in rec.forbidden}:
            answer = (f"Não — {_ACT_LABEL(primary)} é melhor. "
                      f"{_ACT_LABEL(cand)} aqui é erro {sc.get('gravity')}.")
            common = common or rec.common_mistake or f"{_ACT_LABEL(cand)} quando o certo é {_ACT_LABEL(primary)}."
        elif ncand in adv:
            answer = (f"{_ACT_LABEL(primary)} é a recomendação, mas {_ACT_LABEL(cand)} é uma "
                      "linha avançada aceitável (exige plano).")
        elif ncand in accept:
            answer = f"{_ACT_LABEL(cand)} também é aceitável aqui — não é erro. {_ACT_LABEL(primary)} é a preferida."
        else:
            answer = f"{_ACT_LABEL(primary)} é a recomendação. {_ACT_LABEL(cand)} é inferior."

    if rec.warning:
        answer = answer.rstrip(".") + ". " + rec.warning

    return {
        "answer": answer,
        "recommended_action": primary,
        "confidence": rec.confidence,
        "source_type": rec.source_type,
        "range_status": rec.range_status,
        "used_proxy": rec.used_proxy,
        "warning": rec.warning,
        "rule_refs": _cite(rec.rule_ids),
        "provenance": {"main_answer": rec.source_type, "phase": "INFERENCE", "explanation": "PEDAGOGICAL"},
        "missing_info": [],
        "beginner_explanation": rec.explain,
        "common_mistake": common,
    }


def _rule_level_answer(spot: str, ctx: HandContext, cand: str | None, missing_core=None) -> dict:
    kb = _kb()
    rule_id = _SPOT_RULE.get(spot)
    r = kb.rule(rule_id) if rule_id else None
    if not r:
        return _insufficient("Não há regra cadastrada para esse contexto.")
    action = _SPOT_ACTION.get(spot)
    # essenciais ausentes (posição/stack) → insufficient; mão ausente → resposta parcial
    missing = list(missing_core or [])
    if ctx.hero_cards is None and "hero_cards" not in missing:
        missing.append("hero_cards")
    essential_missing = any(m in ("hero_position", "effective_stack_bb") for m in missing)
    answer = r.get("explain_pt", "")
    if action:
        answer = f"{_ACT_LABEL(action)}. " + answer
    if essential_missing:
        answer += " Mas preciso de " + " e ".join(
            "posição" if m == "hero_position" else "stack efetivo" if m == "effective_stack_bb" else "mão"
            for m in missing) + " para a recomendação exata."
    elif "hero_cards" in missing:
        answer += " Me diga a mão para a decisão exata."
    return {
        "answer": answer,
        "recommended_action": action,
        "confidence": "insufficient" if essential_missing else "medium",
        "source_type": "INSUFFICIENT" if essential_missing else "CANONICAL_RULE",
        "range_status": "approximate",
        "used_proxy": None, "warning": None,
        "rule_refs": _cite([rule_id]),
        "provenance": {"main_answer": "RULE", "phase": "INFERENCE", "explanation": "PEDAGOGICAL"},
        "missing_info": missing,
        "beginner_explanation": r.get("explain_pt"),
        "common_mistake": r.get("common_mistake"),
    }


def _ACT_LABEL(a: str | None) -> str:
    return {"shove": "Shove (all-in)", "raise": "Raise", "3bet": "3-bet", "call": "Call",
            "fold": "Fold", "bet": "Aposta", "limp": "Limp", "check": "Check"}.get(
        norm_action(a) if a else None, a or "—")


# ── ponto de entrada ────────────────────────────────────────────────────────────────

def run_query(question: str, context: dict | None = None) -> dict:
    context = context or {}
    q = (question or "").strip().lower()
    if not q and not context:
        return _insufficient("Faça uma pergunta ou informe o contexto da mão.")

    concept = _find_concept(q)
    if concept and (_is_definition(q) or (q.startswith(("por que", "porque", "pq")) and "hero_cards" not in context)):
        return _concept_answer(concept)

    ctx, cand, has_core, missing_core = _build_ctx(question, context)
    spot = _detect_spot(q, ctx)
    ctx.spot = None  # deixa o motor reclassificar

    # caminho completo: temos posição + stack (mão é opcional; motor pede se faltar)
    if has_core:
        return _decision_answer(ctx, cand)
    # falta info ESSENCIAL (posição/stack): insufficient, mas ainda dá a dica da regra do spot
    if spot:
        return _rule_level_answer(spot, ctx, cand, missing_core)
    if concept:
        return _concept_answer(concept)
    return _insufficient("Faltou contexto: me diga posição, stack e a mão.",
                         missing=missing_core or ["hero_position", "effective_stack_bb", "hero_cards"])
