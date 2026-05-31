// Monta o link para "Perguntar ao PKE" já preenchido a partir de uma mão analisada.
// Os nomes dos parâmetros são lidos de volta pela AskPage (useSearchParams).
import type { ReportHand } from "./types";

const ACT_PT: Record<string, string> = {
  shove: "shove", raise: "raise", "3bet": "3-bet", "4bet": "4-bet",
  call: "call", fold: "fold", bet: "aposta", limp: "limp", check: "check",
};

function act(a: string | null | undefined): string {
  return a ? ACT_PT[a] ?? a : "essa linha";
}

/** Caminho /perguntar?... com contexto da mão e uma pergunta sugerida. */
export function askHandUrl(m: ReportHand): string {
  const q =
    m.recomendado && m.linha && m.recomendado !== m.linha
      ? `Por que ${act(m.recomendado)} é melhor que ${act(m.linha)} nessa mão?`
      : `Como devo jogar essa mão?`;
  const p = new URLSearchParams();
  p.set("q", q);
  if (m.cards) p.set("cards", m.cards);
  if (m.pos) p.set("pos", m.pos);
  if (m.eff_bb != null) p.set("stack", String(Math.round(m.eff_bb)));
  if (m.fase) p.set("phase", m.fase);
  return `/perguntar?${p.toString()}`;
}
