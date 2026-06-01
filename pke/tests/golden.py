"""Golden set — spots representativos do Guia de Bolso. Roda como script:
    python -m pke.tests.golden
Falha (exit 1) se alguma expectativa quebrar.
"""
from __future__ import annotations

import sys

from pke import HandContext, engine


def case(desc, ctx, hero_action, expect_rec=None, expect_score=None, expect_rule=None,
         expect_insufficient=False, expect_source=None, expect_status=None,
         expect_quality=None, expect_rec_in=None):
    eng = engine()
    dec = eng.evaluate_decision(ctx, hero_action)
    ok = True
    if expect_insufficient:
        ok = ok and dec["insuficiente"] is True
    else:
        if expect_rec is not None:
            ok = ok and dec["acao_recomendada"] == expect_rec
        if expect_rec_in is not None:
            ok = ok and dec["acao_recomendada"] in expect_rec_in
        if expect_score is not None:
            lo, hi = expect_score
            ok = ok and (dec["nota"] is not None and lo <= dec["nota"] <= hi)
        if expect_rule is not None:
            ok = ok and any(expect_rule in r for r in dec["regra_pdf"])
        if expect_source is not None:
            ok = ok and dec.get("source_type") == expect_source
        if expect_status is not None:
            ok = ok and dec.get("range_status") == expect_status
        if expect_quality is not None:
            ok = ok and dec.get("qualidade_linha") in expect_quality
    status = "OK " if ok else "FAIL"
    print(f"[{status}] {desc}")
    print(f"        spot={ctx.spot} fase={dec['fase']} rec={dec['acao_recomendada']} "
          f"nota={dec['nota']} qual={dec.get('qualidade_linha')} "
          f"src={dec.get('source_type')}/{dec.get('range_status')} regra={dec['regra_pdf']}")
    if not ok:
        print(f"        ESPERADO rec={expect_rec} score={expect_score} rule={expect_rule} "
              f"quality={expect_quality} src={expect_source} status={expect_status} insuf={expect_insufficient}")
    return ok


