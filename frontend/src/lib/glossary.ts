// Glossário em português simples — usado em tooltips, no GlossaryDialog e na
// análise didática. Texto curto, sem jargão sem contexto.
import type { Scenario } from "./types";

export interface GlossaryEntry {
  id: string;
  term: string;
  short: string; // 1 linha — tooltip
  full?: string; // opcional — exemplo/detalhe no painel
}

export const GLOSSARY: GlossaryEntry[] = [
  { id: "BB", term: "BB (big blind)", short: "A aposta obrigatória maior. Também é a unidade pra medir o tamanho do stack." },
  { id: "Stack", term: "Stack", short: "Quantas fichas você tem, medido em BBs (ex.: 35 BB)." },
  { id: "Posicao", term: "Posição", short: "Sua ordem de jogada na mesa. Quanto mais tarde você age, melhor." },
  { id: "Range", term: "Range", short: "O grupo de mãos que a gente joga numa mesma situação." },
  { id: "RFI", term: "RFI", short: "Primeiro aumento da rodada — você abre o pote.", full: "RFI = \"Raise First In\". Ninguém aumentou antes; você é o primeiro." },
  { id: "OpenRaise", term: "Open raise", short: "Abrir o pote com um aumento, sendo o primeiro a entrar." },
  { id: "Call", term: "Call", short: "Pagar a aposta para continuar na mão." },
  { id: "Fold", term: "Fold", short: "Desistir da mão e não colocar mais fichas." },
  { id: "3Bet", term: "3-bet", short: "Reaumentar depois que alguém já aumentou." },
  { id: "4Bet", term: "4-bet", short: "Reaumentar de novo, depois de uma 3-bet." },
  { id: "Shove", term: "Shove", short: "Ir all-in: apostar todas as suas fichas." },
  { id: "Resteal", term: "Resteal", short: "All-in por cima de quem abriu, pra roubar o pote." },
  { id: "Suited", term: "Suited", short: "As duas cartas do mesmo naipe — ajudam a formar flush." },
  { id: "Offsuit", term: "Offsuit", short: "As duas cartas de naipes diferentes — mão mais fraca." },
  { id: "Dominada", term: "Dominada", short: "Quando o adversário pode ter mão parecida, mas com carta maior.", full: "Exemplo: AJ contra J7 — os dois têm um J, mas o A vence o 7." },
  { id: "Equity", term: "Equity", short: "Sua chance de ganhar a mão se ela for até o fim." },
  { id: "ForaDePosicao", term: "Fora de posição", short: "Você age antes do adversário — desvantagem." },
  { id: "EmPosicao", term: "Em posição", short: "Você age depois do adversário — vantagem." },
];

export const GLOSSARY_MAP: Record<string, GlossaryEntry> = Object.fromEntries(
  GLOSSARY.map((g) => [g.id, g]),
);

// Ajuda curta por posição (tooltip no anel/contexto).
export const POS_HINT: Record<string, string> = {
  UTG: "Primeiro a falar. Fora de posição — jogue apertado.",
  UTG1: "Cedo na mesa, logo depois do UTG.",
  UTG2: "Ainda em posição inicial.",
  MP: "Meio da mesa.",
  HJ: "Hijack — uma antes do CO e do BTN.",
  CO: "Cutoff — uma antes do botão. Posição boa.",
  BTN: "Botão — a melhor posição, age por último.",
  SB: "Small blind — aposta obrigatória menor. Fora de posição depois do flop.",
  BB: "Big blind — você já tem fichas no pote.",
};

// Explicação simples do cenário (tooltip no chip "Cenário").
export const SCENARIO_HELP: Record<Scenario, string> = {
  RFI: "Ninguém aumentou ainda. Você pode ser o primeiro a aumentar (abrir).",
  vs_RFI: "Alguém já aumentou antes de você. Decida: desistir, pagar ou reaumentar.",
  vs_3bet: "Você abriu e alguém reaumentou (3-bet). É a sua vez de novo.",
};
