"""
Planilha de torneios — persistência e métricas.

Tabelas em data/preflop.db (mesmo SQLite do app):
  - tournaments         (1 linha por torneio jogado, PK = tournament_id)
  - tournament_payouts  (1 linha por TIPO de torneio, PK = type_key)

Tipo de torneio = (nome normalizado + buy-in + fee). Permite cadastrar UMA
estrutura de payout (lista de prêmios por posição) que se aplica a TODOS os
torneios iguais. Edição manual num torneio individual sobrescreve o payout.

Valores monetários ficam em CENTAVOS (int) pra evitar float.
"""
import os
import json
import time
import hashlib
import sqlite3
from contextlib import contextmanager

from tournament_parser import parse_text, _RE_HH_HEADER, _parse_hand_history

_BASE    = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(_BASE, "data")
DB_PATH  = os.path.join(DATA_DIR, "preflop.db")


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
        CREATE TABLE IF NOT EXISTS tournaments (
            tournament_id   TEXT PRIMARY KEY,
            played_at       TEXT,
            hero            TEXT,
            tournament_name TEXT,
            game_type       TEXT,
            format          TEXT,
            buy_in_cents    INTEGER,
            fee_cents       INTEGER,
            currency        TEXT,
            n_entries       INTEGER,
            prize_pool_cents INTEGER,
            finish_pos      INTEGER,
            prize_cents     INTEGER,
            prize_known     INTEGER NOT NULL DEFAULT 0,  -- 1 se veio do summary OU foi editado MANUALMENTE
            notes           TEXT,
            raw_text        TEXT,                          -- conteúdo bruto pra reprocessamento
            imported_ts     INTEGER NOT NULL,
            updated_ts      INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_t_played   ON tournaments(played_at);
        CREATE INDEX IF NOT EXISTS idx_t_format   ON tournaments(format);
        CREATE INDEX IF NOT EXISTS idx_t_buyin    ON tournaments(buy_in_cents);

        CREATE TABLE IF NOT EXISTS tournament_payouts (
            type_key       TEXT PRIMARY KEY,
            name           TEXT NOT NULL,
            buy_in_cents   INTEGER,
            fee_cents      INTEGER,
            format         TEXT,
            currency       TEXT,
            payouts_json   TEXT NOT NULL,   -- JSON array [pos1_cents, pos2_cents, ...]
            updated_ts     INTEGER NOT NULL
        );
        """)
        # Migração defensiva: adiciona raw_text se o banco é anterior à coluna.
        cols = {r["name"] for r in c.execute("PRAGMA table_info(tournaments)")}
        if "raw_text" not in cols:
            c.execute("ALTER TABLE tournaments ADD COLUMN raw_text TEXT")


_init_schema()


# ── Identidade de "tipo de torneio" ───────────────────────────────────────────
# Dois torneios são "iguais" quando têm o mesmo nome normalizado + buy-in + fee.
# A chave é determinística (md5 truncado) — não muda entre reinicializações.

def _type_key(name: str | None, buy_in_cents: int | None, fee_cents: int | None) -> str:
    norm = " ".join((name or "").lower().split())
    s = f"{norm}|{buy_in_cents or 0}|{fee_cents or 0}"
    return hashlib.md5(s.encode("utf-8")).hexdigest()[:16]


# ── Importação ────────────────────────────────────────────────────────────────

def import_text(text: str) -> dict:
    """Recebe texto de 1+ arquivos do PS (HH e/ou summary, concatenados),
    consolida e insere na tabela. Torneios já cadastrados são ignorados.
    Devolve resumo da operação."""
    parsed = parse_text(text)
    ts = int(time.time())
    summary = {
        "parsed":      len(parsed),
        "new":         0,
        "updated":     0,
        "duplicates":  0,
        "tournaments": [],
    }

    with _conn() as c:
        for t in parsed:
            tid = t["tournament_id"]
            existing = c.execute(
                "SELECT 1 FROM tournaments WHERE tournament_id = ?",
                (tid,),
            ).fetchone()

            # Torneio já cadastrado: ignora por completo (não atualiza nada).
            if existing:
                summary["duplicates"] += 1
                continue

            prize_cents = t.get("prize_cents")
            # se o summary trouxe prize (mesmo $0), considera "known"
            sources = t.get("source_files", set()) or set()
            prize_known = 1 if ("summary" in sources and prize_cents is not None) else 0

            c.execute("""
                INSERT INTO tournaments
                  (tournament_id, played_at, hero, tournament_name, game_type, format,
                   buy_in_cents, fee_cents, currency, n_entries, prize_pool_cents,
                   finish_pos, prize_cents, prize_known, notes, raw_text,
                   imported_ts, updated_ts)
                VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
            """, (
                tid, t.get("played_at"), t.get("hero"),
                t.get("tournament_name"), t.get("game_type"), t.get("format"),
                t.get("buy_in_cents"), t.get("fee_cents"), t.get("currency"),
                t.get("n_entries"), t.get("prize_pool_cents"),
                t.get("finish_pos"), prize_cents, prize_known,
                None, t.get("raw_text"), ts, ts,
            ))
            summary["new"] += 1
            final_row = dict(t)
            final_row["prize_known"] = prize_known

            summary["tournaments"].append(_row_to_public(final_row))

    return summary


# ── Consultas ─────────────────────────────────────────────────────────────────

def _load_payouts_by_key() -> dict[str, list[int]]:
    with _conn() as c:
        rows = c.execute(
            "SELECT type_key, payouts_json FROM tournament_payouts"
        ).fetchall()
    return {r["type_key"]: json.loads(r["payouts_json"]) for r in rows}


def _apply_payout(d: dict, payouts_by_key: dict[str, list[int]]) -> dict:
    """Se o torneio não tem prêmio manual mas existe payout pro seu tipo +
    posição final, injeta o prize calculado e marca prize_source='auto'."""
    d["prize_source"] = "manual" if d.get("prize_known") else None
    if not d.get("prize_known") and d.get("finish_pos"):
        tk = _type_key(d.get("tournament_name"), d.get("buy_in_cents"), d.get("fee_cents"))
        payouts = payouts_by_key.get(tk)
        if payouts is not None:
            idx = int(d["finish_pos"]) - 1
            d["prize_cents"] = payouts[idx] if 0 <= idx < len(payouts) else 0
            d["prize_source"] = "auto"
    return d


def list_tournaments(filters: dict | None = None) -> list[dict]:
    """Lista torneios com filtros opcionais:
       from_date / to_date (YYYY/MM/DD), format, min_buyin / max_buyin (centavos).
    """
    f = filters or {}
    where, params = ["1=1"], []
    if f.get("from_date"):
        where.append("played_at >= ?")
        params.append(f["from_date"])
    if f.get("to_date"):
        where.append("played_at <= ?")
        params.append(f["to_date"] + " 23:59:59")
    if f.get("format"):
        where.append("format = ?")
        params.append(f["format"])
    if f.get("min_buyin") is not None:
        where.append("buy_in_cents >= ?")
        params.append(int(f["min_buyin"]))
    if f.get("max_buyin") is not None:
        where.append("buy_in_cents <= ?")
        params.append(int(f["max_buyin"]))

    sql = (
        "SELECT * FROM tournaments WHERE "
        + " AND ".join(where)
        + " ORDER BY played_at ASC"
    )
    payouts_by_key = _load_payouts_by_key()
    with _conn() as c:
        rows = c.execute(sql, params).fetchall()
    out = []
    for r in rows:
        d = dict(r)
        d = _apply_payout(d, payouts_by_key)
        out.append(_row_to_public(d))
    return out


def overview(filters: dict | None = None) -> dict:
    """Métricas agregadas + série de banca cumulativa pro gráfico.

    Considera como "conhecido" tudo que tem prize_source != None — ou seja,
    edição manual OU prêmio derivado da tabela de payouts cadastrada.
    """
    tournaments = list_tournaments(filters)
    n = len(tournaments)
    cost_total = 0
    prize_total = 0
    itm = 0
    cashed = 0
    pending_prize = 0
    cumulative = []
    running = 0
    by_format: dict[str, dict] = {}

    for t in tournaments:
        cost = (t.get("buy_in_cents") or 0) + (t.get("fee_cents") or 0)
        cost_total += cost
        known = t.get("prize_source") is not None
        if known:
            cashed += 1
            prize = t.get("prize_cents") or 0
            prize_total += prize
            if prize > 0:
                itm += 1
            running += prize - cost
        else:
            pending_prize += 1
            # gráfico assume -cost por enquanto pra essas (pior caso = não cravou)
            running += -cost
        cumulative.append({
            "tournament_id": t["tournament_id"],
            "played_at":     t["played_at"],
            "running":       running,
        })

        fmt = t.get("format") or "Sem rótulo"
        b = by_format.setdefault(fmt, {"n": 0, "cost": 0, "prize": 0, "itm": 0, "cashed": 0})
        b["n"] += 1
        b["cost"] += cost
        if known:
            b["cashed"] += 1
            b["prize"] += t.get("prize_cents") or 0
            if (t.get("prize_cents") or 0) > 0:
                b["itm"] += 1

    profit = prize_total - cost_total
    roi = (profit / cost_total) if cost_total else None
    itm_rate = (itm / cashed) if cashed else None
    avg_buyin = (cost_total / n) if n else None

    return {
        "n_tournaments": n,
        "cost_total_cents":   cost_total,
        "prize_total_cents":  prize_total,
        "profit_cents":       profit,
        "roi_pct":            roi * 100 if roi is not None else None,
        "itm_pct":            itm_rate * 100 if itm_rate is not None else None,
        "avg_buyin_cents":    avg_buyin,
        "pending_prize":      pending_prize,
        "cashed":             cashed,
        "cumulative":         cumulative,
        "by_format":          by_format,
    }


def set_prize(tournament_id: str, prize_cents: int | None,
              finish_pos: int | None = None,
              notes: str | None = None) -> dict:
    """Edição manual do prêmio (e opcionalmente posição/notas).
    Marca prize_known=1 quando prize_cents é informado.
    """
    ts = int(time.time())
    with _conn() as c:
        row = c.execute(
            "SELECT * FROM tournaments WHERE tournament_id = ?", (tournament_id,)
        ).fetchone()
        if not row:
            return {"error": "Torneio não encontrado."}
        new_prize_known = 1 if prize_cents is not None else row["prize_known"]
        c.execute("""
            UPDATE tournaments SET
              prize_cents = COALESCE(?, prize_cents),
              prize_known = ?,
              finish_pos  = COALESCE(?, finish_pos),
              notes       = COALESCE(?, notes),
              updated_ts  = ?
            WHERE tournament_id = ?
        """, (prize_cents, new_prize_known, finish_pos, notes, ts, tournament_id))
        row = c.execute(
            "SELECT * FROM tournaments WHERE tournament_id = ?", (tournament_id,)
        ).fetchone()
    return _row_to_public(dict(row))


def delete_tournament(tournament_id: str) -> dict:
    with _conn() as c:
        cur = c.execute(
            "DELETE FROM tournaments WHERE tournament_id = ?", (tournament_id,)
        )
    return {"deleted": cur.rowcount}


def list_formats() -> list[str]:
    """Valores distintos de `format` (pra alimentar o filtro do frontend)."""
    with _conn() as c:
        rows = c.execute(
            "SELECT DISTINCT format FROM tournaments "
            "WHERE format IS NOT NULL AND format <> '' ORDER BY format"
        ).fetchall()
    return [r["format"] for r in rows]


# ── Helpers ───────────────────────────────────────────────────────────────────

def _row_to_public(row: dict) -> dict:
    """Saída idêntica entre INSERT/UPDATE/SELECT, normalizando tipos."""
    cost = (row.get("buy_in_cents") or 0) + (row.get("fee_cents") or 0)
    prize = row.get("prize_cents")
    # prize_source pode ter sido injetado por _apply_payout; caso contrário,
    # deriva de prize_known (edição manual / summary).
    source = row.get("prize_source")
    if source is None and row.get("prize_known"):
        source = "manual"
    profit = (prize - cost) if (prize is not None and source) else None
    return {
        "tournament_id":  row.get("tournament_id"),
        "played_at":      row.get("played_at"),
        "hero":           row.get("hero"),
        "tournament_name": row.get("tournament_name"),
        "game_type":      row.get("game_type"),
        "format":         row.get("format"),
        "buy_in_cents":   row.get("buy_in_cents"),
        "fee_cents":      row.get("fee_cents"),
        "currency":       row.get("currency") or "USD",
        "n_entries":      row.get("n_entries"),
        "prize_pool_cents": row.get("prize_pool_cents"),
        "finish_pos":     row.get("finish_pos"),
        "prize_cents":    prize if source else None,
        "prize_known":    bool(source),
        "prize_source":   source,                       # 'manual' | 'auto' | None
        "profit_cents":   profit,
        "notes":          row.get("notes"),
    }


# ── Tipos de torneio (estruturas de payout) ───────────────────────────────────

def list_tournament_types() -> list[dict]:
    """Agrupa torneios por tipo (nome + buy-in + fee) e devolve, pra cada um:
       contagem, payout cadastrado (se houver) e as posições finais já vistas
       nos torneios desse tipo (pra mostrar "X torneios com posições 1,3,7...").
    """
    payouts_by_key = _load_payouts_by_key()
    with _conn() as c:
        rows = c.execute("""
            SELECT tournament_name, buy_in_cents, fee_cents,
                   MAX(format)    AS format,
                   MAX(currency)  AS currency,
                   MAX(n_entries) AS typical_entries,
                   COUNT(*)       AS n_tournaments,
                   SUM(CASE WHEN prize_known = 1 THEN 1 ELSE 0 END) AS n_manual_overrides
            FROM tournaments
            WHERE tournament_name IS NOT NULL
            GROUP BY tournament_name, buy_in_cents, fee_cents
            ORDER BY n_tournaments DESC, tournament_name ASC
        """).fetchall()

        out = []
        for r in rows:
            tk = _type_key(r["tournament_name"], r["buy_in_cents"], r["fee_cents"])
            # posições finais distintas nesse tipo (pra ajudar o usuário a
            # ver até onde precisa cadastrar prêmio)
            pos_rows = c.execute("""
                SELECT finish_pos, COUNT(*) AS n FROM tournaments
                WHERE tournament_name = ? AND buy_in_cents IS ?
                  AND fee_cents IS ? AND finish_pos IS NOT NULL
                GROUP BY finish_pos ORDER BY finish_pos
            """, (r["tournament_name"], r["buy_in_cents"], r["fee_cents"])).fetchall()
            positions = [{"pos": p["finish_pos"], "n": p["n"]} for p in pos_rows]
            out.append({
                "type_key":       tk,
                "name":           r["tournament_name"],
                "buy_in_cents":   r["buy_in_cents"],
                "fee_cents":      r["fee_cents"],
                "format":         r["format"],
                "currency":       r["currency"] or "USD",
                "typical_entries": r["typical_entries"],
                "n_tournaments":  r["n_tournaments"],
                "n_manual_overrides": r["n_manual_overrides"],
                "payouts_cents":  payouts_by_key.get(tk, []),
                "has_payout_table": tk in payouts_by_key,
                "finish_positions": positions,
            })
    return out


def set_tournament_payout(
    type_key: str,
    payouts_cents: list,
    label: str | None = None,
) -> dict:
    """Salva a estrutura de payout e/ou o rótulo pra um tipo de torneio.

    payouts_cents = lista de inteiros (centavos), índice 0 = 1º lugar.
    Posições não pagantes podem ser zero (será aplicado também). Posições
    além do tamanho da lista são consideradas 0 (fora ITM).

    label = rótulo visível do tipo (Turbo / Hyper / KO / SnG / etc.).
    Se passado, é propagado pra todos os torneios desse tipo (campo `format`)
    e também armazenado em tournament_payouts.format. Vira a "fonte da
    verdade" do rótulo, sobrescrevendo o detectado automaticamente do nome.

    Se payouts_cents = [] e label != None → só atualiza o rótulo (sem
    criar registro em tournament_payouts).
    """
    if not isinstance(payouts_cents, list):
        return {"error": "payouts_cents deve ser lista de inteiros"}
    norm: list[int] = []
    for v in payouts_cents:
        try:
            n = int(v)
        except (TypeError, ValueError):
            return {"error": f"valor inválido: {v!r}"}
        if n < 0:
            return {"error": "valores negativos não são permitidos"}
        norm.append(n)
    while norm and norm[-1] == 0:
        norm.pop()

    label_clean = label.strip() if isinstance(label, str) else None
    if label_clean == "":
        label_clean = None

    ts = int(time.time())
    with _conn() as c:
        rows = c.execute(
            "SELECT tournament_name, buy_in_cents, fee_cents, format, currency "
            "FROM tournaments WHERE tournament_name IS NOT NULL"
        ).fetchall()
        target = None
        for r in rows:
            if _type_key(r["tournament_name"], r["buy_in_cents"], r["fee_cents"]) == type_key:
                target = r
                break
        if not target:
            return {"error": "Tipo de torneio não encontrado."}

        # Format a usar: o que o usuário passou OU o que já existe nesse tipo.
        format_to_use = label_clean if label_clean is not None else target["format"]

        # 1) Propaga o rótulo pra todos os torneios desse tipo (se label foi passado).
        if label_clean is not None:
            c.execute(
                "UPDATE tournaments SET format = ?, updated_ts = ? "
                "WHERE tournament_name = ? AND buy_in_cents IS ? AND fee_cents IS ?",
                (label_clean, ts, target["tournament_name"],
                 target["buy_in_cents"], target["fee_cents"]),
            )

        # 2) Atualiza/insere a tournament_payouts SOMENTE quando há payout não-vazio.
        #    (Se norm == [] e label foi passado, basta o UPDATE acima.)
        if norm:
            c.execute("""
                INSERT INTO tournament_payouts
                    (type_key, name, buy_in_cents, fee_cents, format, currency,
                     payouts_json, updated_ts)
                VALUES (?,?,?,?,?,?,?,?)
                ON CONFLICT(type_key) DO UPDATE SET
                    name         = excluded.name,
                    buy_in_cents = excluded.buy_in_cents,
                    fee_cents    = excluded.fee_cents,
                    format       = excluded.format,
                    currency     = excluded.currency,
                    payouts_json = excluded.payouts_json,
                    updated_ts   = excluded.updated_ts
            """, (
                type_key, target["tournament_name"], target["buy_in_cents"],
                target["fee_cents"], format_to_use, target["currency"] or "USD",
                json.dumps(norm), ts,
            ))
        elif label_clean is not None:
            # Sem payout novo, mas se já existir um registro, sincroniza o label.
            c.execute(
                "UPDATE tournament_payouts SET format = ?, updated_ts = ? "
                "WHERE type_key = ?",
                (label_clean, ts, type_key),
            )

    return {
        "ok": True,
        "type_key": type_key,
        "payouts_cents": norm,
        "format": format_to_use,
    }


def delete_tournament_payout(type_key: str) -> dict:
    with _conn() as c:
        cur = c.execute(
            "DELETE FROM tournament_payouts WHERE type_key = ?", (type_key,)
        )
    return {"deleted": cur.rowcount}


def reparse_missing() -> dict:
    """Reroda o parser nos torneios que têm raw_text armazenado e estão
    incompletos (sem finish_pos OU sem prize). Útil depois de melhorar uma
    regex no parser sem precisar pedir reimportação ao usuário.

    Não sobrescreve prize editado MANUALMENTE pelo usuário (prize_known=1
    com source manual). Só preenche o que está vazio.
    """
    ts = int(time.time())
    updated_pos = 0
    updated_prize = 0
    examined = 0
    with _conn() as c:
        rows = c.execute(
            "SELECT tournament_id, raw_text, finish_pos, prize_cents, prize_known "
            "FROM tournaments WHERE raw_text IS NOT NULL "
            "  AND (finish_pos IS NULL OR (prize_known = 0))"
        ).fetchall()
        examined = len(rows)
        for r in rows:
            text = r["raw_text"]
            # Compat: raw_text salvo antes do fix v2 não contém o cabeçalho de
            # mão — sem ele o parser pula tudo. Injeta um header sintético.
            if not _RE_HH_HEADER.search(text[:400]):
                text = (
                    f"Mão PokerStars #0: Torneio #{r['tournament_id']}, "
                    "Synth Hold'em No Limit - Nível I (10/20) - "
                    "2026/01/01 00:00:00 BRT\n" + text
                )
            # Importante: chamar _parse_hand_history direto (não parse_text)
            # pra evitar o split por \n\n\n, que quebraria o raw_text em
            # múltiplas partes onde só a primeira tem o header sintético.
            parsed_dict = _parse_hand_history(text)
            target = parsed_dict.get(r["tournament_id"])
            if not target:
                continue

            new_pos   = target.get("finish_pos")
            new_prize = target.get("prize_cents")

            sets, params = [], []
            if r["finish_pos"] is None and new_pos is not None:
                sets.append("finish_pos = ?")
                params.append(new_pos)
                updated_pos += 1
            if not r["prize_known"] and new_prize is not None:
                sets.append("prize_cents = ?")
                sets.append("prize_known = 1")
                params.append(new_prize)
                updated_prize += 1

            if sets:
                sets.append("updated_ts = ?")
                params.append(ts)
                params.append(r["tournament_id"])
                c.execute(
                    f"UPDATE tournaments SET {', '.join(sets)} "
                    f"WHERE tournament_id = ?",
                    params,
                )
    return {
        "examined":       examined,
        "updated_pos":    updated_pos,
        "updated_prize":  updated_prize,
    }
