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

const initialMode = (window.PreflopAPI && PreflopAPI.getMode) ? PreflopAPI.getMode() : 'mtt';
let stackOptions  = (window.PreflopAPI && PreflopAPI.stacksForMode) ? PreflopAPI.stacksForMode(initialMode) : [20,35,50,100];
const _seedStack  = stackOptions.includes(savedPrefs.stack) ? savedPrefs.stack : stackOptions[Math.min(1, stackOptions.length-1)];

const state = {
  mode:        initialMode,
  stack:       _seedStack,
  playerCount: savedPrefs.playerCount || 9,
  phase:       savedPrefs.phase || 'auto', // 'auto' | 'early' | 'middle' | 'late' | 'shortstack'
  heroPos:     null,
  villain:     null,   // 'none' = RFI; ou string com posição do vilão
  scenario:    null,   // derivado de (heroPos, villain)
  rangeData:   null,
  villainsWithData: {}, // { villain_pos: scenario } — populado via list_villains
};

function persistPrefs() {
  C.lsSet(PREFS_KEY, { stack: state.stack, playerCount: state.playerCount, phase: state.phase });
}

// ── Refs ─────────────────────────────────────────────────────────────────────

const el = {
  modePills:       document.getElementById('modePills'),
  stackSlider:     document.getElementById('stackSlider'),
  stackValue:      document.getElementById('stackValue'),
  resetBtn:        document.getElementById('resetBtn'),
  countMinus:      document.getElementById('countMinus'),
  countPlus:       document.getElementById('countPlus'),
  countValue:      document.getElementById('countValue'),
  phasePills:      document.getElementById('phasePills'),
  posPills:        document.getElementById('posPills'),
  posArrowLeft:    document.getElementById('posArrowLeft'),
  posArrowRight:   document.getElementById('posArrowRight'),
  villainPills:    document.getElementById('villainPills'),
  villainArrowLeft:  document.getElementById('villainArrowLeft'),
  villainArrowRight: document.getElementById('villainArrowRight'),
  gridPlaceholder: document.getElementById('gridPlaceholder'),
  gridWrap:        document.getElementById('gridWrap'),
  scenarioLabel:   document.getElementById('scenarioLabel'),
  gridRowLabels:   document.getElementById('gridRowLabels'),
  handGrid:        document.getElementById('handGrid'),
  legend:          document.getElementById('legend'),
  insights:        document.getElementById('insights'),
  tooltip:         document.getElementById('tooltip'),
};

function activePositions() {
  return C.POSITIONS_BY_COUNT[state.playerCount] || C.ALL_POSITIONS;
}

// Deriva cenário a partir da posição do hero e do vilão escolhido
// villain === 'none' → RFI (hero abre); antes do hero → vs_RFI; depois → vs_3bet
function deriveScenario(hero, villain) {
  if (!hero) return null;
  if (villain === 'none' || !villain) return 'RFI';
  const positions = activePositions();
  const hi = positions.indexOf(hero);
  const vi = positions.indexOf(villain);
  if (hi === -1 || vi === -1) return null;
  return vi < hi ? 'vs_RFI' : 'vs_3bet';
}

function defaultVillainFor(hero) {
  // RFI sempre é o default se a posição permite abrir
  if (CAN_RFI[hero]) return 'none';
  // Para BB, vai pro primeiro vilão antes (vs_RFI)
  const positions = activePositions();
  const before = positions.filter(p => positions.indexOf(p) < positions.indexOf(hero));
  return before.length ? before[before.length - 1] : null;
}

// ── Init ─────────────────────────────────────────────────────────────────────

function applyModeUI() {
  // Marca pill ativa + move o thumb do toggle (classe is-sng controla a animação)
  if (el.modePills) {
    el.modePills.classList.toggle('is-sng', state.mode === 'sng');
    el.modePills.querySelectorAll('.mode-pill').forEach(b => {
      b.classList.toggle('selected', b.dataset.mode === state.mode);
    });
  }
  // Slider livre em ambos os modos (10-100bb). Backend faz snap pro range mais próximo.
  el.stackSlider.min   = 10;
  el.stackSlider.max   = 100;
  el.stackSlider.value = state.stack;
  el.stackSlider.disabled = false;
  el.stackSlider.classList.remove('disabled');
  el.stackValue.textContent = state.stack;
}

function renderPhasePills() {
  if (!el.phasePills) return;
  el.phasePills.querySelectorAll('.phase-pill').forEach(btn => {
    btn.classList.toggle('selected', btn.dataset.phase === state.phase);
  });
}

