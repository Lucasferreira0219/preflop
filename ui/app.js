'use strict';

// ─────────────────────────────────────────────────────────────────────────────
//  Consulta — single-column compacto com pills (sem mesa SVG)
// ─────────────────────────────────────────────────────────────────────────────

const C = window.PreflopCore;

const POS_INFO = {
  UTG:  { label:'UTG',   full:'Under The Gun' },
  UTG1: { label:'UTG+1', full:'Under The Gun +1' },
  UTG2: { label:'UTG+2', full:'Under The Gun +2' },
  MP:   { label:'MP',    full:'Middle Position' },
  HJ:   { label:'HJ',    full:'Hijack' },
  CO:   { label:'CO',    full:'Cutoff' },
  BTN:  { label:'BTN',   full:'Button' },
  SB:   { label:'SB',    full:'Small Blind' },
  BB:   { label:'BB',    full:'Big Blind' },
};

// Posições que podem ter aberto antes do hero
const CAN_RAISE_BEFORE = {
  UTG:[], UTG1:['UTG'], UTG2:['UTG','UTG1'],
  MP:['UTG','UTG1','UTG2'], HJ:['UTG','UTG1','UTG2','MP'],
  CO:['UTG','UTG1','UTG2','MP','HJ'],
  BTN:['UTG','UTG1','UTG2','MP','HJ','CO'],
  SB:['UTG','UTG1','UTG2','MP','HJ','CO','BTN'],
  BB:['UTG','UTG1','UTG2','MP','HJ','CO','BTN','SB'],
};

// Posições que podem 3-betar o raise do hero
const CAN_3BET_HERO = {
  UTG:  ['MP','HJ','CO','BTN','SB','BB'],
  UTG1: ['UTG2','MP','HJ','CO','BTN','SB','BB'],
  UTG2: ['MP','HJ','CO','BTN','SB','BB'],
  MP:   ['HJ','CO','BTN','SB','BB'],
  HJ:   ['CO','BTN','SB','BB'],
  CO:   ['BTN','SB','BB'],
  BTN:  ['SB','BB'],
  SB:   ['BB'],
  BB:   [],
};

const CAN_RFI = {
  UTG:true, UTG1:true, UTG2:true, MP:true,
  HJ:true,  CO:true,   BTN:true,  SB:true, BB:false,
};

// ── Estado ───────────────────────────────────────────────────────────────────

const PREFS_KEY  = 'preflop.main.prefs.v1';
const savedPrefs = C.lsGet(PREFS_KEY, {});

const state = {
  stack:       savedPrefs.stack || 35,
  playerCount: savedPrefs.playerCount || 9,
  heroPos:     null,
  scenario:    null,
  rangeData:   null,
};

function persistPrefs() {
  C.lsSet(PREFS_KEY, { stack: state.stack, playerCount: state.playerCount });
}

// ── Refs ─────────────────────────────────────────────────────────────────────

const el = {
  stackSlider:     document.getElementById('stackSlider'),
  stackValue:      document.getElementById('stackValue'),
  resetBtn:        document.getElementById('resetBtn'),
  countMinus:      document.getElementById('countMinus'),
  countPlus:       document.getElementById('countPlus'),
  countValue:      document.getElementById('countValue'),
  posPills:        document.getElementById('posPills'),
  posArrowLeft:    document.getElementById('posArrowLeft'),
  posArrowRight:   document.getElementById('posArrowRight'),
  scenPills:       document.getElementById('scenPills'),
  gridPlaceholder: document.getElementById('gridPlaceholder'),
  gridWrap:        document.getElementById('gridWrap'),
  scenarioLabel:   document.getElementById('scenarioLabel'),
  gridRowLabels:   document.getElementById('gridRowLabels'),
  handGrid:        document.getElementById('handGrid'),
  legend:          document.getElementById('legend'),
  tooltip:         document.getElementById('tooltip'),
};

function activePositions() {
  return C.POSITIONS_BY_COUNT[state.playerCount] || C.ALL_POSITIONS;
}

function defaultScenarioFor(pos) {
  if (CAN_RFI[pos]) return 'RFI';
  if ((CAN_RAISE_BEFORE[pos] || []).length) return 'vs_RFI';
  return 'RFI';
}

