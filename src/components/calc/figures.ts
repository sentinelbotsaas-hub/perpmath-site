// How the risk of ruin, risk reward and Kelly calculators print their
// figures. One place, so that the page (built once, also what a reader
// without JavaScript sees) and the browser script cannot print the same
// number two ways. Presentation only: every number comes from src/lib/calc/.
//
// Safe to import from a browser script: the only dependency is src/lib/fmt.ts.
import { fmt, formatNumber } from '../../lib/fmt';

/** 0.2239 -> "22.39%", 9 -> "900.00%", with thousands separators. */
export const percent = (fraction: number, decimals = 2) => `${formatNumber(fraction * 100, decimals)}%`;

/** A value the reader typed, as a fraction: up to four decimals, no trailing zeros. 0.4 -> "40%", 0.025 -> "2.5%". */
export const typedPercent = (fraction: number) => `${Number((fraction * 100).toFixed(4))}%`;

/**
 * A plain number the reader typed (a price, a ratio): eight significant
 * digits at most, no trailing zeros, thousands separators.
 * 2 -> "2", 1.25 -> "1.25", 68000 -> "68,000", 0.00001234 -> "0.00001234".
 */
export const typedNumber = (value: number) => {
  const rounded = Number(value.toPrecision(8));
  return rounded.toLocaleString('en-US', { maximumFractionDigits: 12 });
};

/**
 * An amount of money computed from prices: two decimals at most from 1
 * upwards, four significant digits below 1, no trailing zeros. A coin priced
 * in fractions of a cent must not print as "0".
 * 1600 -> "1,600", 73.92 -> "73.92", 0.000002345 -> "0.000002345".
 */
export const amount = (value: number) => {
  const rounded = Math.abs(value) >= 1 ? Number(value.toFixed(2)) : Number(value.toPrecision(4));
  return rounded.toLocaleString('en-US', { maximumFractionDigits: 12 });
};

/**
 * A probability. Two decimals of a percent, except at the ends, where
 * rounding would turn "very unlikely" into "impossible":
 *   0          -> "0%"        (cannot happen)
 *   0.0000004  -> "<0.01%"    (can happen, and would print as 0.00%)
 *   0.124651   -> "12.47%"
 *   0.999999   -> ">99.99%"
 *   1          -> "100%"
 * Anything that is not a number from 0 to 1 gives '' (the caller prints its
 * "no value" text instead).
 */
export function formatProbability(p: number): string {
  if (typeof p !== 'number' || !Number.isFinite(p) || p < 0 || p > 1) return '';
  if (p === 0) return '0%';
  if (p === 1) return '100%';
  if (p * 100 < 0.005) return '<0.01%';
  if (p * 100 >= 99.995) return '>99.99%';
  return percent(p);
}

/**
 * A number with its sign always printed, so that colour is never the only
 * sign of a gain or a loss: 0.2 -> "+0.20", -0.1 -> "−0.10" (a real minus
 * sign), 0 -> "0.00". A value that rounds to zero is printed without a sign.
 */
export function signed(value: number, decimals = 2): string {
  const text = formatNumber(Math.abs(value), decimals);
  if (Number(text.replace(/,/g, '')) === 0) return text;
  return `${value > 0 ? '+' : '−'}${text}`;
}

/** signed(), for a fraction printed as a percent: 0.0097 -> "+0.971%" at three decimals. */
export const signedPercent = (fraction: number, decimals = 3) => `${signed(fraction * 100, decimals)}%`;

/**
 * The Monte Carlo estimate of the risk of ruin calculator as text:
 * "12.03% ± 0.33%". When no path, or every path, touched the threshold the
 * standard error formula gives zero, which would read as certainty; the count
 * is printed instead ("0 of 10,000 paths").
 */
export function simulationText(
  sim: { ruined: number; paths: number; estimate: number; standardError: number },
  strings: { sim: string; simNone: string; simAll: string },
): string {
  const paths = formatNumber(sim.paths);
  if (sim.ruined === 0) return fmt(strings.simNone, { paths });
  if (sim.ruined === sim.paths) return fmt(strings.simAll, { paths });
  return fmt(strings.sim, { est: formatProbability(sim.estimate), se: percent(sim.standardError) });
}

/**
 * A reward to risk ratio, without its "R": two decimals up to 1,000, whole
 * numbers up to a million, and ">999,999" beyond that. Prices have no upper
 * bound, so the ratio has none either; past a million the digits say nothing
 * and would not fit the result panel.
 * 2.5 -> "2.50", 13.705 -> "13.71", 4200.4 -> "4,200", 1e15 -> ">999,999".
 */
export function ratioText(ratio: number): string {
  if (ratio >= 999999.5) return '>999,999';
  return formatNumber(ratio, ratio < 1000 ? 2 : 0);
}
