"""
Leitor de histórico de mãos do PokerStars (cliente PT-BR).

Lê o .txt exportado pelo PokerStars e extrai, por mão, os fatos que importam
pro app: nº da mão (chave única), torneio, blinds, quem é o herói, posição,
cartas, stack em bb e a sequência de ações pré-flop.

NÃO dá nota aqui — isso fica na camada que cruza com os ranges do curso
(reaproveita simulator_engine). Aqui só transforma texto → fatos.
"""
import re

RANKS = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2']
_RANK_IDX = {r: i for i, r in enumerate(RANKS)}

# Posições em ordem de ASSENTO a partir do small blind (logo após o botão).
# Espelha POSITIONS_BY_COUNT do simulator_engine, reordenado por assento.
_SEAT_ORDER = {
    9: ['SB', 'BB', 'UTG', 'UTG1', 'UTG2', 'MP', 'HJ', 'CO', 'BTN'],
    8: ['SB', 'BB', 'UTG', 'UTG1', 'MP', 'HJ', 'CO', 'BTN'],
    7: ['SB', 'BB', 'UTG', 'MP', 'HJ', 'CO', 'BTN'],
    6: ['SB', 'BB', 'UTG', 'HJ', 'CO', 'BTN'],
    5: ['SB', 'BB', 'UTG', 'CO', 'BTN'],
    4: ['SB', 'BB', 'UTG', 'BTN'],
    3: ['SB', 'BB', 'BTN'],
    2: ['SB', 'BB'],
}

# Cabeçalho: "Mão PokerStars #260946547381: Torneio #4003782626, ... (10/20) - 2026/05/27 13:40:59 BRT ..."
_RE_HEADER  = re.compile(r"#(\d+):\s*Torneio\s*#(\d+)")
_RE_BLINDS  = re.compile(r"\((\d+)/(\d+)\)")
_RE_DATE    = re.compile(r"(\d{4}/\d{2}/\d{2}\s+\d{2}:\d{2}:\d{2})\s+BRT")
_RE_TABLE   = re.compile(r"-max\s+Lugar\s*#(\d+)")
_RE_MAX     = re.compile(r"(\d+)-max")
_RE_SEAT    = re.compile(r"^Lugar\s+(\d+):\s+(.+?)\s+\((\d+)\s+em fichas\)")
_RE_SB      = re.compile(r"^(.+?):\s+paga o small blind\s+(\d+)")
_RE_BB      = re.compile(r"^(.+?):\s+paga o big blind\s+(\d+)")
_RE_HERO    = re.compile(r"^(.+?)\s+recebe\s+\[(\w\w)\s+(\w\w)\]")
_RE_FOLD    = re.compile(r"^(.+?):\s+desiste")
_RE_CALL    = re.compile(r"^(.+?):\s+iguala\s+(\d+)")
_RE_RAISE   = re.compile(r"^(.+?):\s+aumenta\s+(\d+)\s+para\s+(\d+)")


def canonical_hand(c1, c2):
    """['Kd','Ks'] -> 'KK'; ['As','Kh'] -> 'AKo'; ['Ts','9s'] -> 'T9s'."""
    r1, s1 = c1[0], c1[1]
    r2, s2 = c2[0], c2[1]
    if r1 == r2:
        return r1 + r2
    # rank mais alto primeiro
    if _RANK_IDX[r1] > _RANK_IDX[r2]:
        r1, r2, s1, s2 = r2, r1, s2, s1
    return r1 + r2 + ('s' if s1 == s2 else 'o')


def _split_hands(text):
    """Quebra o arquivo em blocos, um por mão (separador = linha de cabeçalho)."""
    blocks, current = [], []
    for line in text.splitlines():
        if _RE_HEADER.search(line) and "PokerStars" in line:
            if current:
                blocks.append(current)
            current = [line]
        elif current:
            current.append(line)
    if current:
        blocks.append(current)
    return blocks


def _classify(hero, preflop_actions):
    """Classifica o spot do herói pela 1ª decisão voluntária dele.

    Retorna (scenario, hero_action, hero_all_in, gradeable, motivo).
    scenario ∈ {RFI, vs_RFI, vs_3bet, outro}; gradeable diz se bate com o curso.
    """
    raises_before = 0
    limps_before = 0
    hero_act = None
    hero_all_in = False

    for actor, act, _val, all_in in preflop_actions:
        if actor == hero:
            hero_act = act
            hero_all_in = all_in
            break
        if act == 'raise':
            raises_before += 1
        elif act == 'call':
            limps_before += 1

    if hero_act is None:
        return ('outro', None, False, False, 'herói não tomou decisão pré-flop')

    if raises_before == 0:
        if limps_before == 0:
            return ('RFI', hero_act, hero_all_in, True, '')
        return ('outro', hero_act, hero_all_in, False,
                f'pote com {limps_before} limp(s) antes - fora do modelo')
    if raises_before == 1:
        return ('vs_RFI', hero_act, hero_all_in, True, '')
    return ('vs_3bet', hero_act, hero_all_in, True, '')


