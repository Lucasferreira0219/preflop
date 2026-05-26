'use strict';

// ─────────────────────────────────────────────────────────────────────────────
//  CORE — constantes e helpers compartilhados entre Simulador e Consulta
// ─────────────────────────────────────────────────────────────────────────────
//  Tudo aqui é exposto em window.PreflopCore para que app.js e simulator.js
//  consumam sem precisar de bundler. Carregar antes dos outros scripts.
// ─────────────────────────────────────────────────────────────────────────────

const RANKS = ['A','K','Q','J','T','9','8','7','6','5','4','3','2'];

const POS_LABEL = {
  UTG:'UTG', UTG1:'UTG+1', UTG2:'UTG+2', MP:'MP',
  HJ:'HJ', CO:'CO', BTN:'BTN', SB:'SB', BB:'BB',
};

const POS_FULL = {
  UTG:'Under The Gun',  UTG1:'Under The Gun +1', UTG2:'Under The Gun +2',
  MP:'Middle Position', HJ:'Hijack',             CO:'Cutoff',
  BTN:'Button',         SB:'Small Blind',        BB:'Big Blind',
};

const SCENARIO_LABEL = {
  RFI:     '🟢 Abrir (RFI)',
  vs_RFI:  '🔴 Apostaram antes',
  vs_3bet: '🔵 3-Betaram sua aposta',
};

const SCENARIO_SHORT = {
  RFI:'Abrir (RFI)', vs_RFI:'vs Abertura', vs_3bet:'vs 3-Bet',
};

// Ordem horária a partir do fundo (slot 0 = herói)
const CLOCKWISE_FROM_BOTTOM = ['BTN','CO','HJ','MP','UTG2','UTG1','UTG','BB','SB'];

const ALL_POSITIONS = ['UTG','UTG1','UTG2','MP','HJ','CO','BTN','SB','BB'];

const POSITIONS_BY_COUNT = {
  9: ['UTG','UTG1','UTG2','MP','HJ','CO','BTN','SB','BB'],
  8: ['UTG','UTG1','MP','HJ','CO','BTN','SB','BB'],
  7: ['UTG','MP','HJ','CO','BTN','SB','BB'],
  6: ['UTG','HJ','CO','BTN','SB','BB'],
  5: ['UTG','CO','BTN','SB','BB'],
  4: ['UTG','BTN','SB','BB'],
  3: ['BTN','SB','BB'],
  2: ['SB','BB'],
};

// ── Cores (mesma paleta CSS) ─────────────────────────────────────────────────
const ACTION_COLOR = {
  raise:'#2e7d32', rfi:'#2e7d32',
  '3bet':'#1565c0', '4bet':'#6a1b9a',
  shove:'#d32f2f',
  call:'#e65100',  fold:'#37474f',
};

const ACTION_NAME = {
  raise:'Abrir',  rfi:'Abrir',
  '3bet':'3-Bet', '4bet':'4-Bet',
  shove:'Shove',
  call:'Call',    fold:'Fold',
};

// ── Helpers de mão ────────────────────────────────────────────────────────────

function encodeHand(r1, r2, i, j) {
  if (i === j) return r1 + r2;
  if (i < j)   return r1 + r2 + 's';
  return r2 + r1 + 'o';
}

function normalizeAction(a) {
  if (!a) return 'fold';
  if (a === 'raise' || a === 'RFI') return 'rfi';
  return String(a).toLowerCase();
}

function buildLookup(buckets) {
  const priority = ['4bet','3bet','rfi','raise','shove','call','fold'];
  const lookup = {};
  Object.entries(buckets || {}).forEach(([act, hands]) => {
    const norm = normalizeAction(act);
    (hands || []).forEach(hand => {
      const cur = lookup[hand];
      if (!cur || priority.indexOf(norm) < priority.indexOf(cur)) {
        lookup[hand] = norm;
      }
    });
  });
  return lookup;
}

