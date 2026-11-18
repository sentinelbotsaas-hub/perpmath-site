// Liquidation price for a USDT perpetual on isolated margin, simplified formula.
//
//   long  = entry x (1 - 1/leverage + MMR) - extraMargin / quantity
//   short = entry x (1 + 1/leverage - MMR) + extraMargin / quantity
//
// Where it comes from: the position is closed when what is left of the margin
// equals the maintenance margin. With quantity Q, entry E, leverage L:
//   initial margin      IM = E x Q / L
//   maintenance margin  MM = E x Q x MMR
//   long, at price P:   IM + extra + Q x (P - E) = MM
//   =>                  P = E x (1 - 1/L + MMR) - extra / Q
// The short side mirrors it. Without extra margin Q cancels out, which is why
// the basic calculator does not ask for a position size.
//
// What the simplified formula leaves out: the fee to close, funding payments,
// and the "maintenance margin deduction" Bybit applies above risk tier 1. For
// a position inside tier 1 the deduction is zero.
//
// Pure functions, no I/O, no defaults for the maintenance margin rate: the
// caller must pass `mmr` explicitly (the UI reads it from the risk-limit
// snapshot in src/data/risk-limit/).

export type Side = 'long' | 'short';

export interface LiquidationInput {
  side: Side;
  /** Entry price, in quote currency (USDT). Must be > 0. */
  entryPrice: number;
  /** Leverage as a multiple: 20 means 20x. Must be >= 1 and <= maxLeverage. */
  leverage: number;
  /** Maintenance margin rate as a fraction: 0.0033 means 0.33%. */
  mmr: number;
  /** Margin added to the position after opening, in USDT. Optional, >= 0. */
  extraMargin?: number;
  /** Position size in base currency (BTC for BTCUSDT). Required when extraMargin > 0. */
  quantity?: number;
  /** Upper bound for leverage. Defaults to 100 (the UI passes the exchange limit). */
  maxLeverage?: number;
}

/** Which input is wrong. 'noRoom' = leverage so high that 1/leverage <= MMR. */
export type LiquidationIssue =
  | 'side'
  | 'entryPrice'
  | 'leverage'
  | 'mmr'
  | 'extraMargin'
  | 'quantity'
  | 'noRoom';

export interface LiquidationOk {
  ok: true;
  side: Side;
  /** Unrounded. 0 when `reachable` is false. Round with roundToTick() for display. */
  liquidationPrice: number;
  /** How far price must move against the position, as a fraction of entry (0.0467 = 4.67%). */
  distance: number;
  /** `distance` clamped to 0..1, for the to-scale bar. */
  room: number;
  /** false when a long has so much margin that the liquidation price would be <= 0. */
  reachable: boolean;
}

export interface LiquidationError {
  ok: false;
  issues: LiquidationIssue[];
}

export type LiquidationResult = LiquidationOk | LiquidationError;

const isPositive = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n > 0;

export function validateLiquidationInput(input: LiquidationInput): LiquidationIssue[] {
  const issues: LiquidationIssue[] = [];
  const maxLeverage = input.maxLeverage ?? 100;
  const extra = input.extraMargin ?? 0;

  if (input.side !== 'long' && input.side !== 'short') issues.push('side');
  if (!isPositive(input.entryPrice)) issues.push('entryPrice');

  const leverageOk =
    typeof input.leverage === 'number' &&
    Number.isFinite(input.leverage) &&
    input.leverage >= 1 &&
    input.leverage <= maxLeverage;
  if (!leverageOk) issues.push('leverage');

  const mmrOk = typeof input.mmr === 'number' && Number.isFinite(input.mmr) && input.mmr >= 0 && input.mmr < 1;
  if (!mmrOk) issues.push('mmr');

  const extraOk = typeof extra === 'number' && Number.isFinite(extra) && extra >= 0;
  if (!extraOk) issues.push('extraMargin');
  if (extraOk && extra > 0 && !isPositive(input.quantity)) issues.push('quantity');
  if (input.quantity !== undefined && extra === 0 && !(Number.isFinite(input.quantity) && input.quantity >= 0)) {
    issues.push('quantity');
  }

  // Initial margin (1/L) has to be larger than the maintenance margin (MMR),
  // otherwise the position is liquidated the moment it opens.
  if (leverageOk && mmrOk && 1 / input.leverage <= input.mmr) issues.push('noRoom');

  return issues;
}

export function liquidationPrice(input: LiquidationInput): LiquidationResult {
  const issues = validateLiquidationInput(input);
  if (issues.length > 0) return { ok: false, issues };

  const { side, entryPrice, leverage, mmr } = input;
  const extra = input.extraMargin ?? 0;
  const extraPerUnit = extra > 0 ? extra / (input.quantity as number) : 0;

  const raw =
    side === 'long'
      ? entryPrice * (1 - 1 / leverage + mmr) - extraPerUnit
      : entryPrice * (1 + 1 / leverage - mmr) + extraPerUnit;

  const reachable = raw > 0;
  const price = reachable ? raw : 0;
  const distance = Math.abs(entryPrice - raw) / entryPrice;

  return {
    ok: true,
    side,
    liquidationPrice: price,
    distance,
    room: Math.min(1, Math.max(0, distance)),
    reachable,
  };
}

/**
 * Share of the entry price left before liquidation when no margin is added:
 * 1/leverage - MMR. The home page bar uses this. Returns 0 when there is none.
 */
export function roomLeft(leverage: number, mmr: number): number {
  if (!(Number.isFinite(leverage) && leverage >= 1) || !(Number.isFinite(mmr) && mmr >= 0)) return 0;
  return Math.min(1, Math.max(0, 1 / leverage - mmr));
}

/** Round a price to the contract's tick size: roundToTick(64824.44, 0.1) -> 64824.4 */
export function roundToTick(value: number, tick: number): number {
  if (!Number.isFinite(value) || !isPositive(tick)) return value;
  const text = tick.toString();
  const decimals = text.includes('e-')
    ? Number(text.split('e-')[1])
    : text.includes('.')
      ? text.length - text.indexOf('.') - 1
      : 0;
  const scale = 10 ** decimals;
  const ticks = Math.round((value * scale) / Math.round(tick * scale));
  return Number(((ticks * Math.round(tick * scale)) / scale).toFixed(decimals));
}
