// Average price after several fills (dollar-cost averaging, or adding to a
// position), and for a USDT perpetual on isolated margin the liquidation price
// that goes with the new average.
//
//   quantity of a fill   = size                     (size given as a quantity)
//                        = size / price             (size given as an amount in USDT)
//   cost of a fill       = price x quantity
//   average price        = sum of costs / sum of quantities
//
// A fill at a lower price pulls the average down by its share of the total
// quantity, and it makes the position larger by the same fill. Both happen
// together: there is no way to lower the average without holding more.
//
// Futures: every fill is opened at the same leverage, so the margin locked is
// total cost / leverage and the entry price the exchange uses is the average
// price. The liquidation price is NOT a new formula: it is liquidationPrice()
// from liquidation.ts, called with the average price as the entry.
// The same function is called after every fill, which also shows when a fill
// could never have happened: its price lies at or beyond the liquidation
// price of the position held before it.
//
// Pure functions, no I/O. The maintenance margin rate and the exchange's
// leverage cap are passed in by the caller; nothing is defaulted.
import { liquidationPrice } from './liquidation';
import type { Side } from './liquidation';

/** Most fills the calculator accepts. A bound on the input, not a market fact. */
export const MAX_DCA_FILLS = 20;

export type DcaSizeUnit = 'quantity' | 'amount';

export interface DcaFillInput {
  /** Price of this fill in quote currency (USDT). Must be > 0. */
  price: number;
  /** Size of this fill: base currency when sizeUnit is 'quantity', USDT when it is 'amount'. Must be > 0. */
  size: number;
}

export interface DcaFuturesInput {
  side: Side;
  /** Leverage as a multiple, the same for every fill. Must be >= 1 and <= maxLeverage. */
  leverage: number;
  /** Maintenance margin rate as a fraction: 0.0033 means 0.33%. */
  mmr: number;
  /** The exchange's highest allowed leverage for this contract and tier. */
  maxLeverage: number;
}

export interface DcaInput {
  /** The fills in the order they happen. 1 to MAX_DCA_FILLS of them. */
  fills: DcaFillInput[];
  sizeUnit: DcaSizeUnit;
  /** Leave out for spot (no leverage, no liquidation). */
  futures?: DcaFuturesInput;
}

/** Which input is wrong. 'noRoom' = leverage so high that 1/leverage <= MMR. */
export type DcaIssue = 'noFills' | 'tooManyFills' | 'sizeUnit' | 'side' | 'leverage' | 'mmr' | 'maxLeverage' | 'noRoom';

/** A wrong value in one fill. `row` counts from 0. */
export interface DcaRowIssue {
  row: number;
  field: 'price' | 'size';
}

/** The position after one more fill. */
export interface DcaStep {
  price: number;
  /** This fill, in base currency. */
  quantity: number;
  /** This fill, in USDT: price x quantity. */
  cost: number;
  /** Everything held after this fill. */
  totalQuantity: number;
  totalCost: number;
  /** totalCost / totalQuantity after this fill. */
  averagePrice: number;
  /** This fill's share of the final quantity, 0 to 1. The shares add up to 1. */
  share: number;
  /** Futures only: liquidation price of the position after this fill, unrounded. */
  liquidationPrice?: number;
}

export interface DcaFuturesOk {
  side: Side;
  leverage: number;
  /** Margin locked after the first fill: its cost / leverage. */
  firstMargin: number;
  /** Margin locked after all fills: total cost / leverage. */
  margin: number;
  /** Liquidation price after the first fill only, unrounded. */
  firstLiquidationPrice: number;
  /** Liquidation price after all fills, unrounded. */
  liquidationPrice: number;
  /** 1/leverage - MMR: how far the liquidation price is from the average price, a fraction of it. */
  liquidationDistance: number;
  /**
   * How far the liquidation price is from the price of the last fill, as a
   * fraction of that price. Smaller than liquidationDistance whenever the
   * last fill was on the losing side of the average.
   */
  lastToLiquidation: number;
  /**
   * Index (from 0) of the first fill whose price is at or beyond the
   * liquidation price of the position held before it, or null. Such a fill
   * could not have been made: the position was closed on the way there.
   */
  liquidatedBeforeFill: number | null;
}

export interface DcaOk {
  ok: true;
  steps: DcaStep[];
  totalQuantity: number;
  totalCost: number;
  averagePrice: number;
  firstPrice: number;
  lastPrice: number;
  /** averagePrice / firstPrice - 1. Negative when the average came down. */
  averageVsFirst: number;
  /** totalCost / cost of the first fill: how many times larger the position is in USDT. */
  costMultiple: number;
  /** totalQuantity / quantity of the first fill. */
  quantityMultiple: number;
  /**
   * Profit or loss if the whole position were valued at the price of the last
   * fill, in USDT, before fees. Spot counts as a long.
   */
  unrealizedAtLast: number;
  /**
   * The price move from the last fill back to the average price, as a signed
   * fraction of the last price: +0.0323 means price has to rise 3.23%.
   */
  lastToAverage: number;
  futures?: DcaFuturesOk;
}

export interface DcaError {
  ok: false;
  issues: DcaIssue[];
  rowIssues: DcaRowIssue[];
}

export type DcaResult = DcaOk | DcaError;

const isPositive = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n > 0;