function changePhase(newPhase) {
  if (!['auto','early','middle','late','shortstack'].includes(newPhase)) return;
  if (newPhase === state.phase) return;
  state.phase = newPhase;
  persistPrefs();
  renderPhasePills();
  if (state.heroPos && state.villain) refreshRange();
  else loadGenericInsights();
}

function changeMode(newMode) {
  if (newMode === state.mode) return;
  state.mode   = newMode;
  PreflopAPI.setMode(newMode);
  stackOptions = PreflopAPI.stacksForMode(newMode);
  // Stack atual pode não existir no novo modo → snap pro mais próximo permitido
  if (!stackOptions.includes(state.stack)) {
    state.stack = stackOptions[Math.min(1, stackOptions.length - 1)];
    persistPrefs();
  }
  applyModeUI();
  if (state.heroPos) {
    loadVillainsWithData().then(() => {
      renderVillainPills();
      if (state.villain) refreshRange();
    });
  } else {
    loadGenericInsights();
  }
}

function init() {
  el.stackSlider.value     = state.stack;
  el.stackValue.textContent = state.stack;
  el.countValue.textContent = state.playerCount;
  el.countMinus.disabled    = state.playerCount <= 2;
  el.countPlus.disabled     = state.playerCount >= 9;

  applyModeUI();

  if (el.modePills) {
    el.modePills.addEventListener('click', e => {
      const btn = e.target.closest('.mode-pill');
      if (!btn) return;
      changeMode(btn.dataset.mode);
    });
  }

  renderPhasePills();
  if (el.phasePills) {
    el.phasePills.addEventListener('click', e => {
      const btn = e.target.closest('.phase-pill');
      if (!btn) return;
      changePhase(btn.dataset.phase);
    });
  }

  renderPosPills();
  renderVillainPills();

  // Mostra insights de fase mesmo sem nenhuma posição selecionada
  loadGenericInsights();

  el.stackSlider.addEventListener('input', () => {
    state.stack = parseInt(el.stackSlider.value);
    el.stackValue.textContent = state.stack;
    persistPrefs();
    if (state.heroPos) {
      // stack mudou → vilões com dados podem mudar
      loadVillainsWithData().then(() => {
        renderVillainPills();
        if (state.villain) refreshRange();
      });
    } else {
      loadGenericInsights();
    }
  });
  el.resetBtn.addEventListener('click', resetAll);
  el.countMinus.addEventListener('click', () => changePlayerCount(-1));
  el.countPlus.addEventListener('click',  () => changePlayerCount(+1));

  el.villainPills.addEventListener('click', e => {
    const btn = e.target.closest('.villain-pill');
    if (!btn || btn.classList.contains('inactive')) return;
    chooseVillain(btn.dataset.villain);
  });

  el.posArrowLeft.addEventListener('click',  () => navigatePosition(-1));
  el.posArrowRight.addEventListener('click', () => navigatePosition(+1));
  el.villainArrowLeft.addEventListener('click',  () => navigateVillain(-1));
  el.villainArrowRight.addEventListener('click', () => navigateVillain(+1));

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
    return;
  }
  if (state.heroPos) {
    // Vilão pode ter sumido também
    if (state.villain && state.villain !== 'none' && !activePositions().includes(state.villain)) {
      state.villain = defaultVillainFor(state.heroPos);
    }
    renderVillainPills();
    if (state.villain) refreshRange();
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
  // Carrega quais vilões têm dados pra essa posição/stack, depois renderiza pills
  loadVillainsWithData().then(() => {
    // Default: RFI (vilão = 'none'); se posição não pode RFI (BB), pega vilão anterior
    state.villain = defaultVillainFor(pos);
    renderVillainPills();
    if (state.villain) refreshRange();
  });
}

// ── Pills de vilão ──────────────────────────────────────────────────────────

function loadVillainsWithData() {
  if (!state.heroPos) {
    state.villainsWithData = {};
    return Promise.resolve();
  }
  return PreflopAPI.list_villains(state.heroPos, state.stack, state.mode)
    .then(data => { state.villainsWithData = data || {}; })
    .catch(err => { console.error('list_villains:', err); state.villainsWithData = {}; });
}

function villainHasData(villain) {
  if (villain === 'none') return CAN_RFI[state.heroPos];
  return Object.prototype.hasOwnProperty.call(state.villainsWithData, villain);
}

