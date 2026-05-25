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

const ACTION_CONFIG = {
  RFI: [
    { id:'raise', label:'Abrir (RFI)', cls:'raise', key:'1' },
    { id:'fold',  label:'Fold',        cls:'fold',  key:'2' },
  ],
  vs_RFI: [
    { id:'3bet',  label:'3-Bet',       cls:'threebet', key:'1' },
    { id:'call',  label:'Call',        cls:'call',     key:'2' },
    { id:'fold',  label:'Fold',        cls:'fold',     key:'3' },
  ],
  vs_3bet: [
    { id:'4bet',  label:'4-Bet',       cls:'fourbet',  key:'1' },
    { id:'call',  label:'Call',        cls:'call',     key:'2' },
    { id:'fold',  label:'Fold',        cls:'fold',     key:'3' },
  ],
};

// ── Estado ───────────────────────────────────────────────────────────────────

let currentQuestion = null;
let currentScreen   = 'question';

// Preferências persistidas
const PREFS_KEY = 'preflop.simulator.prefs.v1';
const prefs = Object.assign({ stack: '35' }, C.lsGet(PREFS_KEY, {}));

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

  resultBadge: document.getElementById('resultBadge'),
  resultHand:  document.getElementById('resultHand'),
  resultMsg:   document.getElementById('resultMsg'),
  resultGrid:  document.getElementById('resultGrid'),
  resultLegend:document.getElementById('resultLegend'),
  nextBtn:     document.getElementById('nextBtn'),

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
  // Restaura preferências
  if (prefs.stack && el.stackSelect) el.stackSelect.value = prefs.stack;
  el.stackSelect.addEventListener('change', () => {
    prefs.stack = el.stackSelect.value;
    C.lsSet(PREFS_KEY, prefs);
  });

  el.nextBtn.addEventListener('click', nextQuestion);
  el.resetBtn.addEventListener('click', resetStats);
  el.analyticsBtn.addEventListener('click', openAnalytics);
  el.backBtn.addEventListener('click', () => showScreen('question'));

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

// ── Pergunta ─────────────────────────────────────────────────────────────────

function nextQuestion() {
  showScreen('question');
  const stackVal = parseInt(el.stackSelect.value) || null;

  PreflopAPI.new_question(9, stackVal || null)
    .then(q => {
      if (!q || q.error) { console.error(q && q.error); return; }
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

  renderSimTable(q.pos, q.villain_pos || null, q.scenario, [c1, c2], q.stack);

  const actions = ACTION_CONFIG[q.scenario] || ACTION_CONFIG.RFI;
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
  // Evita duplo-submit
  document.querySelectorAll('.action-btn').forEach(b => b.disabled = true);

  PreflopAPI.submit_answer(action).then(res => {
    updateStats(res.stats);
    showResult(res, action);
  });
}

function showResult(res, userAction) {
  showScreen('result');

  const isCorrect = res.result === 'correct';
  el.resultBadge.textContent = isCorrect ? '✅ Correto!' : '❌ Errado';
  el.resultBadge.className   = 'result-badge ' + (isCorrect ? 'correct' : 'wrong');

  el.resultHand.textContent  = currentQuestion.hand + ' — ' + C.handDescription(currentQuestion.hand);

  const correctLabel = C.actionDisplayName(res.correct_action, currentQuestion.scenario);
  if (isCorrect) {
    el.resultMsg.textContent = `A ação correta é ${correctLabel}. Boa!`;
  } else {
    const userLabel = C.actionDisplayName(userAction, currentQuestion.scenario);
    el.resultMsg.textContent = `Você escolheu ${userLabel}, mas a ação correta é ${correctLabel}.`;
  }

  renderResultGrid(res.buckets, currentQuestion.hand);
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

  const order = ['rfi','raise','3bet','4bet','call','fold'];
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
    showPot:           true,
    heroStack:         heroStack,
    villainStack:      heroStack,
    style:             'rich',
  });
}

// ── Atalhos de teclado ───────────────────────────────────────────────────────

function onKeyDown(e) {
  // Não reage quando está digitando num input
  const tag = (e.target && e.target.tagName || '').toLowerCase();
  if (tag === 'input' || tag === 'select' || tag === 'textarea') return;

  if (currentScreen === 'question' && /^[1-3]$/.test(e.key)) {
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
      <div class="an-card-label">🔥 Streak atual</div>
    </div>
    <div class="an-card">
      <div class="an-card-val" style="color:#ffb74d">${data.best_streak ?? 0}</div>
      <div class="an-card-label">🏆 Melhor streak</div>
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
              <td class="mt-wrong">${C.actionDisplayName(m.answered, m.scenario)}</td>
              <td class="mt-right">${C.actionDisplayName(m.correct, m.scenario)}</td>
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
