"""API das mãos importadas do PokerStars."""
import hands_engine as he


class HandsApi:
    def import_hands(self, text: str, mode: str = None):
        """Recebe o conteúdo de um .txt do PokerStars, avalia e salva o que for novo."""
        if not text or not isinstance(text, str):
            return {'error': 'Arquivo vazio ou inválido.'}
        return he.import_text(text, mode or he.GRADE_MODE)

    def get_hands_summary(self, tournament_id: str = None):
        """Estatísticas agregadas das mãos importadas."""
        return he.summary(tournament_id or None)
