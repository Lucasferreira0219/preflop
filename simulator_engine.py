import json
import os
import random

RANGES_DIR = os.path.join(os.path.dirname(__file__), "ranges")

STACK_PROFILES = {
    "mtt": [
        (20,  "mtt/ranges_20bb.json"),
        (35,  "mtt/ranges_35bb.json"),
        (50,  "mtt/ranges_50bb.json"),
        (100, "mtt/ranges_100bb.json"),
    ],
    "sng": [
        (10,  "sng/ranges_10bb.json"),
        (15,  "sng/ranges_15bb.json"),
        (30,  "sng/ranges_30bb.json"),
        (75,  "sng/ranges_75bb.json"),
    ],
}

DEFAULT_MODE = "mtt"

POSITIONS_BY_COUNT = {
    9: ['UTG','UTG1','UTG2','MP','HJ','CO','BTN','SB','BB'],
    8: ['UTG','UTG1','MP','HJ','CO','BTN','SB','BB'],
    7: ['UTG','MP','HJ','CO','BTN','SB','BB'],
    6: ['UTG','HJ','CO','BTN','SB','BB'],
    5: ['UTG','CO','BTN','SB','BB'],
    4: ['UTG','BTN','SB','BB'],
    3: ['BTN','SB','BB'],
    2: ['SB','BB'],
}

REPRESENTATIVE_VILLAIN = {
    "UTG1":"UTG","UTG2":"UTG","MP":"UTG",
    "HJ":"MP","CO":"HJ","BTN":"CO","SB":"BTN","BB":"BTN",
}
REPRESENTATIVE_3BET = {
    "UTG":"BB","UTG1":"BB","UTG2":"BB","MP":"BB",
    "HJ":"BB","CO":"BTN","BTN":"BB","SB":"BB",
}

# Posições que podem ter alguém abrindo antes delas
CAN_FACE_RAISE = {
    'UTG':False,'UTG1':True,'UTG2':True,'MP':True,
    'HJ':True,'CO':True,'BTN':True,'SB':True,'BB':True,
}
# BB não tem RFI (está no big blind)
CAN_RFI = {
    'UTG':True,'UTG1':True,'UTG2':True,'MP':True,
    'HJ':True,'CO':True,'BTN':True,'SB':True,'BB':False,
}

RANKS = ['A','K','Q','J','T','9','8','7','6','5','4','3','2']

_cache = {}


def _load(fname):
    if fname not in _cache:
        path = os.path.join(RANGES_DIR, fname)
        try:
            with open(path, 'r', encoding='utf-8') as f:
                _cache[fname] = json.load(f)
        except (OSError, json.JSONDecodeError) as e:
            print(f"[ranges] Falha ao carregar {fname}: {e}")
            _cache[fname] = {'positions': {}}
    return _cache[fname]


def warm_cache():
    """Pré-carrega todos os perfis de stack (todos os modos) — chamado no startup."""
    for profiles in STACK_PROFILES.values():
        for _, fname in profiles:
            _load(fname)
    return len(_cache)


def _normalize_mode(mode):
    return mode if mode in STACK_PROFILES else DEFAULT_MODE


def available_stacks(mode):
    return [pivot for pivot, _ in STACK_PROFILES[_normalize_mode(mode)]]


def _pick_file(stack_bb, mode):
    profiles = STACK_PROFILES[_normalize_mode(mode)]
    pivots   = [p for p, _ in profiles]
    stack_bb = max(min(pivots), min(stack_bb, max(pivots)))
    best, best_dist = profiles[0][1], abs(stack_bb - profiles[0][0])
    for pivot, fname in profiles[1:]:
        d = abs(stack_bb - pivot)
        if d < best_dist:
            best_dist, best = d, fname
    return best


def all_hands():
    hands = []
    for i in range(13):
        for j in range(13):
            r1, r2 = RANKS[i], RANKS[j]
            if i == j:   hands.append(r1 + r2)
            elif i < j:  hands.append(r1 + r2 + 's')
            # lower triangle handled by upper + 'o' → skip to avoid duplicates
    for i in range(13):
        for j in range(i):
            r1, r2 = RANKS[j], RANKS[i]   # r1 = higher rank
            hands.append(r1 + r2 + 'o')
    return hands


def _get_buckets(pos, scenario, stack_bb, mode=DEFAULT_MODE):
    fname = _pick_file(stack_bb, mode)
    data = _load(fname)
    positions = data.get('positions', {})
    pos_data  = positions.get(pos, {})

    if scenario == 'RFI':
        # Ordem do dict define a prioridade em _correct_action: raise > shove > call.
        out = {'raise': pos_data.get('RFI', [])}
        if pos_data.get('_RFI_shove'):
            out['shove'] = pos_data['_RFI_shove']
        out['call'] = []
        return out

    if scenario == 'vs_RFI':
        villain = REPRESENTATIVE_VILLAIN.get(pos)
        if not villain:
            return {}
        # Usa apenas o spot da própria posição. NÃO faz fallback pro range do BB
        # (isso misturava a defesa do BB em outras posições, ex.: a 10bb).
        vs_rfi = pos_data.get('vs_RFI', {}).get(villain)
        if not vs_rfi:
            return {}
        out = {}
        if vs_rfi.get('3bet'):  out['3bet']  = vs_rfi['3bet']
        if vs_rfi.get('shove'): out['shove'] = vs_rfi['shove']
        out['call'] = vs_rfi.get('call', [])
        return out

    if scenario == 'vs_3bet':
        villain = REPRESENTATIVE_3BET.get(pos)
        if not villain:
            return {}
        vs_3b = pos_data.get('vs_3bet', {}).get(villain, {})
        if not vs_3b:
            return {}
        return {'4bet': vs_3b.get('4bet', []), 'call': vs_3b.get('call', [])}

    return {}