function isScenarioValid(pos, scen) {
  if (!pos) return false;
  if (scen === 'RFI')     return !!CAN_RFI[pos];
  if (scen === 'vs_RFI')  return (CAN_RAISE_BEFORE[pos] || []).some(p => activePositions().includes(p));
  if (scen === 'vs_3bet') return CAN_RFI[pos] && (CAN_3BET_HERO[pos] || []).some(p => activePositions().includes(p));
  return false;
}

// ── Init ─────────────────────────────────────────────────────────────────────

function init() {
  el.stackSlider.value     = state.stack;
  el.stackValue.textContent = state.stack;
  el.countValue.textContent = state.playerCount;
  el.countMinus.disabled    = state.playerCount <= 2;
  el.countPlus.disabled     = state.playerCount >= 9;

  renderPosPills();
  renderScenPills();

  el.stackSlider.addEventListener('input', () => {
    state.stack = parseInt(el.stackSlider.value);
    el.stackValue.textContent = state.stack;
    persistPrefs();
    if (state.scenario && state.heroPos) refreshRange();
  });
  el.resetBtn.addEventListener('click', resetAll);
  el.countMinus.addEventListener('click', () => changePlayerCount(-1));
  el.countPlus.addEventListener('click',  () => changePlayerCount(+1));

  el.scenPills.addEventListener('click', e => {
    const btn = e.target.closest('.scen-pill');
    if (!btn || btn.disabled) return;
    chooseScenario(btn.dataset.scen);
  });

  el.posArrowLeft.addEventListener('click',  () => navigatePosition(-1));
  el.posArrowRight.addEventListener('click', () => navigatePosition(+1));

  document.addEventListener('keydown', e => {
    const tag = (e.target && e.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'select' || tag === 'textarea') return;
    if (e.key === 'ArrowLeft')  { e.preventDefault(); navigatePosition(-1); }
    if (e.key === 'ArrowRight') { e.preventDefault(); navigatePosition(+1); }
  });
}

function navigatePosition(dir) {
  const positions = activePositions();
  const cur = state.heroPos ? positions.indexOf(state.heroPos) : -1;
  const next = cur === -1
    ? (dir === 1 ? 0 : positions.length - 1)
    : (cur + dir + positions.length) % positions.length;
  selectHero(positions[next]);
}

function changePlayerCount(dir) {
  const next = state.playerCount + dir;
  if (next < 2 || next > 9) return;
  state.playerCount = next;
  el.countValue.textContent = next;
  el.countMinus.disabled = next <= 2;
  el.countPlus.disabled  = next >= 9;
  persistPrefs();

  renderPosPills();
  // Se posição atual ficou inativa, reseta
  if (state.heroPos && !activePositions().includes(state.heroPos)) {
    resetAll();
  } else if (state.heroPos) {
    renderScenPills();
    if (state.scenario && !isScenarioValid(state.heroPos, state.scenario)) {
      chooseScenario(defaultScenarioFor(state.heroPos));
    } else if (state.scenario) {
      refreshRange();
    }
  }
}

// ── Pills de posição ────────────────────────────────────────────────────────

function renderPosPills() {
  el.posPills.innerHTML = '';
  const active = activePositions();
  C.ALL_POSITIONS.forEach(pos => {
    const btn = document.createElement('button');
    const isActive   = active.includes(pos);
    const isSelected = pos === state.heroPos;
    btn.className = 'pos-pill' +
      (isActive ? '' : ' inactive') +
      (isSelected ? ' selected' : '');
    btn.disabled = !isActive;
    btn.dataset.pos = pos;
    btn.textContent = POS_INFO[pos].label;
    btn.title = POS_INFO[pos].full;
    btn.addEventListener('click', () => selectHero(pos));
    el.posPills.appendChild(btn);
  });
}

function selectHero(pos) {
  if (!activePositions().includes(pos)) return;
  state.heroPos = pos;
  renderPosPills();
  renderScenPills();
  // Mantém cenário atual se válido, senão usa default
  const wantScen = isScenarioValid(pos, state.scenario) ? state.scenario : defaultScenarioFor(pos);
  chooseScenario(wantScen);
}

// ── Pills de cenário ────────────────────────────────────────────────────────

