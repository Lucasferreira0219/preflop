import json
import os

RANGES_DIR = os.path.join(os.path.dirname(__file__), "ranges")

STACK_PROFILES = {
    "mtt": [
        (20,  "mtt/ranges_20bb.json"),
        (35,  "mtt/ranges_35bb.json"),
        (50,  "mtt/ranges_50bb.json"),
        (100, "mtt/ranges_100bb.json"),
    ],
    "sng": [
        (10,  "sng/ranges_10bb.json"),
        (15,  "sng/ranges_15bb.json"),
        (30,  "sng/ranges_30bb.json"),
        (75,  "sng/ranges_75bb.json"),
    ],
}

DEFAULT_MODE = "mtt"

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
    """Pré-carrega todos os perfis de stack (todos os modos) — chamado no startup."""
    for profiles in STACK_PROFILES.values():
        for _, fname in profiles:
            _load(fname)
    return len(_cache)


def _normalize_mode(mode):
    return mode if mode in STACK_PROFILES else DEFAULT_MODE


def available_stacks(mode):
    """Lista de stacks disponíveis para o modo (ordenados)."""
    return [pivot for pivot, _ in STACK_PROFILES[_normalize_mode(mode)]]


def _pick_file(stack_bb: int, mode: str) -> str:
    profiles = STACK_PROFILES[_normalize_mode(mode)]
    pivots   = [p for p, _ in profiles]
    stack_bb = max(min(pivots), min(stack_bb, max(pivots)))
    best, best_dist = profiles[0][1], abs(stack_bb - profiles[0][0])
    for pivot, fname in profiles[1:]:
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
    def list_villains(self, my_pos: str, stack_bb: int, mode: str = DEFAULT_MODE):
        """
        Retorna {villain_pos: scenario_type} para todos os vilões com range
        cadastrado em vs_RFI ou vs_3bet desta posição/stack/modo.
        """
        fname = _pick_file(stack_bb, mode)
        data  = _load(fname)
        pos_data = data.get("positions", {}).get(my_pos, {})
        result = {}
        for villain, buckets in (pos_data.get("vs_RFI") or {}).items():
            if buckets.get("3bet") or buckets.get("call") or buckets.get("shove"):
                result[villain] = "vs_RFI"
        for villain, buckets in (pos_data.get("vs_3bet") or {}).items():
            if buckets.get("4bet") or buckets.get("call"):
                result[villain] = "vs_3bet"
        return result

    def get_range(self, my_pos: str, scenario: str, stack_bb: int, mode: str = DEFAULT_MODE, villain: str = None):
        """
        scenario: 'RFI' | 'vs_RFI' | 'vs_3bet'
        mode:     'mtt' | 'sng'
        villain:  posição explícita do vilão (opcional). Se omitido, usa REPRESENTATIVE_*.
        """
        fname = _pick_file(stack_bb, mode)
        data = _load(fname)
        positions = data.get("positions", {})
        pos_data = positions.get(my_pos, {})

        if scenario == "RFI":
            buckets = {"raise": pos_data.get("RFI", [])}
            if pos_data.get("_RFI_shove"):
                buckets["shove"] = pos_data["_RFI_shove"]
            return {
                "scenario": "RFI",
                "my_pos": my_pos,
                "stack": stack_bb,
                "buckets": buckets,
            }

        if scenario == "vs_RFI":
            villain_pos = villain or REPRESENTATIVE_VILLAIN.get(my_pos, "UTG")
            vs_rfi = _find_vs_rfi(positions, my_pos, villain_pos)
            if vs_rfi:
                buckets = {}
                if vs_rfi.get("3bet"):  buckets["3bet"]  = vs_rfi["3bet"]
                if vs_rfi.get("shove"): buckets["shove"] = vs_rfi["shove"]
                buckets["call"] = vs_rfi.get("call", [])
                return {
                    "scenario": "vs_RFI",
                    "my_pos": my_pos,
                    "villain_pos": villain_pos,
                    "stack": stack_bb,
                    "buckets": buckets,
                }
            return {"error": f"Sem range cadastrado: {my_pos} vs {villain_pos} (RFI)", "my_pos": my_pos, "villain_pos": villain_pos, "scenario": "vs_RFI", "stack": stack_bb, "buckets": {}}

        if scenario == "vs_3bet":
            villain_pos = villain or REPRESENTATIVE_3BET.get(my_pos, "BB")
            vs_3bet = _find_vs_3bet(positions, my_pos, villain_pos)
            if vs_3bet:
                return {
                    "scenario": "vs_3bet",
                    "my_pos": my_pos,
                    "villain_pos": villain_pos,
                    "stack": stack_bb,
                    "buckets": {
                        "4bet": vs_3bet.get("4bet", []),
                        "call": vs_3bet.get("call", []),
                    },
                }
            return {"error": f"Sem range cadastrado: {my_pos} vs {villain_pos} (3-bet)", "my_pos": my_pos, "villain_pos": villain_pos, "scenario": "vs_3bet", "stack": stack_bb, "buckets": {}}

        return {"error": f"Sem dados para {my_pos} / {scenario}", "buckets": {}}
