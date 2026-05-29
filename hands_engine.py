"""
Armazenamento e avaliação de mãos importadas do PokerStars.

- Persiste no mesmo SQLite do app (data/preflop.db), tabela `imported_hands`.
- Deduplica pelo nº único da mão (PRIMARY KEY + INSERT OR IGNORE).
- Dá "nota" aos spots que batem com o curso reaproveitando simulator_engine
  (_get_buckets / _correct_action / _spot_source). Spots fora do modelo
  (limp, multiway, pós-flop) são salvos sem nota.

O curso cobre só SnG, então a avaliação usa mode='sng'.
"""
import os
import time
import sqlite3
from contextlib import contextmanager

import simulator_engine as se
from hand_history_parser import parse_text

_BASE    = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(_BASE, "data")
DB_PATH  = os.path.join(DATA_DIR, "preflop.db")

GRADE_MODE = "sng"  # o curso só cobre SnG


@contextmanager
def _conn():
    os.makedirs(DATA_DIR, exist_ok=True)
    c = sqlite3.connect(DB_PATH)
    c.row_factory = sqlite3.Row
    try:
        yield c
        c.commit()
    except Exception:
        c.rollback()
        raise
    finally:
        c.close()


def _init_schema():
    with _conn() as c:
        c.executescript("""
        CREATE TABLE IF NOT EXISTS imported_hands (
            hand_id        TEXT PRIMARY KEY,
            tournament_id  TEXT,
            played_at      TEXT,
            imported_ts    INTEGER NOT NULL,
            hero           TEXT,
            hero_pos       TEXT,
            hero_cards     TEXT,
            stack_bb       INTEGER,
            scenario       TEXT,
            hero_action    TEXT,
            course_action  TEXT,
            is_correct     INTEGER,   -- 1/0; NULL quando sem nota
            gradeable      INTEGER,   -- 1/0
            source         TEXT,      -- curso / derivado / sem_material
            motivo         TEXT,
            raw_text       TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_ih_tournament ON imported_hands(tournament_id);
        CREATE INDEX IF NOT EXISTS idx_ih_pos        ON imported_hands(hero_pos);
        CREATE INDEX IF NOT EXISTS idx_ih_scenario   ON imported_hands(scenario);
        CREATE INDEX IF NOT EXISTS idx_ih_correct    ON imported_hands(is_correct);
        """)


_init_schema()


# ── Avaliação (nota pelo curso) ───────────────────────────────────────────────

# Como traduzir a ação do herói pro vocabulário dos buckets do curso, por cenário.
_RAISE_AS = {'RFI': 'raise', 'vs_RFI': '3bet', 'vs_3bet': '4bet'}


def _map_hero_action(scenario, action, all_in):
    if action in ('fold', 'call'):
        return action
    if action == 'raise':
        if all_in:
            return 'shove'
        return _RAISE_AS.get(scenario, 'raise')
    return action


def grade(h, mode=GRADE_MODE):
    """Devolve (course_action, is_correct, source).

    is_correct = None quando o spot não dá nota (fora do modelo, sem range,
    posição/stack faltando).
    """
    if not h.get('gradeable') or h.get('hero_pos') is None \
       or h.get('stack_bb') is None or not h.get('hero_cards'):
        return (None, None, None)

    pos, scenario, stack = h['hero_pos'], h['scenario'], h['stack_bb']
    buckets = se._get_buckets(pos, scenario, stack, mode)
    if not buckets:
        return (None, None, None)

    course = se._correct_action(h['hero_cards'], buckets)
    source = se._spot_source(pos, scenario, stack, mode)
    hero_mapped = _map_hero_action(scenario, h['hero_action'], h.get('hero_all_in'))
    is_correct = 1 if hero_mapped == course else 0
    return (course, is_correct, source)


# ── Importação ────────────────────────────────────────────────────────────────

def import_text(text, mode=GRADE_MODE):
    """Lê o conteúdo de um .txt, avalia e salva o que for novo.

    Retorna um resumo: total lido, novas, duplicadas, com nota, acertos/erros,
    fora do modelo, e a lista das mãos novas (pra exibir na tela).
    """
    parsed = parse_text(text)
    ts = int(time.time())

    summary = {
        'parsed':      len(parsed),
        'new':         0,
        'duplicates':  0,
        'graded':      0,
        'correct':     0,
        'wrong':       0,
        'not_modeled': 0,
        'hands':       [],
    }

    with _conn() as c:
        for h in parsed:
            course, is_correct, source = grade(h, mode)
            if is_correct is None:
                summary['not_modeled'] += 1

            cur = c.execute("""
                INSERT OR IGNORE INTO imported_hands
                    (hand_id, tournament_id, played_at, imported_ts, hero,
                     hero_pos, hero_cards, stack_bb, scenario, hero_action,
                     course_action, is_correct, gradeable, source, motivo, raw_text)
                VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
            """, (
                h['hand_id'], h['tournament_id'], h['played_at'], ts, h['hero'],
                h['hero_pos'], h['hero_cards'], h['stack_bb'], h['scenario'],
                h['hero_action'], course, is_correct,
                1 if h['gradeable'] else 0, source, h['motivo'], h['raw'],
            ))

            if cur.rowcount == 0:
                summary['duplicates'] += 1
                continue

            summary['new'] += 1
            if is_correct is not None:
                summary['graded'] += 1
                summary['correct' if is_correct else 'wrong'] += 1

            summary['hands'].append({
                'hand_id':       h['hand_id'],
                'tournament_id': h['tournament_id'],
                'played_at':     h['played_at'],
                'hero_pos':      h['hero_pos'],
                'hero_cards':    h['hero_cards'],
                'stack_bb':      h['stack_bb'],
                'scenario':      h['scenario'],
                'hero_action':   h['hero_action'],
                'course_action': course,
                'is_correct':    is_correct,
                'source':        source,
                'motivo':        h['motivo'],
            })

    return summary


def summary(tournament_id=None):
    """Estatísticas agregadas das mãos importadas (pro agente / tela de stats)."""
    where, params = "1=1", []
    if tournament_id:
        where, params = "tournament_id = ?", [tournament_id]
    out = {'total': 0, 'graded': 0, 'correct': 0, 'wrong': 0,
           'not_modeled': 0, 'by_position': {}}
    with _conn() as c:
        row = c.execute(
            f"SELECT COUNT(*) total, "
            f"SUM(is_correct IS NOT NULL) graded, "
            f"COALESCE(SUM(is_correct),0) correct "
            f"FROM imported_hands WHERE {where}", params).fetchone()
        out['total']  = row['total'] or 0
        out['graded'] = row['graded'] or 0
        out['correct'] = row['correct'] or 0
        out['wrong'] = out['graded'] - out['correct']
        out['not_modeled'] = out['total'] - out['graded']
        for r in c.execute(
            f"SELECT hero_pos, COUNT(*) total, "
            f"SUM(is_correct IS NOT NULL) graded, COALESCE(SUM(is_correct),0) correct "
            f"FROM imported_hands WHERE {where} GROUP BY hero_pos", params):
            out['by_position'][r['hero_pos']] = {
                'total': r['total'], 'graded': r['graded'], 'correct': r['correct']}
    return out
