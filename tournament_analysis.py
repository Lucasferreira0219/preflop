"""Camada de integração Torneios ↔ PokerKnowledgeEngine.

Responsabilidade (fina, sem estratégia):
  - montar HandContext a partir da mão parseada
  - decidir se a mão é CRÍTICA (filtro)
  - chamar pke.engine().evaluate_decision()
  - classificar o desfecho (erro / cooler / bad_beat / decisão boa / insuficiente)
  - gerar logs de debug por mão
  - agregar o relatório do torneio (médias, piores/melhores, leaks, fase, treino)

A decisão estratégica (ação recomendada, nota, regra) é 100% do PKE.
"""
from __future__ import annotations

import os

from pke import HandContext, engine
from pke.decision import enrich

DEBUG = bool(os.environ.get("PKE_DEBUG"))

# leak -> categoria de treino do Simulador (sugestão de exercício)
_LEAK_TO_DRILL = {
    "nao_shova_short": "push_fold",
    "call_em_vez_de_3bet": "vs_open_3bet",
    "passivo_resteal": "resteal_short",
    "nao_pune_limp": "vs_limp",
    "abre_fraco_ep": "rfi",
    "folda_btn_em_range": "rfi",
    "passivo_hu": "heads_up",
}


# ── contexto ────────────────────────────────────────────────────────────────────

def _preflop_action(h: dict) -> str:
    sc = h.get("scenario")
    if sc == "RFI":
        return "first_in"
    if sc in ("vs_RFI", "vs_3bet"):
        return "vs_shove" if h.get("faced_allin") else "vs_raise"
    if h.get("n_limpers") and h.get("villain_action") == "limp":
        return "vs_limp"
    return "first_in"


def build_context(h: dict) -> HandContext:
    eff = h.get("stack_bb")
    return HandContext(
        table_max=h.get("n_players") or 9,
        players_left=h.get("n_players") or 9,
        paid_places=3,                      # SNG 9-max single (config futura por torneio)
        ante=False,
        bb_chips=h.get("bb") or 100,
        eff_stack_bb=float(eff) if eff is not None else 100.0,
        hero_pos=h.get("hero_pos") or "BTN",
        hero_cards=h.get("hero_cards"),
        villains=[{"pos": h.get("opener_pos"), "action": h.get("villain_action")}]
                 if h.get("opener_pos") else [],
        preflop_action=_preflop_action(h),
        opener_pos=h.get("opener_pos"),
        n_limpers=h.get("n_limpers") or 0,
    )


def map_hero_action(h: dict) -> str | None:
    """Traduz a ação do parser pro vocabulário do PKE conforme o spot."""
    act = h.get("hero_action")
    if act in ("fold", "call"):
        return act
    if act == "raise":
        if h.get("hero_all_in"):
            return "shove"
        return "3bet" if h.get("scenario") in ("vs_RFI", "vs_3bet") else "raise"
    return act


# ── filtro de mão crítica ─────────────────────────────────────────────────────────

def critical_reasons(h: dict, ctx: HandContext) -> list[str]:
    r = []
    if h.get("hero_voluntary"):
        r.append("fichas_voluntarias")
    if h.get("faced_allin"):
        r.append("enfrentou_allin")
        if h.get("hero_action") == "call":
            r.append("call_de_allin")
    if h.get("hero_all_in"):
        r.append("hero_shove")
    sb = h.get("stack_bb")
    if sb is not None and sb < 15:
        r.append("menos_de_15bb")
    if ctx.spot == "push_fold":
        r.append("push_fold")
    if ctx.spot == "resteal_short":
        r.append("resteal")
    if ctx.spot == "vs_limp":
        r.append("limp_punish")
    if ctx.phase == "bubble":
        r.append("bolha")
    if h.get("scenario") in ("vs_RFI", "vs_3bet") and h.get("hero_action") in ("raise", "call"):
        r.append("3bet_ou_call_vs_raise")
    # pote grande / impacto no stack
    pot, stack = h.get("pot_total"), h.get("stack_chips")
    if pot and stack and pot >= stack:
        if h.get("hero_won") is True:
            r.append("ganhou_pote_grande")
        elif h.get("hero_won") is False:
            r.append("perdeu_pote_grande")
        else:
            r.append("impacto_grande_no_stack")
    return r


# ── desfecho ──────────────────────────────────────────────────────────────────────

