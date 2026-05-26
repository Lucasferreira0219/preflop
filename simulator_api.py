import simulator_engine as engine
import stats_engine as stats

_current_question = None


class SimulatorApi:
    def new_question(self, player_count=9, stack_bb=None, focus_pos=None, focus_scenario=None):
        global _current_question
        q = engine.generate_question(
            player_count=int(player_count),
            stack_bb=int(stack_bb) if stack_bb else None,
            focus_pos=focus_pos or None,
            focus_scenario=focus_scenario or None,
        )
        if q is None:
            return {'error': 'Não foi possível gerar uma pergunta.'}
        _current_question = q
        # Não envia os buckets pro frontend (evita "cola")
        return {
            'pos':         q['pos'],
            'scenario':    q['scenario'],
            'hand':        q['hand'],
            'stack':       q['stack'],
            'villain_pos': q.get('villain_pos'),
        }

    def submit_answer(self, user_action: str):
        global _current_question
        if _current_question is None:
            return {'error': 'Nenhuma pergunta ativa.'}

        result = engine.check_answer(_current_question, user_action)
        _current_question['user_action'] = user_action

        stats.record(_current_question, result)

        result['buckets']        = _current_question['buckets']
        result['stats']          = _basic_stats(stats.summary())
        result['correct_action'] = result['correct']
        return result

    def get_stats(self):
        return _basic_stats(stats.summary())

    def reset_stats(self):
        stats.reset()
        return _basic_stats(stats.summary())

    def get_analytics(self, from_ts=None, to_ts=None):
        """Análise completa com filtro opcional por janela de tempo (Unix s)."""
        return stats.summary(
            int(from_ts) if from_ts else None,
            int(to_ts)   if to_ts   else None,
        )

    def get_improvement(self, window_days=7):
        """Compara últimos N dias vs N dias anteriores."""
        return stats.improvement(int(window_days))


def _basic_stats(s):
    return {
        'total':       s.get('total', 0),
        'correct':     s.get('correct', 0),
        'wrong':       s.get('wrong', 0),
        'pct':         s.get('pct', 0),
        'streak':      s.get('streak', 0),
        'best_streak': s.get('best_streak', 0),
    }
