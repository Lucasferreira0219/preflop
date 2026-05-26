"""
Gera os JSONs de range short-stack do SnG:
  - ranges/sng/ranges_10bb.json  → push/fold puro (_RFI_shove + BB call vs shove)
  - ranges/sng/ranges_15bb.json  → fragmentação (RFI mini-raise + _RFI_shove) + resteal (vs_RFI.shove)
  - ranges/sng/ranges_30bb.json  → transição (igual 75bb, open ~5% menor, sem shove)

Fontes: sng_arq/notes/ranges/04-open-shove-short.md, 05-resteal.md, 02-open-raise-short.md.

Notação compacta expandida aqui:
  "66+"   -> 66,77,88,99,TT,JJ,QQ,KK,AA
  "A5s+"  -> A5s,A6s,...,AKs       "ATo+" -> ATo,AJo,AQo,AKo
  "K9s+"  -> K9s,KTs,KJs,KQs       "QTo+" -> QTo,QJo
  "T9s"   -> hand único
Em RFI/shove o bucket shove é definido como (shove_set - raise_set) p/ garantir
a invariante "1 mão -> 1 ação".

Uso: python scripts/build_sng_short_ranges.py
"""
import json
import os

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(BASE, "ranges", "sng")
SRC_75 = os.path.join(OUT_DIR, "ranges_75bb.json")

RANKS = "AKQJT98765432"  # alto -> baixo


def combos(h):
    return 6 if len(h) == 2 else (4 if h[2] == "s" else 12)


def _expand_token(tok):
    tok = tok.strip()
    if not tok:
        return []
    plus = tok.endswith("+")
    body = tok[:-1] if plus else tok
    # Par (ex: "66", "TT")
    if len(body) == 2 and body[0] == body[1]:
        hi = RANKS.index(body[0])
        if not plus:
            return [body]
        return [RANKS[i] * 2 for i in range(hi, -1, -1)]
    # Suited/offsuit (ex: "A5s", "KTo")
    if len(body) == 3 and body[2] in ("s", "o"):
        r1, r2, suit = body[0], body[1], body[2]
        i1, i2 = RANKS.index(r1), RANKS.index(r2)
        if not plus:
            return [body]
        # "+" sobe a carta menor até uma abaixo da maior (i1+1)
        return [r1 + RANKS[i] + suit for i in range(i2, i1, -1)]
    raise ValueError(f"Token de mão inválido: {tok!r}")


def expand(tokens):
    out = []
    seen = set()
    for t in tokens:
        for h in _expand_token(t):
            if h not in seen:
                seen.add(h)
                out.append(h)
    return out


def diff(a, b):
    bset = set(b)
    return [h for h in a if h not in bset]


def pct(hands):
    return sum(combos(h) for h in hands) / 1326 * 100


# ─────────────────────────────────────────────────────────────────────────────
#  10bb — Push/Fold puro (fonte: 04-open-shove-short.md)
#  Alvos: UTG ~9.4%, HJ ~15%, CO ~26%, BTN ~32%, SB vs BB ~54%.
# ─────────────────────────────────────────────────────────────────────────────
SHOVE_10 = {
    "UTG":  ["66+", "A7s+", "A5s", "AJo+", "KQs"],
    "UTG1": ["66+", "A7s+", "A5s", "AJo+", "KQs"],
    "UTG2": ["66+", "A7s+", "A5s", "AJo+", "KQs"],
    "MP":   ["55+", "A4s+", "KTs+", "QJs", "ATo+", "KQo"],
    "HJ":   ["22+", "A2s+", "KTs+", "QTs+", "JTs", "ATo+", "KJo+"],
    "CO":   ["22+", "A2s+", "K8s+", "Q9s+", "J9s+", "T9s", "98s", "A8o+", "K9o+", "QTo+"],
    "BTN":  ["22+", "A2s+", "K5s+", "Q8s+", "J8s+", "T8s+", "97s+", "87s", "76s", "65s",
             "A2o+", "K9o+", "QTo+", "JTo"],
    "SB":   ["22+", "A2s+", "K2s+", "Q5s+", "J7s+", "T7s+", "96s+", "86s+", "75s+", "65s", "54s",
             "A2o+", "K5o+", "Q7o+", "J8o+", "T8o+", "97o+", "87o"],
}

# BB defendendo vs shove (call). Fonte: BB vs SB ~18%, vs BTN ~16%, vs UTG ~8%.
CALL_10 = {
    "SB":  ["55+", "A2s+", "K9s+", "Q9s+", "JTs", "A6o+", "KTo+", "QJo"],
    "BTN": ["66+", "A2s+", "K9s+", "QTs+", "JTs", "A8o+", "KJo+"],
    "UTG": ["77+", "AJs+", "A5s", "KQs", "AQo+"],
}


