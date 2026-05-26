"""
Extrapola ranges vs_RFI e vs_3bet para todos os spots possíveis em SnG 75bb,
baseado nos princípios do PDF Reg Life:
- Iniciantes 3-bet só premium (AA-TT, AKs/o, AQs/o)
- Iniciantes 4-bet só premium (KK+, AKs)
- Call expandido pela posição (IP > OOP) e pela amplitude do range do vilão

Spots já cobertos pelo PDF (do JSON original) NÃO são sobrescritos.
Spots derivados ficam marcados em _derived_spots.

Uso: python scripts/extrapolate_ranges.py
"""
import json
import os
from copy import deepcopy

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RANGES_FILE = os.path.join(BASE, "ranges", "sng", "ranges_75bb.json")

POSITIONS_ORDER = ["UTG", "UTG1", "UTG2", "MP", "HJ", "CO", "BTN", "SB", "BB"]
EP_POS  = {"UTG", "UTG1", "UTG2"}
MP_POS  = {"MP"}
LP_POS  = {"HJ", "CO", "BTN"}
BLINDS  = {"SB", "BB"}

# Combos premium constantes
PREMIUM_3BET = ["AA", "KK", "QQ", "JJ", "TT", "AKs", "AKo", "AQs", "AQo"]
PREMIUM_4BET = ["KK", "AA", "AKs"]
CALL_VS_3BET = ["QQ", "JJ", "AKo", "AQs"]


def villain_bucket(pos):
    if pos in EP_POS:   return "EP"
    if pos in MP_POS:   return "MP"
    if pos == "HJ":     return "HJ"
    if pos == "CO":     return "CO"
    if pos == "BTN":    return "BTN"
    if pos == "SB":     return "SB"
    return "BB"


def hero_bucket(pos):
    if pos in EP_POS:   return "EP"
    if pos in MP_POS:   return "MP"
    if pos == "HJ":     return "HJ"
    if pos == "CO":     return "CO"
    if pos == "BTN":    return "BTN"
    if pos == "SB":     return "SB"
    return "BB"


