'use strict';

// ─────────────────────────────────────────────────────────────────────────────
//  Simulador — usa window.PreflopCore (shared/core.js)
// ─────────────────────────────────────────────────────────────────────────────

const C = window.PreflopCore;

const SUITS = {
  spades:   { symbol:'♠', color:'black' },
  hearts:   { symbol:'♥', color:'red'   },
  diamonds: { symbol:'♦', color:'red'   },
  clubs:    { symbol:'♣', color:'black' },
};
const SUIT_LIST = ['spades','hearts','diamonds','clubs'];

// Coordenadas dos assentos no SVG do simulador (660×400)
const TABLE_W = 660;
const TABLE_H = 400;
const SEAT_COORDS = [
  { x: 330, y: 358 },  // 0 — fundo (herói)
  { x: 502, y: 322 },  // 1 — baixo-direita
  { x: 590, y: 228 },  // 2 — direita
  { x: 554, y: 114 },  // 3 — direita-cima
  { x: 449, y:  48 },  // 4 — cima-direita
  { x: 330, y:  32 },  // 5 — cima
  { x: 211, y:  48 },  // 6 — cima-esquerda
  { x:  70, y: 228 },  // 7 — esquerda
  { x: 158, y: 322 },  // 8 — baixo-esquerda
];

// Botões dependem do cenário, stack e modo (push/fold, fragmentação, resteal…).
function actionMeta(id, scenario) {
  switch (id) {
    case 'raise': return { label:'Abrir (RFI)', cls:'raise' };
    case 'shove': return scenario === 'vs_RFI'
      ? { label:'Resteal',     cls:'resteal' }
      : { label:'Shove',       cls:'shove'   };
    case '3bet':  return { label:'3-Bet', cls:'threebet' };
    case '4bet':  return { label:'4-Bet', cls:'fourbet'  };
    case 'call':  return { label:'Call',  cls:'call'     };
    case 'fold':  return { label:'Fold',  cls:'fold'     };
  }
  return { label:id, cls:'fold' };
}

function mkActions(ids, scenario) {
  return ids.map((id, i) => {
    const m = actionMeta(id, scenario);
    return { id, label:m.label, cls:m.cls, key:String(i + 1) };
  });
}

function getActions(q) {
  const { scenario, stack, mode } = q;
  const sng = mode === 'sng';
  if (scenario === 'RFI') {
    if (sng && stack <= 12) return mkActions(['shove','fold'], scenario);          // push/fold
    if (sng && stack <= 18) return mkActions(['raise','shove','fold'], scenario);  // fragmentação
    return mkActions(['raise','fold'], scenario);
  }
  if (scenario === 'vs_RFI') {
    if (sng && stack <= 12) return mkActions(['call','fold'], scenario);           // defendendo vs shove
    if (sng && stack <= 18) return mkActions(['shove','call','fold'], scenario);   // resteal
    return mkActions(['3bet','call','fold'], scenario);
  }
  if (scenario === 'vs_3bet') return mkActions(['4bet','call','fold'], scenario);
  return [];
}

// ── Estado ───────────────────────────────────────────────────────────────────

let currentQuestion = null;
let currentScreen   = 'question';

// Modo (MTT ou SnG) — lido do localStorage via PreflopAPI
const currentMode  = (window.PreflopAPI && PreflopAPI.getMode) ? PreflopAPI.getMode() : 'mtt';
const stackOptions = (window.PreflopAPI && PreflopAPI.stacksForMode) ? PreflopAPI.stacksForMode(currentMode) : [20,35,50,100];

// Preferências persistidas
const PREFS_KEY = 'preflop.simulator.prefs.v2'; // bumped: reseta stack default para Aleatório
const _defaultStack = '0'; // 0 = Aleatório
const prefs = Object.assign({ stack: _defaultStack, focusPos: '', focusScenario: '' }, C.lsGet(PREFS_KEY, {}));
// 0 = Aleatório é válido; só reseta se for stack desconhecido no modo atual
if (parseInt(prefs.stack) !== 0 && !stackOptions.includes(parseInt(prefs.stack))) {
  prefs.stack = _defaultStack;
}

// ── Histórico de mãos ────────────────────────────────────────────────────────
const HISTORY_KEY = 'preflop.history.v1';
const HISTORY_MAX = 100;

function historySave(q, userAction, correctAction) {
  const hist = C.lsGet(HISTORY_KEY, []);
  hist.unshift({
    ts:       Date.now(),
    hand:     q.hand,
    pos:      q.pos,
    scenario: q.scenario,
    stack:    q.stack,
    user:     userAction,
    correct:  correctAction,
    ok:       userAction === correctAction,
  });
  if (hist.length > HISTORY_MAX) hist.length = HISTORY_MAX;
  C.lsSet(HISTORY_KEY, hist);
}

// ── SM-2 (repetição espaçada simplificada) ────────────────────────────────────
// Key: `${hand}|${pos}|${scenario}|${stack}` → score (0=novo/difícil, 3=dominado)
const SM2_KEY = 'preflop.sm2.v1';
const sm2 = C.lsGet(SM2_KEY, {});

function sm2Key(q) {
  return `${q.hand}|${q.pos}|${q.scenario}|${q.stack}`;
}

function sm2Score(key) {
  return sm2[key] || 0;
}

function sm2Update(key, correct) {
  const cur = sm2[key] || 0;
  sm2[key] = correct ? Math.min(3, cur + 1) : Math.max(0, cur - 2);
  C.lsSet(SM2_KEY, sm2);
}

// Retorna peso para seleção de mão (score baixo = peso alto = aparece mais)
function sm2Weight(key) {
  return Math.max(1, 4 - sm2Score(key));
}

// ── Refs DOM ─────────────────────────────────────────────────────────────────

