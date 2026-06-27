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
import tournament_analysis as ta
import tournaments_engine as te
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
        # Migração defensiva: colunas do PokerKnowledgeEngine (avaliação por mão).
        cols = {r["name"] for r in c.execute("PRAGMA table_info(imported_hands)")}
        for col, decl in [
            ("is_critical", "INTEGER"), ("pke_outcome", "TEXT"), ("pke_score", "INTEGER"),
            ("pke_recommended", "TEXT"), ("pke_rule", "TEXT"), ("pke_error_type", "TEXT"),
            ("pke_gravity", "TEXT"), ("pke_explain", "TEXT"),
            # número original do PokerStars (tournament_id agora é composto id_dia)
            ("ps_tournament_id", "TEXT"),
        ]:
            if col not in cols:
                c.execute(f"ALTER TABLE imported_hands ADD COLUMN {col} {decl}")


_init_schema()


def _store_pke(c, hand_id: str, analysis: dict) -> None:
    """Salva o resultado do PKE junto da mão (só mãos críticas têm decision)."""
    d = (analysis.get("decision") or {})
    c.execute("""
        UPDATE imported_hands SET
          is_critical = ?, pke_outcome = ?, pke_score = ?, pke_recommended = ?,
          pke_rule = ?, pke_error_type = ?, pke_gravity = ?, pke_explain = ?
        WHERE hand_id = ?
    """, (
        1 if analysis.get("is_critical") else 0,
        analysis.get("outcome"),
        d.get("nota"),
        d.get("acao_recomendada"),
        " | ".join(d.get("regra_pdf") or []) or None,
        d.get("tipo_erro"),
        d.get("gravidade"),
        d.get("resumo"),
        hand_id,
    ))


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
                    (hand_id, tournament_id, ps_tournament_id, played_at, imported_ts, hero,
                     hero_pos, hero_cards, stack_bb, scenario, hero_action,
                     course_action, is_correct, gradeable, source, motivo, raw_text)
                VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
            """, (
                h['hand_id'], h['tournament_id'], h.get('ps_tournament_id'),
                h['played_at'], ts, h['hero'],
                h['hero_pos'], h['hero_cards'], h['stack_bb'], h['scenario'],
                h['hero_action'], course, is_correct,
                1 if h['gradeable'] else 0, source, h['motivo'], h['raw'],
            ))

            if cur.rowcount == 0:
                summary['duplicates'] += 1
                continue

            # PokerKnowledgeEngine: filtra mão crítica e avalia (estratégia fica no PKE)
            try:
                analysis = ta.screen_and_analyze(h)
                _store_pke(c, h['hand_id'], analysis)
            except Exception as e:  # nunca quebrar o import por causa da análise
                analysis = None
                if os.environ.get("PKE_DEBUG"):
                    print(f"[PKE] erro ao analisar {h['hand_id']}: {e}")

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


_LAST_TID = None  # último torneio analisado (pro modo "Meus leaks")


def last_analyzed_tid():
    return _LAST_TID


def analyze_tournament(tournament_id):
    """Relatório PKE do torneio: re-parseia o raw_text das mãos, filtra críticas,
    avalia no PKE e agrega (médias, piores/melhores, leaks, fase, treino).

    Re-parsear o raw garante contexto completo (opener, all-in, resultado) sem
    depender de colunas extras no banco.
    """
    with _conn() as c:
        rows = c.execute(
            "SELECT hand_id, raw_text FROM imported_hands "
            "WHERE tournament_id = ? AND raw_text IS NOT NULL ORDER BY played_at ASC",
            (tournament_id,),
        ).fetchall()

    analyzed = []
    for r in rows:
        parsed = parse_text(r["raw_text"])
        if not parsed:
            continue
        res = ta.screen_and_analyze(parsed[0])
        if res.get("is_critical"):
            analyzed.append(res)

    report = ta.build_report(tournament_id, analyzed)
    report["maos_no_torneio"] = len(rows)
    global _LAST_TID
    _LAST_TID = tournament_id  # vira a fonte do modo "Meus leaks"
    _persist_pke_summary(tournament_id, report)
    return report


def _persist_pke_summary(tournament_id, report):
    """Grava o resumo denormalizado do PKE na linha do torneio (Meus Torneios)."""
    leaks = report.get("leaks") or []
    try:
        from pke import version as pkever
        te.set_pke_summary(tournament_id, {
            "pke_analyzed": True,
            # NOTA PRINCIPAL = ponderada por impacto (não a média simples)
            "pke_score_avg": report.get("pke_score"),
            "pke_critical_hands": report.get("pke_critical_hands") or report.get("maos_criticas"),
            "pke_grave_errors": report.get("pke_grave_errors"),
            "pke_main_leak": (leaks[0].get("id") if leaks else None),
            "pke_leaks": leaks[:3],
            "pke_last_analyzed_at": int(time.time()),
            # versionamento da análise (detectar "análise antiga")
            "pke_analysis_version": pkever.PKE_VERSION,
            "pke_rules_version": pkever.rules_version(),
        })
    except Exception:  # persistência é aditiva; nunca quebrar a análise
        if os.environ.get("PKE_DEBUG"):
            import traceback; traceback.print_exc()


def latest_tid_with_hands():
    """Torneio mais recente que tem mãos importadas (fallback da Home quando o
    processo ainda não analisou nada nesta sessão)."""
    with _conn() as c:
        row = c.execute(
            "SELECT tournament_id FROM imported_hands "
            "WHERE tournament_id IS NOT NULL AND raw_text IS NOT NULL "
            "ORDER BY imported_ts DESC, played_at DESC LIMIT 1").fetchone()
    return row["tournament_id"] if row else None


def study_overview():
    """Resumo leve para a Home: último torneio analisado + leaks + média.
    Reaproveita analyze_tournament (que também fixa o _LAST_TID p/ "Meus leaks")."""
    tid = _LAST_TID or latest_tid_with_hands()
    if not tid:
        return {"tem_torneio": False, "last_tid": None, "media_notas": None,
                "erros_graves": 0, "leaks": [], "tem_revisao": False}
    rep = analyze_tournament(tid)
    return {
        "tem_torneio": True,
        "last_tid": tid,
        "media_notas": rep.get("media_notas"),
        "erros_graves": rep.get("erros_graves", 0),
        "leaks": (rep.get("leaks") or [])[:3],
        "tem_revisao": (rep.get("erros_graves", 0) or 0) > 0,
    }


def tids_with_hands():
    """tournament_ids distintos que têm hand history salva (imported_hands)."""
    with _conn() as c:
        rows = c.execute(
            "SELECT DISTINCT tournament_id FROM imported_hands "
            "WHERE tournament_id IS NOT NULL").fetchall()
    return [r["tournament_id"] for r in rows]


def leak_weights(tournament_id=None):
    """Pesos de treino derivados dos leaks. Por padrão usa o ÚLTIMO torneio
    analisado (modo "Meus leaks"); sem isso, agrega todas as mãos importadas.
    Mapeia leak.exercicio -> peso (mais leaks = mais treino). {} se não houver."""
    tid = tournament_id or _LAST_TID
    with _conn() as c:
        if tid:
            rows = c.execute(
                "SELECT raw_text FROM imported_hands "
                "WHERE tournament_id = ? AND raw_text IS NOT NULL", (tid,)).fetchall()
        else:
            rows = c.execute(
                "SELECT raw_text FROM imported_hands WHERE raw_text IS NOT NULL").fetchall()
    analyzed = []
    for r in rows:
        parsed = parse_text(r["raw_text"])
        if parsed:
            res = ta.screen_and_analyze(parsed[0])
            if res.get("is_critical"):
                analyzed.append(res)
    weights = {}
    for l in ta.detect_leaks(analyzed):
        cat = l.get("exercicio")
        if cat:
            weights[cat] = weights.get(cat, 0) + max(15, l["frequencia_hits"] * 8)
    return weights


# ── Análise RFI (aba "Todas") ─────────────────────────────────────────────────

def _action_before_hero_text(h: dict) -> str:
    """Texto descritivo das ações ANTES do herói."""
    scenario = h.get("scenario", "outro")
    opener_pos = h.get("opener_pos")
    villain_action = h.get("villain_action")
    n_limpers = h.get("n_limpers") or 0
    opener_size_bb = h.get("opener_size_bb")

    if scenario == "RFI":
        return "Todos foldaram"
    if scenario == "vs_RFI":
        if opener_pos:
            size_str = f" {opener_size_bb}bb" if opener_size_bb else ""
            act_str = "shovou" if villain_action == "shove" else "abriu"
            return f"{opener_pos} {act_str}{size_str}"
        return "Alguém abriu antes"
    if scenario == "vs_3bet":
        return "Raise e 3-bet antes"
    if n_limpers > 0:
        pos_str = f" ({opener_pos})" if opener_pos and n_limpers == 1 else ""
        return f"{n_limpers} limp{'s' if n_limpers > 1 else ''}{pos_str}"
    return "—"


def _hero_action_display(h: dict) -> str:
    """Texto display formatado da ação do herói."""
    action = h.get("hero_action")
    all_in = h.get("hero_all_in", False)
    size_bb = h.get("hero_action_size_bb")
    if action is None:
        return "—"
    if action == "fold":
        return "fold"
    if action == "call":
        return f"call {size_bb}bb" if size_bb else "call"
    if action == "raise":
        if all_in:
            return "shove (all-in)"
        return f"raise {size_bb}bb" if size_bb else "raise"
    return action


def _classify_spot(h: dict) -> tuple:
    """Retorna (is_rfi_spot, spot_type)."""
    scenario = h.get("scenario", "outro")
    hero_pos = h.get("hero_pos")
    n_limpers = h.get("n_limpers") or 0

    if scenario == "RFI":
        if hero_pos == "SB":
            return True, "sb_first_in"
        return True, "RFI"
    if scenario == "vs_RFI":
        if hero_pos == "BB":
            return False, "bb_defense"
        return False, "vs_raise"
    if scenario == "vs_3bet":
        return False, "vs_raise"
    if n_limpers > 0:
        return False, "vs_limp"
    if h.get("hero_action") is None:
        return False, "postflop_only"
    return False, "unknown"


def _rfi_evaluate(h: dict) -> tuple:
    """Para spot RFI, retorna (recommended, verdict, severity, reason)."""
    pos = h.get("hero_pos")
    stack_bb = h.get("stack_bb")
    hero_cards = h.get("hero_cards")
    hero_action = h.get("hero_action")
    hero_all_in = h.get("hero_all_in", False)

    if not pos or not hero_cards or stack_bb is None or hero_action is None:
        return None, "not_evaluated", None, "Dados insuficientes para avaliar."

    buckets = se._get_buckets(pos, "RFI", stack_bb, GRADE_MODE)
    if not buckets:
        return None, "not_evaluated", None, f"Sem material do curso para {pos} RFI com {stack_bb}bb."

    recommended = se._correct_action(hero_cards, buckets)
    if recommended is None:
        return None, "not_evaluated", None, "Mão não mapeada no material do curso."

    is_push_fold = stack_bb <= 10
    is_short = stack_bb <= 15

    if hero_action == "fold":
        hero_mapped = "fold"
    elif hero_action in ("raise", "call"):
        hero_mapped = "shove" if hero_all_in else "raise"
    else:
        return recommended, "not_evaluated", None, "Ação não reconhecida."

    if recommended == "raise":
        if hero_mapped == "raise":
            return recommended, "correct", "none", f"{hero_cards} está no range de abertura de {pos} com {stack_bb}bb."
        if hero_mapped == "shove":
            if is_push_fold:
                return recommended, "correct", "none", f"Com {stack_bb}bb (zona push/fold), open shove equivale a raise. Correto."
            if is_short:
                return recommended, "minor_error", "minor", f"Com {stack_bb}bb, raise pequeno (2bb) é preferível ao open shove."
            return recommended, "minor_error", "minor", f"Com {stack_bb}bb, prefira raise 2–2.5bb ao invés de open shove."
        # hero_mapped == "fold"
        return recommended, "minor_error", "minor", f"{hero_cards} está no range de abertura de {pos} com {stack_bb}bb. Foldar foi apertado demais."

    if recommended == "fold":
        if hero_mapped == "fold":
            return recommended, "correct", "none", f"{hero_cards} é fold de {pos} com {stack_bb}bb. Correto."
        return recommended, "major_error", "major", f"{hero_cards} não está no range de abertura de {pos} com {stack_bb}bb. Abertura muito ampla."

    if recommended == "shove":
        if hero_mapped == "shove":
            return recommended, "correct", "none", f"Open shove correto com {hero_cards} em {pos} com {stack_bb}bb."
        if hero_mapped == "raise":
            return recommended, "minor_error", "minor", f"Com {stack_bb}bb, a ação correta é open shove. Raise pequeno cria spots difíceis."
        return recommended, "major_error", "major", f"{hero_cards} é mão de open shove em {pos} com {stack_bb}bb. Foldar perde EV significativo."

    return recommended, "not_evaluated", None, None


_NON_RFI_REASON = {
    "bb_defense": "Defesa de Big Blind — não é spot RFI.",
    "vs_raise": "Havia raise antes do herói — não é spot RFI.",
    "vs_limp": "Havia limp(s) antes — spot de iso-raise, não RFI puro.",
    "postflop_only": "Herói não tomou decisão pré-flop voluntária.",
    "unknown": "Spot não classificado.",
}


def tournament_all_hands(tournament_id: str) -> dict:
    """Todas as mãos do torneio com análise de range RFI (foco pré-flop)."""
    with _conn() as c:
        rows = c.execute(
            "SELECT hand_id, raw_text, played_at FROM imported_hands "
            "WHERE tournament_id = ? AND raw_text IS NOT NULL ORDER BY played_at ASC",
            (tournament_id,),
        ).fetchall()

    maos = []
    for i, r in enumerate(rows, 1):
        try:
            parsed_list = parse_text(r["raw_text"])
            if not parsed_list:
                continue
            h = parsed_list[0]
        except Exception:
            continue

        is_rfi, spot_type = _classify_spot(h)

        if is_rfi:
            recommended, verdict, severity, reason = _rfi_evaluate(h)
        else:
            recommended = None
            verdict = "not_evaluated"
            severity = None
            reason = _NON_RFI_REASON.get(spot_type, "Não é spot RFI.")

        maos.append({
            "hand_id": r["hand_id"],
            "hand_number": i,
            "blinds": h.get("blinds"),
            "ante": None,
            "players_count": h.get("n_players"),
            "hero_position": h.get("hero_pos"),
            "hero_cards": h.get("hero_cards"),
            "hero_stack_bb": h.get("stack_bb"),
            "effective_stack_bb": h.get("effective_stack_bb"),
            "action_before_hero": _action_before_hero_text(h),
            "hero_preflop_action": _hero_action_display(h),
            "is_rfi_spot": is_rfi,
            "spot_type": spot_type,
            "recommended_action": recommended,
            "verdict": verdict,
            "severity": severity,
            "reason": reason,
            "played_at": r["played_at"],
        })

    return {"maos": maos, "total": len(maos)}


def all_critical_hands(limit: int = 200, only_errors: bool = True) -> dict:
    """Todas as mãos críticas já analisadas, ordenadas das piores para as melhores.

    only_errors=True retorna só erros (pke_outcome='erro');
    only_errors=False inclui também coolers e decisões boas críticas.
    """
    with _conn() as c:
        if only_errors:
            rows = c.execute(
                "SELECT raw_text, tournament_id, played_at FROM imported_hands "
                "WHERE is_critical = 1 AND pke_outcome = 'erro' AND raw_text IS NOT NULL "
                "ORDER BY pke_score ASC, played_at DESC LIMIT ?", (limit,)
            ).fetchall()
        else:
            rows = c.execute(
                "SELECT raw_text, tournament_id, played_at FROM imported_hands "
                "WHERE is_critical = 1 AND raw_text IS NOT NULL "
                "ORDER BY pke_score ASC, played_at DESC LIMIT ?", (limit,)
            ).fetchall()

    maos = []
    for r in rows:
        parsed = parse_text(r["raw_text"])
        if not parsed:
            continue
        res = ta.screen_and_analyze(parsed[0])
        if not res.get("is_critical"):
            continue
        if only_errors and res.get("outcome") not in ("erro",):
            continue
        view = ta._hand_view(res)
        view["tournament_id"] = r["tournament_id"]
        view["played_at"] = r["played_at"]
        maos.append(view)

    maos.sort(key=lambda h: h.get("nota") if h.get("nota") is not None else 10)
    return {"maos": maos, "total": len(maos)}


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
