"""
Leitor dos arquivos .txt do PokerStars (cliente PT-BR) para PLANILHA DE TORNEIOS.

Aceita dois formatos:
  1. Hand-history (Mão PokerStars #...) — extrai id, data, buy-in/fee, hero, finish_pos.
  2. Tournament-summary (Resumo do torneio PokerStars) — extrai prize, n_entries, format.

Consolida por tournament_id: ao passar vários arquivos no mesmo lote, mescla
infos parciais (ex.: HH dá buy-in e posição; summary completa com prize).

Aqui só transforma texto → fatos. Persistência fica em tournaments_engine.
"""
import re

# ── Regexes compartilhados ────────────────────────────────────────────────────

_RE_HH_HEADER = re.compile(
    r"M[ãa]o PokerStars\s+#(\d+):\s*Torneio\s*#(\d+),\s*"
    r"(.+?)\s+-\s+N[íi]vel"
)
_RE_HH_DATE   = re.compile(r"(\d{4}/\d{2}/\d{2}\s+\d{1,2}:\d{2}:\d{2})\s+BRT")
_RE_HERO      = re.compile(r"^(.+?)\s+recebe\s+\[\w\w\s+\w\w\]")
# Eliminação fora do dinheiro: "X terminou o torneio em Nº lugar"
_RE_BUST      = re.compile(r"^(.+?)\s+terminou o torneio em\s+(\d+)[ºo°]?\s+lugar")
# ITM (ficou no dinheiro): "X Acabou o torneio em Nº lugar e recebeu $ Y.YY"
_RE_ITM       = re.compile(
    r"^(.+?)\s+[Aa]cabou o torneio em\s+(\d+)[ºo°]?\s+lugar\s+e recebeu\s+\$\s*(\d+[.,]\d{2})"
)
# Cravada: "X ganhou o torneio e recebeu $ Y.YY"
_RE_WIN       = re.compile(
    r"^(.+?)\s+ganhou o torneio e recebeu\s+\$\s*(\d+[.,]\d{2})"
)

_RE_SUM_HEADER = re.compile(
    r"Resumo do [Tt]orneio.*?#(\d+)"
)
_RE_SUM_HEADER_ALT = re.compile(
    r"PokerStars Tournament\s+#(\d+):"  # caso o cabeçalho venha em inglês
)
_RE_SUM_BUYIN  = re.compile(
    r"Buy-?In:\s*\$?\s*(\d+[.,]\d{2})\s*/?\s*\$?\s*(\d+[.,]\d{2})?\s*([A-Z]{3})?"
)
_RE_SUM_PLAYERS = re.compile(r"(\d+)\s+jogadores")
_RE_SUM_PLAYERS_EN = re.compile(r"(\d+)\s+players")
_RE_SUM_PRIZEPOOL = re.compile(
    r"(?:Pote do pr[êe]mio total|Total Prize Pool):\s*\$?\s*(\d+[.,]\d{2})"
)
_RE_SUM_DATE = re.compile(r"(\d{4}/\d{2}/\d{2}\s+\d{2}:\d{2}:\d{2})")
# linha tipo: "  1: Fulano (BR), $1.23 (15%)"  — captura posição, nome, prêmio
_RE_SUM_FINISH = re.compile(
    r"^\s*(\d+):\s*(.+?)\s*\([^)]+\),\s*\$\s*(\d+[.,]\d{2})"
)
# linha alternativa do herói com "(em fichas)" ou sem prêmio
_RE_SUM_FINISH_NOPRIZE = re.compile(r"^\s*(\d+):\s*(.+?)\s*\([^)]+\)\s*$")

# Buy-in extra do cabeçalho da HH: "$ 0.42+$ 0.08 USD"
_RE_HH_BUYIN = re.compile(
    r"\$\s*(\d+[.,]\d{2})\s*\+\s*\$\s*(\d+[.,]\d{2})\s*([A-Z]{3})?"
)
# Freeroll
_RE_FREEROLL = re.compile(r"\bFreeroll\b", re.IGNORECASE)

