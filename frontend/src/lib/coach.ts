// Gerador de explicações didáticas (frontend). Linguagem simples, específica da
// mão + situação + ação correta. Funciona em MTT e SnG (não depende do backend).
import { normalizeAction } from "./poker";
import type { Scenario } from "./types";

const RANK_VALUE: Record<string, number> = {
  A: 14, K: 13, Q: 12, J: 11, T: 10, "9": 9, "8": 8, "7": 7, "6": 6, "5": 5, "4": 4, "3": 3, "2": 2,
};
const EARLY = new Set(["UTG", "UTG1", "UTG2", "MP"]);
const BROADWAY = new Set(["A", "K", "Q", "J", "T"]);

interface HandTraits {
  isPair: boolean;
  suited: boolean;
  offsuit: boolean;
  high: string;
  low: string;
  highV: number;
  lowV: number;
  gap: number; // distância entre as cartas (0 = conectadas)
  bothBroadway: boolean;
  suitedAce: boolean;
  category: "premiumPair" | "midPair" | "smallPair" | "premium" | "strong" | "suitedConnector" | "weakOffsuit" | "marginal";
}

export function describeHand(hand: string): HandTraits {
  if (hand.length === 2) {
    const r = hand[0];
    const v = RANK_VALUE[r];
    const category = v >= 11 ? "premiumPair" : v >= 9 ? "midPair" : "smallPair";
    return {
      isPair: true, suited: false, offsuit: false, high: r, low: r, highV: v, lowV: v,
      gap: 0, bothBroadway: BROADWAY.has(r), suitedAce: false, category,
    };
  }
  const a = hand[0];
  const b = hand[1];
  const suited = hand.endsWith("s");
  const av = RANK_VALUE[a];
  const bv = RANK_VALUE[b];
  const high = av >= bv ? a : b;
  const low = av >= bv ? b : a;
  const highV = Math.max(av, bv);
  const lowV = Math.min(av, bv);
  const gap = highV - lowV - 1;
  const bothBroadway = BROADWAY.has(a) && BROADWAY.has(b);
  const suitedAce = suited && high === "A";

  let category: HandTraits["category"];
  if ((high === "A" && lowV >= 12) || (high === "A" && low === "K") || bothBroadway) {
    category = highV >= 13 && lowV >= 12 ? "premium" : "strong";
  } else if (suited && gap <= 1 && lowV >= 5) {
    category = "suitedConnector";
  } else if (!suited && !bothBroadway && (gap >= 2 || lowV <= 7)) {
    category = "weakOffsuit";
  } else {
    category = "marginal";
  }
  return { isPair: false, suited, offsuit: !suited, high, low, highV, lowV, gap, bothBroadway, suitedAce, category };
}

export interface Coaching {
  why: string;
  lesson: string;
  terms: string[]; // ids do glossário
}

const SUIT_CLAUSE = (t: HandTraits) =>
  t.suited ? "do mesmo naipe (suited)" : "de naipes diferentes (offsuit)";

function whyFold(hand: string, t: HandTraits, scenario: Scenario): string {
  if (t.isPair && t.category === "smallPair") {
    if (scenario === "RFI") {
      return `${hand} é um par pequeno. Sendo o primeiro a agir numa posição inicial, ele não abre bem aqui — fica marginal contra tanta gente pra agir depois. Fold.`;
    }
    return `${hand} é um par pequeno. Ele depende de pagar barato pra tentar acertar trinca (set); quando não há esse preço contra um range forte, o melhor é soltar.`;
  }
  if (t.offsuit && t.high === "A") {
    return `${hand} parece boa por ter um Ás, mas a segunda carta é fraca e os naipes são diferentes. Contra quem mostrou força ela costuma estar dominada. Melhor soltar.`;
  }
  if (t.category === "weakOffsuit") {
    return `${hand} tem cartas ${SUIT_CLAUSE(t)} e pouco conectadas. Ela vira par bom poucas vezes e perde para mãos melhores. Fold economiza fichas.`;
  }
  if (scenario === "vs_3bet") {
    return `${hand} não é forte o bastante depois de uma 3-bet. Continuar custa caro contra um range que já mostrou força. Fold.`;
  }
  return `${hand} é fraca para essa situação: acerta bons pares com pouca frequência e perde para os ranges mais fortes. Fold economiza fichas.`;
}

function whyCall(hand: string, t: HandTraits): string {
  const clause = t.isPair
    ? "É um par que joga bem pagando e pode evoluir"
    : t.suited
      ? "Sendo suited, ela tem potencial de flush e sequência"
      : "Ela tem força para seguir, mas não para reaumentar";
  return `Call é pagar a aposta. ${clause}. Você paga barato para ver o flop em vez de inflar o pote com uma mão mediana.`;
}