const RANK_PT = {
  A:'Ás', K:'Rei', Q:'Dama', J:'Valete', T:'Dez',
  9:'Nove', 8:'Oito', 7:'Sete', 6:'Seis', 5:'Cinco',
  4:'Quatro', 3:'Três', 2:'Dois',
};

function handDescription(hand) {
  if (hand.length === 2) return `Par de ${RANK_PT[hand[0]]}s`;
  const r1 = RANK_PT[hand[0]], r2 = RANK_PT[hand[1]];
  if (hand.endsWith('s')) return `${r1}-${r2} mesmo naipe`;
  return `${r1}-${r2} naipes diferentes`;
}

function actionDisplayName(action, scenario, stack) {
  const norm = normalizeAction(action);
  // Shove vira "Resteal" quando é vs_RFI em short stack jogável (12-18bb)
  if (norm === 'shove') {
    if (scenario === 'vs_RFI' && stack != null && stack > 12 && stack <= 18) return 'Resteal';
    return 'Shove (All-in)';
  }
  const map = {
    RFI:     { raise:'Abrir (RFI)', rfi:'Abrir (RFI)', fold:'Fold' },
    vs_RFI:  { '3bet':'3-Bet', call:'Call', fold:'Fold' },
    vs_3bet: { '4bet':'4-Bet', call:'Call', fold:'Fold' },
  };
  return (map[scenario] || {})[norm] || (map[scenario] || {})[action] || action;
}

// ── SVG helper ───────────────────────────────────────────────────────────────

const SVG_NS = 'http://www.w3.org/2000/svg';

function svgEl(tag, attrs, text) {
  const e = document.createElementNS(SVG_NS, tag);
  if (attrs) Object.entries(attrs).forEach(([k, v]) => e.setAttribute(k, v));
  if (text != null) e.textContent = text;
  return e;
}

// ── Geometria: posições de chip relativas ao centro da mesa ─────────────────

function chipBetween(seatCoord, centerCoord, distFromSeat) {
  const dx = centerCoord.x - seatCoord.x;
  const dy = centerCoord.y - seatCoord.y;
  const len = Math.max(1, Math.sqrt(dx * dx + dy * dy));
  return {
    x: seatCoord.x + (dx / len) * distFromSeat,
    y: seatCoord.y + (dy / len) * distFromSeat,
  };
}

// Vizinho horário (próximo na ordem) — usado pra achar o BTN dado o SB, etc.
function clockwiseNeighbor(pos, dir = 1) {
  const i = CLOCKWISE_FROM_BOTTOM.indexOf(pos);
  if (i < 0) return null;
  return CLOCKWISE_FROM_BOTTOM[(i + dir + 9) % 9];
}

