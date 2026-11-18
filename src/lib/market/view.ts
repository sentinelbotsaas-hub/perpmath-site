// What the daily-report and data pages need on top of the numbers: which
// template sentence applies, how a figure is written, and the address that
// opens the liquidation calculator with the day's values filled in.
// Pure and dependency-free, so browser scripts may import it too.
import { highestSurviving, lowestLiquidated } from './compute.ts';
import type { Side, SurvivalRow } from './compute.ts';

/** The three contracts the site reports on, in page order. `coin` is the URL segment. */
export const COINS = [
  { coin: 'btc', symbol: 'BTCUSDT' },
  { coin: 'eth', symbol: 'ETHUSDT' },
  { coin: 'sol', symbol: 'SOLUSDT' },
] as const;

export type Coin = (typeof COINS)[number]['coin'];
export type MarketSymbol = (typeof COINS)[number]['symbol'];

const MINUS = '−'; // a real minus sign, not a hyphen

/** Which of the three template sentences describes one side of the survival table. */
export type SideSummary =
  | { kind: 'allSurvived'; min: number; max: number }
  | { kind: 'mixed'; safe: number; dead: number; hourUtc: number }
  | { kind: 'allLiquidated'; min: number; max: number; hourUtc: number };

/**
 * Room shrinks as leverage rises, so the table always splits cleanly:
 * everything up to `safe` survived and everything from `dead` up was
 * liquidated. `hourUtc` is the hour in which the `dead` row went.
 */
export function summarizeSide(rows: readonly SurvivalRow[], side: Side): SideSummary {
  if (rows.length === 0) throw new Error('survival table is empty');
  const leverages = rows.map((row) => row.leverage);
  const min = Math.min(...leverages);
  const max = Math.max(...leverages);
  const dead = lowestLiquidated(rows, side);
  if (!dead) return { kind: 'allSurvived', min, max };
  const hourUtc = dead[side].hourUtc;
  if (hourUtc === null) throw new Error(`no liquidation hour for the ${dead.leverage}x ${side}`);
  const safe = highestSurviving(rows, side);
  if (safe === null) return { kind: 'allLiquidated', min, max, hourUtc };
  return { kind: 'mixed', safe, dead: dead.leverage, hourUtc };
}

/**
 * A Latin name that is followed directly by Chinese text gets a space:
 * "Solana" + "每日報告" reads "Solana 每日報告". Chinese names are left alone.
 */
export function beforeCjk(name: string): string {
  return /[A-Za-z0-9]$/.test(name) ? `${name} ` : name;
}

/** 14 -> "14:00". */
export function hourLabel(hourUtc: number): string {
  return `${String(hourUtc).padStart(2, '0')}:00`;
}

/** "2026-11-18T12:11:03.262Z" -> "2026-11-18 12:11". The caller adds "UTC". */
export function utcMinute(iso: string): string {
  return `${iso.slice(0, 10)} ${iso.slice(11, 16)}`;
}

/** "2026-11-18T00:00:00.000Z" -> "2026-11-18". */
export function utcDay(iso: string): string {
  return iso.slice(0, 10);
}

function group(value: number, decimals: number): string {
  return value.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

/** 1234.5 -> "+1,234.50", -3 -> "−3.00", 0 -> "0.00". */
export function signedNumber(value: number, decimals = 2): string {
  const text = group(Math.abs(value), decimals);
  if (Number(text.replace(/,/g, '')) === 0) return text;
  return (value < 0 ? MINUS : '+') + text;
}

/** A value that may be negative, with a real minus sign and no plus: -0.12 -> "−0.12". */
export function plainNumber(value: number, decimals = 2): string {
  const text = group(Math.abs(value), decimals);
  if (Number(text.replace(/,/g, '')) === 0) return text;
  return (value < 0 ? MINUS : '') + text;
}

/** 0.0195 -> "+1.95%", -0.0072 -> "−0.72%". For changes. */
export function signedPercent(fraction: number, decimals = 2): string {
  return `${signedNumber(fraction * 100, decimals)}%`;
}

/** A funding rate: 0.00004982 -> "0.0050%", -0.0001 -> "−0.0100%". */
export function ratePercent(rate: number, decimals = 4): string {
  return `${plainNumber(rate * 100, decimals)}%`;
}

/** A change in percentage points: 0.0195 -> "+1.95". The caller adds the unit. */
export function signedPoints(fraction: number, decimals = 2): string {
  return signedNumber(fraction * 100, decimals);
}

/**
 * Query string that opens /tools/liquidation-price-calculator/ with these
 * values. The parameter names are the ones that page's script reads:
 * side, entry, lev, and mmr in percent.
 */
export function calculatorQuery(input: { side: Side; entry: number; leverage: number; mmr: number }): string {
  const mmrPercent = Number((input.mmr * 100).toFixed(4));
  return `?side=${input.side}&entry=${input.entry}&lev=${input.leverage}&mmr=${mmrPercent}`;
}