const el = {
  statTotal:   document.getElementById('statTotal'),
  statCorrect: document.getElementById('statCorrect'),
  statWrong:   document.getElementById('statWrong'),
  statPct:     document.getElementById('statPct'),
  statStreak:  document.getElementById('statStreak'),
  stackSelect: document.getElementById('stackSelect'),
  resetBtn:    document.getElementById('resetBtn'),

  screenQuestion: document.getElementById('screenQuestion'),
  screenResult:   document.getElementById('screenResult'),

  sitStack:    document.getElementById('sitStack'),
  sitPos:      document.getElementById('sitPos'),
  sitScenario: document.getElementById('sitScenario'),
  actionBtns:  document.getElementById('actionBtns'),

  resultBadge:        document.getElementById('resultBadge'),
  resultHand:         document.getElementById('resultHand'),
  resultMsg:          document.getElementById('resultMsg'),
  resultGrid:         document.getElementById('resultGrid'),
  resultLegend:       document.getElementById('resultLegend'),
  resultExplain:      document.getElementById('resultExplain'),
  resultRangeSummary: document.getElementById('resultRangeSummary'),
  rangeToggleBtn:     document.getElementById('rangeToggleBtn'),
  resultGridWrap:     document.getElementById('resultGridWrap'),
  posStrip:           document.getElementById('posStrip'),
  nextBtn:            document.getElementById('nextBtn'),

  focusBtn:           document.getElementById('focusBtn'),
  focusPanel:         document.getElementById('focusPanel'),
  focusPosSelect:     document.getElementById('focusPosSelect'),
  focusScenarioSelect:document.getElementById('focusScenarioSelect'),
  sm2Badge:           document.getElementById('sm2Badge'),

  screenAnalytics:  document.getElementById('screenAnalytics'),
  analyticsBtn:     document.getElementById('analyticsBtn'),
  backBtn:          document.getElementById('backBtn'),
  anSummary:        document.getElementById('anSummary'),
  anRangeInfo:      document.getElementById('anRangeInfo'),
  anPresetGroup:    document.getElementById('anPresetGroup'),
  anDates:          document.getElementById('anDates'),
  anFrom:           document.getElementById('anFrom'),
  anTo:             document.getElementById('anTo'),
  anApply:          document.getElementById('anApply'),
  improvementSection: document.getElementById('improvementSection'),
  improvementBody:  document.getElementById('improvementBody'),
  chartDaily:       document.getElementById('chartDaily'),
  chartPosition:    document.getElementById('chartPosition'),
  chartScenario:    document.getElementById('chartScenario'),
  chartStack:       document.getElementById('chartStack'),
  chartHands:       document.getElementById('chartHands'),
  mistakesTable:    document.getElementById('mistakesTable'),
  topHandsSection:  document.getElementById('topHandsSection'),
  mistakesSection:  document.getElementById('mistakesSection'),
  stackSection:     document.getElementById('stackSection'),
  dailySection:     document.getElementById('dailySection'),
};

// Estado do filtro de análise
let anPreset = 'all'; // 'all' | 'today' | '7' | '30' | 'custom'

// ── Init ─────────────────────────────────────────────────────────────────────

function init() {
  // Indica o modo no subtitle do header (MTT ou SnG)
  const subEl = document.querySelector('.app-sub');
  if (subEl) subEl.textContent = currentMode.toUpperCase();

  // Popula stackSelect com opções do modo atual
  if (el.stackSelect) {
    el.stackSelect.innerHTML = '';
    if (stackOptions.length > 1) {
      const opt = document.createElement('option');
      opt.value = '0'; opt.textContent = 'Aleatório';
      el.stackSelect.appendChild(opt);
    }
    stackOptions.forEach(s => {
      const opt = document.createElement('option');
      opt.value = String(s); opt.textContent = s + 'bb';
      el.stackSelect.appendChild(opt);
    });
    el.stackSelect.value = prefs.stack;
  }

  el.stackSelect.addEventListener('change', () => {
    prefs.stack = el.stackSelect.value;
    C.lsSet(PREFS_KEY, prefs);
  });

  el.nextBtn.addEventListener('click', nextQuestion);
  el.resetBtn.addEventListener('click', resetStats);
  el.analyticsBtn.addEventListener('click', openAnalytics);
  el.backBtn.addEventListener('click', () => showScreen('question'));

  if (el.rangeToggleBtn) {
    el.rangeToggleBtn.addEventListener('click', () => {
      const isOpen = !el.resultGridWrap.classList.contains('hidden');
      el.resultGridWrap.classList.toggle('hidden', isOpen);
      el.rangeToggleBtn.textContent = isOpen ? 'Ver range completo ▾' : 'Ocultar range ▴';
      el.rangeToggleBtn.classList.toggle('open', !isOpen);
    });
  }

  // Focus panel toggle
  el.focusBtn.addEventListener('click', () => {
    el.focusPanel.classList.toggle('hidden');
    updateSM2Badge();
  });
  // Restore focus prefs
  if (prefs.focusPos) el.focusPosSelect.value = prefs.focusPos;
  if (prefs.focusScenario) el.focusScenarioSelect.value = prefs.focusScenario;
  el.focusPosSelect.addEventListener('change', () => {
    prefs.focusPos = el.focusPosSelect.value;
    C.lsSet(PREFS_KEY, prefs);
    updateFocusBtnState();
  });
  el.focusScenarioSelect.addEventListener('change', () => {
    prefs.focusScenario = el.focusScenarioSelect.value;
    C.lsSet(PREFS_KEY, prefs);
    updateFocusBtnState();
  });
  updateFocusBtnState();
  updateSM2Badge();

  // Filtros de período
  el.anPresetGroup.addEventListener('click', e => {
    const btn = e.target.closest('.an-preset');
    if (!btn) return;
    anPreset = btn.dataset.preset;
    document.querySelectorAll('.an-preset').forEach(b => b.classList.toggle('active', b === btn));
    el.anDates.classList.toggle('hidden', anPreset !== 'custom');
    if (anPreset !== 'custom') loadAnalytics();
  });
  el.anApply.addEventListener('click', loadAnalytics);

  document.addEventListener('keydown', onKeyDown);

  PreflopAPI.get_stats().then(updateStats);
  nextQuestion();
}