function whyOpen(hand: string, t: HandTraits): string {
  const clause = t.isPair
    ? "Um par já começa na frente de muitas mãos"
    : t.bothBroadway || t.suitedAce
      ? "Duas cartas altas (ou suited com Ás) jogam bem"
      : "Ela é boa o bastante para tomar a iniciativa";
  return `Abrir (RFI) é ser o primeiro a aumentar. ${clause}, então vale tentar levar os blinds e jogar com a iniciativa.`;
}

function why3bet(hand: string, t: HandTraits): string {
  const clause = t.category === "premiumPair" || t.category === "premium"
    ? "Está entre as melhores mãos"
    : "É forte e joga bem contra quem abriu";
  return `3-bet é reaumentar quem já aumentou. ${hand}: ${clause}. Dá para jogar por valor e colocar pressão.`;
}

function why4bet(hand: string, _t: HandTraits): string {
  return `4-bet é reaumentar uma 3-bet. ${hand} está no topo do seu range — forte o bastante para reaumentar de novo, por valor.`;
}

function whyShove(hand: string, t: HandTraits, scenario: Scenario): string {
  if (scenario === "vs_RFI") {
    return `Resteal é dar all-in por cima de quem abriu. Com stack curto, ${hand} tem força e "fold equity": o adversário larga muitas mãos e você leva o pote.`;
  }
  const clause = t.isPair || t.high === "A" ? "Com uma mão jogável e " : "Com ";
  return `${clause}stack curto, o melhor é ir all-in (shove): simplifica o jogo, evita decisões difíceis no flop e ainda pressiona quem está atrás.`;
}

function lessonFor(scenario: Scenario, action: string, pos: string): string {
  const norm = normalizeAction(action);
  if (scenario === "RFI") {
    if (norm === "fold") return "Nem toda mão vale um aumento. Seja seletivo, principalmente em posição inicial.";
    if (EARLY.has(pos)) return "Em posição inicial tem muita gente para agir depois de você. Abra só com mãos fortes.";
    return "Perto do botão você pode abrir mais mãos, porque sobra menos gente para reagir.";
  }
  if (scenario === "vs_RFI") {
    if (norm === "fold") return "Quando alguém aposta antes de você, feche o jogo. Evite pagar com mãos fracas, ainda mais fora de posição.";
    if (norm === "call") return "Pagar é ok com mãos medianas que jogam bem — mas lembre que você costuma ficar fora de posição.";
    return "Mãos fortes preferem reaumentar a pagar: você toma a iniciativa e não deixa o flop sair barato.";
  }
  // vs_3bet
  if (norm === "fold") return "Quando reaumentam você, respeite. Continue só com mãos realmente fortes.";
  if (norm === "call") return "Dá para pagar uma 3-bet com mãos que jogam bem pós-flop e têm bom potencial.";
  return "Reaumentar de volta (4-bet) é para o topo do range — por valor ou como blefe planejado.";
}

function termsFor(t: HandTraits, scenario: Scenario, action: string): string[] {
  const norm = normalizeAction(action);
  const out = new Set<string>();
  // termo da ação
  if (norm === "fold") out.add("Fold");
  else if (norm === "call") out.add("Call");
  else if (norm === "rfi" || norm === "raise") out.add("RFI");
  else if (norm === "3bet") out.add("3Bet");
  else if (norm === "4bet") out.add("4Bet");
  else if (norm === "shove") out.add(scenario === "vs_RFI" ? "Resteal" : "Shove");

  if (t.suited) out.add("Suited");
  if (t.offsuit) out.add("Offsuit");
  if (norm === "fold" && (t.category === "weakOffsuit" || (t.offsuit && t.high === "A"))) out.add("Dominada");
  if (scenario === "RFI" || scenario === "vs_RFI") out.add("Posicao");
  out.add("Range");
  return Array.from(out).slice(0, 4);
}

/** Gera a explicação de treinador para a mão/cenário/ação corretos. */
export function coachExplain(opts: {
  hand: string;
  scenario: Scenario;
  correctAction: string;
  pos: string;
  stack: number;
}): Coaching {
  const t = describeHand(opts.hand);
  const norm = normalizeAction(opts.correctAction);
  let why: string;
  if (norm === "fold") why = whyFold(opts.hand, t, opts.scenario);
  else if (norm === "call") why = whyCall(opts.hand, t);
  else if (norm === "rfi" || norm === "raise") why = whyOpen(opts.hand, t);
  else if (norm === "3bet") why = why3bet(opts.hand, t);
  else if (norm === "4bet") why = why4bet(opts.hand, t);
  else if (norm === "shove") why = whyShove(opts.hand, t, opts.scenario);
  else why = `A ação recomendada aqui é ${opts.correctAction}.`;

  return {
    why,
    lesson: lessonFor(opts.scenario, opts.correctAction, opts.pos),
    terms: termsFor(t, opts.scenario, opts.correctAction),
  };
}
