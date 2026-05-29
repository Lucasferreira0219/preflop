// Formatação de valores em centavos pra exibir no formato BR (R$/US$).

export function fmtMoney(
  cents: number | null | undefined,
  currency = "USD",
  opts: { signed?: boolean; placeholder?: string } = {},
): string {
  if (cents == null || Number.isNaN(cents)) return opts.placeholder ?? "—";
  const value = cents / 100;
  const symbol = currency === "BRL" ? "R$" : "$";
  const sign = opts.signed && value > 0 ? "+" : "";
  const formatted = value.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${sign}${value < 0 ? "-" : ""}${symbol}${formatted.replace("-", "")}`;
}

export function fmtPct(value: number | null | undefined, decimals = 1): string {
  if (value == null || Number.isNaN(value)) return "—";
  return `${value.toFixed(decimals)}%`;
}

/** Centavos digitados pelo usuário ("12,50" / "12.5" / "12") → int em centavos. */
export function parseCentsInput(s: string): number | null {
  const t = s.trim().replace(/[R$\s]/g, "").replace(",", ".");
  if (t === "" || t === "-") return null;
  const n = Number.parseFloat(t);
  if (Number.isNaN(n)) return null;
  return Math.round(n * 100);
}

/** "2026/05/27 13:40:59" → "27/05/26". */
export function fmtShortDate(s: string | null | undefined): string {
  if (!s) return "—";
  const m = s.match(/^(\d{4})\/(\d{2})\/(\d{2})/);
  if (!m) return s;
  return `${m[3]}/${m[2]}/${m[1].slice(2)}`;
}