# ─────────────────────────────────────────────────────────────────────────────
#  15bb — Fragmentação (mini-raise + shove) + Resteal
#  Fonte: 02-open-raise-short.md (premium->mini-raise, médias->shove) + 05-resteal.md
# ─────────────────────────────────────────────────────────────────────────────
RAISE_15 = {
    "UTG":  ["TT+", "AJs+", "AQo+"],
    "UTG1": ["TT+", "AJs+", "AQo+"],
    "UTG2": ["TT+", "AJs+", "AQo+"],
    "MP":   ["TT+", "ATs+", "AQo+", "KQs"],
    "HJ":   ["99+", "ATs+", "AJo+", "KQs"],
    "CO":   ["99+", "ATs+", "KJs+", "AJo+"],
    "BTN":  ["TT+", "AJs+", "AQo+"],
    "SB":   ["88+", "ATs+", "AJo+", "KQs"],
}
SHOVE_15_RAW = {
    "UTG":  ["66+", "A8s+", "A5s", "KJs+", "ATo+", "KQo"],
    "UTG1": ["66+", "A8s+", "A5s", "KJs+", "ATo+", "KQo"],
    "UTG2": ["66+", "A8s+", "A5s", "KJs+", "ATo+", "KQo"],
    "MP":   ["55+", "A2s+", "KTs+", "QJs", "JTs", "ATo+", "KJo+"],
    "HJ":   ["44+", "A2s+", "K9s+", "Q9s+", "J9s+", "T9s", "98s", "87s", "A8o+", "KJo+", "QJo"],
    "CO":   ["22+", "A2s+", "K7s+", "Q8s+", "J8s+", "T8s+", "97s+", "87s", "76s", "65s",
             "A5o+", "K9o+", "QTo+", "JTo"],
    "BTN":  ["22+", "A2s+", "K5s+", "Q7s+", "J7s+", "T7s+", "96s+", "86s+", "75s+", "64s+", "54s",
             "A2o+", "K8o+", "Q9o+", "J9o+", "T9o"],
    "SB":   ["22+", "A2s+", "K4s+", "Q6s+", "J7s+", "T7s+", "96s+", "86s+", "75s+", "65s", "54s",
             "A2o+", "K7o+", "Q8o+", "J8o+", "T8o+", "98o"],
}

# Resteal (3-bet all-in) vs RFI @15bb. Chave = (hero, villain).
# Inclui os pares representativos (REPRESENTATIVE_VILLAIN) + spots do MD p/ Consulta.
RESTEAL_15 = {
    # vs UTG (tight) — poucos spots, range forte
    ("MP",  "UTG"): ["TT+", "AKs", "AQs", "AKo"],
    ("HJ",  "UTG"): ["TT+", "AJs+", "AQo+"],
    # vs MP
    ("HJ",  "MP"):  ["88+", "ATs+", "KJs+", "AJo+", "KQo"],
    # vs HJ
    ("CO",  "HJ"):  ["66+", "A9s+", "A5s", "KTs+", "QJs", "AJo+", "KQo"],
    ("SB",  "HJ"):  ["66+", "A8s+", "A5s", "K9s+", "QTs+", "JTs", "ATo+", "KJo+"],
    # vs CO
    ("BTN", "CO"):  ["22+", "A2s+", "K9s+", "Q9s+", "J9s+", "T9s", "98s", "87s", "ATo+", "KJo+", "QJo"],
    # vs BTN (mais largo — alvo preferencial)
    ("SB",  "BTN"): ["22+", "A2s+", "K8s+", "Q8s+", "J8s+", "T8s+", "97s+", "87s", "76s", "65s",
                     "A7o+", "K9o+", "QTo+", "JTo"],
    ("BB",  "BTN"): ["22+", "A2s+", "K7s+", "Q8s+", "J8s+", "T8s+", "97s+", "86s+", "76s", "65s",
                     "A5o+", "K9o+", "QTo+", "JTo"],
    # vs SB (blind war)
    ("BB",  "SB"):  ["22+", "A2s+", "K5s+", "Q7s+", "J7s+", "T7s+", "96s+", "86s+", "75s+", "65s", "54s",
                     "A2o+", "K7o+", "Q9o+", "J9o+", "T9o"],
}

# Quais spots de resteal NÃO vêm direto do MD (são adaptados) — marcados como derivados
RESTEAL_15_DERIVED = {("HJ", "UTG"), ("HJ", "MP"), ("CO", "HJ"), ("SB", "BTN"),
                      ("BB", "SB")}

REPRESENTATIVE_VILLAIN = {
    "UTG1": "UTG", "UTG2": "UTG", "MP": "UTG",
    "HJ": "MP", "CO": "HJ", "BTN": "CO", "SB": "BTN", "BB": "BTN",
}

ALL_POS = ["UTG", "UTG1", "UTG2", "MP", "HJ", "CO", "BTN", "SB", "BB"]


