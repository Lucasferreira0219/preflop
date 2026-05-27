import type { Mode } from "./types";

const MODE_KEY = "preflop_mode";
const VALID_MODES: Mode[] = ["mtt", "sng"];

export const STACKS_BY_MODE: Record<Mode, number[]> = {
  mtt: [20, 35, 50, 100],
  sng: [10, 15, 30, 75],
};

export function getMode(): Mode {
  let m: string | null = null;
  try {
    m = localStorage.getItem(MODE_KEY);
  } catch {
    /* ignore */
  }
  return VALID_MODES.includes(m as Mode) ? (m as Mode) : "mtt";
}

export function setMode(m: Mode) {
  if (!VALID_MODES.includes(m)) return;
  try {
    localStorage.setItem(MODE_KEY, m);
  } catch {
    /* ignore */
  }
}

export function stacksForMode(m: Mode): number[] {
  return STACKS_BY_MODE[m] || STACKS_BY_MODE.mtt;
}

export const MODE_LABEL: Record<Mode, string> = { mtt: "MTT", sng: "SnG" };