// ── Focus / SM-2 helpers ──────────────────────────────────────────────────────

function updateFocusBtnState() {
  const active = !!(prefs.focusPos || prefs.focusScenario);
  el.focusBtn.classList.toggle('btn-focus-active', active);
}

function updateSM2Badge() {
  const total = Object.keys(sm2).length;
  const weak  = Object.values(sm2).filter(s => s < 2).length;
  if (el.sm2Badge) el.sm2Badge.textContent = total ? `${weak} fracas / ${total} vistas` : '0 mãos';
}

// ── Pergunta ─────────────────────────────────────────────────────────────────

// SM-2: probabilidade de aceitar a pergunta atual (score alto = mais chance de pular)
// Usa "early accept" — 1 chamada ao servidor, decide se aceita ou pede outra
function sm2Accept(q) {
  const score = sm2Score(sm2Key(q));
  // score 0 = sempre aceita, score 3 = aceita só 25% das vezes
  const threshold = [1.0, 0.7, 0.4, 0.25][score] || 1.0;
  return Math.random() < threshold;
}

function nextQuestion(attempt) {
  if (!attempt) attempt = 0;
  showScreen('question');
  const stackVal  = parseInt(el.stackSelect.value) || null;
  const focusPos  = prefs.focusPos  || null;
  const focusScen = prefs.focusScenario || null;

  PreflopAPI.new_question(9, stackVal || null, focusPos, focusScen, currentMode)
    .then(q => {
      if (!q || q.error) { console.error(q && q.error); return; }

      // SM-2: pula perguntas bem dominadas (max 3 tentativas para evitar loop)
      if (attempt < 3 && !sm2Accept(q)) {
        nextQuestion(attempt + 1);
        return;
      }

      currentQuestion = q;
      renderQuestion(q);
    });
}

function renderQuestion(q) {
  el.sitStack.textContent    = q.stack + 'bb';
  el.sitPos.textContent      = C.POS_LABEL[q.pos] || q.pos;
  el.sitScenario.textContent = C.SCENARIO_LABEL[q.scenario] || q.scenario;

  // Cartas — geradas uma vez por mão (suits estáveis durante a pergunta)
  const { c1, c2 } = handToCards(q.hand);
  q._heroCards = [c1, c2];

  // Exibe cartas grandes em HTML (acima da mesa)
  displayHeroCards(c1, c2);

  // Mini tira de posições + SVG oculto (compatibilidade)
  renderPosStrip(q.pos, q.villain_pos || null);
  renderSimTable(q.pos, q.villain_pos || null, q.scenario, null, q.stack);

  const actions = getActions(q);
  el.actionBtns.innerHTML = '';
  actions.forEach(a => {
    const btn = document.createElement('button');
    btn.className = 'action-btn ' + a.cls;
    btn.dataset.actionId = a.id;
    btn.innerHTML =
      `<span class="action-key">${a.key}</span>` +
      `<span class="action-label">${a.label}</span>`;
    btn.addEventListener('click', () => submitAnswer(a.id));
    el.actionBtns.appendChild(btn);
  });
}

// ── Resposta ─────────────────────────────────────────────────────────────────

function submitAnswer(action) {
  if (!currentQuestion) return;
  document.querySelectorAll('.action-btn').forEach(b => b.disabled = true);

  PreflopAPI.submit_answer(action).then(res => {
    // Atualiza SM-2 para esta mão
    const key = sm2Key(currentQuestion);
    sm2Update(key, res.result === 'correct');
    updateSM2Badge();

    // Salva no histórico
    historySave(currentQuestion, action, res.correct_action);

    updateStats(res.stats);
    showResult(res, action);
  });
}

// ── Explicação rica (reusa a base de conhecimento da Consulta) ────────────────

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c =>
    ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
}

function pickKeyHands(spot, correct) {
  if (!spot) return [];
  const norm = C.normalizeAction(correct);
  if (norm === '3bet' && spot.key_hands_3bet) return spot.key_hands_3bet;
  if (norm === 'call' && spot.key_hands_call) return spot.key_hands_call;
  if (norm === '4bet' && spot.key_hands_4bet) return spot.key_hands_4bet;
  return spot.key_hands || spot.key_hands_3bet || spot.key_hands_call || spot.key_hands_4bet || [];
}

