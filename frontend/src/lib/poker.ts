// Constantes e helpers de poker — porta de ui/shared/core.js, sem dependência de DOM.
import type { ActionId, Mode, Scenario } from "./types";

export const RANKS = ["A", "K", "Q", "J", "T", "9", "8", "7", "6", "5", "4", "3", "2"];

export const POS_LABEL: Record<string, string> = {
  UTG: "UTG", UTG1: "UTG+1", UTG2: "UTG+2", MP: "MP",
  HJ: "HJ", CO: "CO", BTN: "BTN", SB: "SB", BB: "BB",
};

export const POS_FULL: Record<string, string> = {
  UTG: "Under The Gun", UTG1: "Under The Gun +1", UTG2: "Under The Gun +2",
  MP: "Middle Position", HJ: "Hijack", CO: "Cutoff",
  BTN: "Button", SB: "Small Blind", BB: "Big Blind",
};

export const SCENARIO_SHORT: Record<string, string> = {
  RFI: "Abrir (RFI)", vs_RFI: "vs Abertura", vs_3bet: "vs 3-Bet",
};

export const SCENARIO_TITLE: Record<Scenario, string> = {
  RFI: "Você abre o pote (RFI)",
  vs_RFI: "Abriram antes de você",
  vs_3bet: "3-Betaram sua abertura",
};

export const ALL_POSITIONS = ["UTG", "UTG1", "UTG2", "MP", "HJ", "CO", "BTN", "SB", "BB"];

// Ordem horária a partir do fundo (slot 0 = herói)
export const CLOCKWISE_FROM_BOTTOM = ["BTN", "CO", "HJ", "MP", "UTG2", "UTG1", "UTG", "BB", "SB"];

export const POSITIONS_BY_COUNT: Record<number, string[]> = {
  9: ["UTG", "UTG1", "UTG2", "MP", "HJ", "CO", "BTN", "SB", "BB"],
  8: ["UTG", "UTG1", "MP", "HJ", "CO", "BTN", "SB", "BB"],
  7: ["UTG", "MP", "HJ", "CO", "BTN", "SB", "BB"],
  6: ["UTG", "HJ", "CO", "BTN", "SB", "BB"],
  5: ["UTG", "CO", "BTN", "SB", "BB"],
  4: ["UTG", "BTN", "SB", "BB"],
  3: ["BTN", "SB", "BB"],
  2: ["SB", "BB"],
};

// ── Cores das ações (alinhadas à paleta nova) ──────────────────────────────────
export const ACTION_COLOR: Record<string, string> = {
  raise: "#4FA36C", rfi: "#4FA36C",
  "3bet": "#4D7CFE", "4bet": "#9472D4",
  shove: "#D85C5C",
  call: "#D2A54A", fold: "#1B2530",
};

export const ACTION_NAME: Record<string, string> = {
  raise: "Abrir", rfi: "Abrir",
  "3bet": "3-Bet", "4bet": "4-Bet",
  shove: "Shove",
  call: "Call", fold: "Fold",
};

const RANK_PT: Record<string, string> = {
  A: "Ás", K: "Rei", Q: "Dama", J: "Valete", T: "Dez",
  "9": "Nove", "8": "Oito", "7": "Sete", "6": "Seis", "5": "Cinco",
  "4": "Quatro", "3": "Três", "2": "Dois",
};

// ── Helpers de mão ─────────────────────────────────────────────────────────────

export function encodeHand(r1: string, r2: string, i: number, j: number): string {
  if (i === j) return r1 + r2;
  if (i < j) return r1 + r2 + "s";
  return r2 + r1 + "o";
}

export function normalizeAction(a?: string): string {
  if (!a) return "fold";
  if (a === "raise" || a === "RFI") return "rfi";
  return String(a).toLowerCase();
}

const LOOKUP_PRIORITY = ["4bet", "3bet", "rfi", "raise", "shove", "call", "fold"];

/** Mapeia cada mão (ex "AKs") para a ação de maior prioridade no range. */
export function buildLookup(buckets?: Record<string, string[]>): Record<string, string> {
  const lookup: Record<string, string> = {};
  Object.entries(buckets || {}).forEach(([act, hands]) => {
    const norm = normalizeAction(act);
    (hands || []).forEach((hand) => {
      const cur = lookup[hand];
      if (!cur || LOOKUP_PRIORITY.indexOf(norm) < LOOKUP_PRIORITY.indexOf(cur)) {
        lookup[hand] = norm;
      }
    });
  });
  return lookup;
}

export function handDescription(hand: string): string {
  if (hand.length === 2) return `Par de ${RANK_PT[hand[0]]}s`;
  const r1 = RANK_PT[hand[0]];
  const r2 = RANK_PT[hand[1]];
  if (hand.endsWith("s")) return `${r1}-${r2} mesmo naipe`;
  return `${r1}-${r2} naipes diferentes`;
}

export function handCategory(hand: string): "pair" | "suited" | "offsuit" {
  if (hand.length === 2) return "pair";
  return hand.endsWith("s") ? "suited" : "offsuit";
}

export function actionDisplayName(action: string, scenario?: Scenario, stack?: number): string {
  const norm = normalizeAction(action);
  if (norm === "shove") {
    if (scenario === "vs_RFI" && stack != null && stack > 12 && stack <= 18) return "Resteal";
    return "Shove (All-in)";
  }
  const map: Record<string, Record<string, string>> = {
    RFI: { raise: "Abrir (RFI)", rfi: "Abrir (RFI)", fold: "Fold" },
    vs_RFI: { "3bet": "3-Bet", call: "Call", fold: "Fold" },
    vs_3bet: { "4bet": "4-Bet", call: "Call", fold: "Fold" },
  };
  const m = (scenario && map[scenario]) || {};
  return m[norm] || m[action] || action;
}

