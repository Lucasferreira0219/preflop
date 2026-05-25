"""
Persistência de estatísticas em SQLite.

Tabela `attempts` guarda cada mão jogada com timestamp pra análise por
período. Aggregations são feitas em SQL pra escalar.
"""
import os
import json
import time
import sqlite3
from contextlib import contextmanager

_BASE     = os.path.dirname(os.path.abspath(__file__))
DATA_DIR  = os.path.join(_BASE, "data")
DB_PATH   = os.path.join(DATA_DIR, "preflop.db")
LEGACY_JS = os.path.join(DATA_DIR, "user_stats.json")


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
        CREATE TABLE IF NOT EXISTS attempts (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            ts          INTEGER NOT NULL,
            hand        TEXT    NOT NULL,
            pos         TEXT    NOT NULL,
            scenario    TEXT    NOT NULL,
            stack       INTEGER NOT NULL,
            villain_pos TEXT,
            answered    TEXT    NOT NULL,
            correct     TEXT    NOT NULL,
            is_correct  INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_attempts_ts       ON attempts(ts);
        CREATE INDEX IF NOT EXISTS idx_attempts_pos      ON attempts(pos);
        CREATE INDEX IF NOT EXISTS idx_attempts_scenario ON attempts(scenario);
        CREATE INDEX IF NOT EXISTS idx_attempts_stack    ON attempts(stack);
        CREATE INDEX IF NOT EXISTS idx_attempts_hand     ON attempts(hand);

        CREATE TABLE IF NOT EXISTS meta (
            key   TEXT PRIMARY KEY,
            value TEXT
        );
        """)


def _migrate_legacy():
    """Importa best_streak do user_stats.json antigo, se existir."""
    if not os.path.exists(LEGACY_JS):
        return
    try:
        with open(LEGACY_JS, 'r', encoding='utf-8') as f:
            old = json.load(f)
    except (OSError, json.JSONDecodeError):
        return
    bs = int(old.get('best_streak', 0) or 0)
    if bs <= 0:
        return
    with _conn() as c:
        row = c.execute("SELECT value FROM meta WHERE key='best_streak'").fetchone()
        cur = int(row['value']) if row else 0
        if bs > cur:
            c.execute("INSERT OR REPLACE INTO meta(key, value) VALUES('best_streak', ?)",
                      (str(bs),))


_init_schema()
_migrate_legacy()


# ── Escrita ──────────────────────────────────────────────────────────────────

def record(question, result):
    """Insere um attempt e atualiza best_streak se necessário."""
    ts = int(time.time())
    is_correct = 1 if result.get('result') == 'correct' else 0
    with _conn() as c:
        c.execute("""
            INSERT INTO attempts
                (ts, hand, pos, scenario, stack, villain_pos, answered, correct, is_correct)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            ts,
            question.get('hand', ''),
            question.get('pos', ''),
            question.get('scenario', ''),
            int(question.get('stack', 0)),
            question.get('villain_pos'),
            question.get('user_action', '?'),
            result.get('correct', '?'),
            is_correct,
        ))
        # Atualiza best_streak
        streak = _current_streak(c)
        row = c.execute("SELECT value FROM meta WHERE key='best_streak'").fetchone()
        best = int(row['value']) if row else 0
        if streak > best:
            c.execute("INSERT OR REPLACE INTO meta(key, value) VALUES('best_streak', ?)",
                      (str(streak),))


def reset():
    """Limpa toda a base (zera attempts e meta)."""
    with _conn() as c:
        c.execute("DELETE FROM attempts")
        c.execute("DELETE FROM meta")


# ── Leitura ──────────────────────────────────────────────────────────────────

def _current_streak(c):
    """Conta acertos consecutivos a partir do attempt mais recente."""
    streak = 0
    for r in c.execute("SELECT is_correct FROM attempts ORDER BY ts DESC, id DESC LIMIT 1000"):
        if r['is_correct'] == 1:
            streak += 1
        else:
            break
    return streak


def _best_streak(c):
    row = c.execute("SELECT value FROM meta WHERE key='best_streak'").fetchone()
    return int(row['value']) if row else 0


def _where_clause(from_ts, to_ts):
    parts, params = ["1=1"], []
    if from_ts is not None:
        parts.append("ts >= ?"); params.append(int(from_ts))
    if to_ts is not None:
        parts.append("ts <= ?"); params.append(int(to_ts))
    return " AND ".join(parts), params