function renderVillainPills() {
  el.villainPills.innerHTML = '';
  if (!state.heroPos) return;
  const positions = activePositions();
  const order = [];

  // Pill "Ninguém" (= RFI)
  if (CAN_RFI[state.heroPos]) order.push({ key: 'none', label: 'Ninguém' });

  // Demais posições, na ordem da mesa, exceto o hero
  positions.forEach(pos => {
    if (pos === state.heroPos) return;
    order.push({ key: pos, label: POS_INFO[pos].label });
  });

  order.forEach(({ key, label }) => {
    const btn = document.createElement('button');
    const scen = deriveScenario(state.heroPos, key);
    const hasData = villainHasData(key);
    const isSelected = state.villain === key;
    btn.className = 'villain-pill'
      + ` scen-${scen}`
      + (isSelected ? ' selected' : '')
      + (hasData ? '' : ' no-data');
    btn.dataset.villain = key;
    btn.textContent = label;
    btn.title = hasData
      ? scenarioTooltip(scen, key)
      : 'Sem range cadastrado pra esse vilão ainda';
    el.villainPills.appendChild(btn);
  });
}

function scenarioTooltip(scen, villainKey) {
  if (scen === 'RFI') return 'Você abre o pot (RFI)';
  const lbl = villainKey === 'none' ? '' : (POS_INFO[villainKey]?.label || villainKey);
  if (scen === 'vs_RFI')  return `${lbl} abriu antes de você — você responde`;
  if (scen === 'vs_3bet') return `Você abriu, ${lbl} re-aumentou (3-bet)`;
  return '';
}

function chooseVillain(villain) {
  if (!state.heroPos) return;
  state.villain = villain;
  renderVillainPills();
  refreshRange();
}

function navigateVillain(dir) {
  if (!state.heroPos) return;
  const pills = Array.from(el.villainPills.querySelectorAll('.villain-pill'));
  if (!pills.length) return;
  const keys = pills.map(p => p.dataset.villain);
  const cur = state.villain ? keys.indexOf(state.villain) : -1;
  const next = cur === -1
    ? (dir === 1 ? 0 : keys.length - 1)
    : (cur + dir + keys.length) % keys.length;
  chooseVillain(keys[next]);
}

// ── Range ────────────────────────────────────────────────────────────────────

function refreshRange() {
  const scen = deriveScenario(state.heroPos, state.villain);
  state.scenario = scen;
  const villainArg = (state.villain && state.villain !== 'none') ? state.villain : null;

  PreflopAPI.get_range(state.heroPos, scen || 'RFI', state.stack, state.mode, villainArg)
    .then(data => { state.rangeData = data; renderGrid(data); })
    .catch(err => console.error('get_range:', err));

  // Insights educacionais — independente do grid (degradação silenciosa)
  const phaseArg = (state.phase && state.phase !== 'auto') ? state.phase : null;
  PreflopAPI.get_insights(state.mode, state.stack, state.heroPos, scen || 'RFI', villainArg, state.playerCount, phaseArg)
    .then(ins => renderInsights(ins))
    .catch(err => { console.warn('insights unavailable:', err); hideInsights(); });
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
  if (action === 'shove') return scenario === 'vs_RFI' ? 'Resteal (all-in)' : 'Shove (all-in)';
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
  shove: { color:'#d32f2f', emoji:'🔴' },
  call:  { color:'#e65100', emoji:'🟠' },
  fold:  { color:'#37474f', emoji:'⬛' },
};

const ACTION_DESC = {
  rfi:   { name:'Abrir (RFI)',      desc:'Você abre o pot com um raise' },
  raise: { name:'Abrir (RFI)',      desc:'Você abre o pot com um raise' },
  '3bet':{ name:'3-Bet',            desc:'Re-aumenta o raise do vilão' },
  '4bet':{ name:'4-Bet',           desc:'Re-aumenta o 3-bet do vilão' },
  shove: { name:'Shove / Resteal',  desc:'All-in pré-flop (push-fold / resteal)' },
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
  if (sub) sub.textContent = 'Clique numa posição acima pra ver o range — informações da fase aparecem abaixo.';
}

function showGridError(msg) {
  hideGrid();
  const sub = el.gridPlaceholder.querySelector('.placeholder-sub');
  if (sub) sub.textContent = msg;
}

function resetAll() {
  Object.assign(state, { heroPos:null, villain:null, scenario:null, rangeData:null, villainsWithData:{} });
  renderPosPills();
  renderVillainPills();
  hideGrid();
  loadGenericInsights();
}

// ── Insights educacionais ───────────────────────────────────────────────────