function renderScenPills() {
  const pos = state.heroPos;
  document.querySelectorAll('.scen-pill').forEach(btn => {
    const scen = btn.dataset.scen;
    const valid = pos ? isScenarioValid(pos, scen) : false;
    btn.disabled = !valid;
    btn.classList.toggle('inactive', !valid);
    btn.classList.toggle('selected', valid && state.scenario === scen);
  });
}

function chooseScenario(scenario) {
  if (!state.heroPos) return;
  if (!isScenarioValid(state.heroPos, scenario)) return;
  state.scenario = scenario;
  renderScenPills();
  refreshRange();
}

// ── Range ────────────────────────────────────────────────────────────────────

function refreshRange() {
  PreflopAPI.get_range(state.heroPos, state.scenario || 'RFI', state.stack)
    .then(data => { state.rangeData = data; renderGrid(data); })
    .catch(err => console.error('get_range:', err));
}

function renderGrid(data) {
  if (!data || data.error) {
    showGridError((data && data.error) || 'Sem dados para esta situação.');
    return;
  }

  el.gridPlaceholder.classList.add('hidden');
  el.gridWrap.classList.remove('hidden');

  el.scenarioLabel.textContent = buildScenarioTitle(data);

  const lookup = C.buildLookup(data.buckets);

  el.gridRowLabels.innerHTML = '';
  C.RANKS.forEach(r => {
    const d = document.createElement('div');
    d.className = 'row-label';
    d.textContent = r;
    el.gridRowLabels.appendChild(d);
  });

  el.handGrid.innerHTML = '';
  C.RANKS.forEach((r1, i) => {
    C.RANKS.forEach((r2, j) => {
      const hand   = C.encodeHand(r1, r2, i, j);
      const action = lookup[hand] || 'fold';
      const region = i === j ? 'pair' : (i < j ? 'suited' : 'offsuit');
      const cell   = document.createElement('div');
      cell.className = `hand-cell action-${action} region-${region}`;
      cell.textContent = hand;
      attachTooltip(cell, hand, action, data.buckets, data.scenario);
      el.handGrid.appendChild(cell);
    });
  });

  renderLegend(data.buckets, data.scenario);
}

function buildScenarioTitle(data) {
  const h = POS_INFO[data.my_pos]?.label || data.my_pos;
  if (data.scenario === 'RFI')
    return `${h} — Range de Abertura (RFI) — ${data.stack}bb`;
  if (data.scenario === 'vs_RFI') {
    const v = POS_INFO[data.villain_pos]?.label || data.villain_pos;
    return `${h} vs abertura do ${v} — ${data.stack}bb`;
  }
  if (data.scenario === 'vs_3bet') {
    const v = POS_INFO[data.villain_pos]?.label || data.villain_pos;
    return `${h} vs 3-bet do ${v} — ${data.stack}bb`;
  }
  return '';
}

// ── Tooltip ──────────────────────────────────────────────────────────────────

function handDescriptionRich(hand) {
  if (hand.length === 2) return `🟡 Par de ${C.RANK_PT[hand[0]]}s — diagonal`;
  const r1 = C.RANK_PT[hand[0]], r2 = C.RANK_PT[hand[1]];
  if (hand.endsWith('s')) return `🔵 ${r1}-${r2} mesmo naipe (suited)`;
  if (hand.endsWith('o')) return `🔴 ${r1}-${r2} naipes diferentes (offsuit)`;
  return hand;
}

function actionLabel(action, scenario) {
  if (action === 'rfi' || action === 'raise') {
    if (scenario === 'vs_RFI')  return '3-Bet (re-aumentar)';
    if (scenario === 'vs_3bet') return '4-Bet';
    return 'Abrir (RFI)';
  }
  if (action === '3bet') return '3-Bet (re-aumentar)';
  if (action === '4bet') return '4-Bet';
  if (action === 'call') return 'Call (pagar)';
  if (action === 'fold') return 'Fold (descartar)';
  return action;
}

