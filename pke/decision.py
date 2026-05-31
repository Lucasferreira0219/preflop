"""Motor de decisão: dado um HandContext, qual a ação recomendada (e por quê).

Combina regras canônicas (rules.json) + ranges (ranges/sng/*.json). Cada handler
de spot devolve uma Recommendation com proveniência. Se faltar base → insufficient.
"""
from __future__ import annotations

from dataclasses import dataclass, field

from .context import HandContext, hand_class, in_range, is_resteal_hand, is_suited
from .knowledge import KnowledgeBase, kb as _kb
from .phase import classify_phase, icm_model
from .range_synthesis import bubble_call_decision, postflop_decision, stack_proxy_note
from .spot import classify_spot


# source_type: como a decisão foi obtida (proveniência de range)
#   CANONICAL_RULE   — regra direta do Guia de Bolso/PDF (alta confiança)
#   EXTRACTED_RANGE  — range explícito de PDF/JSON (alta confiança)
#   DERIVED_FROM_PDF — aproximação a partir dos PDFs/spots similares (média)
#   HEURISTIC_LOW_STAKES — ajuste exploratório micro/low (média/baixa)
#   INSUFFICIENT     — falta info essencial (mão/pos/stack/ação)
@dataclass
class Recommendation:
    primary: str | None = None
    acceptable: list[str] = field(default_factory=list)
    forbidden: list[str] = field(default_factory=list)
    size: str | None = None
    rule_ids: list[str] = field(default_factory=list)
    range_ref: str | None = None
    common_mistake: str | None = None
    explain: str = ""
    provenance: str = "RULE"
    insufficient: bool = False
    ask: list[str] = field(default_factory=list)
    # camada de síntese / aproximação
    source_type: str = "EXTRACTED_RANGE"
    confidence: str = "high"           # high | medium | medium_low | low
    range_status: str = "exact"        # exact | approximate
    used_proxy: dict | None = None
    warning: str | None = None

    @property
    def approximate(self) -> bool:
        return self.range_status == "approximate" or self.source_type in (
            "DERIVED_FROM_PDF", "HEURISTIC_LOW_STAKES")


def _size_from_table(table: list[dict], eff_bb: float, key: str = "size") -> str | None:
    for row in table:  # tabelas vêm em ordem decrescente de min
        if eff_bb >= row["min"]:
            return row.get(key)
    return table[-1].get(key) if table else None


def enrich(ctx: HandContext) -> HandContext:
    """Preenche os derivados (phase, icm, spot)."""
    ctx.phase = classify_phase(ctx)
    ctx.icm = icm_model(ctx)
    ctx.spot = classify_spot(ctx)
    return ctx


def recommended_actions(ctx: HandContext, kb: KnowledgeBase | None = None) -> Recommendation:
    kb = kb or _kb()
    if ctx.spot is None:
        enrich(ctx)
    spot = ctx.spot
    handler = _HANDLERS.get(spot)
    if handler is None:
        return Recommendation(insufficient=True, explain=f"Spot '{spot}' ainda não modelado.",
                              rule_ids=[], provenance="INFERENCE")
    return handler(ctx, kb)


# ── handlers por spot ───────────────────────────────────────────────────────────

def _need_cards(ctx: HandContext, rule_ids: list[str], explain: str) -> Recommendation:
    return Recommendation(insufficient=True, ask=["hero_cards"], rule_ids=rule_ids,
                          explain=explain + " (informe a mão do Hero para avaliar)")


def _push_fold(ctx: HandContext, kb: KnowledgeBase) -> Recommendation:
    r = kb.rule("OPENSHOVE.10BB")
    rng = kb.shove_range(ctx.hero_pos)
    ref = f"ranges/sng/ranges_10bb.json#positions.{ctx.hero_pos}._RFI_shove"
    if ctx.hero_cards is None:
        return _need_cards(ctx, ["OPENSHOVE.10BB"], r["explain_pt"])
    shove = in_range(ctx.hero_cards, rng)
    # Push/fold ≤10bb é REGRA CLARA do PDF: o grid de 10bb é o range oficial de
    # all-in/fold para qualquer stack curto. Tratamos como exato (nota estrita —
    # raise/fold com <10bb é punido forte).
    return Recommendation(
        primary="shove" if shove else "fold",
        forbidden=["raise", "limp", "call"],
        size="all-in" if shove else None,
        rule_ids=["OPENSHOVE.10BB"], range_ref=ref,
        common_mistake=r.get("common_mistake"),
        explain=r["explain_pt"],
        source_type="CANONICAL_RULE", confidence="high", range_status="exact",
    )