def classify_outcome(h: dict, decision: dict) -> str:
    if decision.get("insuficiente") or decision.get("nota") is None:
        return "insuficiente"
    score = decision["nota"]
    all_in_pot = h.get("faced_allin") or h.get("hero_all_in")
    if score >= 6:
        if all_in_pot and h.get("went_to_showdown") and h.get("hero_won") is False:
            # decisão boa + perdeu all-in no showdown = cooler (bad_beat reservado p/ equity)
            return "cooler"
        return "decisao_boa"
    return "erro"


# ── análise de uma mão ─────────────────────────────────────────────────────────────

def screen_and_analyze(h: dict) -> dict:
    """Filtro-primeiro: só roda o PKE se a mão for crítica (requisito do produto)."""
    ctx = build_context(h)
    enrich(ctx)
    reasons = critical_reasons(h, ctx)
    if not reasons:
        return {"hand_id": h.get("hand_id"), "is_critical": False,
                "critical_reasons": [], "outcome": None, "decision": None, "debug": None}
    return analyze_hand(h)


def analyze_hand(h: dict) -> dict:
    ctx = build_context(h)
    eng = engine()
    hero_action = map_hero_action(h)
    decision = eng.evaluate_decision(ctx, hero_action or "fold")

    reasons = critical_reasons(h, ctx)
    is_crit = bool(reasons)
    outcome = classify_outcome(h, decision)

    debug = {
        "spot": ctx.spot,
        "fase": ctx.phase,
        "eff_stack_bb": ctx.eff_stack_bb,
        "hero_action_pke": hero_action,
        "regra_aplicada": decision.get("regra_pdf"),
        "range_usado": decision.get("range_ref"),
        "motivo_nota": decision.get("motivo"),
        "insuficiente_porque": (decision.get("falta_info") or decision.get("motivo"))
                               if decision.get("insuficiente") else None,
    }
    if DEBUG:
        print(f"[PKE] hand={h.get('hand_id')} spot={ctx.spot} fase={ctx.phase} "
              f"eff={ctx.eff_stack_bb}bb pos={ctx.hero_pos} cards={h.get('hero_cards')} "
              f"hero={hero_action} -> rec={decision.get('acao_recomendada')} "
              f"nota={decision.get('nota')} regra={decision.get('regra_pdf')} "
              f"outcome={outcome} crit={is_crit}{' INSUF:'+str(debug['insuficiente_porque']) if decision.get('insuficiente') else ''}")

    # dados da mão (hand history) para o card expandido da review
    hh_fields = (
        "blinds", "ante", "n_players", "played_at",
        "hero_stack_chips", "hero_stack_bb", "effective_stack_bb",
        "villain_stack_chips", "villain_stack_bb",
        "opener_pos", "opener_action", "opener_size_chips", "opener_size_bb",
        "villain_position", "villain_action", "n_limpers",
        "hero_action", "hero_action_size_chips", "hero_action_size_bb",
        "faced_allin", "allin_amount_chips", "allin_amount_bb",
        "preflop_action_summary", "street", "board",
        "went_to_showdown", "hero_won", "pot_total", "hero_net_chips",
        "hero_busted", "villain_cards", "hero_cards",
    )
    hh = {k: h.get(k) for k in hh_fields}

    return {
        "hand_id": h.get("hand_id"),
        "is_critical": is_crit,
        "critical_reasons": reasons,
        "outcome": outcome,
        "decision": decision,
        "debug": debug,
        "hh": hh,
    }


# ── leaks (sobre as decisões avaliadas do torneio) ─────────────────────────────────

