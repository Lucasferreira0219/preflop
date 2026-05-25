import json
import os

RANGES_DIR = os.path.join(os.path.dirname(__file__), "ranges")

STACK_PROFILES = [
    (20, "ranges_20bb.json"),
    (35, "ranges_35bb.json"),
    (50, "ranges_50bb.json"),
    (100, "ranges_100bb.json"),
]

# Vilão representativo para cada posição do hero (para o cenário genérico "alguém apostou")
REPRESENTATIVE_VILLAIN = {
    "UTG1": "UTG",
    "UTG2": "UTG",
    "MP":   "UTG",
    "HJ":   "MP",
    "CO":   "HJ",
    "BTN":  "CO",
    "SB":   "BTN",
    "BB":   "BTN",
}

# Vilão representativo para "3betaram minha aposta"
REPRESENTATIVE_3BET = {
    "UTG":  "BB",
    "UTG1": "BB",
    "UTG2": "BB",
    "MP":   "BB",
    "HJ":   "BB",
    "CO":   "BTN",
    "BTN":  "BB",
    "SB":   "BB",
}

_cache = {}


def _load(filename):
    if filename not in _cache:
        path = os.path.join(RANGES_DIR, filename)
        try:
            with open(path, "r", encoding="utf-8") as f:
                _cache[filename] = json.load(f)
        except (OSError, json.JSONDecodeError) as e:
            print(f"[ranges] Falha ao carregar {filename}: {e}")
            _cache[filename] = {"positions": {}}
    return _cache[filename]


def warm_cache():
    """Pré-carrega todos os perfis de stack — chamado no startup."""
    for _, fname in STACK_PROFILES:
        _load(fname)
    return len(_cache)


def _pick_file(stack_bb: int) -> str:
    stack_bb = max(10, min(stack_bb, 100))
    best = STACK_PROFILES[0][1]
    best_dist = abs(stack_bb - STACK_PROFILES[0][0])
    for pivot, fname in STACK_PROFILES[1:]:
        dist = abs(stack_bb - pivot)
        if dist < best_dist:
            best_dist = dist
            best = fname
    return best


def _find_vs_rfi(positions, my_pos, villain_pos):
    """Tenta encontrar vs_RFI direto; fallback para BB com mesmo villain."""
    pos_data = positions.get(my_pos, {})
    result = pos_data.get("vs_RFI", {}).get(villain_pos)
    if result:
        return result
    # Fallback: usa BB vs mesmo villain (range conservador representativo)
    bb_data = positions.get("BB", {})
    return bb_data.get("vs_RFI", {}).get(villain_pos)


def _find_vs_3bet(positions, my_pos, villain_pos):
    pos_data = positions.get(my_pos, {})
    return pos_data.get("vs_3bet", {}).get(villain_pos)


class Api:
    def get_range(self, my_pos: str, scenario: str, stack_bb: int):
        """
        scenario: 'RFI' | 'vs_RFI' | 'vs_3bet'
        """
        fname = _pick_file(stack_bb)
        data = _load(fname)
        positions = data.get("positions", {})
        pos_data = positions.get(my_pos, {})

        if scenario == "RFI":
            hands = pos_data.get("RFI", [])
            return {
                "scenario": "RFI",
                "my_pos": my_pos,
                "stack": stack_bb,
                "buckets": {"raise": hands},
            }

        if scenario == "vs_RFI":
            villain = REPRESENTATIVE_VILLAIN.get(my_pos, "UTG")
            vs_rfi = _find_vs_rfi(positions, my_pos, villain)
            if vs_rfi:
                return {
                    "scenario": "vs_RFI",
                    "my_pos": my_pos,
                    "stack": stack_bb,
                    "buckets": {
                        "3bet": vs_rfi.get("3bet", []),
                        "call": vs_rfi.get("call", []),
                    },
                }

        if scenario == "vs_3bet":
            villain = REPRESENTATIVE_3BET.get(my_pos, "BB")
            vs_3bet = _find_vs_3bet(positions, my_pos, villain)
            if vs_3bet:
                return {
                    "scenario": "vs_3bet",
                    "my_pos": my_pos,
                    "stack": stack_bb,
                    "buckets": {
                        "4bet": vs_3bet.get("4bet", []),
                        "call": vs_3bet.get("call", []),
                    },
                }

        return {"error": f"Sem dados para {my_pos} / {scenario}", "buckets": {}}
