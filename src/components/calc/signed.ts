// Formatting for figures that carry a sign: a profit or a loss, a price move,
// a Sharpe ratio. The sign is always printed with the number (a real minus
// sign, not a hyphen), so the colour that goes with it is never the only
// signal. Presentation only: the numbers come from src/lib/calc/.
//
// Safe to import from a browser script: the only dependency is src/lib/fmt.ts.
import { formatNumber } from '../../lib/fmt';

export type SignTone = 'positive' | 'negative';

/** The value as it will be printed at `decimals` places; -0.001 at two places is 0. */
function shown(value: number, decimals: number): number {
  const rounded = Number(value.toFixed(decimals));
  return rounded === 0 ? 0 : rounded;
}

/**
 * 190.37 -> "+190.37", -225.71 -> "−225.71", 0 -> "0.00".
 * With `plus` false a positive number is printed bare: 1.53 -> "1.53".
 * A value that rounds to zero is printed without a sign.
 */
export function signed(value: number, decimals = 2, plus = true): string {
  const v = shown(value, decimals);
  const body = formatNumber(Math.abs(v), decimals);
  if (v < 0) return `−${body}`;
  return v > 0 && plus ? `+${body}` : body;
}

/** 0.0323 -> "+3.23%", -0.4514 -> "−45.14%". */
export function signedPercent(fraction: number, decimals = 2, plus = true): string {
  return `${signed(fraction * 100, decimals, plus)}%`;
}

/**
 * The value of data-tone for a signed figure: green above zero, red below,
 * nothing at zero. It follows the printed number, so a value that rounds to
 * "0.00" has no colour.
 */
export function toneOf(value: number, decimals = 2): SignTone | undefined {
  if (!Number.isFinite(value)) return undefined;
  const v = shown(value, decimals);
  return v > 0 ? 'positive' : v < 0 ? 'negative' : undefined;
}

/** Put a signed figure into an element: its text, and the tone that goes with the sign. */
export function setToned(el: HTMLElement | null, text: string, tone: SignTone | undefined): void {
  if (!el) return;
  if (el.textContent !== text) el.textContent = text;
  if (tone) el.dataset.tone = tone;
  else delete el.dataset.tone;
}

/** Up to `decimals` places, without trailing zeros: 64000 -> "64,000", 35.2941 -> "35.2941". */
export function trimmed(value: number, decimals: number): string {
  const text = formatNumber(value, decimals);
  return text.includes('.') ? text.replace(/0+$/, '').replace(/\.$/, '') : text;
}