# Mapa (hero_bucket, villain_bucket) -> call hands (vs_RFI)
# Compõe com PREMIUM_3BET acima. Valores extraídos dos princípios do PDF
# (iniciantes call seleto + 3-bet só premium).
VS_RFI_CALL_TABLE = {
    # vs EP (range muito tight do vilão → call premium)
    ("EP", "EP"):   ["99", "88", "77", "66", "AJs", "ATs", "KQs", "KJs"],
    ("MP", "EP"):   ["99", "88", "77", "66", "AJs", "ATs", "KQs", "KJs"],
    ("HJ", "EP"):   ["99", "88", "77", "66", "AJs", "ATs", "A9s", "KQs", "KJs", "QJs"],
    ("CO", "EP"):   ["99", "88", "77", "66", "55", "AJs", "ATs", "A9s", "KQs", "KJs", "KTs", "QJs", "JTs"],
    ("BTN", "EP"):  ["99", "88", "77", "66", "55", "44", "33", "22", "AJs", "ATs", "A9s", "A5s", "KQs", "KJs", "KTs", "QJs", "JTs", "T9s"],
    ("SB", "EP"):   ["99", "88", "77", "AJs", "ATs", "KQs", "KJs"],
    ("BB", "EP"):   ["99", "88", "77", "66", "55", "44", "AJs", "ATs", "A9s", "A8s", "A5s", "KQs", "KJs", "KTs", "QJs", "QTs", "JTs", "T9s", "98s", "AJo"],

    # vs MP (range ~16%)
    ("HJ", "MP"):   ["99", "88", "77", "66", "55", "AJs", "ATs", "A9s", "A8s", "KQs", "KJs", "KTs", "QJs", "QTs", "JTs"],
    ("CO", "MP"):   ["99", "88", "77", "66", "55", "44", "33", "22", "AJs", "ATs", "A9s", "A8s", "A7s", "A6s", "A5s", "KQs", "KJs", "KTs", "QJs", "QTs", "JTs", "T9s", "98s", "87s", "AJo", "KQo", "KTo"],
    ("BTN", "MP"):  ["99", "88", "77", "66", "55", "44", "33", "22", "AJs", "ATs", "A9s", "A8s", "A7s", "A6s", "A5s", "A4s", "A3s", "A2s", "KQs", "KJs", "KTs", "K9s", "QJs", "QTs", "Q9s", "JTs", "J9s", "T9s", "98s", "87s", "76s", "AJo", "ATo", "KQo", "KJo"],
    ("SB", "MP"):   ["99", "88", "77", "66", "AJs", "ATs", "A9s", "KQs", "KJs", "KTs", "QJs", "JTs"],
    ("BB", "MP"):   ["99-22", "AJs", "ATs", "A9s", "A8s", "A7s", "A5s", "KQs", "KJs", "KTs", "K9s", "QJs", "QTs", "Q9s", "JTs", "J9s", "T9s", "98s", "87s", "AJo", "ATo", "KQo", "KJo"],

    # vs HJ (range ~25%)
    ("CO", "HJ"):   ["99", "88", "77", "66", "55", "44", "33", "22", "AJs", "ATs", "A9s", "A8s", "A7s", "A6s", "A5s", "KQs", "KJs", "KTs", "QJs", "QTs", "JTs", "T9s", "98s", "87s", "AJo", "KQo", "KTo"],
    ("BTN", "HJ"):  ["99", "88", "77", "66", "55", "44", "33", "22", "AJs", "ATs", "A9s", "A8s", "A7s", "A6s", "A5s", "A4s", "A3s", "A2s", "KQs", "KJs", "KTs", "K9s", "K8s", "QJs", "QTs", "Q9s", "Q8s", "JTs", "J9s", "J8s", "T9s", "T8s", "98s", "97s", "87s", "76s", "65s", "AJo", "ATo", "KQo", "KJo", "KTo", "QJo"],
    ("SB", "HJ"):   ["99", "88", "77", "66", "55", "AJs", "ATs", "A9s", "A8s", "KQs", "KJs", "KTs", "QJs", "QTs", "JTs", "T9s"],
    ("BB", "HJ"):   ["99", "88", "77", "66", "55", "44", "33", "22", "AJs", "ATs", "A9s", "A8s", "A7s", "A5s", "A4s", "A3s", "A2s", "KQs", "KJs", "KTs", "K9s", "K8s", "QJs", "QTs", "Q9s", "JTs", "J9s", "T9s", "98s", "87s", "76s", "AJo", "ATo", "A9o", "KQo", "KJo", "KTo", "QJo"],

    # vs CO (range ~33%)
    ("BTN", "CO"):  ["99", "88", "77", "66", "55", "44", "33", "22", "AJs", "ATs", "A9s", "A8s", "A7s", "A6s", "A5s", "A4s", "A3s", "A2s", "KQs", "KJs", "KTs", "K9s", "K8s", "QJs", "QTs", "Q9s", "Q8s", "JTs", "J9s", "J8s", "T9s", "T8s", "98s", "97s", "87s", "86s", "76s", "75s", "65s", "64s", "54s", "AJo", "ATo", "KQo", "KJo", "KTo", "QJo", "QTo"],
    ("SB", "CO"):   ["99", "88", "77", "66", "55", "44", "33", "22", "AJs", "ATs", "A9s", "A8s", "A7s", "A6s", "A5s", "KQs", "KJs", "KTs", "K9s", "QJs", "QTs", "Q9s", "JTs", "J9s", "T9s", "98s", "AJo", "ATo", "KQo", "KJo"],
    ("BB", "CO"):   ["99", "88", "77", "66", "55", "44", "33", "22", "AJs", "ATs", "A9s", "A8s", "A7s", "A6s", "A5s", "A4s", "A3s", "A2s", "KQs", "KJs", "KTs", "K9s", "K8s", "K7s", "QJs", "QTs", "Q9s", "Q8s", "JTs", "J9s", "J8s", "T9s", "T8s", "98s", "97s", "87s", "86s", "76s", "75s", "65s", "AJo", "ATo", "A9o", "KQo", "KJo", "KTo", "K9o", "QJo", "QTo", "JTo"],

    # vs BTN (range ~50%)
    ("SB", "BTN"):  ["99", "88", "77", "66", "55", "44", "33", "22", "AJs", "ATs", "A9s", "A8s", "A7s", "A6s", "A5s", "A4s", "A3s", "A2s", "KQs", "KJs", "KTs", "K9s", "K8s", "QJs", "QTs", "Q9s", "Q8s", "JTs", "J9s", "T9s", "T8s", "98s", "87s", "76s", "65s", "AJo", "ATo", "KQo", "KJo", "KTo", "QJo", "QTo"],
    ("BB", "BTN"):  ["99", "88", "77", "66", "55", "44", "33", "22", "AJs", "ATs", "A9s", "A8s", "A7s", "A6s", "A5s", "A4s", "A3s", "A2s", "KQs", "KJs", "KTs", "K9s", "K8s", "K7s", "K6s", "K5s", "QJs", "QTs", "Q9s", "Q8s", "Q7s", "JTs", "J9s", "J8s", "J7s", "T9s", "T8s", "T7s", "98s", "97s", "87s", "86s", "76s", "75s", "65s", "64s", "54s", "AJo", "ATo", "A9o", "A8o", "KQo", "KJo", "KTo", "K9o", "QJo", "QTo", "Q9o", "JTo", "J9o", "T9o"],

    # vs SB (HU dynamic)
    ("BB", "SB"):   ["99", "88", "77", "66", "55", "44", "33", "22", "AJs", "ATs", "A9s", "A8s", "A7s", "A6s", "A5s", "A4s", "A3s", "A2s", "KQs", "KJs", "KTs", "K9s", "K8s", "K7s", "K6s", "K5s", "K4s", "K3s", "K2s", "QJs", "QTs", "Q9s", "Q8s", "Q7s", "Q6s", "JTs", "J9s", "J8s", "J7s", "T9s", "T8s", "T7s", "98s", "97s", "96s", "87s", "86s", "76s", "75s", "65s", "64s", "54s", "AJo", "ATo", "A9o", "A8o", "A7o", "A6o", "A5o", "KQo", "KJo", "KTo", "K9o", "K8o", "QJo", "QTo", "Q9o", "Q8o", "JTo", "J9o", "J8o", "T9o", "T8o", "98o"],
}