function renderRichExplanation(res, q) {
  const ins      = res.insights || {};
  const correct  = res.correct_action;
  const scenario = q.scenario;
  const stack    = q.stack;
  const action   = ins.action || {};
  const spot     = ins.spot;
  const uni      = ins.universal_derived;
  const phase    = ins.phase;
  const out      = [];

  // 1) Ação correta — badge grande + descrição da ação
  const actName  = action.name || C.actionDisplayName(correct, scenario, stack);
  const actColor = action.color || C.ACTION_COLOR[C.normalizeAction(correct)] || '#555';
  const actEmoji = action.emoji ? action.emoji + ' ' : '';
  out.push(`
    <div class="explain-section explain-action">
      <span class="explain-action-badge" style="background:${actColor}">${actEmoji}${esc(actName)}</span>
      ${action.long_desc ? `<div class="explain-body">${esc(action.long_desc)}</div>` : ''}
    </div>`);

  // 2) Por que essa ação?
  const whyBody = (spot && spot.summary) || (uni && uni.summary) || '';
  let whyFlag = '';
  if (ins.spot_derived) {
    whyFlag = `<span class="explain-flag">⚙ Spot derivado dos princípios do PDF</span>`;
  } else if (ins.scenario_derived) {
    whyFlag = `<span class="explain-flag">⚙ Range derivado dos princípios do PDF</span>`;
  }
  if (whyBody || whyFlag) {
    out.push(`
      <div class="explain-section">
        <div class="explain-title">Por que ${esc(actName)}?</div>
        ${whyBody ? `<div class="explain-body">${esc(whyBody)}</div>` : ''}
        ${whyFlag}
      </div>`);
  }

  // 3) Mãos-chave do range
  const keyHands = pickKeyHands(spot, correct);
  if (keyHands.length) {
    out.push(`
      <div class="explain-section">
        <div class="explain-title">Mãos-chave do range</div>
        <div class="explain-chips">${keyHands.map(h => `<span class="explain-chip">${esc(h)}</span>`).join('')}</div>
      </div>`);
  }

  // 4) Erros comuns (spot + por posição), dedupe, top 5
  const mistakes = [];
  const seen = new Set();
  [...((spot && spot.common_mistakes) || []),
   ...((uni && uni.common_mistakes) || []),
   ...(ins.position_mistakes || [])].forEach(m => {
    if (m && !seen.has(m)) { seen.add(m); mistakes.push(m); }
  });
  if (mistakes.length) {
    out.push(`
      <div class="explain-section">
        <div class="explain-title">Erros comuns</div>
        <ul class="explain-list explain-mistakes">
          ${mistakes.slice(0, 5).map(m => `<li>${esc(m)}</li>`).join('')}
        </ul>
      </div>`);
  }

  // 5) Contexto da fase
  if (phase) {
    const meta = [];
    if (phase.rp_avg_pct != null) meta.push(`RP ~${phase.rp_avg_pct}%`);
    if (ins.open_pct != null)     meta.push(`${ins.open_pct}% open`);
    out.push(`
      <div class="explain-section explain-phase">
        <div class="explain-title">🎯 ${esc(phase.label)}${meta.length ? ` <span class="explain-rp">${esc(meta.join(' · '))}</span>` : ''}</div>
        ${phase.mentality ? `<div class="explain-body">${esc(phase.mentality)}</div>` : ''}
        ${spot && spot.icm_note ? `<div class="explain-icm"><strong>ICM:</strong> ${esc(spot.icm_note)}</div>` : ''}
      </div>`);
  }

  return out.join('');
}

function showResult(res, userAction) {
  showScreen('result');

  const isCorrect = res.result === 'correct';
  el.resultBadge.textContent = isCorrect ? 'CORRETO' : 'ERRADO';
  el.resultBadge.className   = 'result-badge ' + (isCorrect ? 'correct' : 'wrong');

  el.resultHand.textContent  = currentQuestion.hand + ' — ' + C.handDescription(currentQuestion.hand);

  const correctLabel = C.actionDisplayName(res.correct_action, currentQuestion.scenario, currentQuestion.stack);
  if (isCorrect) {
    el.resultMsg.textContent = `Acao correta: ${correctLabel}.`;
  } else {
    const userLabel = C.actionDisplayName(userAction, currentQuestion.scenario, currentQuestion.stack);
    el.resultMsg.textContent = `Voce escolheu ${userLabel}, correto seria ${correctLabel}.`;
  }

  // Explicação contextual rica (reusa insights do backend)
  if (el.resultExplain) {
    const html = renderRichExplanation(res, currentQuestion);
    el.resultExplain.innerHTML = html;
    el.resultExplain.style.display = html ? '' : 'none';
  }

  // Renderiza grid (hidden inicialmente) e resumo de range
  renderResultGrid(res.buckets, currentQuestion.hand);
  renderRangeSummary(res.buckets);

  // Fecha range grid no início de cada nova mão
  if (el.resultGridWrap)   el.resultGridWrap.classList.add('hidden');
  if (el.rangeToggleBtn)   el.rangeToggleBtn.textContent = 'Ver range completo ▾';
  if (el.rangeToggleBtn)   el.rangeToggleBtn.classList.remove('open');
}

function renderRangeSummary(buckets) {
  if (!el.resultRangeSummary) return;
  const lookup = C.buildLookup(buckets);
  const counts = {};
  Object.values(lookup).forEach(a => counts[a] = (counts[a] || 0) + 1);
  const foldCount = 169 - Object.values(counts).reduce((s, n) => s + n, 0);
  if (foldCount > 0) counts['fold'] = foldCount;

  const order = ['rfi','raise','3bet','4bet','shove','call','fold'];
  const shown = new Set();
  let html = '';
  order.forEach(act => {
    const n = counts[act] || 0;
    if (n <= 0) return;
    const key = act === 'raise' ? 'rfi' : act;
    if (shown.has(key)) return;
    shown.add(key);
    const pct = Math.round(n / 169 * 100);
    const color = C.ACTION_COLOR[act] || '#555';
    const name  = C.ACTION_NAME[act] || act;
    html += `<span class="rrs-pill">
      <span class="rrs-dot" style="background:${color}"></span>
      ${name} <span class="rrs-pct">${pct}%</span>
    </span>`;
  });
  el.resultRangeSummary.innerHTML = html;
}

// ── Mini grade no resultado ───────────────────────────────────────────────────