def detect_leaks(analyzed: list[dict]) -> list[dict]:
    """analyzed = lista de dicts {h, result(analyze_hand)} já com decision."""
    sig: dict[str, dict] = {}

    def bump(leak_id, label, a, fix):
        d = a["decision"]
        s = sig.setdefault(leak_id, {"id": leak_id, "label": label, "hits": 0,
                                     "soma_perda": 0, "fases": {}, "exemplo": None, "fix": fix,
                                     "regra": None})
        s["hits"] += 1
        s["soma_perda"] += (10 - (d.get("nota") or 0))
        s["fases"][d.get("fase")] = s["fases"].get(d.get("fase"), 0) + 1
        if s["exemplo"] is None:
            s["exemplo"] = f"{d.get('hero_pos')} {d.get('hero_cards')} ({d.get('fase')}): " \
                           f"{d.get('linha_hero')} em vez de {d.get('acao_recomendada')}"
            s["regra"] = (d.get("regra_pdf") or [None])[0]

    for a in analyzed:
        d = a["decision"]
        spot, err, score = d.get("spot"), d.get("tipo_erro"), d.get("nota")
        if score is None:
            continue
        # spot vem no debug (decision não carrega spot); usa debug
        spot = a["debug"]["spot"]
        if spot == "push_fold" and err == "raise_em_vez_de_pushfold":
            bump("nao_shova_short", "Não shova short stack", a, "≤10bb = all-in ou fold. Decore o grid de shove da posição.")
        elif spot in ("vs_open",) and err and "call_em_vez" in err:
            bump("call_em_vez_de_3bet", "Dá call em vez de 3-bet", a, "Fora de BTN/BB: 3-bet ou fold.")
        elif spot == "resteal_short" and d.get("linha_hero") in ("call", "fold") and score < 6:
            bump("passivo_resteal", "Passivo no resteal short", a, "≤20bb vs CO/BTN: resteal-shove pares/broadways naipadas/ases naipados.")
        elif spot == "vs_limp" and d.get("linha_hero") in ("fold", "call") and score < 6:
            bump("nao_pune_limp", "Não pune limp", a, "Punir limp com raise usando o range da posição do limpador.")
        elif spot == "rfi" and d.get("acao_recomendada") == "fold" and score < 6:
            bump("abre_fraco_ep", "Abre mãos fora do range", a, "Respeitar o range de RFI da posição.")

    out = []
    for s in sig.values():
        out.append({
            "id": s["id"], "label": s["label"], "frequencia_hits": s["hits"],
            "gravidade": "alta" if s["soma_perda"] / max(s["hits"], 1) >= 5 else "media",
            "perda_media_nota": round(s["soma_perda"] / max(s["hits"], 1), 1),
            "fase_predominante": max(s["fases"], key=s["fases"].get) if s["fases"] else None,
            "exemplo": s["exemplo"], "regra_violada": s["regra"],
            "como_corrigir": s["fix"], "exercicio": _LEAK_TO_DRILL.get(s["id"]),
        })
    return sorted(out, key=lambda x: x["frequencia_hits"], reverse=True)


# ── relatório do torneio ────────────────────────────────────────────────────────────

# ── classificação de decisão (severidade) e impacto (peso) por mão ───────────────
_SHOWN_LABEL = {
    "correct": "Acerto", "minor_error": "Erro leve", "medium_error": "Erro médio",
    "major_error": "Erro grave", "cooler": "Cooler", "insufficient": "Insuficiente",
}
_SHOWN_IMPACT = {"low": "Impacto baixo", "medium": "Impacto médio",
                 "high": "Impacto alto", "critical": "Impacto crítico"}

# faixa de qualidade da linha (tolerância estratégica) → rótulo PT da UI
_SHOWN_QUALITY = {
    "best": "Melhor linha", "standard_good": "Boa linha padrão",
    "acceptable_good": "Linha aceitável", "acceptable_but_inferior": "Linha aceitável, mas inferior",
    "close": "Spot close", "minor_error": "Erro leve", "medium_error": "Erro médio",
    "major_error": "Erro grave", "severe_error": "Erro crítico",
    "cooler": "Cooler", "insufficient": "Insuficiente",
}


def _decision_label(outcome: str, score) -> str:
    if outcome == "insuficiente":
        return "insufficient"
    if outcome == "cooler":
        return "cooler"
    if score is None:
        return "insufficient"
    if score >= 8:
        return "correct"
    if score >= 6:
        return "minor_error"
    if score >= 4:
        return "medium_error"
    return "major_error"


def _impact(spot, fase, eff, line, rec, label, hh) -> tuple[float, str]:
    """impact_weight (0.25–5.0) + impact_label (low/medium/high/critical).

    Folds óbvios pesam pouco; push/fold, resteal, all-in, bolha, pote grande pesam
    muito; raise/fold <10bb, punts, bustout e erros graves de ICM são críticos.
    """
    eff = eff or 0
    allin = bool(hh.get("faced_allin")) or line == "shove" or rec == "shove" or bool(hh.get("hero_busted"))
    busted = bool(hh.get("hero_busted"))
    pot, hs = hh.get("pot_total"), hh.get("hero_stack_chips")
    big_pot = bool(pot and hs and pot >= hs)

    if line == "fold" and rec == "fold" and not allin and not busted:
        w = 0.4                                   # fold óbvio / trivial
    elif spot in ("rfi", "vs_limp", "bb_defense", "blind_war_sb"):
        w = 1.0                                   # decisão pré-flop normal
    elif (spot in ("push_fold", "resteal_short", "bubble_call")
          or (spot == "vs_open" and eff <= 20) or allin or fase == "bubble" or big_pot):
        w = 2.0                                   # alto risco / muda o stack
    else:
        w = 1.0

    raise_fold_sub10 = spot == "push_fold" and eff < 10 and line == "raise"
    critical = busted or raise_fold_sub10 or (
        label == "major_error" and (fase == "bubble" or spot == "bubble_call"
                                    or allin or spot in ("push_fold", "resteal_short")))
    if critical:
        w = max(w, 4.0)

    il = "low" if w <= 0.5 else "medium" if w <= 1.5 else "high" if w <= 2.5 else "critical"
    return round(w, 2), il