# Format hints — vêm no nome do torneio (HH header group 3)
_FMT_HINTS = [
    (re.compile(r"\bHyper[\s-]?Turbo\b", re.I), "Hyper-Turbo"),
    (re.compile(r"\bTurbo\b", re.I),            "Turbo"),
    (re.compile(r"\bKnockout|KO\b", re.I),      "KO"),
    (re.compile(r"\bBounty\b", re.I),           "Bounty"),
    (re.compile(r"\bSat[ée]lite\b|Satellite", re.I), "Satélite"),
    (re.compile(r"\bSit\s*&\s*Go\b|\bSnG\b", re.I),  "SnG"),
]


def make_internal_tid(ps_id: str, played_at: str | None) -> str:
    """Chave interna ÚNICA de um torneio.

    O PokerStars REUTILIZA o número do torneio em datas diferentes — o mesmo
    `4004985567` em 31/05 e 01/06 são torneios DIFERENTES. Por isso a identidade
    real é (id_pokerstars, dia). Compomos {ps_id}_{YYYYMMDD} a partir da data de
    início; sem data conhecida, cai no número puro (compat com registros antigos).
    """
    if not ps_id:
        return ps_id
    if played_at and len(played_at) >= 10 and "/" in played_at[:10]:
        day = played_at[:10].replace("/", "")   # '2026/06/01' -> '20260601'
        if day.isdigit():
            return f"{ps_id}_{day}"
    return str(ps_id)


def _cents(s):
    """'0,42' ou '0.42' → 42 (centavos)."""
    if s is None:
        return None
    s = s.replace(",", ".")
    try:
        return int(round(float(s) * 100))
    except ValueError:
        return None


def _detect_format(name: str) -> str | None:
    if not name:
        return None
    for rx, label in _FMT_HINTS:
        if rx.search(name):
            return label
    return None


# ── Detecção de tipo de arquivo ────────────────────────────────────────────────

def _looks_like_summary(text: str) -> bool:
    head = text[:400]
    return bool(
        _RE_SUM_HEADER.search(head)
        or _RE_SUM_HEADER_ALT.search(head)
        or "Resumo do" in head
    )


# ── Parser de hand-history ─────────────────────────────────────────────────────

def _parse_hand_history(text: str) -> dict:
    """Agrupa todas as mãos por torneio e devolve {ps_tid: facts}.

    Agrupa pelo NÚMERO do PokerStars durante o parse (a data só é conhecida ao
    ler a 1ª mão); a chave interna composta (id_dia) é resolvida no final.
    Arquivos do PS sempre trazem um torneio por dia — não há ambiguidade dentro
    de um único arquivo.
    """
    by_tid: dict[str, dict] = {}
    current_tid = None
    hero_per_tid: dict[str, str] = {}
    raw_per_tid: dict[str, list[str]] = {}

    for line in text.splitlines():
        m = _RE_HH_HEADER.search(line)
        if m:
            current_tid = m.group(2)
            d = by_tid.setdefault(current_tid, {
                "tournament_id": current_tid,        # provisório; vira composto no fim
                "ps_tournament_id": current_tid,     # número original do PokerStars
                "source_files": {"hh"},
                "room": "PokerStars",
            })
            # IMPORTANTE: acumula a linha do cabeçalho também, pra raw_text
            # ser auto-suficiente (re-parseável sem header sintético).
            raw_per_tid.setdefault(current_tid, []).append(line)
            # nome do torneio (sem o nível)
            tname = m.group(3).strip()
            d.setdefault("game_type", _extract_game_type(tname))
            d.setdefault("format", _detect_format(tname))
            d.setdefault("tournament_name", tname)
            # buy-in
            mb = _RE_HH_BUYIN.search(line)
            if mb and "buy_in_cents" not in d:
                d["buy_in_cents"] = _cents(mb.group(1))
                d["fee_cents"]    = _cents(mb.group(2))
                d["currency"]     = mb.group(3) or "USD"
            elif _RE_FREEROLL.search(line):
                d.setdefault("buy_in_cents", 0)
                d.setdefault("fee_cents", 0)
                d.setdefault("currency", "USD")
            # data: primeira mão é a referência (= início do torneio pro jogador)
            md = _RE_HH_DATE.search(line)
            if md and "played_at" not in d:
                d["played_at"] = md.group(1)
            continue

        if current_tid is None:
            continue

        # acumula texto bruto por torneio (todas as linhas após o cabeçalho)
        raw_per_tid[current_tid].append(line)

        # herói pelo "recebe [..]" — uma vez por torneio basta
        if current_tid not in hero_per_tid:
            mh = _RE_HERO.match(line)
            if mh:
                hero_per_tid[current_tid] = mh.group(1).strip()
                by_tid[current_tid]["hero"] = mh.group(1).strip()

        hero = hero_per_tid.get(current_tid)

        # vencedor (cravada): "X ganhou o torneio e recebeu $ Y.YY"
        mwin = _RE_WIN.match(line)
        if mwin and hero and mwin.group(1).strip() == hero:
            by_tid[current_tid]["finish_pos"] = 1
            by_tid[current_tid]["prize_cents"] = _cents(mwin.group(2))
            continue

        # ITM: "X Acabou o torneio em Nº lugar e recebeu $ Y.YY"
        mitm = _RE_ITM.match(line)
        if mitm and hero and mitm.group(1).strip() == hero:
            # mantém só a 1ª ocorrência (PS pode repetir em mãos subsequentes)
            if by_tid[current_tid].get("finish_pos") is None:
                by_tid[current_tid]["finish_pos"]  = int(mitm.group(2))
                by_tid[current_tid]["prize_cents"] = _cents(mitm.group(3))
            continue

        # Eliminação fora do dinheiro: "X terminou o torneio em Nº lugar"
        mbust = _RE_BUST.match(line)
        if mbust and hero and mbust.group(1).strip() == hero:
            if by_tid[current_tid].get("finish_pos") is None:
                by_tid[current_tid]["finish_pos"]  = int(mbust.group(2))
                by_tid[current_tid].setdefault("prize_cents", 0)
            continue

    # injeta o texto bruto acumulado por torneio (pra reprocessamento futuro)
    for tid, lines in raw_per_tid.items():
        if tid in by_tid:
            by_tid[tid]["raw_text"] = "\n".join(lines)

    # resolve a chave interna composta (id_dia) agora que played_at é conhecido
    for d in by_tid.values():
        d["tournament_id"] = make_internal_tid(
            d.get("ps_tournament_id"), d.get("played_at"))

    return by_tid