def _rfi(ctx: HandContext, kb: KnowledgeBase) -> Recommendation:
    rng = kb.rfi_range(ctx.eff_stack_bb, ctx.hero_pos)
    size = _size_from_table(kb.rule("RFI.SIZE")["size_table_bb"], ctx.eff_stack_bb)
    ref = kb.range_ref(ctx.eff_stack_bb, ctx.hero_pos, "RFI")
    if not rng:
        return Recommendation(insufficient=True, rule_ids=["RFI.RANGE"], range_ref=ref,
                              explain="Sem range de RFI cadastrado para este stack/posição.")
    if ctx.hero_cards is None:
        return _need_cards(ctx, ["RFI.RANGE", "RFI.SIZE"], "Abrir o range teórico da posição.")
    open_it = in_range(ctx.hero_cards, rng)
    return Recommendation(
        primary="raise" if open_it else "fold",
        forbidden=["limp"] if open_it else ["raise", "limp"],
        size=size if open_it else None,
        rule_ids=["RFI.RANGE", "RFI.SIZE"], range_ref=ref,
        explain=f"RFI {ctx.hero_pos}: abrir o range teórico; size {size}.",
    )


def _blind_war_sb(ctx: HandContext, kb: KnowledgeBase) -> Recommendation:
    r = kb.rule("SB.RAISE_ONLY")
    size = _size_from_table(r["size_table_bb"], ctx.eff_stack_bb)
    rng = kb.rfi_range(ctx.eff_stack_bb, "SB")
    # SB.RAISE_ONLY: todo range em raise (sem limp). Se há range, grada a mão; senão, regra-nível.
    if ctx.hero_cards and rng:
        open_it = in_range(ctx.hero_cards, rng)
        return Recommendation(
            primary="raise" if open_it else "fold",
            forbidden=["limp"], size=size if open_it else None,
            rule_ids=["SB.RAISE_ONLY"], explain=r["explain_pt"], common_mistake="dar limp do SB",
        )
    return Recommendation(primary="raise", forbidden=["limp"], size=size,
                          rule_ids=["SB.RAISE_ONLY"], explain=r["explain_pt"],
                          common_mistake="dar limp do SB")


def _vs_open(ctx: HandContext, kb: KnowledgeBase) -> Recommendation:
    villain = ctx.opener_pos
    vr = kb.vs_rfi(ctx.eff_stack_bb, ctx.hero_pos, villain) if villain else {}
    eff = ctx.eff_stack_bb
    rules = []
    forbidden: list[str] = []
    call_allowed = ctx.hero_pos in ("BTN", "BB") and eff >= 30
    if not call_allowed:
        forbidden.append("call")
        rules.append("VSRFI.3BET_ONLY" if ctx.hero_pos not in ("BTN", "BB") else "VSRFI.SHORT_NOCALL")
    if ctx.hero_cards is None:
        return _need_cards(ctx, rules or ["VSRFI.3BET_ONLY"], "Fora de BTN/BB: 3-bet ou fold.")
    in3 = in_range(ctx.hero_cards, vr.get("3bet"))
    insh = in_range(ctx.hero_cards, vr.get("shove"))
    incall = in_range(ctx.hero_cards, vr.get("call"))
    size = _size_from_table(kb.rule("THREEBET.SIZE")["size_table_bb"], eff,
                            key="ip" if ctx.is_ip_vs(villain) else "oop")
    if eff <= 17 and (in3 or insh):
        rules.append("THREEBET.SIZE")
        return Recommendation(primary="shove", forbidden=forbidden, size="all-in",
                              rule_ids=rules, explain="≤17bb: 3-bet vira all-in (shove).")
    if in3:
        rules.append("THREEBET.SIZE")
        return Recommendation(primary="3bet", forbidden=forbidden, size=size, rule_ids=rules,
                              common_mistake="dar call em vez de 3-bet",
                              explain=f"3-bet por valor ({size}).")
    if insh:
        return Recommendation(primary="shove", forbidden=forbidden, size="all-in", rule_ids=rules,
                              explain="Mão de shove vs open neste stack.")
    if incall and call_allowed:
        return Recommendation(primary="call", acceptable=["3bet"], rule_ids=["VSRFI.DEEP_LOWPAIR_CALL"],
                              explain="BTN/BB deep: call permitido com parte do range.")
    return Recommendation(primary="fold", forbidden=forbidden, rule_ids=rules or ["VSRFI.3BET_ONLY"],
                          explain="Fora do range de 3-bet/shove: fold.")