function attachTooltip(cell, hand, cellAction, buckets, scenario) {
  cell.addEventListener('mouseenter', e => {
    el.tooltip.classList.remove('hidden');

    const inBucket = (act) => (buckets[act] || []).includes(hand);
    const anyBucket = Object.values(buckets).some(h => h.includes(hand));

    const lines = Object.keys(buckets)
      .filter(act => inBucket(act))
      .map(act => `
        <div class="tt-row">
          <span class="tt-action">${actionLabel(C.normalizeAction(act), scenario)}</span>
          <span class="tt-value">✓</span>
        </div>`)
      .join('');

    el.tooltip.innerHTML = `
      <div class="tt-hand">${hand}</div>
      <div class="tt-hand-desc">${handDescriptionRich(hand)}</div>
      <hr class="tt-divider"/>
      ${anyBucket ? lines : '<span class="tt-fold">Fold — descartar esta mão</span>'}
    `;
    positionTooltip(e);
  });
  cell.addEventListener('mousemove', positionTooltip);
  cell.addEventListener('mouseleave', () => el.tooltip.classList.add('hidden'));
}

function positionTooltip(e) {
  const tt = el.tooltip, pad = 14;
  let x = e.clientX + pad, y = e.clientY + pad;
  if (x + 220 > window.innerWidth)  x = e.clientX - 220 - pad;
  if (y + 120 > window.innerHeight) y = e.clientY - 120 - pad;
  tt.style.left = x + 'px';
  tt.style.top  = y + 'px';
}

// ── Legenda ──────────────────────────────────────────────────────────────────

const LEGEND_DEF = {
  rfi:   { color:'#2e7d32', emoji:'🟢' },
  raise: { color:'#2e7d32', emoji:'🟢' },
  '3bet':{ color:'#1565c0', emoji:'🔵' },
  '4bet':{ color:'#6a1b9a', emoji:'🟣' },
  call:  { color:'#e65100', emoji:'🟠' },
  fold:  { color:'#37474f', emoji:'⬛' },
};

const ACTION_DESC = {
  rfi:   { name:'Abrir (RFI)',      desc:'Você abre o pot com um raise' },
  raise: { name:'Abrir (RFI)',      desc:'Você abre o pot com um raise' },
  '3bet':{ name:'3-Bet',            desc:'Re-aumenta o raise do vilão' },
  '4bet':{ name:'4-Bet',           desc:'Re-aumenta o 3-bet do vilão' },
  call:  { name:'Call',             desc:'Apenas paga a aposta do vilão' },
  fold:  { name:'Fold',             desc:'Descarta a mão' },
};

function renderLegend(buckets, scenario) {
  el.legend.innerHTML = '<div class="legend-title">Legenda:</div>';
  const shown = new Set();

  Object.entries(buckets).forEach(([act, hands]) => {
    if (!hands.length) return;
    const norm = C.normalizeAction(act);
    if (shown.has(norm)) return;
    shown.add(norm);
    const def  = LEGEND_DEF[norm] || { color:'#555', emoji:'⬜' };
    const info = ACTION_DESC[norm] || { name: act, desc: '' };
    el.legend.innerHTML += legendItem(def.color, def.emoji, info.name, info.desc);
  });

  if (!shown.has('fold')) {
    el.legend.innerHTML += legendItem(LEGEND_DEF.fold.color, LEGEND_DEF.fold.emoji, ACTION_DESC.fold.name, ACTION_DESC.fold.desc);
  }
}

function legendItem(color, emoji, name, desc) {
  return `
    <div class="legend-item">
      <div class="legend-color" style="background:${color}"></div>
      <div class="legend-info">
        <span class="legend-name">${emoji} ${name}</span>
        <span class="legend-desc">${desc}</span>
      </div>
    </div>`;
}

// ── Utilitários ──────────────────────────────────────────────────────────────

function hideGrid() {
  el.gridPlaceholder.classList.remove('hidden');
  el.gridWrap.classList.add('hidden');
  const sub = el.gridPlaceholder.querySelector('.placeholder-sub');
  if (sub) sub.textContent = 'Clique numa posição acima pra ver o range.';
}

function showGridError(msg) {
  hideGrid();
  const sub = el.gridPlaceholder.querySelector('.placeholder-sub');
  if (sub) sub.textContent = msg;
}

function resetAll() {
  Object.assign(state, { heroPos:null, scenario:null, rangeData:null });
  renderPosPills();
  renderScenPills();
  hideGrid();
}

// ── Boot ─────────────────────────────────────────────────────────────────────

PreflopAPI.ready(init);