def combos(h):
    return 6 if len(h) == 2 else (4 if h[2] == 's' else 12)


def expand_pair_range(s):
    """Expande notação tipo '99-22' em ['99','88','77','66','55','44','33','22']."""
    if "-" in s and len(s.split("-")[0]) == 2:
        hi, lo = s.split("-")
        ranks = "AKQJT98765432"
        hi_idx = ranks.index(hi[0])
        lo_idx = ranks.index(lo[0])
        return [ranks[i] * 2 for i in range(hi_idx, lo_idx + 1)]
    return [s]


def expand_list(hands):
    out = []
    for h in hands:
        out.extend(expand_pair_range(h))
    return out


def get_vs_rfi(hero_b, villain_b):
    if (hero_b, villain_b) in VS_RFI_CALL_TABLE:
        return {
            "3bet": list(PREMIUM_3BET),
            "call": expand_list(VS_RFI_CALL_TABLE[(hero_b, villain_b)]),
        }
    return None


def is_before(p, hero):
    return POSITIONS_ORDER.index(p) < POSITIONS_ORDER.index(hero)


def is_after(p, hero):
    return POSITIONS_ORDER.index(p) > POSITIONS_ORDER.index(hero)


def main():
    with open(RANGES_FILE, "r", encoding="utf-8") as f:
        data = json.load(f)

    # Lista de spots originais (não sobrescrever)
    original_vs_rfi  = set()
    original_vs_3bet = set()
    derived_vs_rfi  = []
    derived_vs_3bet = []

    for hero, hero_data in data["positions"].items():
        for villain in (hero_data.get("vs_RFI") or {}):
            buckets = hero_data["vs_RFI"][villain]
            if buckets.get("3bet") or buckets.get("call"):
                original_vs_rfi.add((hero, villain))
        for villain in (hero_data.get("vs_3bet") or {}):
            buckets = hero_data["vs_3bet"][villain]
            if buckets.get("4bet") or buckets.get("call"):
                original_vs_3bet.add((hero, villain))

    # Preenche vs_RFI faltantes
    for hero in POSITIONS_ORDER:
        if hero == "UTG":
            continue  # UTG nunca enfrenta open antes
        hero_data = data["positions"].setdefault(hero, {"RFI": [], "vs_RFI": {}, "vs_3bet": {}})
        hero_data.setdefault("vs_RFI", {})
        hb = hero_bucket(hero)
        for villain in POSITIONS_ORDER:
            if not is_before(villain, hero):
                continue
            if villain == "BB":  # BB nunca RFI
                continue
            if (hero, villain) in original_vs_rfi:
                continue
            vb = villain_bucket(villain)
            rng = get_vs_rfi(hb, vb)
            if rng is None:
                continue
            hero_data["vs_RFI"][villain] = rng
            derived_vs_rfi.append(f"{hero} vs {villain}")

    # Preenche vs_3bet faltantes (universal premium)
    for hero in POSITIONS_ORDER:
        if hero == "BB":  # BB não tem RFI nem vs_3bet (não abre)
            continue
        hero_data = data["positions"].setdefault(hero, {"RFI": [], "vs_RFI": {}, "vs_3bet": {}})
        hero_data.setdefault("vs_3bet", {})
        for villain in POSITIONS_ORDER:
            if not is_after(villain, hero):
                continue
            if (hero, villain) in original_vs_3bet:
                continue
            hero_data["vs_3bet"][villain] = {
                "4bet": list(PREMIUM_4BET),
                "call": list(CALL_VS_3BET),
            }
            derived_vs_3bet.append(f"{hero} vs {villain}")

    # Marca spots derivados em uma seção meta
    data["_derived_spots"] = {
        "vs_RFI":  derived_vs_rfi,
        "vs_3bet": derived_vs_3bet,
        "note":    "Ranges derivados aplicando os princípios do PDF Reg Life (3-Bet/4-Bet premium pra iniciantes, call seleto por posição). NÃO são fontes diretas do PDF.",
    }

    # Atualiza _notes
    data["_notes"] = (
        "Early game SnG = ~75bb. Spots originais do PDF: 3 vs_RFI (UTG1/UTG2 vs UTG, "
        "CO vs MP/HJ, BTN vs CO). Demais spots são DERIVADOS dos princípios do PDF "
        "(ver _derived_spots). vs_3bet usa heurística universal pra iniciantes "
        "(4-Bet só KK+/AKs, call seleto QQ-TT/AKo/AQs)."
    )

    with open(RANGES_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

    print(f"vs_RFI: {len(original_vs_rfi)} originais + {len(derived_vs_rfi)} derivados")
    print(f"vs_3bet: {len(original_vs_3bet)} originais + {len(derived_vs_3bet)} derivados")
    print()
    print("Validação combos vs_RFI:")
    for hero, hero_data in data["positions"].items():
        for villain, buckets in (hero_data.get("vs_RFI") or {}).items():
            c3 = sum(combos(h) for h in buckets.get("3bet", []))
            cc = sum(combos(h) for h in buckets.get("call", []))
            mark = "★" if (hero, villain) in original_vs_rfi else "·"
            print(f"  {mark} {hero:>4} vs {villain:>4}: 3bet={c3:>3} call={cc:>4} total={c3+cc:>4} ({(c3+cc)/1326*100:>4.1f}%)")


if __name__ == "__main__":
    main()