function renderResultGrid(buckets, highlightHand) {
  const lookup = C.buildLookup(buckets);

  el.resultGrid.innerHTML = '';
  C.RANKS.forEach((r1, i) => {
    C.RANKS.forEach((r2, j) => {
      const hand   = C.encodeHand(r1, r2, i, j);
      const action = lookup[hand] || 'fold';
      const cell   = document.createElement('div');
      cell.className = 'rg-cell action-' + action;
      if (hand === highlightHand) cell.classList.add('highlighted');
      cell.textContent = hand;
      cell.title = hand;
      el.resultGrid.appendChild(cell);
    });
  });

  // Legenda com contagem de mãos por categoria
  const counts = {};
  Object.values(lookup).forEach(a => counts[a] = (counts[a] || 0) + 1);
  const foldCount = 169 - Object.values(counts).reduce((s, n) => s + n, 0);

  const order = ['rfi','raise','3bet','4bet','shove','call','fold'];
  el.resultLegend.innerHTML = '';
  const shown = new Set();
  order.forEach(act => {
    const n = act === 'fold' ? foldCount : (counts[act] || 0);
    if (n <= 0) return;
    if (shown.has(act === 'raise' ? 'rfi' : act)) return;
    shown.add(act === 'raise' ? 'rfi' : act);
    const pct = Math.round(n / 169 * 100);
    el.resultLegend.innerHTML += `
      <div class="rl-item">
        <div class="rl-dot" style="background:${C.ACTION_COLOR[act] || '#555'}"></div>
        <span class="rl-name">${C.ACTION_NAME[act] || act}</span>
        <span class="rl-pct">${pct}%</span>
      </div>`;
  });
}

// ── Cards ─────────────────────────────────────────────────────────────────────

function handToCards(hand) {
  if (hand.length === 2) {
    const rank = hand[0];
    return {
      c1: { rank, suit: SUITS.spades },
      c2: { rank, suit: SUITS.hearts },
    };
  }
  const r1 = hand[0], r2 = hand[1], type = hand[2];
  if (type === 's') {
    const s = SUITS[SUIT_LIST[Math.floor(Math.random() * 4)]];
    return { c1: { rank:r1, suit:s }, c2: { rank:r2, suit:s } };
  }
  const pairs = [
    [SUITS.spades, SUITS.hearts],
    [SUITS.spades, SUITS.diamonds],
    [SUITS.clubs,  SUITS.hearts],
    [SUITS.clubs,  SUITS.diamonds],
  ];
  const [s1, s2] = pairs[Math.floor(Math.random() * 4)];
  return { c1: { rank:r1, suit:s1 }, c2: { rank:r2, suit:s2 } };
}

// ── Exibição grande das cartas do hero (HTML, não SVG) ───────────────────────

function displayHeroCards(c1, c2) {
  function fillCard(ids, cardId, card) {
    const isRed = card.suit.color === 'red';
    const textColor = isRed ? '#c62828' : '#0d0d24';
    const cardEl = document.getElementById(cardId);
    if (!cardEl) return;

    ids.forEach(id => {
      const e = document.getElementById(id);
      if (!e) return;
      if (id.includes('Rank')) e.textContent = card.rank;
      else e.textContent = card.suit.symbol;
      e.style.color = textColor;
    });

    // Borda sutil colorida
    cardEl.style.borderColor = isRed
      ? 'rgba(198,40,40,0.3)'
      : 'rgba(30,30,80,0.2)';
  }

  fillCard(['hRank1','hSuit1','hCenterSuit1','hRank1b','hSuit1b'], 'hCard1', c1);
  fillCard(['hRank2','hSuit2','hCenterSuit2','hRank2b','hSuit2b'], 'hCard2', c2);
}

// (renderCard removido — cartas agora são desenhadas no SVG via renderPokerTable)

// ── Stats ─────────────────────────────────────────────────────────────────────

function updateStats(s) {
  el.statTotal.textContent   = s.total;
  el.statCorrect.textContent = s.correct;
  el.statWrong.textContent   = s.wrong;
  el.statPct.textContent     = s.total > 0 ? s.pct + '%' : '—';
  if (el.statStreak) {
    const cur = s.streak || 0;
    el.statStreak.textContent = cur;
    el.statStreak.parentElement.classList.toggle('hot', cur >= 5);
  }
}

function resetStats() {
  PreflopAPI.reset_stats().then(updateStats);
}

// ── Navegação de telas ────────────────────────────────────────────────────────

function showScreen(name) {
  currentScreen = name;
  el.screenQuestion.classList.toggle('hidden',   name !== 'question');
  el.screenResult.classList.toggle('hidden',     name !== 'result');
  el.screenAnalytics.classList.toggle('hidden',  name !== 'analytics');
  document.querySelector('main').classList.toggle('analytics-mode', name === 'analytics');
}

// ── Mini tira de posições ────────────────────────────────────────────────────

function renderPosStrip(heroPos, villainPos) {
  if (!el.posStrip) return;
  const positions = C.POSITIONS_BY_COUNT[9];
  el.posStrip.innerHTML = '';
  positions.forEach((pos, i) => {
    if (i > 0) {
      const sep = document.createElement('span');
      sep.className = 'ps-sep';
      sep.textContent = '·';
      el.posStrip.appendChild(sep);
    }
    const span = document.createElement('span');
    span.className = 'ps-pos';
    if (pos === heroPos)   span.classList.add('ps-hero');
    if (pos === villainPos) span.classList.add('ps-villain');
    span.textContent = C.POS_LABEL[pos] || pos;
    el.posStrip.appendChild(span);
  });
}

// ── Mesa de posições (via core compartilhado) ────────────────────────────────

function renderSimTable(heroPos, villainPos, scenario, heroCards, heroStack) {
  const svg = document.getElementById('simTable');
  C.renderPokerTable({
    svg, width: TABLE_W, height: TABLE_H,
    seatCoords:        SEAT_COORDS,
    heroPos, villainPos, scenario,
    activePositions:   C.POSITIONS_BY_COUNT[9],
    heroCards:         heroCards || null,
    showVillainCards:  !!villainPos,
    showPot:           false,
    heroStack:         heroStack,
    villainStack:      heroStack,
    style:             'rich',
  });
}