def _extract_game_type(name: str) -> str:
    n = name.lower()
    if "hold'em no limit" in n or "no limit hold" in n:
        return "NLHE"
    if "pot limit omaha" in n or "plo" in n:
        return "PLO"
    if "hold'em limit" in n:
        return "LHE"
    return "NLHE"  # default mais comum


# ── Parser de summary ──────────────────────────────────────────────────────────

def _parse_summary(text: str) -> dict:
    """Lê o conteúdo de um .summary. Espera 1 torneio por arquivo."""
    tid = None
    m = _RE_SUM_HEADER.search(text) or _RE_SUM_HEADER_ALT.search(text)
    if m:
        tid = m.group(1)
    if not tid:
        return {}

    fact = {"tournament_id": tid, "ps_tournament_id": tid,
            "source_files": {"summary"}, "room": "PokerStars"}

    # buy-in
    mb = _RE_SUM_BUYIN.search(text)
    if mb:
        fact["buy_in_cents"] = _cents(mb.group(1))
        fact["fee_cents"]    = _cents(mb.group(2)) if mb.group(2) else 0
        fact["currency"]     = mb.group(3) or "USD"
    elif _RE_FREEROLL.search(text):
        fact["buy_in_cents"] = 0
        fact["fee_cents"] = 0
        fact["currency"] = "USD"

    # players
    mp = _RE_SUM_PLAYERS.search(text) or _RE_SUM_PLAYERS_EN.search(text)
    if mp:
        fact["n_entries"] = int(mp.group(1))

    # prize pool (info do torneio inteiro, não do herói)
    mpp = _RE_SUM_PRIZEPOOL.search(text)
    if mpp:
        fact["prize_pool_cents"] = _cents(mpp.group(1))

    # data
    md = _RE_SUM_DATE.search(text)
    if md:
        fact["played_at"] = md.group(1)

    # chave interna composta (id_dia) — agora que played_at foi extraído
    fact["tournament_id"] = make_internal_tid(tid, fact.get("played_at"))

    # nome / formato
    # tenta pegar a linha logo após o "Tournament Summary"
    for line in text.splitlines()[:8]:
        f = _detect_format(line)
        if f:
            fact["format"] = f
            break

    # posição + prêmio do herói: precisa do nome do herói (ainda não temos
    # de forma confiável só pelo summary). Devolvemos lista de finishers
    # e o engine cruza com o hero descoberto na HH.
    finishers = []
    for line in text.splitlines():
        mf = _RE_SUM_FINISH.match(line)
        if mf:
            finishers.append({
                "pos": int(mf.group(1)),
                "name": mf.group(2).strip(),
                "prize_cents": _cents(mf.group(3)),
            })
            continue
        mfn = _RE_SUM_FINISH_NOPRIZE.match(line)
        if mfn:
            finishers.append({
                "pos": int(mfn.group(1)),
                "name": mfn.group(2).strip(),
                "prize_cents": 0,
            })
    if finishers:
        fact["_finishers"] = finishers

    return fact