def _hand_view(a: dict) -> dict:
    """Visão completa de uma mão crítica para a UI (só exibição)."""
    d = a["decision"]
    dbg = a.get("debug") or {}
    hh = a.get("hh") or {}
    _outcome = a["outcome"]
    _score = d.get("nota")
    _dlabel = _decision_label(_outcome, _score)
    _w, _ilabel = _impact(dbg.get("spot"), d.get("fase"), d.get("eff_stack_bb"),
                          d.get("linha_hero"), d.get("acao_recomendada"), _dlabel, hh)
    # faixa de qualidade da linha (tolerância): cooler/insuficiente têm prioridade
    if _outcome == "cooler":
        _quality = "cooler"
    elif _outcome == "insuficiente" or d.get("insuficiente"):
        _quality = "insufficient"
    else:
        _quality = d.get("qualidade_linha") or _dlabel
    return {
        "decision_label": _dlabel,
        "impact_label": _ilabel,
        "impact_weight": _w,
        "internal_score": _score,        # debug/cálculo — NÃO exibir como nota na UI da mão
        "shown_label": _SHOWN_LABEL.get(_dlabel, _dlabel),
        "shown_impact": _SHOWN_IMPACT.get(_ilabel, _ilabel),
        # ── tolerância estratégica: faixa da linha + linhas alternativas ──────
        "hero_action_quality": _quality,
        "shown_quality": _SHOWN_QUALITY.get(_quality, _SHOWN_LABEL.get(_dlabel, _dlabel)),
        "quality_note": d.get("nota_pedagogica"),
        "acoes_aceitaveis": d.get("acoes_aceitaveis") or [],
        "alternativas_avancadas": d.get("alternativas_avancadas") or [],
        "acoes_ruins": d.get("acoes_ruins") or [],
        "erros_graves_acoes": d.get("erros_graves_acoes") or [],
        "hand_id": a.get("hand_id"),
        "fase": d.get("fase"),
        "spot": dbg.get("spot"),
        "cards": d.get("hero_cards"),
        "pos": d.get("hero_pos"),
        "eff_bb": d.get("eff_stack_bb"),
        "linha": d.get("linha_hero"),
        "recomendado": d.get("acao_recomendada"),
        "size_recomendado": d.get("size_recomendado"),
        "nota": d.get("nota"),
        "outcome": a["outcome"],
        "gravidade": d.get("gravidade"),
        "erro": d.get("tipo_erro"),
        "regra": d.get("regra_pdf") or [],
        "explicacao": d.get("explicacao_iniciante") or d.get("motivo"),
        "resumo": d.get("resumo"),
        "ajuste_exploratorio": d.get("ajuste_exploratorio"),
        "motivos_criticos": a.get("critical_reasons") or [],
        "insuficiente": d.get("insuficiente", False),
        "falta_info": d.get("falta_info") or [],
        # proveniência da síntese de range
        "source_type": d.get("source_type"),
        "confidence": d.get("confidence"),
        "range_status": d.get("range_status"),
        "warning": d.get("warning"),
        # dados da mão (hand history) para o card expandido
        "hh": hh,
    }