// ── Mesa CSS ─────────────────────────────────────────────────────────────────

// Seat positions as % of oval (scaled from SVG 660x400 coords)
const CSS_SEAT_PCT = [
  { left: 50,   top: 86 },  // 0 hero — bottom center
  { left: 76,   top: 77 },  // 1 — bottom-right
  { left: 89,   top: 55 },  // 2 — right
  { left: 84,   top: 26 },  // 3 — top-right
  { left: 68,   top:  9 },  // 4 — top-right-center
  { left: 50,   top:  5 },  // 5 — top center
  { left: 32,   top:  9 },  // 6 — top-left-center
  { left: 11,   top: 55 },  // 7 — left
  { left: 24,   top: 77 },  // 8 — bottom-left
];

function renderCSSTable(heroPos, villainPos) {
  const container = document.getElementById('cssSeats');
  if (!container) return;
  const positions = C.POSITIONS_BY_COUNT[9]; // clockwise from hero seat
  container.innerHTML = '';
  positions.forEach((pos, i) => {
    const coord = CSS_SEAT_PCT[i];
    const seat = document.createElement('div');
    seat.className = 'css-seat';
    if (pos === heroPos)   seat.classList.add('css-seat-hero');
    if (pos === villainPos) seat.classList.add('css-seat-villain');
    seat.style.left = coord.left + '%';
    seat.style.top  = coord.top  + '%';
    seat.textContent = C.POS_LABEL[pos] || pos;
    container.appendChild(seat);
  });
}

// ── Atalhos de teclado ───────────────────────────────────────────────────────

function onKeyDown(e) {
  // Não reage quando está digitando num input
  const tag = (e.target && e.target.tagName || '').toLowerCase();
  if (tag === 'input' || tag === 'select' || tag === 'textarea') return;

  if (currentScreen === 'question' && /^[1-4]$/.test(e.key)) {
    const all = document.querySelectorAll('.action-btn');
    const btn = all[parseInt(e.key) - 1];
    if (btn && !btn.disabled) { e.preventDefault(); btn.click(); }
    return;
  }
  if (currentScreen === 'result' && (e.key === ' ' || e.key === 'Enter')) {
    e.preventDefault();
    el.nextBtn.click();
    return;
  }
  // Shift+R reseta as estatísticas
  if ((e.key === 'r' || e.key === 'R') && e.shiftKey) {
    e.preventDefault();
    resetStats();
  }
}

// ── Análise ──────────────────────────────────────────────────────────────────

function openAnalytics() {
  showScreen('analytics');
  loadAnalytics();
  renderHistory();
}

function getDateRange() {
  const now = Math.floor(Date.now() / 1000);
  if (anPreset === 'all')   return { from: null, to: null, label: 'Todo o histórico' };
  if (anPreset === 'today') {
    const d = new Date(); d.setHours(0,0,0,0);
    return { from: Math.floor(d.getTime()/1000), to: now, label: 'Hoje' };
  }
  if (anPreset === '7' || anPreset === '30') {
    const days = parseInt(anPreset);
    return { from: now - days*86400, to: now, label: `Últimos ${days} dias` };
  }
  if (anPreset === 'custom') {
    const fromStr = el.anFrom.value, toStr = el.anTo.value;
    let from = null, to = null;
    if (fromStr) from = Math.floor(new Date(fromStr + 'T00:00:00').getTime() / 1000);
    if (toStr)   to   = Math.floor(new Date(toStr + 'T23:59:59').getTime() / 1000);
    const lbl = `${fromStr || '—'} → ${toStr || 'agora'}`;
    return { from, to, label: lbl };
  }
  return { from: null, to: null, label: 'Todo o histórico' };
}

function loadAnalytics() {
  const range = getDateRange();
  el.anRangeInfo.textContent = range.label;
  Promise.all([
    PreflopAPI.get_analytics(range.from, range.to),
    PreflopAPI.get_improvement(7),
  ]).then(([data, improv]) => renderAnalytics(data, improv));
}

