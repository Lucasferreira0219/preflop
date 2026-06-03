"""API do Caderno de Estudo (anotações). Métodos finos: validam e delegam ao engine."""
import notes_engine as ne


class NotesApi:
    def list_notes(self, filters: dict | None = None):
        return ne.list_notes(filters or {})

    def get_note(self, note_id: str):
        if not note_id:
            return {"error": "note_id obrigatório."}
        n = ne.get_note(note_id)
        return n or {"error": "Anotação não encontrada."}

    def create_note(self, data: dict | None = None):
        if not isinstance(data, dict):
            return {"error": "Dados inválidos."}
        return ne.create_note(data)

    def update_note(self, note_id: str, patch: dict | None = None):
        if not note_id:
            return {"error": "note_id obrigatório."}
        n = ne.update_note(note_id, patch or {})
        return n or {"error": "Anotação não encontrada."}

    def delete_note(self, note_id: str, hard: bool = False):
        if not note_id:
            return {"error": "note_id obrigatório."}
        return ne.delete_note(note_id, hard=bool(hard))

    def note_from_hand(self, payload: dict | None = None, force: bool = False):
        if not isinstance(payload, dict):
            return {"error": "Dados da mão inválidos."}
        return ne.note_from_hand(payload, force=bool(force))

    def note_from_tournament(self, payload: dict | None = None):
        if not isinstance(payload, dict):
            return {"error": "Dados do torneio inválidos."}
        return ne.note_from_tournament(payload)

    def note_from_leak(self, payload: dict | None = None):
        if not isinstance(payload, dict):
            return {"error": "Dados do leak inválidos."}
        return ne.note_from_leak(payload)

    def notes_stats(self):
        return ne.notes_stats()