// ── Chips: desenho ────────────────────────────────────────────────────────────
//
//  Desenha um chip de poker estilizado num SVG.
//  type: 'dealer' (D), 'sb' (½), 'bb' (1), 'bet' (valor livre), 'fold'
//
function drawChip(svg, x, y, opts) {
  const { type = 'bet', value = '', radius = 8 } = opts || {};

  const styles = {
    dealer: { fill:'#f5f1e0', stroke:'#bfa55a', text:'#3a2e0a', textWeight: 900, textSize: 10 },
    sb:     { fill:'#1e5dbb', stroke:'#7eb6ff', text:'#fff',    textWeight: 800, textSize:  9 },
    bb:     { fill:'#b71c1c', stroke:'#ff8a80', text:'#fff',    textWeight: 800, textSize:  9 },
    bet:    { fill:'#f9a825', stroke:'#fff176', text:'#3e2b00', textWeight: 800, textSize:  8.5 },
    bet3:   { fill:'#1565c0', stroke:'#64b5f6', text:'#fff',    textWeight: 800, textSize:  8.5 },
    bet4:   { fill:'#6a1b9a', stroke:'#ce93d8', text:'#fff',    textWeight: 800, textSize:  8.5 },
    fold:   { fill:'#2a2a3a', stroke:'#444466', text:'#666688', textWeight: 700, textSize:  7.5 },
  };
  const s = styles[type] || styles.bet;

  // Sombra leve
  svg.appendChild(svgEl('circle', {
    cx: x, cy: y + 1.2, r: radius,
    fill: '#000', opacity: 0.35,
  }));

  // Anel externo (com "ranhuras")
  svg.appendChild(svgEl('circle', {
    cx: x, cy: y, r: radius,
    fill: s.fill, stroke: s.stroke, 'stroke-width': 1.4,
  }));

  // Núcleo interno (faz parecer um chip)
  svg.appendChild(svgEl('circle', {
    cx: x, cy: y, r: radius * 0.62,
    fill: 'none', stroke: s.stroke, 'stroke-width': 0.8, opacity: 0.7,
  }));

  // Texto centralizado
  if (value !== '' && value != null) {
    svg.appendChild(svgEl('text', {
      x, y: y + 0.4,
      'text-anchor': 'middle', 'dominant-baseline': 'middle',
      fill: s.text, 'font-size': s.textSize,
      'font-weight': s.textWeight, 'font-family': 'monospace',
    }, value));
  }
}

// ── Carta de poker desenhada em SVG ──────────────────────────────────────────
//
//  opts: { rank, suit (símbolo), color ('red'|'black'), faceDown, w, h, rotation }
//
function drawCard(svg, x, y, opts) {
  const {
    rank = '', suit = '', color = 'black',
    faceDown = false, w = 36, h = 52, rotation = 0,
  } = opts || {};

  const g = svgEl('g', { transform: `translate(${x},${y}) rotate(${rotation})` });

  // Sombra
  g.appendChild(svgEl('rect', {
    x: -w/2 + 1.5, y: -h/2 + 2.5, width: w, height: h, rx: 4, ry: 4,
    fill: '#000', opacity: 0.45,
  }));

  if (faceDown) {
    // Verso
    g.appendChild(svgEl('rect', {
      x: -w/2, y: -h/2, width: w, height: h, rx: 4, ry: 4,
      fill: '#8b1a1a', stroke: '#ffffff', 'stroke-width': 1.2,
    }));
    g.appendChild(svgEl('rect', {
      x: -w/2 + 3, y: -h/2 + 3, width: w - 6, height: h - 6, rx: 2, ry: 2,
      fill: 'none', stroke: '#ffffff66', 'stroke-width': 1,
    }));
    g.appendChild(svgEl('text', {
      x: 0, y: 1,
      'text-anchor': 'middle', 'dominant-baseline': 'middle',
      fill: '#ffffff80',
      'font-size': h * 0.42, 'font-weight': 'bold',
    }, '♠'));
  } else {
    // Face branca
    g.appendChild(svgEl('rect', {
      x: -w/2, y: -h/2, width: w, height: h, rx: 4, ry: 4,
      fill: '#fafaff', stroke: '#0d0d1a', 'stroke-width': 0.8,
    }));
    const textColor = color === 'red' ? '#c62828' : '#0d0d24';
    const rankFs = w * 0.42;
    const suitFs = w * 0.34;

    // Canto superior-esquerdo: rank + suit
    g.appendChild(svgEl('text', {
      x: -w/2 + 3, y: -h/2 + rankFs - 1,
      fill: textColor, 'font-size': rankFs, 'font-weight': 900,
      'font-family': 'Georgia, serif',
    }, rank));
    g.appendChild(svgEl('text', {
      x: -w/2 + 4, y: -h/2 + rankFs + suitFs - 2,
      fill: textColor, 'font-size': suitFs,
      'font-family': 'Georgia, serif',
    }, suit));

    // Naipe grande central
    g.appendChild(svgEl('text', {
      x: 1, y: 2,
      'text-anchor': 'middle', 'dominant-baseline': 'middle',
      fill: textColor, 'font-size': h * 0.46, 'font-weight': 'bold',
    }, suit));
  }

  svg.appendChild(g);
}