function renderAnalytics(data, improv) {
  const worstPos  = worstEntry(data.by_position);
  const worstScen = worstEntry(data.by_scenario);

  el.anSummary.innerHTML = `
    <div class="an-card">
      <div class="an-card-val">${data.total}</div>
      <div class="an-card-label">Mãos jogadas</div>
    </div>
    <div class="an-card">
      <div class="an-card-val" style="color:var(--accent)">${data.total > 0 ? data.pct + '%' : '—'}</div>
      <div class="an-card-label">Precisão</div>
    </div>
    <div class="an-card">
      <div class="an-card-val" style="color:#ff9800">${data.streak ?? 0}</div>
      <div class="an-card-label">Streak atual</div>
    </div>
    <div class="an-card">
      <div class="an-card-val" style="color:#ffb74d">${data.best_streak ?? 0}</div>
      <div class="an-card-label">Melhor streak</div>
    </div>
    <div class="an-card">
      <div class="an-card-val" style="color:var(--wrong);font-size:${worstPos ? '18px' : '26px'}">${worstPos ? (C.POS_LABEL[worstPos] || worstPos) : '—'}</div>
      <div class="an-card-label">Posição mais difícil</div>
    </div>
    <div class="an-card">
      <div class="an-card-val" style="color:var(--wrong);font-size:${worstScen ? '14px' : '26px'}">${worstScen ? (C.SCENARIO_SHORT[worstScen] || worstScen) : '—'}</div>
      <div class="an-card-label">Cenário mais difícil</div>
    </div>
  `;

  renderImprovement(improv);
  renderDailyChart(data.daily || []);

  const POS_ORDER = ['UTG','UTG1','UTG2','MP','HJ','CO','BTN','SB','BB'];
  renderBarChart(el.chartPosition, POS_ORDER, data.by_position, p => C.POS_LABEL[p] || p, improv && improv.by_position);
  renderBarChart(el.chartScenario, ['RFI','vs_RFI','vs_3bet'], data.by_scenario, s => C.SCENARIO_SHORT[s] || s, improv && improv.by_scenario);

  // Por stack
  const stackKeys = Object.keys(data.by_stack || {}).map(Number).sort((a,b)=>a-b).map(String);
  if (stackKeys.length) {
    el.stackSection.classList.remove('hidden');
    renderBarChart(el.chartStack, stackKeys, data.by_stack, s => s + ' bb', improv && improv.by_stack);
  } else {
    el.stackSection.classList.add('hidden');
  }

  if (data.top_wrong_hands && data.top_wrong_hands.length) {
    el.topHandsSection.classList.remove('hidden');
    el.chartHands.innerHTML = '';
    const maxFreq = data.top_wrong_hands[0][1];
    data.top_wrong_hands.forEach(([hand, count]) => {
      const w = Math.round(count / maxFreq * 100);
      el.chartHands.innerHTML += `
        <div class="chart-row">
          <div class="chart-label">${hand}</div>
          <div class="chart-track"><div class="chart-fill freq" style="width:${w}%"></div></div>
          <div class="chart-info">${count}× errada</div>
        </div>`;
    });
  } else {
    el.topHandsSection.classList.add('hidden');
  }

  const mistakes = data.last_mistakes || [];
  if (mistakes.length) {
    el.mistakesSection.classList.remove('hidden');
    el.mistakesTable.innerHTML = `
      <table class="mistakes-table">
        <thead>
          <tr>
            <th>Quando</th><th>Mão</th><th>Posição</th><th>Cenário</th>
            <th>Stack</th><th>Você jogou</th><th>Correto</th>
          </tr>
        </thead>
        <tbody>
          ${mistakes.map(m => `
            <tr>
              <td class="mt-time">${formatTimeAgo(m.ts)}</td>
              <td>${m.hand}</td>
              <td>${C.POS_LABEL[m.pos] || m.pos}</td>
              <td>${C.SCENARIO_SHORT[m.scenario] || m.scenario}</td>
              <td>${m.stack}bb</td>
              <td class="mt-wrong">${C.actionDisplayName(m.answered, m.scenario, m.stack)}</td>
              <td class="mt-right">${C.actionDisplayName(m.correct, m.scenario, m.stack)}</td>
            </tr>`).join('')}
        </tbody>
      </table>`;
  } else {
    el.mistakesSection.classList.add('hidden');
  }
}

// ── Improvement (evolução) ──────────────────────────────────────────────────

function renderImprovement(imp) {
  if (!imp) { el.improvementSection.classList.add('hidden'); return; }
  if (!imp.recent.total && !imp.previous.total) {
    el.improvementSection.classList.add('hidden');
    return;
  }
  el.improvementSection.classList.remove('hidden');

  const r = imp.recent, p = imp.previous;
  const delta = imp.delta_pct;
  const deltaCls = delta == null ? 'neutral' : (delta > 0 ? 'good' : (delta < 0 ? 'bad' : 'neutral'));
  const deltaTxt = delta == null ? '—' : (delta > 0 ? `+${delta}` : `${delta}`) + ' pp';

  // Lista de áreas com melhora/piora notável
  const areaDeltas = [];
  ['by_position','by_scenario','by_stack'].forEach(group => {
    Object.entries(imp[group] || {}).forEach(([key, v]) => {
      if (v.delta == null || (v.recent_total < 3 && v.previous_total < 3)) return;
      const label = group === 'by_position' ? (C.POS_LABEL[key] || key)
                  : group === 'by_scenario' ? (C.SCENARIO_SHORT[key] || key)
                  : key + 'bb';
      areaDeltas.push({ group, label, delta: v.delta, r: v.recent_pct, p: v.previous_pct,
                        rt: v.recent_total, pt: v.previous_total });
    });
  });
  areaDeltas.sort((a,b) => Math.abs(b.delta) - Math.abs(a.delta));
  const topAreas = areaDeltas.slice(0, 6);

  el.improvementBody.innerHTML = `
    <div class="imp-overall">
      <div class="imp-period">
        <div class="imp-period-label">7 dias anteriores</div>
        <div class="imp-period-val">${p.total ? p.pct + '%' : '—'}</div>
        <div class="imp-period-sub">${p.total} mãos</div>
      </div>
      <div class="imp-arrow imp-${deltaCls}">
        <div class="imp-delta">${deltaTxt}</div>
        <div class="imp-arrow-icon">${delta == null ? '·' : (delta > 0 ? '▲' : (delta < 0 ? '▼' : '='))}</div>
      </div>
      <div class="imp-period">
        <div class="imp-period-label">Últimos 7 dias</div>
        <div class="imp-period-val">${r.total ? r.pct + '%' : '—'}</div>
        <div class="imp-period-sub">${r.total} mãos</div>
      </div>
    </div>
    ${topAreas.length ? `
      <div class="imp-areas">
        <div class="imp-areas-title">Variação por área (mais relevantes):</div>
        ${topAreas.map(a => `
          <div class="imp-area-row">
            <div class="imp-area-label">${a.label}</div>
            <div class="imp-area-bars">
              <span class="imp-pct prev">${a.p ?? '—'}%</span>
              <span class="imp-arrow-small">→</span>
              <span class="imp-pct now">${a.r ?? '—'}%</span>
            </div>
            <div class="imp-area-delta ${a.delta > 0 ? 'good' : (a.delta < 0 ? 'bad' : 'neutral')}">
              ${a.delta > 0 ? '+' : ''}${a.delta} pp
            </div>
          </div>
        `).join('')}
      </div>
    ` : ''}
  `;
}