// ── Quais botões mostrar (porta de getActions/actionMeta no simulator.js) ───────

export interface ActionButton {
  id: ActionId;
  label: string;
  variant: "open" | "threebet" | "fourbet" | "shove" | "resteal" | "call" | "fold";
  key: string;
}

function actionMeta(id: ActionId, scenario: Scenario): { label: string; variant: ActionButton["variant"] } {
  switch (id) {
    case "raise":
      return { label: "Abrir (RFI)", variant: "open" };
    case "shove":
      return scenario === "vs_RFI"
        ? { label: "Resteal", variant: "resteal" }
        : { label: "Shove", variant: "shove" };
    case "3bet":
      return { label: "3-Bet", variant: "threebet" };
    case "4bet":
      return { label: "4-Bet", variant: "fourbet" };
    case "call":
      return { label: "Call", variant: "call" };
    case "fold":
      return { label: "Fold", variant: "fold" };
    default:
      return { label: id, variant: "fold" };
  }
}

function mkActions(ids: ActionId[], scenario: Scenario): ActionButton[] {
  return ids.map((id, i) => {
    const m = actionMeta(id, scenario);
    return { id, label: m.label, variant: m.variant, key: String(i + 1) };
  });
}

export function getActions(q: { scenario: Scenario; stack: number; mode: Mode }): ActionButton[] {
  const { scenario, stack, mode } = q;
  const sng = mode === "sng";
  if (scenario === "RFI") {
    if (sng && stack <= 12) return mkActions(["shove", "fold"], scenario);
    if (sng && stack <= 18) return mkActions(["raise", "shove", "fold"], scenario);
    return mkActions(["raise", "fold"], scenario);
  }
  if (scenario === "vs_RFI") {
    if (sng && stack <= 12) return mkActions(["call", "fold"], scenario);
    if (sng && stack <= 18) return mkActions(["shove", "call", "fold"], scenario);
    return mkActions(["3bet", "call", "fold"], scenario);
  }
  if (scenario === "vs_3bet") return mkActions(["4bet", "call", "fold"], scenario);
  return [];
}

// ── Cartas: deriva 2 cartas concretas a partir da notação (ex "AKs" → A♠ K♠) ───

export type SuitName = "spades" | "hearts" | "diamonds" | "clubs";
export const SUIT_SYMBOL: Record<SuitName, string> = {
  spades: "♠", hearts: "♥", diamonds: "♦", clubs: "♣",
};
export const SUIT_IS_RED: Record<SuitName, boolean> = {
  spades: false, hearts: true, diamonds: true, clubs: false,
};
const SUIT_LIST: SuitName[] = ["spades", "hearts", "diamonds", "clubs"];

export interface Card {
  rank: string;
  suit: SuitName;
}

/** Gera duas cartas plausíveis pra notação da mão. Determinístico por seed opcional. */
export function handToCards(hand: string): [Card, Card] {
  const rnd = (n: number) => Math.floor(Math.random() * n);
  if (hand.length === 2) {
    const rank = hand[0];
    return [
      { rank, suit: "spades" },
      { rank, suit: "hearts" },
    ];
  }
  const r1 = hand[0];
  const r2 = hand[1];
  const type = hand[2];
  if (type === "s") {
    const s = SUIT_LIST[rnd(4)];
    return [
      { rank: r1, suit: s },
      { rank: r2, suit: s },
    ];
  }
  const pairs: [SuitName, SuitName][] = [
    ["spades", "hearts"],
    ["spades", "diamonds"],
    ["clubs", "hearts"],
    ["clubs", "diamonds"],
  ];
  const [s1, s2] = pairs[rnd(4)];
  return [
    { rank: r1, suit: s1 },
    { rank: r2, suit: s2 },
  ];
}

// ── Anel de posições (oval) — % [left, top] por slot horário a partir do hero ──
export const RING_SLOTS_9: [number, number][] = [
  [50, 92], // 0 hero — base
  [78, 82],
  [92, 56],
  [85, 26],
  [66, 10],
  [50, 6],
  [34, 10],
  [15, 26],
  [8, 56],
];

/**
 * Dado heroPos e a lista de posições ativas, retorna cada posição com sua
 * coordenada (%) no oval, marcando hero/vilão/foldado.
 */
export function ringSeats(
  heroPos: string,
  villainPos: string | null,
  scenario: Scenario,
  playerCount = 9,
): Array<{ pos: string; left: number; top: number; isHero: boolean; isVillain: boolean; folded: boolean; active: boolean }> {
  const active = POSITIONS_BY_COUNT[playerCount] || ALL_POSITIONS;
  const heroIdx = CLOCKWISE_FROM_BOTTOM.indexOf(heroPos);
  const slots = ringSlotsFor(playerCount);
  return CLOCKWISE_FROM_BOTTOM.map((pos) => {
    const slot = (CLOCKWISE_FROM_BOTTOM.indexOf(pos) - heroIdx + 9) % 9;
    const isActive = active.includes(pos);
    const isHero = pos === heroPos;
    const isVillain = pos === villainPos;
    let folded = false;
    if (isActive && !isHero && !isVillain && (scenario === "vs_RFI" || scenario === "vs_3bet")) {
      folded = true;
    }
    const coord = slots[slot] || [50, 50];
    return { pos, left: coord[0], top: coord[1], isHero, isVillain, folded, active: isActive };
  }).filter((s) => s.active);
}

function ringSlotsFor(_playerCount: number): [number, number][] {
  // 9-max usa o layout completo; menos jogadores reusam os mesmos slots
  return RING_SLOTS_9;
}