# ── API pública ────────────────────────────────────────────────────────────────

def parse_text(text: str) -> list[dict]:
    """Recebe o conteúdo de UM ou VÁRIOS arquivos do PS (concatenados) e devolve
    uma lista de torneios consolidados (1 dict por tournament_id).

    Os arquivos podem ser hand-histories E/OU summaries — o parser detecta cada
    bloco e mescla. Campos faltantes ficam ausentes (não None) pra deixar o
    engine decidir o que precisa do usuário.
    """
    # Divide em "documentos" pelos limites entre HH e summary (separamos por
    # "\n\n\n" que é o que o PS usa entre arquivos quando concatenados).
    parts = _split_into_documents(text)
    by_tid: dict[str, dict] = {}

    for part in parts:
        if not part.strip():
            continue
        if _looks_like_summary(part):
            f = _parse_summary(part)
            if f:
                _merge(by_tid, f)
        else:
            for tid, f in _parse_hand_history(part).items():
                _merge(by_tid, f)

    # Cruza summary._finishers com o hero da HH (quando temos)
    for d in by_tid.values():
        finishers = d.pop("_finishers", None)
        hero = d.get("hero")
        if finishers and hero:
            for row in finishers:
                if _names_match(row["name"], hero):
                    d.setdefault("finish_pos", row["pos"])
                    d.setdefault("prize_cents", row["prize_cents"])
                    break

    return list(by_tid.values())


def _split_into_documents(text: str) -> list[str]:
    """O PS separa hand-histories e summaries com várias linhas em branco.
    Como não sabemos com certeza, partimos em parágrafos grandes (≥3 quebras)
    e em cada cabeçalho de Summary.
    """
    # Quebra em blocos por 3+ newlines OU por cabeçalho de summary
    raw = re.split(r"\n{3,}", text)
    # Pode haver summaries grudados — fragmenta mais por cabeçalho explícito
    out = []
    for blk in raw:
        # Se o bloco tem MAIS de um cabeçalho de summary, separa
        positions = [m.start() for m in _RE_SUM_HEADER.finditer(blk)]
        if len(positions) > 1:
            for i, p in enumerate(positions):
                end = positions[i + 1] if i + 1 < len(positions) else len(blk)
                out.append(blk[p:end])
        else:
            out.append(blk)
    return out


def _merge(by_tid: dict, fact: dict) -> None:
    tid = fact["tournament_id"]
    if tid not in by_tid:
        by_tid[tid] = dict(fact)
        return
    cur = by_tid[tid]
    # source_files é set; resto: only set if missing
    cur.setdefault("source_files", set()).update(fact.get("source_files", set()))
    for k, v in fact.items():
        if k in ("tournament_id", "source_files"):
            continue
        if v is None:
            continue
        if k not in cur or cur[k] in (None, ""):
            cur[k] = v


def _names_match(a: str, b: str) -> bool:
    """Compara nomes ignorando sufixos do summary tipo '(BR)' e espaços."""
    norm = lambda s: re.sub(r"\s+", " ", s).strip().lower()
    return norm(a) == norm(b)


if __name__ == "__main__":
    import sys, json
    with open(sys.argv[1], "r", encoding="utf-8") as f:
        txt = f.read()
    out = parse_text(txt)
    for t in out:
        t["source_files"] = sorted(t.get("source_files", []))
    print(json.dumps(out, ensure_ascii=False, indent=2))
