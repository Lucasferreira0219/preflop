"""
Caderno de estudo — anotações persistidas.

Tabelas em data/preflop.db (mesmo SQLite do app):
  - notes        (1 linha por anotação, PK = note_id)
  - note_links   (links N-para-1 de uma nota para mãos/torneios/regras/leaks)

Anotações tipadas (nota livre, análise de mão, review de torneio, leak, conceito,
plano de estudo, dúvida, erro recorrente, mental game, sessão). Templates de mão/
torneio/leak são montados aqui (markdown PT-BR) a partir de dados que o frontend já
tem (ReportHand/ReportLeak/relatório), sem tocar no motor PKE.
"""
import os
import json
import time
import uuid
import sqlite3
from contextlib import contextmanager

_BASE    = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(_BASE, "data")
DB_PATH  = os.path.join(DATA_DIR, "preflop.db")

NOTE_TYPES = {
    "free", "hand_analysis", "tournament_review", "leak", "concept",
    "study_plan", "question", "recurring_error", "mental_game", "grind_session",
}
REVIEW_STATUSES = {"not_reviewed", "reviewed", "needs_work", "mastered"}
SOURCES = {
    "manual", "exported_from_hand", "exported_from_tournament",
    "exported_from_leak", "exported_from_ask", "exported_from_training",
}

