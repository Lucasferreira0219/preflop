import json
import os

_BASE = os.path.dirname(os.path.abspath(__file__))
INSIGHTS_DIR = os.path.join(_BASE, "data", "insights")
RANGES_DIR   = os.path.join(_BASE, "ranges")

_cache = {}


def _load(name):
    if name not in _cache:
        path = os.path.join(INSIGHTS_DIR, f"{name}.json")
        try:
            with open(path, "r", encoding="utf-8") as f:
                _cache[name] = json.load(f)
        except (OSError, json.JSONDecodeError) as e:
            print(f"[insights] Falha ao carregar {name}: {e}")
            _cache[name] = {}
    return _cache[name]


def _load_range_meta(mode, bucket):
    """Carrega _derived_spots do JSON de range correspondente (pra saber se um spot é derivado)."""
    key = f"_range_meta_{mode}_{bucket}"
    if key in _cache:
        return _cache[key]
    fname = f"sng/ranges_{bucket}bb.json" if mode == "sng" else f"mtt/ranges_{bucket}bb.json"
    path = os.path.join(RANGES_DIR, fname)
    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        _cache[key] = data.get("_derived_spots", {})
    except (OSError, json.JSONDecodeError):
        _cache[key] = {}
    return _cache[key]


def warm_cache():
    _load("sng")
    _load("universal")
    return len(_cache)


def _phase_for(stack):
    if stack <= 12:  return "shortstack"
    if stack <= 20:  return "late"
    if stack <= 50:  return "middle"
    return "early"


def _bucket_stack(stack):
    """Snap stack contínuo para snapshot fixo: 10, 15, 30, 75."""
    if stack <= 12: return 10
    if stack <= 22: return 15
    if stack <= 50: return 30
    return 75


def _spot_key(scenario, pos, villain, bucket):
    if scenario == "RFI":
        return f"{pos}@{bucket}"
    if scenario in ("vs_RFI", "vs_3bet") and villain:
        return f"{pos}_vs_{villain}@{bucket}"
    return None


VALID_PHASES = {"early", "middle", "late", "shortstack"}


class InsightsApi:
    def get_insights(self, mode, stack, pos=None, scenario=None, villain=None, player_count=9, phase=None):
        stack  = int(stack)
        uni    = _load("universal")
        bucket = _bucket_stack(stack)

        # MTT: só glossário + ações, sem fabricar conteúdo
        if mode != "sng":
            return {
                "mode": mode,
                "stack": stack,
                "bucket_stack": bucket,
                "phase": None,
                "phase_explicit": bool(phase),
                "spot": None,
                "scenario_derived": False,
                "spot_derived": False,
                "universal_derived": None,
                "stack_context": None,
                "position_mistakes": [],
                "open_pct": None,
                "glossary": uni.get("glossary", {}),
                "actions": uni.get("actions", {}),
            }

        sng = _load("sng")
        # Fase explícita do usuário OU derivada do stack
        phase_explicit = phase in VALID_PHASES
        phase_key      = phase if phase_explicit else _phase_for(stack)
        phase_data     = sng.get("phases", {}).get(phase_key)

        # Detectar se o spot é derivado (não fonte direta do PDF)
        range_meta     = _load_range_meta(mode, bucket)
        derived_vs_rfi  = set(range_meta.get("vs_RFI", []))
        derived_vs_3bet = set(range_meta.get("vs_3bet", []))
        spot_label = f"{pos} vs {villain}" if (pos and villain) else None
        is_derived = bool(scenario) and (
            (scenario == "vs_RFI"  and spot_label in derived_vs_rfi) or
            (scenario == "vs_3bet" and spot_label in derived_vs_3bet) or
            (scenario == "vs_3bet")  # qualquer vs_3bet hoje é heurística universal
        )

        # Spot específico (ou fallback _universal) — apenas se temos cenário definido
        spot = None
        universal_derived = None
        if scenario:
            spots    = sng.get("spots", {}).get(scenario, {})
            spot_key = _spot_key(scenario, pos, villain, bucket)
            spot     = (spots.get(spot_key) if spot_key else None) or spots.get(f"_universal@{bucket}")
            universal_derived = sng.get("spots", {}).get("_universal_derived", {}).get(f"{scenario}@{bucket}")

        stack_ctx  = sng.get("by_stack", {}).get(str(bucket))
        pos_miss   = sng.get("by_pos_common_mistakes", {}).get(pos, []) if pos else []
        open_pct   = sng.get("open_pct_by_pos", {}).get(str(bucket), {}).get(pos) if pos else None

        return {
            "mode": mode,
            "stack": stack,
            "bucket_stack": bucket,
            "phase": phase_data,
            "phase_explicit": phase_explicit,
            "spot": spot,
            "spot_derived": is_derived and spot is None,  # spot ausente E derivado
            "scenario_derived": is_derived,                # spot existe mas o range é derivado
            "universal_derived": universal_derived,        # princípios genéricos quando spot=null
            "stack_context": stack_ctx,
            "position_mistakes": pos_miss,
            "open_pct": open_pct if scenario == "RFI" else None,
            "glossary": uni.get("glossary", {}),
            "actions": uni.get("actions", {}),
        }
