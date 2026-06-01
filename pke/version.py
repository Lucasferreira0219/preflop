"""Versões do PKE (best-effort) — usadas para detectar análises desatualizadas.

- PKE_VERSION: versão do motor/algoritmo (bump manual quando muda lógica).
- rules_version(): versão das regras (campo de rules.json, fallback no schema).
- ranges_version(): best-effort por mtime dos arquivos de range.
"""
from __future__ import annotations

import json
import os
import time

# 0.4.0 — camada de tolerância estratégica (linhas alternativas / hero_action_quality):
# premium short-stack vs open não é mais punido por shovar; call/trap = avançada.
PKE_VERSION = "0.4.0"

_BASE = os.path.dirname(os.path.abspath(__file__))
_ROOT = os.path.dirname(_BASE)
_RULES = os.path.join(_BASE, "rules.json")
_RANGES_DIR = os.path.join(_ROOT, "ranges", "sng")


def _mtime_date(path: str) -> str | None:
    try:
        return time.strftime("%Y-%m-%d", time.localtime(os.path.getmtime(path)))
    except OSError:
        return None


def rules_version() -> str:
    """Versão das regras: campo 'version' do rules.json, senão schema_version,
    senão a data de modificação do arquivo."""
    try:
        with open(_RULES, "r", encoding="utf-8") as f:
            doc = json.load(f)
        if doc.get("version"):
            return str(doc["version"])
        return f"schema{doc.get('schema_version', 1)}"
    except (OSError, ValueError):
        return _mtime_date(_RULES) or "unknown"


def ranges_version() -> str:
    """Best-effort: data de modificação mais recente entre os arquivos de range."""
    latest = 0.0
    try:
        for fn in os.listdir(_RANGES_DIR):
            if fn.endswith(".json"):
                latest = max(latest, os.path.getmtime(os.path.join(_RANGES_DIR, fn)))
    except OSError:
        return "unknown"
    return time.strftime("%Y-%m-%d", time.localtime(latest)) if latest else "unknown"


def rules_updated_at() -> str | None:
    return _mtime_date(_RULES)
