"""API das mãos importadas do PokerStars."""
import hands_engine as he


class HandsApi:
    def import_hands(self, text: str, mode: str = None, user_id: int = 1):
        """Recebe o conteúdo de um .txt do PokerStars, avalia e salva o que for novo."""
        if not text or not isinstance(text, str):
            return {'error': 'Arquivo vazio ou inválido.'}
        return he.import_text(text, mode or he.GRADE_MODE, user_id=user_id)

    def get_hands_summary(self, tournament_id: str = None, user_id: int = 1):
        """Estatísticas agregadas das mãos importadas."""
        return he.summary(tournament_id or None, user_id=user_id)

    def analyze_tournament(self, tournament_id: str, user_id: int = 1):
        """Relatório do PokerKnowledgeEngine para um torneio (notas, leaks, treino)."""
        if not tournament_id:
            return {'error': 'tournament_id obrigatório.'}
        return he.analyze_tournament(tournament_id, user_id=user_id)

    def study_overview(self, user_id: int = 1):
        """Resumo da Home: último torneio analisado, média e top leaks."""
        return he.study_overview(user_id=user_id)

    def all_critical_hands(self, only_errors: bool = True, limit: int = 200, user_id: int = 1):
        """Todas as mãos críticas (erros) de todos os torneios, piores primeiro."""
        return he.all_critical_hands(limit=limit, only_errors=only_errors, user_id=user_id)