// ── Gráfico diário ──────────────────────────────────────────────────────────

function renderDailyChart(daily) {
  if (!daily.length) { el.dailySection.classList.add('hidden'); return; }
  el.dailySection.classList.remove('hidden');

  // Pega no máximo os últimos 30 dias
  const slice = daily.slice(-30);
  const maxTotal = Math.max(1, ...slice.map(d => d.total));

  el.chartDaily.innerHTML = slice.map(d => {
    const heightPct = Math.round(d.total / maxTotal * 100);
    const pctCls = d.pct >= 80 ? 'good' : d.pct >= 60 ? 'mid' : 'bad';
    const dayLbl = d.day.slice(5); // MM-DD
    return `
      <div class="daily-bar-wrap" title="${d.day} — ${d.pct}% (${d.correct}/${d.total})">
        <div class="daily-bar-val">${d.pct}%</div>
        <div class="daily-bar-track">
          <div class="daily-bar-fill ${pctCls}" style="height:${heightPct}%"></div>
        </div>
        <div class="daily-bar-day">${dayLbl}</div>
      </div>
    `;
  }).join('');
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function formatTimeAgo(ts) {
  if (!ts) return '—';
  const diff = Math.floor(Date.now()/1000) - ts;
  if (diff < 60) return 'agora';
  if (diff < 3600) return Math.floor(diff/60) + 'min';
  if (diff < 86400) return Math.floor(diff/3600) + 'h';
  if (diff < 86400*7) return Math.floor(diff/86400) + 'd';
  const d = new Date(ts*1000);
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`;
}

// ── Histórico de mãos ─────────────────────────────────────────────────────────

function renderHistory() {
  const wrap = document.getElementById('historyList');
  if (!wrap) return;
  const hist = C.lsGet(HISTORY_KEY, []);
  if (!hist.length) {
    wrap.innerHTML = '<div class="hist-empty">Nenhuma mão jogada ainda.</div>';
    return;
  }
  const scenLabel = { RFI: 'RFI', vs_RFI: 'vs RFI', vs_3bet: 'vs 3-Bet' };
  wrap.innerHTML = hist.map(h => {
    const time = (() => {
      const diff = Math.floor((Date.now() - h.ts) / 1000);
      if (diff < 60)      return 'agora';
      if (diff < 3600)    return Math.floor(diff/60) + 'min';
      if (diff < 86400)   return Math.floor(diff/3600) + 'h';
      if (diff < 86400*7) return Math.floor(diff/86400) + 'd';
      const d = new Date(h.ts);
      return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`;
    })();
    const okCls  = h.ok ? 'hist-ok' : 'hist-wrong';
    const badge  = h.ok ? '✓' : '✗';
    const userLbl    = C.actionDisplayName(h.user,    h.scenario, h.stack);
    const correctLbl = C.actionDisplayName(h.correct, h.scenario, h.stack);
    const detail = h.ok
      ? `<span class="hist-action-ok">${userLbl}</span>`
      : `<span class="hist-action-wrong">${userLbl}</span> → <span class="hist-action-ok">${correctLbl}</span>`;
    return `<div class="hist-row ${okCls}">
      <span class="hist-badge">${badge}</span>
      <span class="hist-hand">${h.hand}</span>
      <span class="hist-meta">${C.POS_LABEL[h.pos]||h.pos} · ${scenLabel[h.scenario]||h.scenario} · ${h.stack}bb</span>
      <span class="hist-detail">${detail}</span>
      <span class="hist-time">${time}</span>
    </div>`;
  }).join('');
}

function renderBarChart(container, order, data, labelFn, improvData) {
  container.innerHTML = '';
  order.forEach(key => {
    const d = data[key];
    if (!d) {
      container.innerHTML += `
        <div class="chart-row">
          <div class="chart-label">${labelFn(key)}</div>
          <div class="chart-track"><div class="chart-fill none"></div></div>
          <div class="chart-info" style="color:var(--dim)">sem dados</div>
        </div>`;
      return;
    }
    const pct = d.total > 0 ? Math.round(d.correct / d.total * 100) : 0;
    const cls = pct >= 80 ? 'good' : pct >= 60 ? 'mid' : 'bad';

    // Mini-delta vs período anterior (se disponível)
    let deltaBadge = '';
    if (improvData && improvData[key] && improvData[key].delta != null) {
      const dlt = improvData[key].delta;
      const dCls = dlt > 0 ? 'good' : (dlt < 0 ? 'bad' : 'neutral');
      const sign = dlt > 0 ? '+' : '';
      deltaBadge = `<span class="chart-delta ${dCls}" title="vs 7 dias anteriores">${sign}${dlt}pp</span>`;
    }

    container.innerHTML += `
      <div class="chart-row">
        <div class="chart-label">${labelFn(key)}</div>
        <div class="chart-track"><div class="chart-fill ${cls}" style="width:${pct}%"></div></div>
        <div class="chart-info">${pct}% <span class="dim">(${d.correct}/${d.total})</span>${deltaBadge}</div>
      </div>`;
  });
}

function worstEntry(byMap) {
  let worst = null, worstPct = 101;
  Object.entries(byMap || {}).forEach(([k, v]) => {
    if (v.total < 3) return;
    const pct = Math.round(v.correct / v.total * 100);
    if (pct < worstPct) { worst = k; worstPct = pct; }
  });
  return worst;
}

function goHome() { PreflopAPI.navigate('launcher'); }
window.goHome = goHome;

// ── Boot ─────────────────────────────────────────────────────────────────────

PreflopAPI.ready(init);