def _resteal_short(ctx: HandContext, kb: KnowledgeBase) -> Recommendation:
    r = kb.rule("RESTEAL.SHORT")
    if ctx.hero_cards is None:
        return _need_cards(ctx, ["RESTEAL.SHORT"], r["explain_pt"])
    do = is_resteal_hand(ctx.hero_cards)
    # RESTEAL.SHORT é regra direta do PDF (predicado), vale p/ qualquer stack ≤20bb.
    return Recommendation(
        primary="shove" if do else "fold",
        forbidden=["call"], size="all-in" if do else None,
        rule_ids=["RESTEAL.SHORT"], common_mistake=r.get("common_mistake"),
        explain=r["explain_pt"],
        source_type="CANONICAL_RULE", confidence="high", range_status="exact",
    )


def _bb_defense(ctx: HandContext, kb: KnowledgeBase) -> Recommendation:
    r = kb.rule("BB.NOFOLD_SUITED")
    villain = ctx.opener_pos
    vr = kb.vs_rfi(ctx.eff_stack_bb, "BB", villain) if villain else {}
    bubble = ctx.phase == "bubble"
    if ctx.hero_cards is None:
        return _need_cards(ctx, ["BB.NOFOLD_SUITED"], r["explain_pt"])
    in3 = in_range(ctx.hero_cards, vr.get("3bet"))
    incall = in_range(ctx.hero_cards, vr.get("call"))
    suited = is_suited(ctx.hero_cards)
    forbidden = []
    if suited and not bubble:
        forbidden = ["fold"]
    if in3:
        return Recommendation(primary="3bet", forbidden=forbidden, rule_ids=["BB.NOFOLD_SUITED"],
                              explain="BB: 3-bet por valor; não foldar naipadas.")
    if incall or (suited and not bubble):
        return Recommendation(primary="call", forbidden=forbidden, rule_ids=["BB.NOFOLD_SUITED"],
                              common_mistake=r.get("common_mistake"),
                              explain=r["explain_pt"])
    return Recommendation(primary="fold", rule_ids=["BB.NOFOLD_SUITED"],
                          explain="Offsuit fraca fora do range: fold (BB ainda assim defende naipadas).")


