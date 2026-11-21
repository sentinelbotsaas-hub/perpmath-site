// Profit and loss of one USDT perpetual trade on isolated margin, before and
// after the two costs every trade has: the fee in and out, and funding.
//
//   quantity      = size                          (size given as a quantity)
//                 = margin x leverage / entry     (size given as margin)
//   position value (notional) = quantity x entry
//   margin        = notional / leverage
//   gross P&L     = quantity x (exit - entry)     long
//                 = quantity x (entry - exit)     short
//   fee, in and out = quantity x (entry + exit) x fee rate
//   funding       = -(notional x funding rate x settlements)   long
//                 = +(notional x funding rate x settlements)   short
//   net P&L       = gross P&L - fee + funding
//   return on margin   = P&L / margin
//   return on notional = P&L / notional
//
// Funding sign: a positive funding rate means longs pay shorts, so `funding`
// here is negative for a long and positive for a short. It is charged on the
// position value at each settlement; this file uses the value at entry for
// every settlement, which is an approximation.
//
// The exit price is only reachable while the position is open. Whether it is
// still open is decided by liquidationPrice() from liquidation.ts, not by a
// second formula here: an exit at or beyond the liquidation price sets
// `liquidatedBeforeExit`, and the caller must not present the P&L at that
// exit as something that can happen.
//
// Pure functions, no I/O. Every rate (fee, funding, maintenance margin) and
// the exchange's leverage cap are passed in by the caller.
import { liquidationPrice } from './liquidation';
import type { Side } from './liquidation';

/** Most funding settlements the calculator accepts. A bound on the input, not a market fact. */
export const MAX_FUNDING_PERIODS = 10000;

export type ProfitSizeUnit = 'quantity' | 'margin';

export interface ProfitInput {
  side: Side;
  /** Entry price in USDT. Must be > 0. */
  entryPrice: number;
  /** Exit price in USDT. Must be > 0. */
  exitPrice: number;
  sizeUnit: ProfitSizeUnit;
  /** Base currency when sizeUnit is 'quantity', USDT of margin when it is 'margin'. Must be > 0. */
  size: number;
  /** Leverage as a multiple. Must be >= 1 and <= maxLeverage. */
  leverage: number;
  /** Fee per side as a fraction of the traded value: 0.00055 means 0.055%. 0 <= fee < 1. */
  feeRate: number;
  /** Funding rate per settlement as a signed fraction: 0.0001 means 0.01%, longs pay. -1 < rate < 1. Default 0. */
  fundingRate?: number;
  /** Number of funding settlements the position is held through. Whole number, 0 to MAX_FUNDING_PERIODS. Default 0. */
  fundingPeriods?: number;
  /** Maintenance margin rate as a fraction: 0.0033 means 0.33%. */
  mmr: number;
  /** The exchange's highest allowed leverage for this contract and tier. */
  maxLeverage: number;
}

/** Which input is wrong. 'noRoom' = leverage so high that 1/leverage <= MMR. */
export type ProfitIssue =
  | 'side'
  | 'entryPrice'
  | 'exitPrice'
  | 'sizeUnit'
  | 'size'
  | 'leverage'
  | 'feeRate'
  | 'fundingRate'
  | 'fundingPeriods'
  | 'mmr'
  | 'maxLeverage'
  | 'noRoom';

export interface ProfitOk {
  ok: true;
  side: Side;
  /** Position size in base currency, unrounded. */
  quantity: number;
  /** quantity x entry, in USDT. */
  notional: number;
  /** notional / leverage, in USDT. */
  margin: number;
  /** (exit - entry) / entry, signed. */
  priceChange: number;
  /** P&L from the price move alone, in USDT. Signed. */
  grossPnl: number;
  /** Fee to open: notional x fee rate. */
  entryFee: number;
  /** Fee to close: quantity x exit x fee rate. */
  exitFee: number;
  /** entryFee + exitFee. Always >= 0; it is subtracted. */
  roundTripFee: number;
  /** Effect of funding on the P&L, in USDT. Negative = paid, positive = received. */
  funding: number;
  /** grossPnl - roundTripFee + funding. */
  netPnl: number;
  /** netPnl - grossPnl: what fees and funding together did to the P&L. Negative = they cost. */
  costs: number;
  grossReturnOnMargin: number;
  netReturnOnMargin: number;
  grossReturnOnNotional: number;
  netReturnOnNotional: number;
  /** Exit price at which netPnl is exactly 0, with these fees and this funding. Can be <= 0 for a long that funding pays generously. */
  breakEvenPrice: number;
  /** Liquidation price at this leverage, unrounded (simplified formula, no extra margin). */
  liquidationPrice: number;
  /** 1/leverage - MMR, a fraction of entry. */
  liquidationDistance: number;
  /**
   * true = the exit price is at or beyond the liquidation price: the position
   * was closed by the exchange before price got there, and the P&L fields
   * above describe an exit that cannot happen.
   */
  liquidatedBeforeExit: boolean;
}