def build_10bb():
    positions = {}
    for pos in ALL_POS:
        entry = {"RFI": [], "vs_RFI": {}, "vs_3bet": {}}
        if pos in SHOVE_10:
            entry["_RFI_shove"] = expand(SHOVE_10[pos])
        positions[pos] = entry
    # BB defende vs shove (call)
    for villain, hands in CALL_10.items():
        positions["BB"]["vs_RFI"][villain] = {"call": expand(hands), "3bet": [], "shove": []}
    return {
        "stack": "10bb",
        "mode": "sng",
        "source": "Reg Life SnG — Open Shove Short Stack (push/fold ~10bb). Fonte: 04-open-shove-short.md.",
        "_notes": "Push/fold puro. _RFI_shove = range de all-in por posição. BB defende via vs_RFI.{villain}.call. Sem mini-raise (RFI vazio), sem resteal.",
        "positions": positions,
        "_derived_spots": {"vs_RFI": [], "vs_3bet": [],
                           "note": "Ranges de shove/call diretos do PDF Reg Life (Open Shove Short Stack)."},
    }


def build_15bb():
    positions = {}
    for pos in ALL_POS:
        entry = {"RFI": [], "vs_RFI": {}, "vs_3bet": {}}
        if pos in RAISE_15:
            raise_h = expand(RAISE_15[pos])
            shove_h = diff(expand(SHOVE_15_RAW[pos]), raise_h)
            entry["RFI"] = raise_h
            entry["_RFI_shove"] = shove_h
        positions[pos] = entry
    derived = []
    for (hero, villain), hands in RESTEAL_15.items():
        positions[hero]["vs_RFI"][villain] = {"shove": expand(hands), "call": [], "3bet": []}
        if (hero, villain) in RESTEAL_15_DERIVED:
            derived.append(f"{hero} vs {villain}")
    return {
        "stack": "15bb",
        "mode": "sng",
        "source": "Reg Life SnG — Open Raise Short Stack + Resteal (~15bb). Fontes: 02-open-raise-short.md, 05-resteal.md.",
        "_notes": "Fragmentação: RFI = mini-raise premium (induz), _RFI_shove = médias (fold equity), fold = resto. vs_RFI = resteal (3-bet all-in) — bucket shove; call/3bet vazios (push/fold).",
        "positions": positions,
        "_derived_spots": {"vs_RFI": derived, "vs_3bet": [],
                           "note": "Spots de resteal adaptados (não-fonte direta do PDF) ficam listados em vs_RFI."},
    }


# Trims do open p/ 30bb (~5% menor que 75bb), removendo o fundo do range.
TRIM_30 = {
    "BTN": ["J7o", "T7o", "K6o", "Q9o", "98o", "53s"],
    "CO":  ["K2s", "K3s", "K4s", "K5s", "64s", "54s", "86s", "75s"],
    "SB":  ["K9o", "Q9o", "J9o", "T9o"],
}


def build_30bb():
    with open(SRC_75, "r", encoding="utf-8") as f:
        data = json.load(f)
    data["stack"] = "30bb"
    data["source"] = ("Reg Life SnG — transição Middle Game (~30bb). Open ~5% menor que 75bb "
                      "(fonte: 02-open-raise-short.md). vs_RFI/vs_3bet herdados do 75bb.")
    data["_notes"] = ("Transição middle game. Mesmo esquema do 75bb (RFI + vs_RFI 3bet/call + vs_3bet 4bet/call), "
                      "com open ~5% mais tight nas posições late. Sem fragmentação shove (isso é 10/15bb).")
    for pos, trims in TRIM_30.items():
        rfi = data["positions"].get(pos, {}).get("RFI", [])
        data["positions"][pos]["RFI"] = diff(rfi, trims)
    if "_target_pct" in data:
        # ajusta levemente as metas das posições late
        for pos in TRIM_30:
            if pos in data["_target_pct"]:
                data["_target_pct"][pos] = round(pct(data["positions"][pos]["RFI"]))
    return data


def report(tag, data):
    print(f"\n=== {tag} ===")
    for pos, entry in data["positions"].items():
        bits = []
        if entry.get("RFI"):
            bits.append(f"RFI={pct(entry['RFI']):.1f}%")
        if entry.get("_RFI_shove"):
            bits.append(f"shove={pct(entry['_RFI_shove']):.1f}%")
        vr = entry.get("vs_RFI") or {}
        for v, b in vr.items():
            if b.get("shove"):
                bits.append(f"resteal vs {v}={pct(b['shove']):.1f}%")
            if b.get("call"):
                bits.append(f"call vs {v}={pct(b['call']):.1f}%")
        if bits:
            print(f"  {pos:>4}: " + "  ".join(bits))


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    files = {
        "ranges_10bb.json": build_10bb(),
        "ranges_15bb.json": build_15bb(),
        "ranges_30bb.json": build_30bb(),
    }
    for fname, data in files.items():
        path = os.path.join(OUT_DIR, fname)
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        report(fname, data)
        print(f"  -> escrito {path}")


if __name__ == "__main__":
    main()