def aggregate_score(maos: list[dict]) -> dict:
    """Nota PKE ponderada por impacto + caps por erro grave.

    - insuficiente NÃO entra; cooler NÃO penaliza (excluído da média).
    - média ponderada por impact_weight (folds fáceis pesam pouco).
    - caps: erros graves limitam o teto da nota (punt não fica com nota alta).
    Devolve {pke_score, media_simples, grave_errors, critical_punts, explanation}.
    """
    contrib = []          # (internal_score, weight)
    grave = 0
    critical_punts = 0
    simples = []
    for m in maos:
        lbl = m["decision_label"]
        if lbl in ("insufficient", "cooler"):
            continue
        s = m["internal_score"]
        if s is None:
            continue
        contrib.append((s, m["impact_weight"]))
        simples.append(s)
        if lbl == "major_error":
            grave += 1
            if m["impact_label"] == "critical":
                critical_punts += 1

    if not contrib:
        return {"pke_score": None, "media_simples": None, "grave_errors": 0,
                "critical_punts": 0, "explanation": "Sem decisões avaliáveis (só folds triviais/insuficientes/coolers)."}

    wsum = sum(w for _, w in contrib)
    weighted = sum(s * w for s, w in contrib) / wsum
    media_simples = round(sum(simples) / len(simples), 2)

    cap = 10.0
    if grave >= 1:
        cap = 8.5
    if grave >= 2:
        cap = 7.5
    if grave >= 3:
        cap = 6.5
    if critical_punts >= 1:
        cap = min(cap, 6.0)
    if critical_punts >= 2:
        cap = min(cap, 5.0)
    pke = round(min(weighted, cap), 1)

    # explicação curta
    if grave == 0 and pke >= 7:
        expl = "Nota boa: poucos erros graves e boas decisões nos spots de maior impacto. Folds fáceis tiveram peso baixo."
    elif grave >= 1:
        extra = " (incluindo erro crítico de ICM/all-in)" if critical_punts else ""
        expl = (f"Nota impactada por {grave} erro(s) grave(s){extra} em spots de alto impacto. "
                "Folds fáceis tiveram peso baixo; erros em push/fold, resteal e bolha pesaram mais.")
    else:
        expl = "Decisões majoritariamente corretas; mãos triviais tiveram peso baixo."
    return {"pke_score": pke, "media_simples": media_simples, "grave_errors": grave,
            "critical_punts": critical_punts, "explanation": expl}


def build_report(tournament_id: str, analyzed: list[dict]) -> dict:
    maos = [_hand_view(a) for a in analyzed]
    scored = [m for m in maos if m["nota"] is not None]

    agg = aggregate_score(maos)

    # ordena pior→melhor; insuficientes não entram em "scored"
    piores = sorted(scored, key=lambda m: m["nota"])[:5]
    melhores = [m for m in sorted(scored, key=lambda m: -m["nota"]) if m["nota"] >= 8][:5]
    erros_graves = agg["grave_errors"]

    # fase com mais erros (nota < 6) — insuficiente NÃO conta como erro
    erros_por_fase: dict[str, int] = {}
    tipos_erro: dict[str, int] = {}
    for m in scored:
        if m["nota"] < 6:
            erros_por_fase[m["fase"]] = erros_por_fase.get(m["fase"], 0) + 1
            if m["erro"]:
                tipos_erro[m["erro"]] = tipos_erro.get(m["erro"], 0) + 1
    fase_pior = max(erros_por_fase, key=erros_por_fase.get) if erros_por_fase else None
    tipos_erro_top = sorted(
        [{"tipo": k, "n": v} for k, v in tipos_erro.items()], key=lambda x: -x["n"])

    leaks = detect_leaks(analyzed)   # cooler/insuficiente não viram leak (só nota<6)
    treino = sorted({l["exercicio"] for l in leaks if l["exercicio"]})
    main_leak = leaks[0]["exercicio"] if leaks else None

    return {
        "tournament_id": tournament_id,
        "maos_no_torneio": None,            # preenchido pelo hands_engine
        "maos_criticas": len(maos),
        "maos_com_nota": len(scored),
        # NOTA PRINCIPAL (única, visível): ponderada por impacto + caps
        "pke_score": agg["pke_score"],
        "pke_score_explanation": agg["explanation"],
        "pke_grave_errors": erros_graves,
        "pke_main_leak": main_leak,
        "pke_critical_hands": len(maos),
        # interno/debug (não exibir como nota principal)
        "media_notas": agg["media_simples"],
        "erros_graves": erros_graves,
        "fase_com_mais_erros": fase_pior,
        "erros_por_fase": erros_por_fase,
        "tipos_erro_top": tipos_erro_top,
        "contagem_outcome": _count([m["outcome"] for m in maos]),
        "maos": maos,
        "piores_decisoes": piores,
        "melhores_decisoes": melhores,
        "leaks": leaks,
        "treino_sugerido": treino,
    }


def _count(items):
    out: dict[str, int] = {}
    for i in items:
        out[i] = out.get(i, 0) + 1
    return out