def parse_text(text):
    """Lê o conteúdo de um .txt e devolve uma lista de mãos (dicts)."""
    hands = []
    for block in _split_hands(text):
        head = block[0]
        m = _RE_HEADER.search(head)
        if not m:
            continue
        hand_id, tournament_id = m.group(1), m.group(2)

        mb = _RE_BLINDS.search(head)
        sb, bb = (int(mb.group(1)), int(mb.group(2))) if mb else (0, 0)
        md = _RE_DATE.search(head)
        played_at = md.group(1) if md else None

        button_seat = None
        max_players = 9
        seats = {}        # nome -> stack em fichas
        hero = None
        hero_cards = None
        preflop = []      # (ator, ação, valor)
        section = 'pre'   # pre -> cartas -> postflop
        hero_pos = None

        for line in block[1:]:
            if button_seat is None:
                mt = _RE_TABLE.search(line)
                if mt:
                    button_seat = int(mt.group(1))
                    mm = _RE_MAX.search(line)
                    if mm:
                        max_players = int(mm.group(1))
                    continue

            ms = _RE_SEAT.match(line)
            if ms and section == 'pre':
                seats[ms.group(2)] = int(ms.group(3))
                continue

            if line.startswith('*** CARTAS DA MÃO ***'):
                section = 'cartas'
                continue
            if line.startswith('*** FLOP') or line.startswith('*** RESUMO') \
               or line.startswith('*** SUMÁRIO') or line.startswith('*** SHOW'):
                section = 'post'
                continue

            msb = _RE_SB.match(line)
            if msb:
                seats.setdefault(msb.group(1), 0)
                if hero_pos is None and msb.group(1):
                    pass  # posição resolvida abaixo
                hero_sb = msb.group(1)
                continue
            mbb = _RE_BB.match(line)
            if mbb:
                continue

            if section == 'cartas':
                mh = _RE_HERO.match(line)
                if mh:
                    hero = mh.group(1)
                    hero_cards = canonical_hand(mh.group(2), mh.group(3))
                    continue

            if section in ('cartas',):
                all_in = 'all-in' in line
                mr = _RE_RAISE.match(line)
                if mr:
                    preflop.append((mr.group(1), 'raise', int(mr.group(3)), all_in))
                    continue
                mc = _RE_CALL.match(line)
                if mc:
                    preflop.append((mc.group(1), 'call', int(mc.group(2)), all_in))
                    continue
                mf = _RE_FOLD.match(line)
                if mf:
                    preflop.append((mf.group(1), 'fold', None, False))
                    continue

        # Posição do herói via assento relativo ao botão
        hero_pos = _hero_position(block, hero, button_seat, len(seats))

        stack_chips = seats.get(hero, 0)
        stack_bb = round(stack_chips / bb) if bb else None
        scenario, hero_action, hero_all_in, gradeable, motivo = _classify(hero, preflop)

        hands.append({
            'hand_id': hand_id,
            'tournament_id': tournament_id,
            'played_at': played_at,
            'sb': sb, 'bb': bb,
            'hero': hero,
            'hero_pos': hero_pos,
            'hero_cards': hero_cards,
            'stack_bb': stack_bb,
            'scenario': scenario,
            'hero_action': hero_action,
            'hero_all_in': hero_all_in,
            'gradeable': gradeable,
            'motivo': motivo,
            'n_players': len(seats),
            'raw': '\n'.join(block),
        })
    return hands


def _hero_position(block, hero, button_seat, n_players):
    """Descobre a posição do herói pelo assento relativo ao botão."""
    if hero is None or button_seat is None:
        return None
    seat_of = {}
    for line in block:
        ms = _RE_SEAT.match(line)
        if ms:
            seat_of[ms.group(2)] = int(ms.group(1))
    if hero not in seat_of:
        return None
    seats_sorted = sorted(seat_of.values())
    n = len(seats_sorted)
    order = _SEAT_ORDER.get(n)
    if not order:
        return None
    # ordem de assento começando logo após o botão
    start = seats_sorted.index(button_seat)
    rotated = seats_sorted[start + 1:] + seats_sorted[:start + 1]
    seat_to_pos = {seat: order[i] for i, seat in enumerate(rotated)}
    return seat_to_pos.get(seat_of[hero])


if __name__ == '__main__':
    import sys, json
    path = sys.argv[1]
    with open(path, 'r', encoding='utf-8') as f:
        hands = parse_text(f.read())
    print(json.dumps(hands, ensure_ascii=False, indent=2))
