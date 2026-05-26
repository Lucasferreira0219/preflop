import json
import os
import random

RANGES_DIR = os.path.join(os.path.dirname(__file__), "ranges")

STACK_PROFILES = [
    (20,  "ranges_20bb.json"),
    (35,  "ranges_35bb.json"),
    (50,  "ranges_50bb.json"),
    (100, "ranges_100bb.json"),
]

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
    """Pré-carrega todos os perfis de stack — chamado no startup."""
    for _, fname in STACK_PROFILES:
        _load(fname)
    return len(_cache)


def _pick_file(stack_bb):
    stack_bb = max(10, min(stack_bb, 100))
    best, best_dist = STACK_PROFILES[0][1], abs(stack_bb - STACK_PROFILES[0][0])
    for pivot, fname in STACK_PROFILES[1:]:
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


def _get_buckets(pos, scenario, stack_bb):
    fname = _pick_file(stack_bb)
    data = _load(fname)
    positions = data.get('positions', {})
    pos_data  = positions.get(pos, {})

    if scenario == 'RFI':
        raise_hands = pos_data.get('RFI', [])
        return {'raise': raise_hands, 'call': []}

    if scenario == 'vs_RFI':
        villain = REPRESENTATIVE_VILLAIN.get(pos)
        if not villain:
            return {}
        vs_rfi = pos_data.get('vs_RFI', {}).get(villain)
        if not vs_rfi:
            vs_rfi = positions.get('BB', {}).get('vs_RFI', {}).get(villain, {})
        if not vs_rfi:
            return {}
        return {'3bet': vs_rfi.get('3bet', []), 'call': vs_rfi.get('call', [])}

    if scenario == 'vs_3bet':
        villain = REPRESENTATIVE_3BET.get(pos)
        if not villain:
            return {}
        vs_3b = pos_data.get('vs_3bet', {}).get(villain, {})
        if not vs_3b:
            return {}
        return {'4bet': vs_3b.get('4bet', []), 'call': vs_3b.get('call', [])}

    return {}


def _correct_action(hand, buckets):
    for action, hands in buckets.items():
        if hand in hands:
            return action
    return 'fold'


def generate_question(player_count=9, stack_bb=None, focus_pos=None, focus_scenario=None):
    if stack_bb is None:
        stack_bb = random.choice([20, 35, 50, 100])

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
        buckets  = _get_buckets(pos, scenario, stack_bb)
        if not buckets:
            continue

        # vs_3bet só faz sentido com mãos que você teria aberto
        if scenario == 'vs_3bet':
            rfi_hands = _get_buckets(pos, 'RFI', stack_bb).get('raise', [])
            pool = rfi_hands if rfi_hands else hands
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
            'correct_action': correct,
            'buckets':        buckets,
            'villain_pos':    villain_pos,
        }

    return None


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
