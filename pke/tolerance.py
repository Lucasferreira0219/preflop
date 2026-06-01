"""Camada de tolerância estratégica do PKE.

Poker não é "preto no branco": vários spots têm mais de uma linha aceitável.
Esta camada roda DEPOIS do handler de decisão e reclassifica as ações em faixas:

  - acceptable  → linha boa/padrão (não penaliza)
  - advanced    → linha avançada (trap/induce): aceitável, mas exige plano
  - bad         → linha claramente inferior (erro médio)
  - severe      → erro caro (erro crítico): raise/fold short, fold de premium curto…

Foco do produto: treinador prático para SNG low ticket / iniciante.
Prioriza decisão simples, não pune injustamente premium short-stack, mas mantém
erros realmente caros como erros. NÃO é um solver.
"""
from __future__ import annotations

from .context import hand_class

# Mãos premium para a tolerância de SHORT STACK vs open.
#   monster → shove é linha simples e lucrativa; foldar é erro grave.
#   strong  → shove é aceitável (principalmente OOP / fora de posição).
_PREMIUM_MONSTER = {"AA", "KK", "QQ", "JJ", "AKs", "AKo"}
_PREMIUM_STRONG = {"TT", "99", "AQs", "AQo", "AJs", "KQs"}

# Limite de stack em que tratamos o spot como "short" (push/fold relevante).
SHORT_STACK_BB = 17.0

_ADVANCED_NOTE = (
    "Existem linhas possíveis aqui. Call pode induzir o vilão, mas exige plano "
    "pós-flop. Shove é mais simples, captura valor e evita pós-flop fora de posição. "
    "Para SNG low ticket e jogador iniciante, shove é totalmente aceitável."
)


def premium_tier(cards: str | None) -> str | None:
    """Classe de premium para tolerância de short-stack vs open."""
    cls = hand_class(cards)
    if cls is None:
        return None
    if cls in _PREMIUM_MONSTER:
        return "monster"
    if cls in _PREMIUM_STRONG:
        return "strong"
    return None


def apply_strategic_tolerance(ctx, rec):
    """Reclassifica as ações da Recommendation conforme a tolerância estratégica.

    Atua apenas em spots curtos vs open (vs_open / resteal_short / bb_defense) com
    mão premium e stack ≤ SHORT_STACK_BB. Fora disso, devolve a recomendação intacta
    (deep stack continua exigindo a linha teórica; mãos especulativas continuam erro).
    """
    if rec is None or rec.insufficient:
        return rec
    if ctx.preflop_action != "vs_raise":
        return rec
    if ctx.spot not in ("vs_open", "resteal_short", "bb_defense"):
        return rec

    eff = ctx.eff_stack_bb or 0.0
    tier = premium_tier(ctx.hero_cards)
    if tier is None or eff > SHORT_STACK_BB:
        return rec  # não-premium ou deep → sem tolerância (mantém teoria/erros)

    # ── premium short-stack vs open: shove é uma linha boa e simples ──────────────
    value_lines = {"shove", "3bet"}

    # A linha principal preferida quando curto é o shove (≤17bb o 3-bet vira all-in).
    # Se o handler "recomendou" fold/None (bug clássico do range vazio), corrige.
    if rec.primary not in (value_lines | {"call"}):
        rec.primary = "shove"

    acceptable = set(rec.acceptable) | value_lines | {rec.primary}
    acceptable.discard("fold")
    advanced = set(rec.advanced)

    # call: linha avançada (trap/induzir) — a menos que seja a própria recomendada.
    if rec.primary == "call":
        acceptable.add("call")
    else:
        advanced.add("call")
        acceptable.discard("call")

    # erros: foldar premium curto = erro grave; raise/fold curto = erro crítico.
    forbidden = (set(rec.forbidden) - value_lines - {"call"}) | {"fold"}
    severe = set(rec.severe)
    bad = set(rec.bad)
    if eff <= 12:
        severe.add("raise")          # raise/fold bem curto é crítico
    else:
        bad.add("raise")             # 13–17bb: inferior, mas não catastrófico

    rec.acceptable = sorted(acceptable)
    rec.advanced = sorted(advanced)
    rec.forbidden = sorted(forbidden)
    rec.severe = sorted(severe)
    rec.bad = sorted(bad)
    rec.tolerance_applied = True
    rec.advanced_note = _ADVANCED_NOTE
    if not rec.explain or rec.primary == "shove":
        rec.explain = (
            f"Premium curto ({hand_class(ctx.hero_cards)}, {round(eff)}bb) fora/ contra open: "
            "shove é simples e lucrativo. Call pode ser linha avançada para induzir."
        )
    return rec
