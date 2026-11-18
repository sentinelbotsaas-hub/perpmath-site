// Highest leverage at which a stop is hit before the liquidation price.
//
// For a USDT perpetual on isolated margin (simplified formula, no extra
// margin; see liquidation.ts), price can move against the position by
//   liquidation distance = 1/leverage - MMR        (a fraction of entry)
// before the exchange closes it. A stop that sits
//   stop distance = |entry - stop| / entry
// away is reached first only while
//   1/leverage - MMR > stop distance
//   =>  leverage < 1 / (stop distance + MMR)
// The bound is exclusive: exactly at it, the liquidation price IS the stop.
//
// Pure functions, no I/O. The maintenance margin rate and the exchange's
// leverage cap are passed in by the caller (the UI reads both from the
// risk-limit snapshot in src/data/risk-limit/); nothing is defaulted here.
import type { Side } from './liquidation';

export interface MaxLeverageInput {
  side: Side;
  /** Entry price, in quote currency (USDT). Must be > 0. */
  entryPrice: number;
  /** Stop price. Below entry for a long, above entry for a short. Must be > 0. */
  stopPrice: number;
  /** Maintenance margin rate as a fraction: 0.0033 means 0.33%. */
  mmr: number;
  /** The exchange's highest allowed leverage for this contract and tier. Must be >= 1. */
  maxLeverage: number;
}

/** Which input is wrong. 'stopSide' = the stop is on the wrong side of the entry (or equal to it). */
export type MaxLeverageIssue = 'side' | 'entryPrice' | 'stopPrice' | 'stopSide' | 'mmr' | 'maxLeverage';

export interface MaxLeverageOk {
  ok: true;
  side: Side;
  /** |entry - stop| / entry, a fraction of the entry price (0.02 = 2%). */
  stopDistance: number;
  /** 1 / (stopDistance + MMR). Exclusive upper bound, unrounded and not capped by the exchange. */
  limit: number;
  /**
   * The largest whole-number leverage that is strictly below `limit` and not
   * above `maxLeverage`. 0 when even 1x is liquidated before the stop.
   */
  maxWholeLeverage: number;
  /** true when the exchange cap, not the stop, is what holds the figure down. */
  cappedByExchange: boolean;
  /** false when no leverage of 1x or more keeps the stop ahead of liquidation. */
  feasible: boolean;
  /** 1/maxWholeLeverage - MMR, a fraction of entry. 0 when not feasible. */
  liquidationDistance: number;
  /** Liquidation price at maxWholeLeverage, unrounded. 0 when not feasible. */
  liquidationPrice: number;
}

export interface MaxLeverageError {
  ok: false;
  issues: MaxLeverageIssue[];
}

export type MaxLeverageResult = MaxLeverageOk | MaxLeverageError;

const isPositive = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n > 0;

// Two distances closer than this are treated as equal, and equal means the
// stop is NOT first. Keeps 1/20 - 0.0033 vs 0.0467 from flipping on the last
// binary digit.
const TOLERANCE = 1e-12;

/** |entry - stop| / entry. Returns NaN for unusable prices. */
export function stopDistance(entryPrice: number, stopPrice: number): number {
  if (!isPositive(entryPrice) || !isPositive(stopPrice)) return Number.NaN;
  return Math.abs(entryPrice - stopPrice) / entryPrice;
}

/**
 * Is the stop reached strictly before the liquidation price?
 *   stopComesFirst(0.02, 20, 0.0033) -> true   (liquidation is 4.67% away)
 *   stopComesFirst(0.05, 20, 0.0033) -> false  (liquidation is 4.67% away)
 * `distance` is the stop distance as a fraction of entry.
 */
export function stopComesFirst(distance: number, leverage: number, mmr: number): boolean {
  if (!Number.isFinite(distance) || distance < 0) return false;
  if (!(Number.isFinite(leverage) && leverage >= 1)) return false;
  if (!(Number.isFinite(mmr) && mmr >= 0)) return false;
  return 1 / leverage - mmr - distance > TOLERANCE;
}

export function validateMaxLeverageInput(input: MaxLeverageInput): MaxLeverageIssue[] {
  const issues: MaxLeverageIssue[] = [];
  const sideOk = input.side === 'long' || input.side === 'short';
  const entryOk = isPositive(input.entryPrice);
  const stopOk = isPositive(input.stopPrice);

  if (!sideOk) issues.push('side');
  if (!entryOk) issues.push('entryPrice');
  if (!stopOk) issues.push('stopPrice');
  if (sideOk && entryOk && stopOk) {
    const wrongSide = input.side === 'long' ? input.stopPrice >= input.entryPrice : input.stopPrice <= input.entryPrice;
    if (wrongSide) issues.push('stopSide');
  }

  const mmrOk = typeof input.mmr === 'number' && Number.isFinite(input.mmr) && input.mmr >= 0 && input.mmr < 1;
  if (!mmrOk) issues.push('mmr');

  const capOk = typeof input.maxLeverage === 'number' && Number.isFinite(input.maxLeverage) && input.maxLeverage >= 1;
  if (!capOk) issues.push('maxLeverage');

  return issues;
}

export function maxLeverage(input: MaxLeverageInput): MaxLeverageResult {
  const issues = validateMaxLeverageInput(input);
  if (issues.length > 0) return { ok: false, issues };

  const { side, entryPrice, stopPrice, mmr } = input;
  const distance = stopDistance(entryPrice, stopPrice);
  const limit = 1 / (distance + mmr);
  const cap = Math.floor(input.maxLeverage);

  // Start from the whole number at or under the bound and step down until the
  // stop really is first. At most one step is needed; the loop is the proof.
  let whole = Math.min(Math.floor(limit + TOLERANCE), cap);
  while (whole >= 1 && !stopComesFirst(distance, whole, mmr)) whole -= 1;

  const feasible = whole >= 1;
  if (!feasible) {
    return {
      ok: true,
      side,
      stopDistance: distance,
      limit,
      maxWholeLeverage: 0,
      cappedByExchange: false,
      feasible: false,
      liquidationDistance: 0,
      liquidationPrice: 0,
    };
  }

  const liquidationDistance = 1 / whole - mmr;
  return {
    ok: true,
    side,
    stopDistance: distance,
    limit,
    maxWholeLeverage: whole,
    // The cap binds when the next whole number up would still keep the stop first.
    cappedByExchange: whole === cap && stopComesFirst(distance, cap + 1, mmr),
    feasible: true,
    liquidationDistance,
    liquidationPrice: side === 'long' ? entryPrice * (1 - liquidationDistance) : entryPrice * (1 + liquidationDistance),
  };
}

/** Cut a number down to `decimals` places without rounding up: floorTo(18.7699, 2) -> 18.76 */
export function floorTo(value: number, decimals: number): number {
  if (!Number.isFinite(value)) return value;
  const scale = 10 ** decimals;
  return Math.floor(value * scale + 1e-9) / scale;
}
