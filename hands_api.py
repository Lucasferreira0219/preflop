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

    def analyze_tournament(self, tournament_id: str):
        """Relatório do PokerKnowledgeEngine para um torneio (notas, leaks, treino)."""
        if not tournament_id:
            return {'error': 'tournament_id obrigatório.'}
        return he.analyze_tournament(tournament_id)

    def study_overview(self):
        """Resumo da Home: último torneio analisado, média e top leaks."""
        return he.study_overview()

    def all_critical_hands(self, only_errors: bool = True, limit: int = 200):
        """Todas as mãos críticas (erros) de todos os torneios, piores primeiro."""
        return he.all_critical_hands(limit=limit, only_errors=only_errors)
