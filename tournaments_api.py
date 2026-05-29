"""API REST da planilha de torneios."""
import tournaments_engine as te


class TournamentsApi:
    def import_tournaments(self, text: str):
        if not text or not isinstance(text, str):
            return {"error": "Arquivo vazio ou inválido."}
        return te.import_text(text)

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