export interface ProfitError {
  ok: false;
  issues: ProfitIssue[];
}

export type ProfitResult = ProfitOk | ProfitError;

const isPositive = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n > 0;
const isFraction = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n < 1;

export function validateProfitInput(input: ProfitInput): ProfitIssue[] {
  const issues: ProfitIssue[] = [];
  const fundingRate = input.fundingRate ?? 0;
  const fundingPeriods = input.fundingPeriods ?? 0;

  if (input.side !== 'long' && input.side !== 'short') issues.push('side');
  if (!isPositive(input.entryPrice)) issues.push('entryPrice');
  if (!isPositive(input.exitPrice)) issues.push('exitPrice');
  if (input.sizeUnit !== 'quantity' && input.sizeUnit !== 'margin') issues.push('sizeUnit');
  if (!isPositive(input.size)) issues.push('size');

  const capOk = typeof input.maxLeverage === 'number' && Number.isFinite(input.maxLeverage) && input.maxLeverage >= 1;
  const leverageOk =
    typeof input.leverage === 'number' &&
    Number.isFinite(input.leverage) &&
    input.leverage >= 1 &&
    (!capOk || input.leverage <= input.maxLeverage);
  if (!leverageOk) issues.push('leverage');

  if (!isFraction(input.feeRate)) issues.push('feeRate');
  if (!(typeof fundingRate === 'number' && Number.isFinite(fundingRate) && fundingRate > -1 && fundingRate < 1)) {
    issues.push('fundingRate');
  }
  if (!(typeof fundingPeriods === 'number' && Number.isInteger(fundingPeriods) && fundingPeriods >= 0 && fundingPeriods <= MAX_FUNDING_PERIODS)) {
    issues.push('fundingPeriods');
  }

  const mmrOk = isFraction(input.mmr);
  if (!mmrOk) issues.push('mmr');
  if (!capOk) issues.push('maxLeverage');

  // Initial margin (1/L) has to be larger than the maintenance margin (MMR).
  if (leverageOk && mmrOk && 1 / input.leverage <= input.mmr) issues.push('noRoom');

  return issues;
}

export function profit(input: ProfitInput): ProfitResult {
  const issues = validateProfitInput(input);
  if (issues.length > 0) return { ok: false, issues };

  const { side, entryPrice, exitPrice, leverage, feeRate, mmr } = input;
  const fundingRate = input.fundingRate ?? 0;
  const fundingPeriods = input.fundingPeriods ?? 0;
  const direction = side === 'long' ? 1 : -1;

  const quantity = input.sizeUnit === 'margin' ? (input.size * leverage) / entryPrice : input.size;
  const notional = input.sizeUnit === 'margin' ? input.size * leverage : quantity * entryPrice;
  const margin = input.sizeUnit === 'margin' ? input.size : notional / leverage;

  const grossPnl = quantity * (exitPrice - entryPrice) * direction;
  const entryFee = notional * feeRate;
  const exitFee = quantity * exitPrice * feeRate;
  const roundTripFee = entryFee + exitFee;
  // A positive rate is paid by longs and received by shorts. `|| 0` turns -0 into 0.
  const funding = -direction * notional * fundingRate * fundingPeriods || 0;
  const netPnl = grossPnl - roundTripFee + funding;

  // netPnl = 0 solved for the exit price:
  //   long   q(x - e) - q(e + x)f + F = 0  =>  x = (e(1 + f) - F/q) / (1 - f)
  //   short  q(e - x) - q(e + x)f + F = 0  =>  x = (e(1 - f) + F/q) / (1 + f)
  const fundingPerUnit = funding / quantity;
  const breakEvenPrice =
    side === 'long'
      ? (entryPrice * (1 + feeRate) - fundingPerUnit) / (1 - feeRate)
      : (entryPrice * (1 - feeRate) + fundingPerUnit) / (1 + feeRate);

  const liq = liquidationPrice({ side, entryPrice, leverage, mmr, maxLeverage: input.maxLeverage });
  // Cannot fail: the same checks ran above. Kept so a future change shows up as an error, not a wrong number.
  if (!liq.ok) return { ok: false, issues: ['leverage'] };
  const liquidatedBeforeExit = liq.reachable && (side === 'long' ? exitPrice <= liq.liquidationPrice : exitPrice >= liq.liquidationPrice);

  return {
    ok: true,
    side,
    quantity,
    notional,
    margin,
    priceChange: (exitPrice - entryPrice) / entryPrice,
    grossPnl,
    entryFee,
    exitFee,
    roundTripFee,
    funding,
    netPnl,
    costs: netPnl - grossPnl,
    grossReturnOnMargin: grossPnl / margin,
    netReturnOnMargin: netPnl / margin,
    grossReturnOnNotional: grossPnl / notional,
    netReturnOnNotional: netPnl / notional,
    breakEvenPrice,
    liquidationPrice: liq.liquidationPrice,
    liquidationDistance: 1 / leverage - mmr,
    liquidatedBeforeExit,
  };
}