// ── Stack de chips (várias fichas empilhadas) ────────────────────────────────
//
//  opts: { type, value, count, radius }
//
function drawChipStack(svg, x, y, opts) {
  const { type = 'bet', value = '', count = 4, radius = 10 } = opts || {};

  const styles = {
    sb:   { fill:'#1e5dbb', stroke:'#7eb6ff', text:'#fff'    },
    bb:   { fill:'#b71c1c', stroke:'#ff8a80', text:'#fff'    },
    bet:  { fill:'#f9a825', stroke:'#fff176', text:'#3e2b00' },
    bet3: { fill:'#1565c0', stroke:'#64b5f6', text:'#fff'    },
    bet4: { fill:'#6a1b9a', stroke:'#ce93d8', text:'#fff'    },
  };
  const s = styles[type] || styles.bet;
  const off = 1.8;

  // Sombra elíptica
  svg.appendChild(svgEl('ellipse', {
    cx: x, cy: y + 3, rx: radius * 1.15, ry: radius * 0.35,
    fill: '#000', opacity: 0.5,
  }));

  // Empilhamento (chips de baixo para cima)
  for (let i = count - 1; i > 0; i--) {
    svg.appendChild(svgEl('ellipse', {
      cx: x, cy: y - i * off, rx: radius, ry: radius * 0.42,
      fill: s.fill, stroke: s.stroke, 'stroke-width': 0.9,
    }));
  }
  // Chip do topo (círculo cheio — efeito 3D)
  const topY = y - (count - 1) * off;
  svg.appendChild(svgEl('circle', {
    cx: x, cy: topY, r: radius,
    fill: s.fill, stroke: s.stroke, 'stroke-width': 1.3,
  }));
  svg.appendChild(svgEl('circle', {
    cx: x, cy: topY, r: radius * 0.6,
    fill: 'none', stroke: s.stroke, 'stroke-width': 0.7, opacity: 0.7,
  }));
  if (value !== '') {
    svg.appendChild(svgEl('text', {
      x: x, y: topY + 0.5,
      'text-anchor': 'middle', 'dominant-baseline': 'middle',
      fill: s.text, 'font-size': Math.max(8, radius * 0.85),
      'font-weight': 900, 'font-family': 'monospace',
    }, value));
  }
}

// ── Pot (badge central) ──────────────────────────────────────────────────────
function drawPot(svg, cx, cy, value) {
  const text = `POT ${value} bb`;
  const w = Math.max(80, text.length * 6.5 + 24);
  const h = 24;
  svg.appendChild(svgEl('rect', {
    x: cx - w/2, y: cy - h/2, width: w, height: h, rx: 12, ry: 12,
    fill: '#000000aa', stroke: '#ffffff44', 'stroke-width': 1,
  }));
  svg.appendChild(svgEl('circle', {
    cx: cx - w/2 + 13, cy, r: 6.5,
    fill: '#f9a825', stroke: '#fff176', 'stroke-width': 1,
  }));
  svg.appendChild(svgEl('circle', {
    cx: cx - w/2 + 13, cy, r: 3,
    fill: 'none', stroke: '#fff176', 'stroke-width': 0.7,
  }));
  svg.appendChild(svgEl('text', {
    x: cx + 8, y: cy + 0.5,
    'text-anchor': 'middle', 'dominant-baseline': 'middle',
    fill: '#ffe082', 'font-size': 11, 'font-weight': 800,
    'font-family': 'monospace',
  }, text));
}

// Pot inferido pelo cenário
function potForScenario(scenario) {
  if (scenario === 'RFI')     return '1.5';
  if (scenario === 'vs_RFI')  return '4';
  if (scenario === 'vs_3bet') return '13';
  return '1.5';
}

