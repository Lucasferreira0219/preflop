"""Golden set — spots representativos do Guia de Bolso. Roda como script:
    python -m pke.tests.golden
Falha (exit 1) se alguma expectativa quebrar.
"""
from __future__ import annotations

import sys

from pke import HandContext, engine


def case(desc, ctx, hero_action, expect_rec=None, expect_score=None, expect_rule=None,
         expect_insufficient=False):
    eng = engine()
    dec = eng.evaluate_decision(ctx, hero_action)
    ok = True
    if expect_insufficient:
        ok = ok and dec["insuficiente"] is True
    else:
        if expect_rec is not None:
            ok = ok and dec["acao_recomendada"] == expect_rec
        if expect_score is not None:
            lo, hi = expect_score
            ok = ok and (dec["nota"] is not None and lo <= dec["nota"] <= hi)
        if expect_rule is not None:
            ok = ok and any(expect_rule in r for r in dec["regra_pdf"])
    status = "OK " if ok else "FAIL"
    print(f"[{status}] {desc}")
    print(f"        spot={dec['spot'] if 'spot' in dec else ctx.spot} fase={dec['fase']} "
          f"rec={dec['acao_recomendada']} nota={dec['nota']} erro={dec['tipo_erro']} "
          f"regra={dec['regra_pdf']}")
    if not ok:
        print(f"        ESPERADO rec={expect_rec} score={expect_score} rule={expect_rule} insuf={expect_insufficient}")
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

    # 6) Bolha: call de shove → regra-nível (insuficiente p/ nota exata)
    results.append(case(
        "Bolha call de shove → insuficiente (anti-alucinação)",
        HandContext(eff_stack_bb=12, hero_pos="BB", hero_cards="A9o",
                    preflop_action="vs_shove", opener_pos="BTN", players_left=4, paid_places=3),
        hero_action="call", expect_insufficient=True))

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

    # ── spot insuficiente (pós-flop ainda não modelado) ──────────────────────────
    results.append(case(
        "Pós-flop (street=flop) → insuficiente",
        HandContext(eff_stack_bb=30, hero_pos="BTN", hero_cards="AhKh", street="flop", players_left=6),
        "bet", expect_insufficient=True))

    # ── raise/fold com <10bb punido forte ────────────────────────────────────────
    results.append(case(
        "BTN 9bb AA dá raise (não all-in) → punido forte",
        HandContext(eff_stack_bb=9, hero_pos="BTN", hero_cards="AA", preflop_action="first_in", players_left=6),
        "raise", expect_rec="shove", expect_score=(0, 4), expect_rule="OPENSHOVE.10BB"))

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
    ok_bubble = a_bubble["outcome"] == "insuficiente"
    print(f"[{'OK ' if ok_bubble else 'FAIL'}] Bolha call de shove sem range → insuficiente (não chuta)")
    results.append(ok_bubble)

    n_ok = sum(results)
    print(f"\nTOTAL {n_ok}/{len(results)} OK")
    return 0 if n_ok == len(results) else 1


if __name__ == "__main__":
    sys.exit(main())