def summary(from_ts=None, to_ts=None):
    """Estatísticas completas, opcionalmente filtradas por janela de tempo."""
    where, params = _where_clause(from_ts, to_ts)
    out = {
        'from_ts':         from_ts,
        'to_ts':           to_ts,
        'total':           0,
        'correct':         0,
        'wrong':           0,
        'pct':             0,
        'streak':          0,
        'best_streak':     0,
        'by_position':     {},
        'by_scenario':     {},
        'by_stack':        {},
        'last_mistakes':   [],
        'top_wrong_hands': [],
        'daily':           [],
    }

    with _conn() as c:
        row = c.execute(
            f"SELECT COUNT(*) AS total, COALESCE(SUM(is_correct),0) AS correct "
            f"FROM attempts WHERE {where}", params
        ).fetchone()
        total   = row['total'] or 0
        correct = row['correct'] or 0
        out['total']   = total
        out['correct'] = correct
        out['wrong']   = total - correct
        out['pct']     = round(correct / total * 100) if total > 0 else 0
        out['streak']      = _current_streak(c)
        out['best_streak'] = _best_streak(c)

        if total == 0:
            return out

        for r in c.execute(
            f"SELECT pos, COUNT(*) AS total, COALESCE(SUM(is_correct),0) AS correct "
            f"FROM attempts WHERE {where} GROUP BY pos", params
        ):
            out['by_position'][r['pos']] = {'total': r['total'], 'correct': r['correct']}

        for r in c.execute(
            f"SELECT scenario, COUNT(*) AS total, COALESCE(SUM(is_correct),0) AS correct "
            f"FROM attempts WHERE {where} GROUP BY scenario", params
        ):
            out['by_scenario'][r['scenario']] = {'total': r['total'], 'correct': r['correct']}

        for r in c.execute(
            f"SELECT stack, COUNT(*) AS total, COALESCE(SUM(is_correct),0) AS correct "
            f"FROM attempts WHERE {where} GROUP BY stack ORDER BY stack", params
        ):
            out['by_stack'][str(r['stack'])] = {'total': r['total'], 'correct': r['correct']}

        for r in c.execute(
            f"SELECT ts, hand, pos, scenario, stack, answered, correct "
            f"FROM attempts WHERE {where} AND is_correct = 0 "
            f"ORDER BY ts DESC, id DESC LIMIT 20", params
        ):
            out['last_mistakes'].append({
                'ts':       r['ts'],
                'hand':     r['hand'],
                'pos':      r['pos'],
                'scenario': r['scenario'],
                'stack':    r['stack'],
                'answered': r['answered'],
                'correct':  r['correct'],
            })

        for r in c.execute(
            f"SELECT hand, COUNT(*) AS cnt FROM attempts "
            f"WHERE {where} AND is_correct = 0 "
            f"GROUP BY hand ORDER BY cnt DESC LIMIT 10", params
        ):
            out['top_wrong_hands'].append([r['hand'], r['cnt']])

        # Série diária (timezone local do SQLite)
        for r in c.execute(
            f"SELECT DATE(ts, 'unixepoch', 'localtime') AS day, "
            f"       COUNT(*) AS total, COALESCE(SUM(is_correct),0) AS correct "
            f"FROM attempts WHERE {where} "
            f"GROUP BY day ORDER BY day", params
        ):
            out['daily'].append({
                'day':     r['day'],
                'total':   r['total'],
                'correct': r['correct'],
                'pct':     round(r['correct'] / r['total'] * 100) if r['total'] else 0,
            })

    return out


def improvement(window_days=7):
    """Compara janela recente vs janela anterior (mesma duração)."""
    now = int(time.time())
    win = int(window_days) * 86400
    recent_from, recent_to = now - win, now
    prev_from, prev_to     = now - 2 * win, recent_from

    recent = summary(recent_from, recent_to)
    prev   = summary(prev_from,   prev_to)

    def delta_by(group):
        result = {}
        rg = recent.get(group, {})
        pg = prev.get(group, {})
        for k in set(rg.keys()) | set(pg.keys()):
            r = rg.get(k, {'total': 0, 'correct': 0})
            p = pg.get(k, {'total': 0, 'correct': 0})
            r_pct = round(r['correct'] / r['total'] * 100) if r['total'] else None
            p_pct = round(p['correct'] / p['total'] * 100) if p['total'] else None
            delta = (r_pct - p_pct) if (r_pct is not None and p_pct is not None) else None
            result[k] = {
                'recent_pct':     r_pct,
                'previous_pct':   p_pct,
                'recent_total':   r['total'],
                'previous_total': p['total'],
                'delta':          delta,
            }
        return result

    delta_overall = None
    if recent['total'] > 0 and prev['total'] > 0:
        delta_overall = recent['pct'] - prev['pct']

    return {
        'window_days':  int(window_days),
        'recent_from':  recent_from,
        'recent_to':    recent_to,
        'previous_from': prev_from,
        'previous_to':   prev_to,
        'recent':       {'total': recent['total'], 'correct': recent['correct'], 'pct': recent['pct']},
        'previous':     {'total': prev['total'],   'correct': prev['correct'],   'pct': prev['pct']},
        'delta_pct':    delta_overall,
        'by_position':  delta_by('by_position'),
        'by_scenario':  delta_by('by_scenario'),
        'by_stack':     delta_by('by_stack'),
    }