export function validateDcaInput(input: DcaInput): { issues: DcaIssue[]; rowIssues: DcaRowIssue[] } {
  const issues: DcaIssue[] = [];
  const rowIssues: DcaRowIssue[] = [];
  const fills = Array.isArray(input.fills) ? input.fills : [];

  if (fills.length === 0) issues.push('noFills');
  if (fills.length > MAX_DCA_FILLS) issues.push('tooManyFills');
  if (input.sizeUnit !== 'quantity' && input.sizeUnit !== 'amount') issues.push('sizeUnit');

  fills.forEach((fill, row) => {
    if (!isPositive(fill?.price)) rowIssues.push({ row, field: 'price' });
    if (!isPositive(fill?.size)) rowIssues.push({ row, field: 'size' });
  });

  const f = input.futures;
  if (f) {
    if (f.side !== 'long' && f.side !== 'short') issues.push('side');
    const capOk = typeof f.maxLeverage === 'number' && Number.isFinite(f.maxLeverage) && f.maxLeverage >= 1;
    const leverageOk =
      typeof f.leverage === 'number' && Number.isFinite(f.leverage) && f.leverage >= 1 && (!capOk || f.leverage <= f.maxLeverage);
    if (!leverageOk) issues.push('leverage');
    const mmrOk = typeof f.mmr === 'number' && Number.isFinite(f.mmr) && f.mmr >= 0 && f.mmr < 1;
    if (!mmrOk) issues.push('mmr');
    if (!capOk) issues.push('maxLeverage');
    // Initial margin (1/L) has to be larger than the maintenance margin (MMR).
    if (leverageOk && mmrOk && 1 / f.leverage <= f.mmr) issues.push('noRoom');
  }

  return { issues, rowIssues };
}

/**
 * Average price of several fills: sum(price x quantity) / sum(quantity).
 *   averagePrice([{ price: 100, quantity: 1 }, { price: 50, quantity: 3 }]) -> 62.5
 * Returns NaN when there is nothing to average or a value is not above 0.
 */
export function averagePrice(fills: Array<{ price: number; quantity: number }>): number {
  if (!Array.isArray(fills) || fills.length === 0) return Number.NaN;
  let cost = 0;
  let quantity = 0;
  for (const fill of fills) {
    if (!isPositive(fill?.price) || !isPositive(fill?.quantity)) return Number.NaN;
    cost += fill.price * fill.quantity;
    quantity += fill.quantity;
  }
  return cost / quantity;
}

export function dca(input: DcaInput): DcaResult {
  const checked = validateDcaInput(input);
  if (checked.issues.length > 0 || checked.rowIssues.length > 0) return { ok: false, ...checked };

  const f = input.futures;
  const direction = f?.side === 'short' ? -1 : 1;

  /** The existing liquidation formula, with the average price as the entry. */
  const liquidationAt = (average: number): number | null => {
    if (!f) return null;
    const r = liquidationPrice({ side: f.side, entryPrice: average, leverage: f.leverage, mmr: f.mmr, maxLeverage: f.maxLeverage });
    return r.ok ? r.liquidationPrice : null;
  };

  const steps: DcaStep[] = [];
  let totalQuantity = 0;
  let totalCost = 0;
  let liquidatedBeforeFill: number | null = null;

  for (let i = 0; i < input.fills.length; i++) {
    const { price, size } = input.fills[i];
    const quantity = input.sizeUnit === 'amount' ? size / price : size;
    const cost = input.sizeUnit === 'amount' ? size : price * quantity;

    // Was the position held so far still open when price got here?
    if (f && i > 0 && liquidatedBeforeFill === null) {
      const before = steps[i - 1].liquidationPrice as number;
      const reached = f.side === 'long' ? price <= before : price >= before;
      if (reached) liquidatedBeforeFill = i;
    }

    totalQuantity += quantity;
    totalCost += cost;
    const average = totalCost / totalQuantity;
    const step: DcaStep = { price, quantity, cost, totalQuantity, totalCost, averagePrice: average, share: 0 };
    if (f) {
      const liq = liquidationAt(average);
      // Cannot fail: the same checks ran above. Kept so a future change shows up as an error, not a wrong number.
      if (liq === null) return { ok: false, issues: ['leverage'], rowIssues: [] };
      step.liquidationPrice = liq;
    }
    steps.push(step);
  }

  for (const step of steps) step.share = step.quantity / totalQuantity;

  const average = totalCost / totalQuantity;
  const first = steps[0];
  const last = steps[steps.length - 1];

  const result: DcaOk = {
    ok: true,
    steps,
    totalQuantity,
    totalCost,
    averagePrice: average,
    firstPrice: first.price,
    lastPrice: last.price,
    averageVsFirst: average / first.price - 1,
    costMultiple: totalCost / first.cost,
    quantityMultiple: totalQuantity / first.quantity,
    unrealizedAtLast: totalQuantity * (last.price - average) * direction,
    lastToAverage: (average - last.price) / last.price,
  };

  if (f) {
    const liq = last.liquidationPrice as number;
    result.futures = {
      side: f.side,
      leverage: f.leverage,
      firstMargin: first.cost / f.leverage,
      margin: totalCost / f.leverage,
      firstLiquidationPrice: first.liquidationPrice as number,
      liquidationPrice: liq,
      liquidationDistance: 1 / f.leverage - f.mmr,
      lastToLiquidation: (direction * (last.price - liq)) / last.price,
      liquidatedBeforeFill,
    };
  }

  return result;
}
