"""API REST da planilha de torneios."""
import tournaments_engine as te
import hands_engine as he


class TournamentsApi:
    def import_tournaments(self, text: str):
        if not text or not isinstance(text, str):
            return {"error": "Arquivo vazio ou inválido."}
        return te.import_text(text)

    def import_files(self, text: str):
        """Import unificado: financeiro (tournaments) + mãos (PKE) + análise.

        Reaproveita os dois parsers existentes, roda o PKE automaticamente e
        persiste o resumo na linha do torneio. Seguro para qualquer .txt.
        """
        if not text or not isinstance(text, str):
            return {"error": "Arquivo vazio ou inválido."}
        fin = te.import_text(text)                 # financeiro (cria/atualiza tournaments)
        hands = he.import_text(text)               # mãos + pke_* por mão
        tids = {t.get("tournament_id") for t in fin.get("tournaments", []) if t.get("tournament_id")}
        tids |= {h.get("tournament_id") for h in hands.get("hands", []) if h.get("tournament_id")}
        for tid in tids:
            try:
                he.analyze_tournament(tid)         # persiste resumo PKE no torneio
            except Exception:
                pass
        tournaments = [t for t in te.list_tournaments() if t["tournament_id"] in tids]
        return {
            "tournaments": tournaments,
            "hands": hands,
            "financeiro": {k: fin.get(k) for k in ("parsed", "new", "updated", "duplicates")},
            "tids": sorted(tids),
        }

    def list_tournaments(self, filters: dict | None = None):
        return te.list_tournaments(filters or {})

    def tournaments_overview(self, filters: dict | None = None):
        return te.overview(filters or {})

    def update_tournament(self, tournament_id: str,
                          prize_cents: int | None = None,
                          finish_pos: int | None = None,
                          notes: str | None = None):
        if not tournament_id:
            return {"error": "tournament_id obrigatório."}
        return te.set_prize(tournament_id, prize_cents, finish_pos, notes)

    def delete_tournament(self, tournament_id: str):
        if not tournament_id:
            return {"error": "tournament_id obrigatório."}
        return te.delete_tournament(tournament_id)

    def list_formats(self):
        return te.list_formats()

    def list_rooms(self):
        return te.list_rooms()

    def add_tournament(self, data: dict):
        if not isinstance(data, dict):
            return {"error": "Dados inválidos."}
        return te.add_manual(data)

    def tournaments_sessions(self, filters: dict | None = None):
        return te.sessions(filters or {})

    # ── Cronômetro de grind ───────────────────────────────────────────────────
    def grind_active(self):
        return te.grind_active()

    def grind_start(self):
        return te.grind_start()

    def grind_stop(self):
        return te.grind_stop()

    def grind_blocks_for_day(self, day: str):
        if not day:
            return []
        return te.grind_blocks_for_day(day)

    def delete_grind_block(self, block_id: int):
        return te.delete_grind_block(block_id)

    # ── Tipos de torneio (estruturas de payout) ───────────────────────────────
    def list_tournament_types(self):
        return te.list_tournament_types()

    def set_tournament_payout(self, type_key: str, payouts_cents: list,
                              label: str | None = None):
        if not type_key:
            return {"error": "type_key obrigatório."}
        return te.set_tournament_payout(type_key, payouts_cents or [], label)

    def delete_tournament_payout(self, type_key: str):
        if not type_key:
            return {"error": "type_key obrigatório."}
        return te.delete_tournament_payout(type_key)

    def reparse_missing(self):
        return te.reparse_missing()