# Colunas estruturadas de poker (além de title/type/content/flags).
_POKER_COLS = [
    "tournament_id", "hand_id", "session_id", "spot", "phase", "hero_cards",
    "position", "effective_stack_bb", "decision_label", "impact_label",
    "leak_key", "pke_rule_id", "pke_rule_page", "pke_recommendation",
    "hero_action", "result",
]


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
        CREATE TABLE IF NOT EXISTS notes (
            note_id        TEXT PRIMARY KEY,
            title          TEXT,
            type           TEXT NOT NULL DEFAULT 'free',
            content        TEXT,
            tags_json      TEXT,                          -- JSON array de strings
            pinned         INTEGER NOT NULL DEFAULT 0,
            archived       INTEGER NOT NULL DEFAULT 0,
            favorite       INTEGER NOT NULL DEFAULT 0,
            review_status  TEXT NOT NULL DEFAULT 'not_reviewed',
            source         TEXT NOT NULL DEFAULT 'manual',
            -- contexto de poker (opcional)
            tournament_id  TEXT,
            hand_id        TEXT,
            session_id     TEXT,
            spot           TEXT,
            phase          TEXT,
            hero_cards     TEXT,
            position       TEXT,
            effective_stack_bb REAL,
            decision_label TEXT,
            impact_label   TEXT,
            leak_key       TEXT,
            pke_rule_id    TEXT,
            pke_rule_page  TEXT,
            pke_recommendation TEXT,
            hero_action    TEXT,
            result         TEXT,
            created_at     INTEGER NOT NULL,
            updated_at     INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_notes_hand   ON notes(hand_id);
        CREATE INDEX IF NOT EXISTS idx_notes_tour   ON notes(tournament_id);
        CREATE INDEX IF NOT EXISTS idx_notes_type   ON notes(type);
        CREATE INDEX IF NOT EXISTS idx_notes_upd    ON notes(updated_at);

        CREATE TABLE IF NOT EXISTS note_links (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            note_id     TEXT NOT NULL,
            entity_type TEXT NOT NULL,   -- tournament | hand | rule | leak | training_session
            entity_id   TEXT NOT NULL,
            label       TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_notelinks_note ON note_links(note_id);
        """)


_init_schema()


# ── helpers ────────────────────────────────────────────────────────────────────

def _now() -> int:
    return int(time.time())


def _parse_tags(s) -> list:
    if not s:
        return []
    try:
        v = json.loads(s)
        return v if isinstance(v, list) else []
    except (ValueError, TypeError):
        return []


def _row_to_public(row: dict, links=None) -> dict:
    d = dict(row)
    d["tags"] = _parse_tags(d.pop("tags_json", None))
    d["pinned"] = bool(d.get("pinned"))
    d["archived"] = bool(d.get("archived"))
    d["favorite"] = bool(d.get("favorite"))
    if links is not None:
        d["links"] = links
    return d


def _links_for(c, note_id) -> list:
    rows = c.execute(
        "SELECT entity_type, entity_id, label FROM note_links WHERE note_id = ? ORDER BY id",
        (note_id,),
    ).fetchall()
    return [dict(r) for r in rows]


# ── tags automáticas (§11) ──────────────────────────────────────────────────────

_SPOT_TAGS = {
    "push_fold": "push/fold", "resteal_short": "resteal", "vs_open": "vs open",
    "vs_limp": "limp punish", "rfi": "RFI", "bb_defense": "BB defense",
    "heads_up": "HU", "bubble_call": "call shove", "blind_war_sb": "short stack",
}
_PHASE_TAGS = {"bubble": "bolha", "itm": "ICM", "heads_up": "HU", "3handed": "HU"}
_LEAK_TAGS = {
    "nao_shova_short": "push/fold", "call_em_vez_de_3bet": "vs open",
    "passivo_resteal": "resteal", "nao_pune_limp": "limp punish",
    "abre_fraco_ep": "RFI", "folda_btn_em_range": "short stack",
    "passivo_hu": "HU",
}


def _auto_tags(spot=None, phase=None, decision_label=None, leak_key=None,
              eff_bb=None, extra=None) -> list:
    tags = set(extra or [])
    if spot and spot in _SPOT_TAGS:
        tags.add(_SPOT_TAGS[spot])
    if phase and phase in _PHASE_TAGS:
        tags.add(_PHASE_TAGS[phase])
    if leak_key and leak_key in _LEAK_TAGS:
        tags.add(_LEAK_TAGS[leak_key])
    if decision_label in ("major_error", "severe_error"):
        tags.add("erro grave")
        tags.add("revisar")
    if eff_bb is not None and eff_bb <= 15:
        tags.add("short stack")
    return sorted(tags)


# ── CRUD ─────────────────────────────────────────────────────────────────────────

def _insert(c, data: dict) -> str:
    nid = data.get("note_id") or uuid.uuid4().hex
    ts = _now()
    cols = ["note_id", "title", "type", "content", "tags_json", "pinned",
            "archived", "favorite", "review_status", "source", *_POKER_COLS,
            "created_at", "updated_at"]
    vals = {
        "note_id": nid,
        "title": (data.get("title") or "").strip() or "Sem título",
        "type": data.get("type") if data.get("type") in NOTE_TYPES else "free",
        "content": data.get("content") or "",
        "tags_json": json.dumps(data.get("tags") or [], ensure_ascii=False),
        "pinned": 1 if data.get("pinned") else 0,
        "archived": 1 if data.get("archived") else 0,
        "favorite": 1 if data.get("favorite") else 0,
        "review_status": data.get("review_status") if data.get("review_status") in REVIEW_STATUSES else "not_reviewed",
        "source": data.get("source") if data.get("source") in SOURCES else "manual",
        "created_at": ts, "updated_at": ts,
    }
    for k in _POKER_COLS:
        vals[k] = data.get(k)
    placeholders = ", ".join("?" for _ in cols)
    c.execute(f"INSERT INTO notes ({', '.join(cols)}) VALUES ({placeholders})",
              [vals[k] for k in cols])
    return nid


def create_note(data: dict) -> dict:
    with _conn() as c:
        nid = _insert(c, data or {})
        for lk in (data or {}).get("links") or []:
            c.execute(
                "INSERT INTO note_links (note_id, entity_type, entity_id, label) VALUES (?,?,?,?)",
                (nid, lk.get("entity_type"), lk.get("entity_id"), lk.get("label")),
            )
        row = c.execute("SELECT * FROM notes WHERE note_id = ?", (nid,)).fetchone()
        return _row_to_public(row, _links_for(c, nid))


def get_note(note_id: str) -> dict | None:
    if not note_id:
        return None
    with _conn() as c:
        row = c.execute("SELECT * FROM notes WHERE note_id = ?", (note_id,)).fetchone()
        if not row:
            return None
        return _row_to_public(row, _links_for(c, note_id))


_EDITABLE = {"title", "type", "content", "review_status"}
_FLAGS = {"pinned", "archived", "favorite"}


def update_note(note_id: str, patch: dict) -> dict | None:
    if not note_id:
        return None
    patch = patch or {}
    sets, params = [], []
    for k in _EDITABLE:
        if k in patch:
            sets.append(f"{k} = ?")
            params.append(patch[k])
    for k in _FLAGS:
        if k in patch:
            sets.append(f"{k} = ?")
            params.append(1 if patch[k] else 0)
    if "tags" in patch:
        sets.append("tags_json = ?")
        params.append(json.dumps(patch["tags"] or [], ensure_ascii=False))
    for k in _POKER_COLS:
        if k in patch:
            sets.append(f"{k} = ?")
            params.append(patch[k])
    if not sets:
        return get_note(note_id)
    sets.append("updated_at = ?")
    params.append(_now())
    params.append(note_id)
    with _conn() as c:
        c.execute(f"UPDATE notes SET {', '.join(sets)} WHERE note_id = ?", params)
        row = c.execute("SELECT * FROM notes WHERE note_id = ?", (note_id,)).fetchone()
        if not row:
            return None
        return _row_to_public(row, _links_for(c, note_id))


def delete_note(note_id: str, hard: bool = False) -> dict:
    if not note_id:
        return {"error": "note_id obrigatório."}
    with _conn() as c:
        if hard:
            c.execute("DELETE FROM note_links WHERE note_id = ?", (note_id,))
            cur = c.execute("DELETE FROM notes WHERE note_id = ?", (note_id,))
            return {"deleted": cur.rowcount, "hard": True}
        c.execute("UPDATE notes SET archived = 1, updated_at = ? WHERE note_id = ?",
                  (_now(), note_id))
        return {"archived": 1}


_SORTS = {
    "recent": "updated_at DESC",
    "recent_created": "created_at DESC",
    "oldest": "created_at ASC",
    "edited": "updated_at DESC",
    "favorite": "favorite DESC, updated_at DESC",
    "type": "type ASC, updated_at DESC",
    "tournament": "tournament_id ASC, updated_at DESC",
}


def list_notes(filters: dict | None = None) -> list:
    f = filters or {}
    where, params = ["1=1"], []
    # arquivadas: por padrão escondidas, a não ser que peça archived=True
    if f.get("archived"):
        where.append("archived = 1")
    else:
        where.append("archived = 0")
    if f.get("type"):
        where.append("type = ?"); params.append(f["type"])
    if f.get("review_status"):
        where.append("review_status = ?"); params.append(f["review_status"])
    if f.get("source"):
        where.append("source = ?"); params.append(f["source"])
    if f.get("tournament_id"):
        where.append("tournament_id = ?"); params.append(f["tournament_id"])
    if f.get("hand_id"):
        where.append("hand_id = ?"); params.append(f["hand_id"])
    if f.get("spot"):
        where.append("spot = ?"); params.append(f["spot"])
    if f.get("phase"):
        where.append("phase = ?"); params.append(f["phase"])
    if f.get("leak_key"):
        where.append("leak_key = ?"); params.append(f["leak_key"])
    if f.get("pke_rule_id"):
        where.append("pke_rule_id = ?"); params.append(f["pke_rule_id"])
    if f.get("favorite"):
        where.append("favorite = 1")
    if f.get("pinned"):
        where.append("pinned = 1")
    if f.get("from_date"):
        where.append("created_at >= ?"); params.append(int(f["from_date"]))
    if f.get("to_date"):
        where.append("created_at <= ?"); params.append(int(f["to_date"]))
    if f.get("q"):
        where.append("(LOWER(title) LIKE ? OR LOWER(content) LIKE ?)")
        like = f"%{str(f['q']).lower()}%"
        params += [like, like]
    if f.get("tag"):
        where.append("tags_json LIKE ?")
        params.append(f"%\"{f['tag']}\"%")
    order = _SORTS.get(f.get("sort") or "recent", _SORTS["recent"])
    sql = ("SELECT * FROM notes WHERE " + " AND ".join(where)
           + f" ORDER BY pinned DESC, {order}")
    with _conn() as c:
        rows = c.execute(sql, params).fetchall()
        return [_row_to_public(r) for r in rows]


def notes_stats() -> dict:
    with _conn() as c:
        def n(sql, p=()):
            return c.execute(sql, p).fetchone()[0]
        total = n("SELECT COUNT(*) FROM notes WHERE archived = 0")
        pinned = n("SELECT COUNT(*) FROM notes WHERE archived = 0 AND pinned = 1")
        favorite = n("SELECT COUNT(*) FROM notes WHERE archived = 0 AND favorite = 1")
        hands = n("SELECT COUNT(*) FROM notes WHERE archived = 0 AND source = 'exported_from_hand'")
        leaks = n("SELECT COUNT(*) FROM notes WHERE archived = 0 AND type = 'leak'")
        archived = n("SELECT COUNT(*) FROM notes WHERE archived = 1")
        pending = n("SELECT COUNT(*) FROM notes WHERE archived = 0 AND "
                    "review_status IN ('not_reviewed','needs_work') AND source = 'exported_from_hand'")
    return {
        "total": total, "pinned": pinned, "favorite": favorite,
        "hands_saved": hands, "leaks_noted": leaks, "archived": archived,
        "pending_review": pending,
    }


# ── templates / exportações ──────────────────────────────────────────────────────

def _line(label, value):
    return f"{label}: {value if value not in (None, '') else '—'}"


def note_from_hand(payload: dict, force: bool = False) -> dict:
    """Cria anotação 'análise de mão' a partir do ReportHand (+ tournament_id).
    Dedup: se já há nota não-arquivada com esse hand_id e not force, devolve a
    existente em {'existing': <note>}."""
    p = payload or {}
    hand_id = p.get("hand_id")
    if hand_id and not force:
        with _conn() as c:
            row = c.execute(
                "SELECT * FROM notes WHERE hand_id = ? AND archived = 0 "
                "ORDER BY updated_at DESC LIMIT 1", (hand_id,)).fetchone()
            if row:
                return {"existing": _row_to_public(row, _links_for(c, row["note_id"]))}

    pos = p.get("pos") or "?"
    cards = p.get("cards") or "?"
    spot = p.get("spot")
    fase = p.get("fase")
    bb = p.get("eff_bb")
    title = f"{pos} {cards}"
    extra = " · ".join(x for x in [spot, fase, (f"{round(bb)}bb" if bb else None)] if x)
    if extra:
        title += f" · {extra}"

    hh = p.get("hh") or {}
    content = "\n".join([
        "## Situação",
        _line("Torneio", p.get("tournament_id")),
        _line("Fase", fase),
        _line("Blinds", hh.get("blinds")),
        _line("Ante", "sim" if hh.get("ante") else "—"),
        _line("Jogadores restantes", hh.get("n_players")),
        _line("Stack Hero (bb)", hh.get("hero_stack_bb")),
        _line("Stack efetivo (bb)", bb),
        _line("Posição Hero", pos),
        _line("Vilão principal", hh.get("villain_position")),
        "",
        "## Ação da mão",
        _line("Ação antes de mim", hh.get("opener_action") or hh.get("preflop_action_summary")),
        _line("Minha ação", p.get("linha")),
        _line("Ação depois", hh.get("villain_action")),
        _line("Showdown", "sim" if hh.get("went_to_showdown") else "—"),
        _line("Resultado", "ganhou" if hh.get("hero_won") else ("perdeu" if hh.get("hero_won") is False else "—")),
        "",
        "## Minha leitura",
        "O que eu pensei na hora: ",
        "",
        "## PKE",
        _line("Recomendado", p.get("recomendado")),
        _line("Status", p.get("shown_label") or p.get("decision_label")),
        _line("Impacto", p.get("shown_impact") or p.get("impact_label")),
        _line("Regra", ", ".join(p.get("regra") or []) or "—"),
        _line("Explicação", p.get("explicacao")),
        "",
        "## Erro / Acerto",
        "O que fiz certo: ",
        "O que errei: ",
        "",
        "## Correção prática",
        "Na próxima vez, eu devo: ",
        "",
        "## Regra para memorizar",
        "- ",
        "",
        "## Treino relacionado",
        _line("Spot", spot),
        _line("Leak", p.get("leak_key")),
    ])

    rule_raw = (p.get("regra") or [None])[0]
    rule_id = rule_raw.split(" (")[0].strip() if rule_raw else None
    data = {
        "title": title, "type": "hand_analysis", "content": content,
        "source": "exported_from_hand",
        "tags": _auto_tags(spot, fase, p.get("decision_label"), p.get("leak_key"), bb),
        "tournament_id": p.get("tournament_id"), "hand_id": hand_id,
        "spot": spot, "phase": fase, "hero_cards": p.get("cards"),
        "position": pos if pos != "?" else None,
        "effective_stack_bb": bb,
        "decision_label": p.get("decision_label"), "impact_label": p.get("impact_label"),
        "leak_key": p.get("leak_key"),
        "pke_rule_id": rule_id, "pke_recommendation": p.get("recomendado"),
        "hero_action": p.get("linha"),
    }
    return create_note(data)


def note_from_tournament(payload: dict) -> dict:
    """Cria anotação 'review de torneio' a partir do resumo do relatório."""
    p = payload or {}
    title = " · ".join(x for x in [
        "Review torneio",
        p.get("played_at") or p.get("date"),
        (f"{p.get('finish_pos')}º" if p.get("finish_pos") else None),
        (f"Nota PKE {p.get('pke_score')}" if p.get("pke_score") is not None else None),
    ] if x)
    worst = p.get("worst_hand_ids") or []
    maos_md = "\n".join(f"- mão {h}" for h in worst) or "- "
    content = "\n".join([
        "## Resumo do torneio",
        _line("Resultado", p.get("result")),
        _line("Posição", p.get("finish_pos")),
        _line("Buy-in", p.get("buyin")),
        _line("Prêmio", p.get("prize")),
        _line("ROI", p.get("roi")),
        _line("Nota PKE", p.get("pke_score")),
        _line("Erros graves", p.get("erros_graves")),
        _line("Leak principal", p.get("main_leak")),
        "",
        "## Pontos positivos", "- ", "",
        "## Maiores erros", "- ", "",
        "## Mãos para revisar", maos_md, "",
        "## Leaks detectados",
        "\n".join(f"- {l}" for l in (p.get("leaks") or [])) or "- ", "",
        "## Plano de treino", "- ", "",
        "## Conclusão", "O que vou ajustar no próximo grind: ",
    ])
    data = {
        "title": title, "type": "tournament_review", "content": content,
        "source": "exported_from_tournament",
        "tags": _auto_tags(leak_key=p.get("main_leak_key"), extra=["revisar"]),
        "tournament_id": p.get("tournament_id"),
        "leak_key": p.get("main_leak_key"), "result": p.get("result"),
        "links": [{"entity_type": "hand", "entity_id": h, "label": f"Mão {h}"} for h in worst]
                 + ([{"entity_type": "tournament", "entity_id": p.get("tournament_id"),
                      "label": "Torneio"}] if p.get("tournament_id") else []),
    }
    return create_note(data)


def note_from_leak(payload: dict) -> dict:
    """Cria anotação 'leak' a partir do ReportLeak."""
    p = payload or {}
    label = p.get("label") or "Leak"
    title = f"Leak · {label}"
    exemplos = p.get("exemplos") or ([p["exemplo"]] if p.get("exemplo") else [])
    content = "\n".join([
        "## Leak",
        _line("Nome", label),
        _line("Frequência", p.get("frequencia_hits")),
        _line("Gravidade", p.get("gravidade")),
        _line("Fase", p.get("fase_predominante")),
        _line("Spot", p.get("spot")),
        "",
        "## Exemplos",
        "\n".join(f"- {e}" for e in exemplos) or "- ", "",
        "## Regra violada",
        _line("Regra", p.get("regra_violada")),
        "",
        "## Por que isso custa dinheiro", "- ", "",
        "## Correção prática",
        _line("", p.get("como_corrigir")) if p.get("como_corrigir") else "- ", "",
        "## Regra para memorizar", "- ",
    ])
    rule_raw = p.get("regra_violada")
    rule_id = rule_raw.split(" (")[0].strip() if rule_raw else None
    data = {
        "title": title, "type": "leak", "content": content,
        "source": "exported_from_leak",
        "tags": _auto_tags(p.get("spot"), p.get("fase_predominante"),
                           leak_key=p.get("id") or p.get("exercicio"), extra=["importante"]),
        "tournament_id": p.get("tournament_id"),
        "spot": p.get("spot"), "phase": p.get("fase_predominante"),
        "leak_key": p.get("exercicio") or p.get("id"), "pke_rule_id": rule_id,
    }
    return create_note(data)