def main() -> int:
    results = []

    # 1) Push/fold 9bb BTN com A8o — está no shove range → shove é 10; raise é leak (cap 4)
    results.append(case(
        "Push/fold 9bb BTN A8o → shove correto",
        HandContext(eff_stack_bb=9, hero_pos="BTN", hero_cards="A8o",
                    preflop_action="first_in", players_left=6),
        hero_action="shove", expect_rec="shove", expect_score=(9, 10), expect_rule="OPENSHOVE.10BB"))

    results.append(case(
        "Push/fold 9bb BTN A8o → deu raise/fold (leak, nota baixa)",
        HandContext(eff_stack_bb=9, hero_pos="BTN", hero_cards="A8o",
                    preflop_action="first_in", players_left=6),
        hero_action="raise", expect_rec="shove", expect_score=(0, 4), expect_rule="OPENSHOVE.10BB"))

    # 2) Resteal 15bb SB vs CO open, A7s → shove (resteal); call é cap 3
    results.append(case(
        "Resteal 15bb SB vs CO A7s → shove correto",
        HandContext(eff_stack_bb=15, hero_pos="SB", hero_cards="A7s",
                    preflop_action="vs_raise", opener_pos="CO", players_left=6),
        hero_action="shove", expect_rec="shove", expect_score=(9, 10), expect_rule="RESTEAL.SHORT"))

    results.append(case(
        "Resteal 15bb SB vs CO A7s → deu call (sem fold equity)",
        HandContext(eff_stack_bb=15, hero_pos="SB", hero_cards="A7s",
                    preflop_action="vs_raise", opener_pos="CO", players_left=6),
        hero_action="call", expect_rec="shove", expect_score=(0, 3), expect_rule="RESTEAL.SHORT"))

    # 3) RFI 30bb BTN AA → raise correto; fold é erro claro
    results.append(case(
        "RFI 30bb BTN AA → raise correto",
        HandContext(eff_stack_bb=30, hero_pos="BTN", hero_cards="AA",
                    preflop_action="first_in", players_left=8),
        hero_action="raise", expect_rec="raise", expect_score=(8, 10), expect_rule="RFI.RANGE"))

    # 4) vs open 30bb MP (não BTN/BB) com QQ → 3bet; call é proibido (VSRFI.3BET_ONLY)
    results.append(case(
        "vs open 30bb HJ QQ → 3bet; call proibido",
        HandContext(eff_stack_bb=30, hero_pos="HJ", hero_cards="QQ",
                    preflop_action="vs_raise", opener_pos="MP", players_left=8),
        hero_action="call", expect_rec="3bet", expect_score=(0, 5), expect_rule="VSRFI.3BET_ONLY"))

    # 5) Heads-up BTN 20bb → nunca foldar
    results.append(case(
        "HU BTN 20bb 72o → não foldar (regra HU.BTN)",
        HandContext(eff_stack_bb=20, hero_pos="BTN", hero_cards="72o",
                    preflop_action="first_in", players_left=2),
        hero_action="fold", expect_rec="raise", expect_rule="HU.BTN"))

    # 6) Bolha: call de shove → APROXIMAÇÃO por ICM (não recusa mais). A9o = fold.
    results.append(case(
        "Bolha call de shove A9o → ICM heuristic = fold (DERIVED, não insuficiente)",
        HandContext(eff_stack_bb=12, hero_pos="BB", hero_cards="A9o",
                    preflop_action="vs_shove", opener_pos="BTN", players_left=4, paid_places=3),
        hero_action="call", expect_rec="fold", expect_score=(0, 5),
        expect_source="DERIVED_FROM_PDF", expect_status="approximate"))

    # 7) Sem mão informada → pede a mão
    results.append(case(
        "Push/fold sem hero_cards → falta info",
        HandContext(eff_stack_bb=9, hero_pos="CO", preflop_action="first_in", players_left=6),
        hero_action="shove", expect_insufficient=True))

    # ── push/fold por posição ───────────────────────────────────────────────────
    results.append(case(
        "Push/fold UTG 8bb AA → shove",
        HandContext(eff_stack_bb=8, hero_pos="UTG", hero_cards="AA", preflop_action="first_in", players_left=8),
        "shove", expect_rec="shove", expect_score=(9, 10), expect_rule="OPENSHOVE.10BB"))
    results.append(case(
        "Push/fold UTG 8bb 72o → fold (fora do shove de EP)",
        HandContext(eff_stack_bb=8, hero_pos="UTG", hero_cards="72o", preflop_action="first_in", players_left=8),
        "fold", expect_rec="fold", expect_score=(8, 10), expect_rule="OPENSHOVE.10BB"))
    results.append(case(
        "Push/fold BTN 8bb 22 → shove (range mais largo no BTN)",
        HandContext(eff_stack_bb=8, hero_pos="BTN", hero_cards="22", preflop_action="first_in", players_left=6),
        "shove", expect_rec="shove", expect_score=(9, 10), expect_rule="OPENSHOVE.10BB"))

    # ── resteal contra CO/BTN ─────────────────────────────────────────────────────
    results.append(case(
        "Resteal SB 16bb vs CO A5s → shove (ás naipado)",
        HandContext(eff_stack_bb=16, hero_pos="SB", hero_cards="A5s", preflop_action="vs_raise", opener_pos="CO", players_left=6),
        "shove", expect_rec="shove", expect_score=(9, 10), expect_rule="RESTEAL.SHORT"))
    results.append(case(
        "Resteal BB 18bb vs BTN KK → shove (par)",
        HandContext(eff_stack_bb=18, hero_pos="BB", hero_cards="KK", preflop_action="vs_raise", opener_pos="BTN", players_left=6),
        "shove", expect_rec="shove", expect_score=(9, 10), expect_rule="RESTEAL.SHORT"))
    results.append(case(
        "Resteal SB 16bb vs CO 72o → fold (não é mão de resteal)",
        HandContext(eff_stack_bb=16, hero_pos="SB", hero_cards="72o", preflop_action="vs_raise", opener_pos="CO", players_left=6),
        "fold", expect_rec="fold", expect_rule="RESTEAL.SHORT"))

    # ── call errado vs open raise ────────────────────────────────────────────────
    results.append(case(
        "vs open CO 30bb vs UTG AA → 3bet; call é erro",
        HandContext(eff_stack_bb=30, hero_pos="CO", hero_cards="AA", preflop_action="vs_raise", opener_pos="UTG", players_left=8),
        "call", expect_rec="3bet", expect_score=(0, 5), expect_rule="VSRFI.3BET_ONLY"))

    # ── limp punish ──────────────────────────────────────────────────────────────
    results.append(case(
        "Limp punish: BTN vs limp MP AJs → raise",
        HandContext(eff_stack_bb=30, hero_pos="BTN", hero_cards="AJs", preflop_action="vs_limp", opener_pos="MP", players_left=8),
        "raise", expect_rec="raise", expect_score=(8, 10), expect_rule="LIMP.PUNISH"))
    results.append(case(
        "Limp punish: BTN vs limp MP 72o → fold",
        HandContext(eff_stack_bb=30, hero_pos="BTN", hero_cards="72o", preflop_action="vs_limp", opener_pos="MP", players_left=8),
        "fold", expect_rec="fold", expect_rule="LIMP.PUNISH"))

    # ── defesa de BB ──────────────────────────────────────────────────────────────
    results.append(case(
        "BB defense 30bb vs CO 76s → não foldar (call); fold é erro",
        HandContext(eff_stack_bb=30, hero_pos="BB", hero_cards="76s", preflop_action="vs_raise", opener_pos="CO", players_left=6),
        "fold", expect_rec="call", expect_score=(0, 5), expect_rule="BB.NOFOLD_SUITED"))
    results.append(case(
        "BB defense 30bb vs CO AA → 3bet",
        HandContext(eff_stack_bb=30, hero_pos="BB", hero_cards="AA", preflop_action="vs_raise", opener_pos="CO", players_left=6),
        "3bet", expect_rec="3bet", expect_score=(8, 10), expect_rule="BB.NOFOLD_SUITED"))

    # ── pós-flop → guideline aproximada (não recusa mais) ────────────────────────
    results.append(case(
        "Pós-flop IP (street=flop) → guideline c-bet (DERIVED, não insuficiente)",
        HandContext(eff_stack_bb=30, hero_pos="BTN", hero_cards="AhKh", street="flop", players_left=6),
        "bet", expect_rec="bet", expect_source="DERIVED_FROM_PDF"))

    # ── raise/fold com <10bb punido forte ────────────────────────────────────────
    results.append(case(
        "BTN 9bb AA dá raise (não all-in) → punido forte",
        HandContext(eff_stack_bb=9, hero_pos="BTN", hero_cards="AA", preflop_action="first_in", players_left=6),
        "raise", expect_rec="shove", expect_score=(0, 4), expect_rule="OPENSHOVE.10BB"))

    # ── TOLERÂNCIA ESTRATÉGICA: premium short-stack não é punido por shovar ───────
    print("\n— Tolerância estratégica (linhas alternativas) —")
    _GOOD = {"best", "standard_good", "acceptable_good"}

    # Teste 1 — QQ 10bb SB vs open: shove é boa linha; fold grave; raise/fold crítico
    qq = lambda: HandContext(eff_stack_bb=10, hero_pos="SB", hero_cards="QQ",
                             preflop_action="vs_raise", opener_pos="MP", players_left=6)
    results.append(case("T1 QQ 10bb SB vs open → SHOVE não é erro (boa linha)",
        qq(), "shove", expect_rec="shove", expect_score=(8, 10), expect_quality=_GOOD))
    results.append(case("T1 QQ 10bb SB vs open → CALL é alternativa avançada (aceitável)",
        qq(), "call", expect_score=(8, 10), expect_quality={"acceptable_good", "standard_good"}))
    results.append(case("T1 QQ 10bb SB vs open → FOLD é erro grave",
        qq(), "fold", expect_score=(0, 4), expect_quality={"major_error", "severe_error"}))
    results.append(case("T1 QQ 10bb SB vs open → RAISE/FOLD é erro crítico",
        qq(), "raise", expect_score=(0, 4), expect_quality={"severe_error"}))

    # Teste 2 — AKs 12bb BB vs BTN open shove → aceitável/bom, não punir
    results.append(case("T2 AKs 12bb BB vs BTN open → shove bom",
        HandContext(eff_stack_bb=12, hero_pos="BB", hero_cards="AKs",
                    preflop_action="vs_raise", opener_pos="BTN", players_left=6),
        "shove", expect_rec="shove", expect_score=(8, 10), expect_quality=_GOOD))

    # Teste 3 — AA/KK 14bb vs open call → trap aceitável/avançada; não é erro grave
    results.append(case("T3 AA 14bb SB vs open → CALL aceitável (trap), não erro grave",
        HandContext(eff_stack_bb=14, hero_pos="SB", hero_cards="AA",
                    preflop_action="vs_raise", opener_pos="MP", players_left=6),
        "call", expect_score=(8, 10), expect_quality={"acceptable_good", "standard_good"}))
    results.append(case("T3 KK 14bb BB vs CO → SHOVE também aceitável",
        HandContext(eff_stack_bb=14, hero_pos="BB", hero_cards="KK",
                    preflop_action="vs_raise", opener_pos="CO", players_left=6),
        "shove", expect_score=(8, 10), expect_quality=_GOOD))

    # Teste 4 — JJ 15bb SB vs CO open shove → resteal bom, não punir
    results.append(case("T4 JJ 15bb SB vs CO open → shove (resteal) bom",
        HandContext(eff_stack_bb=15, hero_pos="SB", hero_cards="JJ",
                    preflop_action="vs_raise", opener_pos="CO", players_left=6),
        "shove", expect_rec="shove", expect_score=(8, 10), expect_quality=_GOOD, expect_rule="RESTEAL.SHORT"))

    # Teste 5 — erro continua erro: A8o 9bb BTN raise/fold → crítico
    results.append(case("T5 A8o 9bb BTN raise/fold → erro crítico (tolerância não se aplica)",
        HandContext(eff_stack_bb=9, hero_pos="BTN", hero_cards="A8o", preflop_action="first_in", players_left=6),
        "raise", expect_rec="shove", expect_score=(0, 4), expect_quality={"severe_error"}))

    # Teste 6 — call especulativo short: 76s 12bb BTN vs CO open → erro (não aceitável)
    results.append(case("T6 76s 12bb BTN vs CO open → CALL especulativo é erro (não aceitável)",
        HandContext(eff_stack_bb=12, hero_pos="BTN", hero_cards="76s",
                    preflop_action="vs_raise", opener_pos="CO", players_left=6),
        "call", expect_score=(0, 5), expect_quality={"medium_error", "major_error"}))

    # Teste 7 — bolha call loose: aproximação ICM; loose → erro; close → marginal
    results.append(case("T7 Bolha call loose Q5o → aproximação ICM = erro (não punição extrema)",
        HandContext(eff_stack_bb=12, hero_pos="BB", hero_cards="Q5o",
                    preflop_action="vs_shove", opener_pos="BTN", players_left=4, paid_places=3),
        "call", expect_rec="fold", expect_score=(0, 5), expect_source="DERIVED_FROM_PDF",
        expect_quality={"major_error", "medium_error", "close"}))

    # Teste 8 — HU botão 72o fold → erro (regra HU forte; tolerância não se aplica)
    results.append(case("T8 BTN HU 72o fold → erro (regra HU.BTN forte)",
        HandContext(eff_stack_bb=20, hero_pos="BTN", hero_cards="72o", preflop_action="first_in", players_left=2),
        "fold", expect_rec="raise", expect_score=(0, 5),
        expect_quality={"medium_error", "major_error"}, expect_rule="HU.BTN"))

    n_ok = sum(results)
    print(f"\n{n_ok}/{len(results)} casos de decisão OK")

    # ── integração tournament_analysis: cooler não vira leak; bolha insuficiente ──
    import tournament_analysis as ta
    base = dict(scenario="RFI", hero_pos="BTN", hero_cards="KK", stack_bb=9, hero_action="raise",
                hero_all_in=True, n_players=6, hero_voluntary=True, faced_allin=False, opener_pos=None,
                villain_action=None, n_limpers=0, pot_total=1800, stack_chips=900,
                hero_won=False, went_to_showdown=True, hero_busted=True, bb=100)
    a_cooler = ta.screen_and_analyze(dict(base, hand_id="cool1"))
    ok_cooler = a_cooler["outcome"] == "cooler" and len(ta.detect_leaks([a_cooler])) == 0
    print(f"[{'OK ' if ok_cooler else 'FAIL'}] Cooler (KK shove correto, perdeu) → outcome cooler e NÃO vira leak")
    results.append(ok_cooler)

    a_bubble = ta.screen_and_analyze(dict(scenario="vs_RFI", hero_pos="BB", hero_cards="A9o", stack_bb=12,
        hero_action="call", hero_all_in=False, n_players=4, hero_voluntary=True, faced_allin=True,
        opener_pos="BTN", villain_action="shove", n_limpers=0, pot_total=2400, stack_chips=1200,
        hero_won=None, went_to_showdown=False, hero_busted=False, bb=100, hand_id="bub1"))
    # agora a bolha é APROXIMADA (ICM): call loose de A9o vira erro com nota baixa, não "insuficiente"
    ok_bubble = a_bubble["outcome"] == "erro" and (a_bubble["decision"]["source_type"] == "DERIVED_FROM_PDF")
    print(f"[{'OK ' if ok_bubble else 'FAIL'}] Bolha call loose A9o → aproximação ICM = erro (não insuficiente)  "
          f"[outcome={a_bubble['outcome']} src={a_bubble['decision'].get('source_type')} nota={a_bubble['decision'].get('nota')}]")
    results.append(ok_bubble)

    # ── síntese: nunca recusa quando dá pra aproximar (testes da nova fase) ──────
    print("\n— Range Synthesis —")
    results.append(case(
        "Resteal 14bb SB vs CO A5s (sem bucket exato) → shove",
        HandContext(eff_stack_bb=14, hero_pos="SB", hero_cards="A5s", preflop_action="vs_raise", opener_pos="CO", players_left=6),
        "shove", expect_rec="shove", expect_rule="RESTEAL.SHORT"))
    results.append(case(
        "Open shove 9bb BTN A8o → responde (grid 10bb = regra clara de push/fold)",
        HandContext(eff_stack_bb=9, hero_pos="BTN", hero_cards="A8o", preflop_action="first_in", players_left=6),
        "shove", expect_rec="shove", expect_score=(9, 10), expect_source="CANONICAL_RULE"))
    results.append(case(
        "Pós-flop IP vs BB (flop) → guideline c-bet (DERIVED, não insuficiente)",
        HandContext(eff_stack_bb=30, hero_pos="BTN", hero_cards="AhKh", street="flop",
                    opener_pos="BB", players_left=6),
        "bet", expect_rec="bet", expect_source="DERIVED_FROM_PDF"))
    results.append(case(
        "Call especulativo 12bb vs open CO (resteal spot) → regra resteal pune",
        HandContext(eff_stack_bb=12, hero_pos="SB", hero_cards="KJo", preflop_action="vs_raise", opener_pos="CO", players_left=6),
        "call", expect_rec="fold", expect_rule="RESTEAL.SHORT"))
    # essenciais ausentes → INSUFFICIENT (via query)
    from pke import engine as _eng
    q_nopos = _eng().query("o que faço com A8o e 9bb?", {"hero_cards": "A8o", "effective_stack_bb": 9})
    ok_nopos = q_nopos["confidence"] == "insufficient" or "hero_position" in q_nopos.get("missing_info", [])
    print(f"[{'OK ' if ok_nopos else 'FAIL'}] Sem posição → insufficient/pede posição  [{q_nopos.get('missing_info')}]")
    results.append(ok_nopos)

    # ── nota ponderada por impacto + caps ────────────────────────────────────────
    print("\n— Nota ponderada por impacto —")
    def view(dl, il, w, s):
        return {"decision_label": dl, "impact_label": il, "impact_weight": w, "internal_score": s}

    # T1/T2: 20 folds fáceis (10, peso 0.4) + 1 punt crítico (0, peso 4.0) → NÃO fica alto
    agg = ta.aggregate_score([view("correct", "low", 0.4, 10) for _ in range(20)]
                             + [view("major_error", "critical", 4.0, 0)])
    ok = agg["pke_score"] is not None and agg["pke_score"] <= 6.5 and agg["media_simples"] >= 9
    print(f"[{'OK ' if ok else 'FAIL'}] 20 folds(10) + 1 punt crítico(0) → nota {agg['pke_score']} "
          f"(média simples {agg['media_simples']}) — não inflou")
    results.append(ok)

    # T4: cooler não penaliza
    agg = ta.aggregate_score([view("correct", "high", 2.0, 10), view("cooler", "high", 2.0, 0)])
    ok = agg["pke_score"] == 10.0
    print(f"[{'OK ' if ok else 'FAIL'}] cooler não penaliza → nota {agg['pke_score']}")
    results.append(ok)

    # T5: insuficiente não entra
    agg = ta.aggregate_score([view("correct", "medium", 1.0, 8), view("insufficient", "low", 0.0, None)])
    ok = agg["pke_score"] == 8.0
    print(f"[{'OK ' if ok else 'FAIL'}] insuficiente não entra → nota {agg['pke_score']}")
    results.append(ok)

    # T3: erro grave na bolha derruba bastante
    agg = ta.aggregate_score([view("correct", "medium", 1.0, 9) for _ in range(5)]
                             + [view("major_error", "critical", 4.0, 3)])
    ok = agg["pke_score"] <= 6.5
    print(f"[{'OK ' if ok else 'FAIL'}] 5 acertos + 1 erro grave bolha → nota {agg['pke_score']} (cai bastante)")
    results.append(ok)

    # T6: raise/fold <10bb → peso crítico
    w6, il6 = ta._impact("push_fold", "middle", 8, "raise", "shove", "major_error", {})
    ok = il6 == "critical" and w6 >= 4.0
    print(f"[{'OK ' if ok else 'FAIL'}] raise/fold 8bb → impacto {il6} peso {w6}")
    results.append(ok)

    # T7: call especulativo short (resteal) erro grave → crítico
    w7, il7 = ta._impact("resteal_short", "middle", 12, "call", "fold", "major_error", {})
    ok = il7 == "critical"
    print(f"[{'OK ' if ok else 'FAIL'}] call especulativo short → impacto {il7}")
    results.append(ok)

    # T8: acerto em push/fold importante pesa mais que fold trivial
    w_pf, _ = ta._impact("push_fold", "middle", 8, "shove", "shove", "correct", {})
    w_fold, il_fold = ta._impact("rfi", "early", 50, "fold", "fold", "correct", {})
    ok = w_pf > w_fold and il_fold == "low"
    print(f"[{'OK ' if ok else 'FAIL'}] push/fold importante (peso {w_pf}) > fold trivial (peso {w_fold}, {il_fold})")
    results.append(ok)

    n_ok = sum(results)
    print(f"\nTOTAL {n_ok}/{len(results)} OK")
    return 0 if n_ok == len(results) else 1


if __name__ == "__main__":
    sys.exit(main())