def _vs_limp(ctx: HandContext, kb: KnowledgeBase) -> Recommendation:
    r = kb.rule("LIMP.PUNISH")
    limper = ctx.opener_pos
    iso_range = kb.rfi_range(ctx.eff_stack_bb, limper) if limper else []
    size = _size_from_table(kb.rule("LIMP.SIZE")["size_table_bb"], ctx.eff_stack_bb)
    if ctx.hero_cards is None:
        return _need_cards(ctx, ["LIMP.PUNISH", "LIMP.SIZE"], r["explain_pt"])
    if not limper:
        # falta a posição do limpador → info essencial p/ saber qual range usar
        return Recommendation(insufficient=True, ask=["opener_position"], rule_ids=["LIMP.PUNISH"],
                              source_type="INSUFFICIENT", confidence="low", range_status="approximate",
                              explain="Para punir o limp preciso saber de qual posição veio o limp.")
    approx = not iso_range  # sem range de open p/ a posição do limpador → aproxima
    if approx:
        # fallback rule-based: punir mãos de open "padrão" (a regra do PDF é punir com o range
        # de open da posição; sem o JSON, usamos uma noção conservadora de mão jogável).
        from .context import is_resteal_hand
        punish = is_resteal_hand(ctx.hero_cards) or in_range(ctx.hero_cards, kb.rfi_range(ctx.eff_stack_bb, "CO"))
        return Recommendation(
            primary="raise" if punish else "fold",
            forbidden=["limp"] if ctx.hero_pos != "SB" else [],
            size=size if punish else None,
            rule_ids=["LIMP.PUNISH", "LIMP.SIZE"], common_mistake=r.get("common_mistake"),
            explain=f"Punir limp do {limper}: regra manda usar o range de open daquela posição. "
                    "Sem o range exato, aproximo pelo range de open padrão.",
            source_type="DERIVED_FROM_PDF", confidence="medium", range_status="approximate",
            used_proxy={"base_spot": f"range de open de {limper}", "adjustment": "proxy_open_range"},
            warning="Aproximação do range de punição. Range exato não cadastrado p/ esta posição.",
        )
    punish = in_range(ctx.hero_cards, iso_range)
    return Recommendation(
        primary="raise" if punish else "fold",
        forbidden=["limp"] if ctx.hero_pos != "SB" else [],
        size=size if punish else None,
        rule_ids=["LIMP.PUNISH", "LIMP.SIZE"], common_mistake=r.get("common_mistake"),
        explain=f"Punir limp do {limper} com o range de open daquela posição (raise {size}).",
        source_type="EXTRACTED_RANGE", confidence="high", range_status="exact",
    )


def _heads_up(ctx: HandContext, kb: KnowledgeBase) -> Recommendation:
    r = kb.rule("HU.BTN")
    if ctx.hero_pos in ("BTN", "SB"):
        # HU: ICM quase não existe; BTN não folda. Curto → push/fold fica mais relevante.
        if ctx.eff_stack_bb <= 10:
            primary, src, conf = "shove", "DERIVED_FROM_PDF", "medium"
            expl = "HU curto (≤10bb): push/fold fica mais relevante — shove em vez de raise/fold."
        else:
            primary, src, conf = "raise", "CANONICAL_RULE", "high"
            expl = r["explain_pt"]
        return Recommendation(primary=primary, forbidden=["fold"], rule_ids=["HU.BTN"],
                              common_mistake="foldar do BTN no HU", explain=expl,
                              source_type=src, confidence=conf,
                              range_status="exact" if src == "CANONICAL_RULE" else "approximate")
    return Recommendation(insufficient=True, ask=["hero_position"], rule_ids=["HU.BTN"],
                          source_type="INSUFFICIENT", confidence="low", explain=r["explain_pt"])


def _bubble_call(ctx: HandContext, kb: KnowledgeBase) -> Recommendation:
    # Sem range exato de call de shove → heurística de ICM (aproximação rotulada).
    if ctx.hero_cards is None:
        return _need_cards(ctx, ["BUBBLE.PLAN"], "Call na bolha depende muito da mão e do ICM.")
    d = bubble_call_decision(ctx)
    return Recommendation(
        primary=d["action"],
        forbidden=[],  # aproximação: não trava como proibido
        rule_ids=d["rule_ids"], explain=d["explain"],
        common_mistake="pagar shove loose na bolha (ICM)",
        source_type=d["source_type"], confidence=d["confidence"],
        range_status=d["range_status"], used_proxy=d["used_proxy"], warning=d["warning"],
    )


def _postflop(ctx: HandContext, kb: KnowledgeBase) -> Recommendation:
    d = postflop_decision(ctx)
    return Recommendation(
        primary=d["action"], size=d.get("size"),
        rule_ids=d["rule_ids"], explain=d["explain"],
        source_type=d["source_type"], confidence=d["confidence"],
        range_status=d["range_status"], used_proxy=d["used_proxy"], warning=d["warning"],
    )


_HANDLERS = {
    "push_fold": _push_fold,
    "rfi": _rfi,
    "blind_war_sb": _blind_war_sb,
    "vs_open": _vs_open,
    "resteal_short": _resteal_short,
    "bb_defense": _bb_defense,
    "vs_limp": _vs_limp,
    "heads_up": _heads_up,
    "bubble_call": _bubble_call,
    "postflop": _postflop,
}
