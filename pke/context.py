"""HandContext + utilitários de cartas/mãos do PokerKnowledgeEngine.

Tudo em torno de uma representação normalizada de mão (HandContext) que as três
áreas (Simulador, Consulta, Torneios) montam e o motor consome.
"""
from __future__ import annotations

from dataclasses import dataclass, field

RANK_ORDER = "AKQJT98765432"
_RANK_IDX = {r: i for i, r in enumerate(RANK_ORDER)}
BROADWAY = set("AKQJT")
POSITIONS = ["UTG", "UTG1", "UTG2", "MP", "HJ", "CO", "BTN", "SB", "BB"]


def hand_class(cards: str | None) -> str | None:
    """Normaliza uma mão para a notação de classe usada nos ranges.

    Aceita combo real ("AhTs") ou já-classe ("ATs", "ATo", "TT").
    Devolve sempre a carta mais alta primeiro: "AhTs" -> "ATs", "TsTh" -> "TT".
    """
    if not cards:
        return None
    s = cards.strip()
    # já é classe?
    if len(s) in (2, 3) and s[0] in _RANK_IDX and s[1] in _RANK_IDX:
        r1, r2 = s[0], s[1]
        if r1 == r2:
            return r1 + r2
        hi, lo = (r1, r2) if _RANK_IDX[r1] < _RANK_IDX[r2] else (r2, r1)
        suited = len(s) == 3 and s[2].lower() == "s"
        return hi + lo + ("s" if suited else "o")
    # combo real "AhTs"
    if len(s) == 4 and s[0] in _RANK_IDX and s[2] in _RANK_IDX:
        r1, s1, r2, s2 = s[0], s[1], s[2], s[3]
        if r1 == r2:
            return r1 + r2
        hi, lo = (r1, r2) if _RANK_IDX[r1] < _RANK_IDX[r2] else (r2, r1)
        return hi + lo + ("s" if s1.lower() == s2.lower() else "o")
    return None


def in_range(cards: str | None, range_list: list[str] | None) -> bool:
    cls = hand_class(cards)
    if cls is None or not range_list:
        return False
    return cls in set(range_list)


def is_pair(cards: str | None) -> bool:
    cls = hand_class(cards)
    return bool(cls) and len(cls) == 2


def is_suited(cards: str | None) -> bool:
    cls = hand_class(cards)
    return bool(cls) and len(cls) == 3 and cls.endswith("s")


def is_resteal_hand(cards: str | None) -> bool:
    """Regra RESTEAL.SHORT: pares, broadways naipadas, ases naipados."""
    cls = hand_class(cards)
    if not cls:
        return False
    if is_pair(cls):
        return True
    if is_suited(cls):
        hi, lo = cls[0], cls[1]
        if hi == "A":  # ás naipado
            return True
        if hi in BROADWAY and lo in BROADWAY:  # broadway naipada
            return True
    return False


@dataclass
class HandContext:
    # mesa
    table_max: int = 9
    players_left: int = 9
    paid_places: int = 3              # SNG 9-max single paga top 3 (config por torneio)
    prize_structure: list[float] | None = None
    ante: bool = False
    bb_chips: int = 100
    eff_stack_bb: float = 100.0
    # hero / vilões
    hero_pos: str = "BTN"
    hero_cards: str | None = None
    villains: list[dict] = field(default_factory=list)   # display: [{pos,stack_bb,action}]
    # ação pré-flop normalizada (preenchida pelo ContextBuilder / setada nos testes)
    preflop_action: str = "first_in"  # first_in | vs_raise | vs_limp | vs_shove
    opener_pos: str | None = None
    n_limpers: int = 0
    # pós-flop (futuro)
    street: str = "preflop"
    board: list[str] | None = None
    # derivados (preenchidos pelo motor)
    phase: str | None = None
    icm: dict | None = None
    spot: str | None = None

    def is_ip_vs(self, villain_pos: str | None) -> bool:
        """Hero está em posição contra o vilão? (ordem de ação PÓS-FLOP:
        SB age primeiro, BTN por último → quem age depois é IP)."""
        if not villain_pos:
            return True
        postflop = ["SB", "BB", "UTG", "UTG1", "UTG2", "MP", "HJ", "CO", "BTN"]
        try:
            return postflop.index(self.hero_pos) > postflop.index(villain_pos)
        except ValueError:
            return True
