"""KnowledgeBase: carrega regras canônicas (rules.json), ranges (ranges/sng/*.json)
e glossário (universal.json). Faz o bucket de stack para o range mais próximo.

Fonte única da verdade: o motor NUNCA inventa range — só lê destes arquivos.
"""
from __future__ import annotations

import json
import os

_BASE = os.path.dirname(os.path.abspath(__file__))
_ROOT = os.path.dirname(_BASE)
_RANGES_DIR = os.path.join(_ROOT, "ranges", "sng")
_INSIGHTS = os.path.join(_ROOT, "data", "insights")

# Buckets de stack disponíveis nos ranges de SNG.
STACK_BUCKETS = [10, 15, 30, 75]


def _load_json(path: str) -> dict:
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


class KnowledgeBase:
    def __init__(self) -> None:
        self.rules_doc = _load_json(os.path.join(_BASE, "rules.json"))
        self.rules = self.rules_doc["rules"]
        self._rules_by_id = {r["id"]: r for r in self.rules}
        self._ranges: dict[int, dict] = {}
        for bb in STACK_BUCKETS:
            self._ranges[bb] = _load_json(os.path.join(_RANGES_DIR, f"ranges_{bb}bb.json"))
        try:
            self.glossary = _load_json(os.path.join(_INSIGHTS, "universal.json")).get("glossary", {})
        except OSError:
            self.glossary = {}

    # ── regras ────────────────────────────────────────────────────────────────
    def rule(self, rule_id: str) -> dict | None:
        return self._rules_by_id.get(rule_id)

    def rules_version(self) -> int:
        return self.rules_doc.get("schema_version", 0)

    # ── ranges ──────────────────────────────────────────────────────────────────
    def bucket_for(self, eff_bb: float) -> int:
        """Bucket de stack mais próximo (clamp nos limites)."""
        eff_bb = max(STACK_BUCKETS[0], min(eff_bb, STACK_BUCKETS[-1]))
        return min(STACK_BUCKETS, key=lambda b: abs(b - eff_bb))

    def position_data(self, eff_bb: float, pos: str) -> dict:
        bucket = self.bucket_for(eff_bb)
        return self._ranges[bucket].get("positions", {}).get(pos, {})

    def rfi_range(self, eff_bb: float, pos: str) -> list[str]:
        return self.position_data(eff_bb, pos).get("RFI") or []

    def shove_range(self, pos: str) -> list[str]:
        # push/fold curto: sempre o grid de 10bb
        return self._ranges[10].get("positions", {}).get(pos, {}).get("_RFI_shove") or []

    def vs_rfi(self, eff_bb: float, pos: str, villain: str) -> dict:
        return (self.position_data(eff_bb, pos).get("vs_RFI") or {}).get(villain, {})

    def range_ref(self, eff_bb: float, pos: str, key: str) -> str:
        return f"ranges/sng/ranges_{self.bucket_for(eff_bb)}bb.json#positions.{pos}.{key}"


# instância única reaproveitada (carrega os JSON uma vez)
_kb: KnowledgeBase | None = None


def kb() -> KnowledgeBase:
    global _kb
    if _kb is None:
        _kb = KnowledgeBase()
    return _kb
