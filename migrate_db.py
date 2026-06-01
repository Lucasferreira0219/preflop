#!/usr/bin/env python
"""
Migração de banco — chave composta de torneio (id_pokerstars, data).

Contexto: o PokerStars REUTILIZA o número do torneio em datas diferentes.
O mesmo 4004985567 em 31/05 e 01/06 são torneios DIFERENTES. Antes, a tabela
usava o número puro como chave única, então o segundo virava "duplicata" e
sumia. Agora a chave interna é {id_pokerstars}_{YYYYMMDD}.

Este script é SEGURO e IDEMPOTENTE:
  - faz backup do banco antes de qualquer alteração
  - só faz UPDATE de chaves (nunca DELETE)
  - rodar 2x não causa dano
  - reporta o estado antes/depois e avisa de torneios sem data (risco residual)

Uso (no servidor de produção, ANTES de reiniciar o app):

    python migrate_db.py            # backup + migra + relatório
    python migrate_db.py --check    # só relatório, NÃO altera nada
"""
import os
import sys
import time
import shutil
import sqlite3

_BASE = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(_BASE, "data", "preflop.db")


def _conn():
    c = sqlite3.connect(DB_PATH)
    c.row_factory = sqlite3.Row
    return c


def _report(c, titulo):
    print(f"\n=== {titulo} ===")
    n_t = c.execute("SELECT COUNT(*) FROM tournaments").fetchone()[0]
    n_h = c.execute("SELECT COUNT(*) FROM imported_hands").fetchone()[0]
    print(f"  torneios: {n_t} | mãos: {n_h}")

    # torneios sem data (risco: não ganham chave composta → podem colidir)
    sem_data = c.execute(
        "SELECT COUNT(*) FROM tournaments WHERE played_at IS NULL OR played_at = ''"
    ).fetchone()[0]
    print(f"  torneios SEM data (risco de colisão futura): {sem_data}")

    # mãos órfãs (sem torneio correspondente) — deve ser sempre 0
    orfas = c.execute("""
        SELECT COUNT(*) FROM imported_hands ih
        WHERE NOT EXISTS (
            SELECT 1 FROM tournaments t WHERE t.tournament_id = ih.tournament_id)
    """).fetchone()[0]
    print(f"  mãos órfãs (sem torneio): {orfas}")

    # IDs do PokerStars que aparecem em +1 data (a razão de toda essa mudança)
    try:
        rep = c.execute("""
            SELECT ps_tournament_id, COUNT(*) n FROM tournaments
            WHERE ps_tournament_id IS NOT NULL
            GROUP BY ps_tournament_id HAVING n > 1
        """).fetchall()
        if rep:
            print(f"  IDs PokerStars reutilizados em datas diferentes: {len(rep)}")
            for r in rep:
                print(f"    - {r['ps_tournament_id']} aparece {r['n']}x")
    except sqlite3.OperationalError:
        pass  # coluna ainda não existe (banco pré-migração)

    return {"torneios": n_t, "maos": n_h, "sem_data": sem_data, "orfas": orfas}


def check_only():
    if not os.path.exists(DB_PATH):
        print(f"Banco não encontrado: {DB_PATH}")
        return 1
    with _conn() as c:
        _report(c, "ESTADO ATUAL (somente leitura)")
    return 0


def migrate():
    if not os.path.exists(DB_PATH):
        print(f"Banco não encontrado: {DB_PATH}")
        return 1

    # 1) backup
    stamp = time.strftime("%Y%m%d_%H%M%S")
    bak = f"{DB_PATH}.bak.{stamp}"
    shutil.copy2(DB_PATH, bak)
    print(f"Backup criado: {bak}")

    # 2) estado antes
    with _conn() as c:
        antes = _report(c, "ANTES DA MIGRAÇÃO")

    # 3) dispara a migração — importar os engines roda _init_schema() +
    #    _migrate_composite_tids() (idempotente). É a MESMA migração que
    #    rodaria no boot do app, só que controlada e com relatório.
    print("\nRodando migração (schema + chave composta)…")
    import hands_engine  # noqa: F401  (importa tournaments_engine + dispara tudo)
    print("Migração concluída.")

    # 4) estado depois
    with _conn() as c:
        depois = _report(c, "DEPOIS DA MIGRAÇÃO")

    # 5) veredito
    print("\n=== RESULTADO ===")
    if depois["orfas"] > 0:
        print("  [ERRO] Ha maos orfas - RESTAURE o backup e investigue antes de subir.")
        print(f"     Restaurar: cp '{bak}' '{DB_PATH}'")
        return 2
    if depois["maos"] != antes["maos"] or depois["torneios"] != antes["torneios"]:
        print("  [ERRO] Contagem mudou (nao deveria) - confira acima.")
        return 2
    print("  [OK] Nada perdido. Pode reiniciar o app.")
    if depois["sem_data"] > 0:
        print(f"  [INFO] {depois['sem_data']} torneio(s) sem data ficaram com chave pura.")
        print("     Nao quebram nada; so podem duplicar se voce reimportar o mesmo arquivo.")
    return 0


if __name__ == "__main__":
    if "--check" in sys.argv:
        sys.exit(check_only())
    sys.exit(migrate())