// ── Mesa: render compartilhado ───────────────────────────────────────────────
//
//  Renderiza a mesa SVG com herói no fundo, vilão destacado, chips de blind,
//  dealer button, chip da aposta do vilão e do herói (quando vs_3bet).
//
//  config:
//    svg:         elemento <svg>
//    width/height: dimensões
//    seatSize:    { hero:[W,H], villain:[W,H], other:[W,H] }
//    seatCoords:  array de 9 coordenadas por slot (0 = fundo)
//    heroPos:     posição do herói (str)
//    villainPos:  posição do vilão ou null
//    scenario:    'RFI' | 'vs_RFI' | 'vs_3bet'
//    activePositions: posições existentes (ex: 9-max). Outras ficam dimmed/foldadas.
//    foldedPositions: array opcional — quem já foldou (visualizar como apagado)
//    showChips:   bool (default true) — desenhar chips
//
function renderPokerTable(config) {
  const {
    svg, width = 660, height = 400,
    seatCoords,
    heroPos, villainPos = null, scenario = 'RFI',
    activePositions = ALL_POSITIONS,
    foldedPositions = null,
    // Visual rico (modo simulador):
    heroCards         = null,   // [{rank, suit:{symbol, color}}, ...]
    showVillainCards  = false,
    showPot           = false,
    heroStack         = null,
    villainStack      = null,
    style             = 'rich', // 'rich' | 'compact'
    // Visual compacto (modo consulta — backward compat):
    seatSize          = null,
    showChips         = true,
  } = config;

  svg.innerHTML = '';
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);

  const cx = width / 2, cy = height / 2;
  const rx = width * 0.41, ry = height * 0.38;

  // Felt: gradiente radial + bordas
  const gradId = 'feltGrad_' + Math.random().toString(36).slice(2, 9);
  const defs = svgEl('defs');
  const grad = svgEl('radialGradient', { id: gradId, cx: '50%', cy: '38%', r: '70%' });
  grad.appendChild(svgEl('stop', { offset: '0%',   'stop-color': '#1f6a3e' }));
  grad.appendChild(svgEl('stop', { offset: '100%', 'stop-color': '#0a3a20' }));
  defs.appendChild(grad);
  svg.appendChild(defs);

  // Sombra externa
  svg.appendChild(svgEl('ellipse', {
    cx, cy: cy + 4, rx: rx + 14, ry: ry + 10,
    fill: '#000', opacity: 0.55,
  }));
  // Anel externo (borda da mesa)
  svg.appendChild(svgEl('ellipse', {
    cx, cy, rx: rx + 10, ry: ry + 8,
    fill: '#3a2914', stroke: '#1a1208', 'stroke-width': 1.5,
  }));
  // Felt principal
  svg.appendChild(svgEl('ellipse', {
    cx, cy, rx, ry,
    fill: `url(#${gradId})`, stroke: '#0a2810', 'stroke-width': 2,
  }));
  // Anel interno claro
  svg.appendChild(svgEl('ellipse', {
    cx, cy, rx: rx - 14, ry: ry - 12,
    fill: 'none', stroke: '#2e7c4e', 'stroke-width': 1, opacity: 0.4,
  }));

  // POT central
  if (showPot) {
    drawPot(svg, cx, cy - 6, potForScenario(scenario));
  }

  const heroIdx = CLOCKWISE_FROM_BOTTOM.indexOf(heroPos);
  if (heroIdx < 0) return;

  const heroBg   = { RFI:'#1b5e20', vs_RFI:'#0d3a7a', vs_3bet:'#3a0d6a' };
  const heroLine = { RFI:'#4caf50', vs_RFI:'#42a5f5', vs_3bet:'#ab47bc' };

  // Mapeia cada posição → coordenada no slot rotacionado
  const posCoord = {};
  CLOCKWISE_FROM_BOTTOM.forEach((pos, i) => {
    const slot = (i - heroIdx + 9) % 9;
    posCoord[pos] = seatCoords[slot];
  });

  // Folded set: em vs_RFI / vs_3bet, qualquer jogador que não é hero nem
  // vilão está foldado (pois a ação só chegou até onde está pq todos os
  // outros foldaram). Em RFI puro, ninguém foldou ainda.
  let folded = new Set(foldedPositions || []);
  if (!foldedPositions && (scenario === 'vs_RFI' || scenario === 'vs_3bet')) {
    ALL_POSITIONS.forEach(p => {
      if (!activePositions.includes(p)) return;
      if (p === heroPos || p === villainPos) return;
      folded.add(p);
    });
  }

  // Tamanhos de assento por estilo (hero é wider pra abrigar cartas dentro)
  const sizes = style === 'rich'
    ? { hero:[140, 56], villain:[90, 40], other:[58, 26] }
    : (seatSize || { hero:[60, 28], villain:[52, 22], other:[44, 18] });

  // ── Cartas do vilão (face-down) — desenhar PRIMEIRO pra ficar atrás do assento
  if (showVillainCards && villainPos && posCoord[villainPos]) {
    const seat = posCoord[villainPos];
    // Cards dentro do assento do vilão (lado esquerdo)
    const cw = 18, ch = 26;
    const cardX = seat.x - sizes.villain[0]/2 + cw/2 + 4;
    drawCard(svg, cardX,       seat.y, { faceDown:true, w:cw, h:ch, rotation: -6 });
    drawCard(svg, cardX + cw + 4, seat.y, { faceDown:true, w:cw, h:ch, rotation:  6 });
  }

  // ── Assentos ────────────────────────────────────────────────────────────────
  CLOCKWISE_FROM_BOTTOM.forEach((pos) => {
    const c = posCoord[pos];
    if (!c) return;
    const inactive = !activePositions.includes(pos);
    const isHero    = pos === heroPos;
    const isVillain = pos === villainPos;
    const isFolded  = folded.has(pos);

    let bg = '#1a1a30', stroke = '#33334d', sw = 1, fontColor = '#8888aa', opacity = 0.95;
    if (inactive)      { bg = '#0a0a14'; stroke = '#15152a'; fontColor = '#2a2a4a'; opacity = 0.4; }
    else if (isFolded) { bg = '#0d0d1a'; stroke = '#1a1a30'; fontColor = '#3a3a55'; opacity = 0.55; }
    else if (isHero)   { bg = heroBg[scenario] || '#1b5e20'; stroke = heroLine[scenario] || '#4caf50'; sw = 2.5; fontColor = '#ffffff'; opacity = 1; }
    else if (isVillain){ bg = '#5a1010'; stroke = '#ef5350'; sw = 2; fontColor = '#ffffff'; opacity = 1; }

    const [W, H] = isHero ? sizes.hero : (isVillain ? sizes.villain : sizes.other);

    const g = svgEl('g', { opacity });
    g.appendChild(svgEl('rect', {
      x: c.x - W/2, y: c.y - H/2, width: W, height: H, rx: 5,
      fill: bg, stroke, 'stroke-width': sw,
    }));

    const label = POS_LABEL[pos] || pos;

    // Subtítulo: stack para hero, ação para vilão, "fold" para foldados
    let subtitle = null, subColor = null;
    if (isHero)      { subtitle = `${heroStack || 100} bb`; subColor = '#c8f0d8'; }
    else if (isVillain) {
      subtitle = scenario === 'vs_RFI' ? '● ABRIU' : (scenario === 'vs_3bet' ? '● 3-BET' : null);
      subColor = '#ff9a9a';
    }
    else if (isFolded) { subtitle = '✕ fold'; subColor = '#555577'; }

    const hasSub = style === 'rich' && subtitle != null;
    const richSeat = style === 'rich' && (isHero || isVillain);

    if (richSeat) {
      // Layout horizontal: cartas (já desenhadas) à esquerda, texto à direita
      const [W] = isHero ? sizes.hero : sizes.villain;
      const textCenterX = c.x + W/4;  // ~ centro do painel direito (após cartas)

      g.appendChild(svgEl('text', {
        x: textCenterX, y: c.y - (hasSub ? 7 : 0),
        'text-anchor': 'middle', 'dominant-baseline': 'middle',
        fill: fontColor,
        'font-size': isHero ? 14 : 11,
        'font-weight': 800, 'font-family': 'monospace',
      }, label));
      if (hasSub) {
        g.appendChild(svgEl('text', {
          x: textCenterX, y: c.y + 9,
          'text-anchor': 'middle', 'dominant-baseline': 'middle',
          fill: subColor,
          'font-size': isHero ? 10 : 9,
          'font-weight': 700, 'font-family': 'monospace',
        }, subtitle));
      }
    } else {
      // Layout simples (centralizado) — outros assentos e modo compact
      g.appendChild(svgEl('text', {
        x: c.x, y: c.y + (hasSub ? -5 : 1),
        'text-anchor': 'middle', 'dominant-baseline': 'middle',
        fill: fontColor,
        'font-size': isHero ? 13 : (isVillain ? 11 : 10),
        'font-weight': isHero ? 800 : 700, 'font-family': 'monospace',
      }, label));
      if (hasSub) {
        g.appendChild(svgEl('text', {
          x: c.x, y: c.y + 8,
          'text-anchor': 'middle', 'dominant-baseline': 'middle',
          fill: subColor,
          'font-size': isHero ? 9 : 8.5,
          'font-weight': 700, 'font-family': 'monospace',
        }, subtitle));
      }
    }

    svg.appendChild(g);
  });

  // ── Cartas do hero (face-up, DENTRO do assento — lado esquerdo) ────────────
  if (heroCards && heroCards.length >= 2 && posCoord[heroPos]) {
    const seat = posCoord[heroPos];
    const cw = style === 'rich' ? 32 : 28;
    const ch = style === 'rich' ? 46 : 40;
    const cardX = seat.x - sizes.hero[0]/2 + cw/2 + 6;
    drawCard(svg, cardX,            seat.y, {
      rank: heroCards[0].rank,
      suit: heroCards[0].suit.symbol,
      color: heroCards[0].suit.color,
      w: cw, h: ch, rotation: -5,
    });
    drawCard(svg, cardX + cw - 4,   seat.y, {
      rank: heroCards[1].rank,
      suit: heroCards[1].suit.symbol,
      color: heroCards[1].suit.color,
      w: cw, h: ch, rotation: 5,
    });
  }

  // ── Label "▲ VOCÊ" abaixo do assento do hero ──
  if (posCoord[heroPos]) {
    const seat = posCoord[heroPos];
    svg.appendChild(svgEl('text', {
      x: seat.x, y: seat.y + (sizes.hero[1] / 2) + 10,
      'text-anchor': 'middle', 'dominant-baseline': 'middle',
      fill: heroLine[scenario] || '#4caf50',
      'font-size': 9, 'font-weight': 800, 'font-family': 'monospace',
      'letter-spacing': 1,
    }, '▲ VOCÊ'));
  }

  if (!showChips) return;

  // ── Chips ──────────────────────────────────────────────────────────────────
  //
  //  Modo rich: SB/BB já estão no POT — não desenhamos chips separados pra
  //  evitar poluição visual. Só fica:
  //    - Dealer button (D) AO LADO do BTN
  //    - Chip de aposta do vilão (entre vilão e pot)
  //    - Chip do RFI do hero quando cenário é vs_3bet
  //
  const center = { x: cx, y: cy };
  const dist = style === 'rich' ? 50 : 22;
  const chipR = style === 'rich' ? 11 : 8;

  // Dealer button: bem ao lado do BTN (offset perpendicular grande, distância
  // radial pequena pra ficar colado no assento)
  if (activePositions.includes('BTN') && posCoord['BTN']) {
    const seat = posCoord['BTN'];
    const seatHalfW = (heroPos === 'BTN' ? sizes.hero[0] : (villainPos === 'BTN' ? sizes.villain[0] : sizes.other[0])) / 2;
    const angle = Math.atan2(center.y - seat.y, center.x - seat.x);
    // Posiciona à direita do assento (perpendicular)
    const perp = angle + Math.PI / 2;
    const px = seat.x + Math.cos(perp) * (seatHalfW + 10);
    const py = seat.y + Math.sin(perp) * (seatHalfW + 10);
    drawChip(svg, px, py, { type:'dealer', value:'D', radius: chipR });
  }

  // Modo compact: blinds e dealer simples (mantém compat com app.js)
  if (style !== 'rich') {
    if (activePositions.includes('SB') && posCoord['SB']) {
      const seat = posCoord['SB'];
      const p = chipBetween(seat, center, dist);
      drawChip(svg, p.x, p.y, { type:'sb', value:'½', radius: chipR - 0.5 });
    }
    if (activePositions.includes('BB') && posCoord['BB']) {
      const seat = posCoord['BB'];
      const p = chipBetween(seat, center, dist);
      drawChip(svg, p.x, p.y, { type:'bb', value:'1', radius: chipR - 0.5 });
    }
  }

  // ── Apostas (contexto da ação) ─────────────────────────────────────────────
  if (villainPos && posCoord[villainPos] && (scenario === 'vs_RFI' || scenario === 'vs_3bet')) {
    const seat = posCoord[villainPos];
    // Distância grande pra ficar bem longe do assento (no espaço da mesa)
    const p = chipBetween(seat, center, style === 'rich' ? 75 : dist + 18);
    if (style === 'rich') {
      if (scenario === 'vs_RFI') drawChipStack(svg, p.x, p.y, { type:'bet',  value:'2.5', count: 5, radius: chipR });
      else                       drawChipStack(svg, p.x, p.y, { type:'bet4', value:'9',   count: 8, radius: chipR });
    } else {
      const t = scenario === 'vs_RFI' ? 'bet' : 'bet4';
      const v = scenario === 'vs_RFI' ? '2.5' : '9';
      drawChip(svg, p.x, p.y, { type:t, value:v, radius: chipR + 1 });
    }
  }
  // Aposta do hero quando vs_3bet
  if (scenario === 'vs_3bet' && posCoord[heroPos]) {
    const seat = posCoord[heroPos];
    const p = chipBetween(seat, center, style === 'rich' ? 80 : dist + 22);
    if (style === 'rich') {
      drawChipStack(svg, p.x, p.y, { type:'bet3', value:'2.5', count: 5, radius: chipR });
    } else {
      drawChip(svg, p.x, p.y, { type:'bet3', value:'2.5', radius: chipR + 1 });
    }
  }
}

// ── Persistência simples em localStorage (com guarda) ────────────────────────

function lsGet(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    if (v == null) return fallback;
    return JSON.parse(v);
  } catch { return fallback; }
}

function lsSet(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); }
  catch { /* ignora (modo restrito etc.) */ }
}

// ── Exporta ──────────────────────────────────────────────────────────────────

window.PreflopCore = {
  // Constantes
  RANKS, POS_LABEL, POS_FULL, SCENARIO_LABEL, SCENARIO_SHORT,
  CLOCKWISE_FROM_BOTTOM, ALL_POSITIONS, POSITIONS_BY_COUNT,
  ACTION_COLOR, ACTION_NAME, RANK_PT,
  // Helpers
  encodeHand, normalizeAction, buildLookup, handDescription, actionDisplayName,
  svgEl, chipBetween, clockwiseNeighbor,
  drawChip, drawChipStack, drawCard, drawPot, potForScenario,
  renderPokerTable,
  lsGet, lsSet,
};