const GLOSSARY_BY_SCENARIO = {
  RFI:     ['RFI', 'Limp', 'FoldEquity', 'FragmentacaoRange'],
  vs_RFI:  ['3bet', 'ImpliedOdds', 'Resteal'],
  vs_3bet: ['4bet', 'ChipEV', 'EV'],
};
const GLOSSARY_SNG_ALWAYS = ['RP', 'ICM'];

function hideInsights() {
  if (!el.insights) return;
  el.insights.classList.add('hidden');
  el.insights.innerHTML = '';
}

// Carrega insights "genéricos" (sem hero/scenario) — mostra só fase + glossário básico
function loadGenericInsights() {
  if (state.heroPos) return; // se há hero, refreshRange cuida
  const phaseArg = (state.phase && state.phase !== 'auto') ? state.phase : null;
  PreflopAPI.get_insights(state.mode, state.stack, null, null, null, state.playerCount, phaseArg)
    .then(ins => renderInsights(ins))
    .catch(err => { console.warn('insights unavailable:', err); hideInsights(); });
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function buildMetaBadge(ins) {
  const parts = [];
  if (ins.open_pct != null) parts.push(`${ins.open_pct}% das mãos`);
  if (ins.phase)            parts.push(ins.phase.label);
  if (ins.phase && ins.phase.rp_avg_pct != null) parts.push(`RP ~${ins.phase.rp_avg_pct}%`);
  if (!parts.length) return '';
  return `<span class="scenario-meta">${parts.map(escapeHtml).join(' · ')}</span>`;
}

function renderSpotCard(ins) {
  const spot = ins.spot;
  const ctx  = ins.stack_context;
  const uni  = ins.universal_derived;

  // Se nada de spot/uni e não há hero selecionado, esconde card (placeholder de fase fica)
  if (!spot && !uni && !state.heroPos) return '';
  if (!spot && !ctx && !uni) return '';

  // Caso sem spot: usa universal_derived (princípios) + stack_context
  if (!spot) {
    const principlesHtml = uni && uni.principles
      ? `<p><strong>Princípios aplicados:</strong></p><ul class="insight-list">${uni.principles.map(p => `<li>${escapeHtml(p)}</li>`).join('')}</ul>`
      : '';
    const mistakesHtml = uni && uni.common_mistakes
      ? `<p><strong>Cuidados:</strong></p><ul class="insight-list">${uni.common_mistakes.map(m => `<li>${escapeHtml(m)}</li>`).join('')}</ul>`
      : '';
    return `
      <div class="insight-card insight-spot insight-construction">
        <h3>📖 Sobre este spot <span class="badge-derived">DERIVADO</span></h3>
        <p class="insight-construction-msg">⚠️ O PDF Reg Life NÃO cobre este spot específico. As mãos no grid foram extrapoladas aplicando os princípios gerais do PDF.</p>
        ${uni ? `<p>${escapeHtml(uni.summary || '')}</p>` : ''}
        ${principlesHtml}
        ${mistakesHtml}
        ${ctx ? `<p class="insight-narrative"><strong>${escapeHtml(ctx.label)}:</strong> ${escapeHtml(ctx.narrative)}</p>` : ''}
      </div>`;
  }

  const handsLine = (label, hands) => {
    if (!hands || !hands.length) return '';
    return `<p><strong>${label}:</strong> ${hands.map(escapeHtml).join(', ')}</p>`;
  };

  const derivedBadge = ins.scenario_derived && !spot._derived ? '' : (spot._derived || ins.scenario_derived
    ? '<span class="badge-derived">DERIVADO</span>'
    : '<span class="badge-source">PDF</span>');

  return `
    <div class="insight-card insight-spot">
      <h3>📖 ${escapeHtml(spot.title || 'Sobre este spot')} ${derivedBadge}</h3>
      <p>${escapeHtml(spot.summary || '')}</p>
      ${handsLine('Mãos-chave', spot.key_hands)}
      ${handsLine('3-Bet com', spot.key_hands_3bet)}
      ${handsLine('Call com',  spot.key_hands_call)}
      ${handsLine('4-Bet com', spot.key_hands_4bet)}
      ${spot.size_recommendation ? `<p><strong>Tamanho:</strong> ${escapeHtml(spot.size_recommendation)}</p>` : ''}
      ${spot.icm_note ? `<p class="insight-icm-note"><strong>ICM:</strong> ${escapeHtml(spot.icm_note)}</p>` : ''}
    </div>`;
}

function renderHowToPlayCard(phase) {
  if (!phase || !phase.how_to_play || !phase.how_to_play.length) return '';
  return `
    <div class="insight-card insight-howto">
      <h3>🎓 Como jogar — ${escapeHtml(phase.label)}</h3>
      <ul class="insight-list">
        ${phase.how_to_play.map(h => `<li>${escapeHtml(h)}</li>`).join('')}
      </ul>
    </div>`;
}

function renderMentalityCard(phase) {
  if (!phase || !phase.mentality) return '';
  return `
    <div class="insight-card insight-mentality">
      <h3>🧠 Mentalidade — ${escapeHtml(phase.label)}</h3>
      <p>${escapeHtml(phase.mentality)}</p>
      ${phase.frequency_tips ? `<p class="insight-narrative"><strong>Frequências típicas:</strong> ${escapeHtml(phase.frequency_tips)}</p>` : ''}
    </div>`;
}

function renderMistakesCard(spot, positionMistakes) {
  const a = (spot && spot.common_mistakes) || [];
  const b = positionMistakes || [];
  // Dedupe preservando ordem
  const seen = new Set();
  const all  = [...a, ...b].filter(m => { if (seen.has(m)) return false; seen.add(m); return true; });
  if (!all.length) return '';

  return `
    <div class="insight-card insight-mistakes">
      <h3>⚠️ Erros comuns</h3>
      <ul class="insight-list">
        ${all.map(m => `<li>${escapeHtml(m)}</li>`).join('')}
      </ul>
    </div>`;
}

function renderPhaseCard(phase, openPct, stackChosen, explicit) {
  if (!phase) return '';
  // Aviso se fase escolhida manualmente não combina com stack atual
  let mismatch = '';
  if (explicit && phase.stack_range && stackChosen != null) {
    const [lo, hi] = phase.stack_range;
    if (stackChosen < lo || stackChosen > hi) {
      mismatch = `<p class="insight-mismatch">⚠️ Stack atual (${stackChosen}bb) está fora da faixa típica desta fase (${lo}-${hi}bb). Range do grid pode não refletir a fase escolhida.</p>`;
    }
  }
  const explicitTag = explicit ? '<span class="phase-tag-explicit">manual</span>' : '<span class="phase-tag-auto">auto</span>';
  return `
    <div class="insight-card insight-phase">
      <h3>🎯 ${escapeHtml(phase.label)} ${explicitTag}</h3>
      <p>${escapeHtml(phase.summary || '')}</p>
      ${phase.rp_avg_pct != null ? `<p><strong>Risk Premium médio:</strong> ~${phase.rp_avg_pct}%</p>` : ''}
      ${phase.stack_range ? `<p><strong>Faixa de stack:</strong> ${phase.stack_range[0]}–${phase.stack_range[1]} bb</p>` : ''}
      ${mismatch}
    </div>`;
}

function renderGlossaryCard(glossary, scenario, mode) {
  if (!glossary || !Object.keys(glossary).length) return '';

  const keys = (GLOSSARY_BY_SCENARIO[scenario] || []).slice();
  if (mode === 'sng') keys.push(...GLOSSARY_SNG_ALWAYS);

  const items = keys
    .map(k => glossary[k])
    .filter(Boolean)
    .map(g => `<dt>${escapeHtml(g.term)}</dt><dd>${escapeHtml(g.definition)}</dd>`)
    .join('');

  if (!items) return '';

  return `
    <details class="insight-card insight-glossary glossary-collapse" open>
      <summary>📚 Glossário desta situação</summary>
      <dl class="insight-glossary-list">${items}</dl>
    </details>`;
}

function renderInsights(ins) {
  if (!ins || !el.insights) return hideInsights();

  // Atualiza o título do scenarioLabel com o badge inline
  if (state.rangeData && el.scenarioLabel) {
    el.scenarioLabel.innerHTML = escapeHtml(buildScenarioTitle(state.rangeData)) + buildMetaBadge(ins);
  }

  // Cards (em ordem visual)
  const html = [
    renderSpotCard(ins),
    renderHowToPlayCard(ins.phase),
    renderMistakesCard(ins.spot, ins.position_mistakes),
    renderPhaseCard(ins.phase, ins.open_pct, ins.stack, ins.phase_explicit),
    renderMentalityCard(ins.phase),
    renderGlossaryCard(ins.glossary, state.scenario, ins.mode),
  ].filter(Boolean).join('');

  if (!html.trim()) {
    hideInsights();
    return;
  }

  el.insights.innerHTML = html;
  el.insights.classList.remove('hidden');
}

// ── Boot ─────────────────────────────────────────────────────────────────────

PreflopAPI.ready(init);