# Posições cujo RFI tem base direta no PDF (% do curso), por bucket de stack.
# Demais posições são extrapolações dos princípios → 'derivado'.
_RFI_CURSO = {
    75: {'UTG', 'HJ', 'CO', 'BTN'},   # Open Raise Early: %s do PDF
    10: {'UTG', 'HJ', 'CO', 'BTN', 'SB'},  # Open Shove: %s do PDF
    # 15 e 30: composição não vem combo-a-combo do PDF → derivado
}


def _spot_source(pos, scenario, stack_bb, mode):
    """Proveniência do spot: 'curso' (base no PDF), 'derivado' (extrapolado dos
    princípios) ou 'sem_material' (MTT — fora do escopo do curso SnG)."""
    if _normalize_mode(mode) != 'sng':
        return 'sem_material'
    data    = _load(_pick_file(stack_bb, mode))
    derived = data.get('_derived_spots', {})
    try:
        bucket = int(str(data.get('stack', '')).replace('bb', '').strip())
    except ValueError:
        bucket = None

    if scenario == 'vs_3bet':
        return 'derivado'  # o curso não cobre enfrentar 3-bet
    if scenario == 'vs_RFI':
        villain = REPRESENTATIVE_VILLAIN.get(pos)
        label   = f"{pos} vs {villain}"
        return 'derivado' if label in set(derived.get('vs_RFI', [])) else 'curso'
    if scenario == 'RFI':
        return 'curso' if pos in _RFI_CURSO.get(bucket, set()) else 'derivado'
    return 'derivado'


def _correct_action(hand, buckets):
    for action, hands in buckets.items():
        if hand in hands:
            return action
    return 'fold'


def generate_question(player_count=9, stack_bb=None, focus_pos=None, focus_scenario=None, mode=DEFAULT_MODE):
    mode = _normalize_mode(mode)
    if stack_bb is None:
        stack_bb = random.choice(available_stacks(mode))

    positions = POSITIONS_BY_COUNT.get(player_count, POSITIONS_BY_COUNT[9])
    hands = all_hands()

    # Filtra posição se modo focado ativo
    if focus_pos and focus_pos in positions:
        candidate_positions = [focus_pos]
    else:
        candidate_positions = positions

    for _ in range(200):
        pos = random.choice(candidate_positions)
        possible_scenarios = []
        if CAN_RFI.get(pos):        possible_scenarios.append('RFI')
        if CAN_FACE_RAISE.get(pos): possible_scenarios.append('vs_RFI')
        if CAN_RFI.get(pos):        possible_scenarios.append('vs_3bet')

        # Filtra cenário se modo focado ativo
        if focus_scenario:
            if focus_scenario in possible_scenarios:
                possible_scenarios = [focus_scenario]
            else:
                continue

        if not possible_scenarios:
            continue

        scenario = random.choice(possible_scenarios)
        buckets  = _get_buckets(pos, scenario, stack_bb, mode)
        if not buckets:
            continue
        # No modo SnG, vs_RFI/vs_3bet ainda não foram calibrados → buckets ficam vazios
        if scenario != 'RFI' and not any(buckets.values()):
            continue

        # vs_3bet só faz sentido com mãos que você teria aberto (raise OU shove)
        if scenario == 'vs_3bet':
            rfi_b = _get_buckets(pos, 'RFI', stack_bb, mode)
            pool  = list(set(rfi_b.get('raise', []) + rfi_b.get('shove', []))) or hands
        else:
            pool = hands

        hand    = random.choice(pool)
        correct = _correct_action(hand, buckets)

        villain_pos = None
        if scenario == 'vs_RFI':
            villain_pos = REPRESENTATIVE_VILLAIN.get(pos)
        elif scenario == 'vs_3bet':
            villain_pos = REPRESENTATIVE_3BET.get(pos)

        return {
            'pos':            pos,
            'scenario':       scenario,
            'hand':           hand,
            'stack':          stack_bb,
            'mode':           mode,
            'correct_action': correct,
            'buckets':        buckets,
            'villain_pos':    villain_pos,
            'phase':          _phase_for(stack_bb),
            'source':         _spot_source(pos, scenario, stack_bb, mode),
        }

    return None


def _phase_for(stack_bb):
    """Fase derivada do stack (mesma lógica de insights_api._phase_for)."""
    if stack_bb <= 12:  return 'shortstack'
    if stack_bb <= 20:  return 'late'
    if stack_bb <= 50:  return 'middle'
    return 'early'


def check_answer(question, user_action):
    correct = question['correct_action']
    if user_action == correct:
        return {
            'result':  'correct',
            'label':   'Correto!',
            'correct': correct,
        }
    return {
        'result':  'wrong',
        'label':   'Errado',
        'correct': correct,
    }
