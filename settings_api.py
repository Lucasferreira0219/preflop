"""API de Configurações / Manutenção PKE.

Reprocessa torneios usando as mãos JÁ salvas (não reimporta, não apaga nada):
roda o PKE atual sobre o raw_text do hand history e regrava nota/leaks/versão.
"""
from __future__ import annotations

import time

import hands_engine as he
import tournaments_engine as te
from pke import version as pkever


def _now_iso() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%S", time.localtime())


class SettingsApi:
    # ── status ───────────────────────────────────────────────────────────────────
    def pke_status(self) -> dict:
        pv, rv = pkever.PKE_VERSION, pkever.rules_version()
        counts = te.pke_counts(pv, rv)
        with_hands = set(he.tids_with_hands())
        analyzed_ids = set(te.tournament_ids(only_analyzed=True))
        not_analyzed = len(with_hands - analyzed_ids)
        return {
            "pke_version": pv,
            "rules_version": rv,
            "ranges_version": pkever.ranges_version(),
            "rules_updated_at": pkever.rules_updated_at(),
            "last_reprocess_at": te.get_meta("last_reprocess_at"),
            "tournaments_total": counts["tournaments_total"],
            "with_hand_history": len(with_hands),
            "without_hand_history": max(0, counts["tournaments_total"] - len(with_hands)),
            "pke_analyzed": counts["pke_analyzed"],
            "pke_outdated": counts["pke_outdated"],
            "pke_not_analyzed": not_analyzed,
        }

    # ── reprocessamento ────────────────────────────────────────────────────────────
    def _scope_tids(self, scope: str) -> list[str]:
        with_hands = he.tids_with_hands()
        if scope == "last":
            last = he.last_analyzed_tid()
            return [last] if last and last in with_hands else (with_hands[-1:] if with_hands else [])
        if scope == "not_analyzed":
            analyzed = set(te.tournament_ids(only_analyzed=True))
            return [t for t in with_hands if t not in analyzed]
        # all | with_hands → todos com hand history (só esses dá pra analisar no PKE)
        return with_hands

    def reprocess_pke(self, scope: str = "all", recalculate_sessions: bool = True) -> dict:
        started = _now_iso()
        t0 = time.time()
        tids = self._scope_tids(scope or "all")
        processed = updated = skipped = failed = 0
        errors = []
        for tid in tids:
            try:
                rep = he.analyze_tournament(tid)  # re-parseia raw + roda PKE atual + persiste
                processed += 1
                if rep.get("maos_criticas", 0) > 0:
                    updated += 1
                else:
                    skipped += 1
            except Exception as e:  # nunca aborta o lote; reporta a falha
                failed += 1
                errors.append({"tournament_id": tid, "motivo": str(e)[:200],
                               "acao_sugerida": "reimportar o hand history desse torneio"})
        result = {
            "scope": scope,
            "processed": processed, "updated": updated, "skipped": skipped, "failed": failed,
            "errors": errors,
            "started_at": started, "finished_at": _now_iso(),
            "elapsed_s": round(time.time() - t0, 2),
        }
        if recalculate_sessions:
            result["sessions"] = self.recalculate_sessions()
        te.set_meta("last_reprocess_at", result["finished_at"])
        te.set_meta("last_reprocess_result", _json(result))
        return result

    def recalculate_sessions(self) -> dict:
        """Recalcula agregados por dia/sessão. As sessões são derivadas ao vivo dos
        torneios (tournaments_engine.sessions), então isto confirma/recomputa e
        devolve a contagem de dias — sem alterar resultado financeiro."""
        try:
            days = te.sessions({})
            return {"recalculated": True, "days": len(days)}
        except Exception as e:
            return {"recalculated": False, "error": str(e)[:200]}


def _json(obj) -> str:
    import json
    try:
        return json.dumps(obj, ensure_ascii=False)
    except (TypeError, ValueError):
        return "{}"
