import simulator_engine as engine
import stats_engine as stats
from insights_api import InsightsApi

_current_question = None
_insights = InsightsApi()


class SimulatorApi:
    def new_question(self, player_count=9, stack_bb=None, focus_pos=None, focus_scenario=None, mode=None):
        global _current_question
        q = engine.generate_question(
            player_count=int(player_count),
            stack_bb=int(stack_bb) if stack_bb else None,
            focus_pos=focus_pos or None,
            focus_scenario=focus_scenario or None,
            mode=mode or engine.DEFAULT_MODE,
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
            'mode':        q.get('mode'),
            'villain_pos': q.get('villain_pos'),
            'phase':       q.get('phase'),
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
        result['insights']       = _build_insights(_current_question, result['correct'])
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


def _build_insights(q, correct):
    """Monta o payload de insights contextual pra tela de resultado.
    Degrada silenciosamente (retorna None) se algo falhar — o frontend tem fallback."""
    try:
        ins = _insights.get_insights(
            q.get('mode', 'mtt'), q['stack'], q['pos'],
            q['scenario'], q.get('villain_pos'),
        )
    except Exception as exc:  # pragma: no cover
        print(f"[simulator] insights falhou: {exc}")
        return None

    actions = ins.get('actions') or {}
    action_info = actions.get(correct)
    # vs_RFI shove em short stack é "resteal" — usa a descrição específica
    if (correct == 'shove' and q['scenario'] == 'vs_RFI'
            and 12 < int(q['stack']) <= 18 and actions.get('resteal')):
        action_info = actions['resteal']

    return {
        'spot':              ins.get('spot'),
        'spot_derived':      ins.get('spot_derived'),
        'scenario_derived':  ins.get('scenario_derived'),
        'universal_derived': ins.get('universal_derived'),
        'phase':             ins.get('phase'),
        'phase_explicit':    ins.get('phase_explicit'),
        'stack_context':     ins.get('stack_context'),
        'position_mistakes': ins.get('position_mistakes'),
        'open_pct':          ins.get('open_pct'),
        'action':            action_info,
    }


def _basic_stats(s):
    return {
        'total':       s.get('total', 0),
        'correct':     s.get('correct', 0),
        'wrong':       s.get('wrong', 0),
        'pct':         s.get('pct', 0),
        'streak':      s.get('streak', 0),
        'best_streak': s.get('best_streak', 0),
    }
