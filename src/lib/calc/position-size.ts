// Position size from a fixed risk per trade, for a USDT perpetual on isolated
// margin.
//
//   risk amount = account x risk per trade
//   quantity    = risk amount / |entry - stop|
//   notional    = quantity x entry
//   margin      = notional / leverage
//   fee, in and out at the stop = quantity x (entry + stop) x fee rate
//
// The side follows from the prices: a stop below the entry is a long, a stop
// above it is a short. Leverage does not change the quantity or the loss at
// the stop; it only changes how much margin is locked up and where the
// liquidation price sits. That is why the result also says whether the stop
// is reached before the liquidation price (see leverage.ts).
//
// Pure functions, no I/O. Every rate (risk, fee, maintenance margin) and the
// exchange's leverage cap are passed in by the caller; nothing is defaulted.
import { stopComesFirst } from './leverage';
import { liquidationPrice } from './liquidation';
import type { Side } from './liquidation';

export interface PositionSizeInput {
  /** Account balance in USDT. Must be > 0. */
  accountSize: number;
  /** Share of the account to lose if the stop is hit, as a fraction: 0.01 means 1%. 0 < risk <= 1. */
  riskFraction: number;
  /** Entry price in USDT. Must be > 0. */
  entryPrice: number;
  /** Stop price in USDT. Must be > 0 and different from the entry. */
  stopPrice: number;
  /** Leverage as a multiple. Must be >= 1 and <= maxLeverage. */
  leverage: number;
  /** Fee per side as a fraction of the traded value: 0.00055 means 0.055%. 0 <= fee < 1. */
  feeRate: number;
  /** Maintenance margin rate as a fraction: 0.0033 means 0.33%. */
  mmr: number;
  /** The exchange's highest allowed leverage for this contract and tier. */
  maxLeverage: number;
}

/** Which input is wrong. 'noRoom' = leverage so high that 1/leverage <= MMR. */
export type PositionSizeIssue =
  | 'accountSize'
  | 'risk'
  | 'entryPrice'
  | 'stopPrice'
  | 'leverage'
  | 'feeRate'
  | 'mmr'
  | 'maxLeverage'
  | 'noRoom';

export interface PositionSizeOk {
  ok: true;
  /** long when the stop is below the entry, short when it is above. */
  side: Side;
  /** account x risk, in USDT: the loss at the stop before fees. */
  riskAmount: number;
  /** |entry - stop| / entry, a fraction of the entry price. */
  stopDistance: number;
  /** Position size in base currency (BTC for BTCUSDT), unrounded. */
  quantity: number;
  /** quantity x entry, in USDT. */
  notional: number;
  /** notional / leverage, in USDT. */
  margin: number;
  /** Fee to open: notional x fee rate. */
  entryFee: number;
  /** Fee to close at the stop: quantity x stop x fee rate. */
  exitFee: number;
  /** entryFee + exitFee. */
  roundTripFee: number;
  /** riskAmount + roundTripFee: what the trade costs if the stop is hit and fills at its price. */
  lossAtStop: number;
  /** Liquidation price at this leverage, unrounded (simplified formula, no extra margin). */
  liquidationPrice: number;
  /** 1/leverage - MMR, a fraction of entry. */
  liquidationDistance: number;
  /** false = the position would be liquidated before price reaches the stop. */
  stopBeforeLiquidation: boolean;
  /** false = the margin needed is more than the account holds. */
  marginFits: boolean;
}

export interface PositionSizeError {
  ok: false;
  issues: PositionSizeIssue[];
}

export type PositionSizeResult = PositionSizeOk | PositionSizeError;

const isPositive = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n > 0;
const isFraction = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n < 1;

export function validatePositionSizeInput(input: PositionSizeInput): PositionSizeIssue[] {
  const issues: PositionSizeIssue[] = [];

  if (!isPositive(input.accountSize)) issues.push('accountSize');
  if (!(isPositive(input.riskFraction) && input.riskFraction <= 1)) issues.push('risk');

  const entryOk = isPositive(input.entryPrice);
  if (!entryOk) issues.push('entryPrice');
  if (!isPositive(input.stopPrice) || (entryOk && input.stopPrice === input.entryPrice)) issues.push('stopPrice');

  const capOk = typeof input.maxLeverage === 'number' && Number.isFinite(input.maxLeverage) && input.maxLeverage >= 1;
  const leverageOk =
    typeof input.leverage === 'number' &&
    Number.isFinite(input.leverage) &&
    input.leverage >= 1 &&
    (!capOk || input.leverage <= input.maxLeverage);
  if (!leverageOk) issues.push('leverage');

  if (!isFraction(input.feeRate)) issues.push('feeRate');

  const mmrOk = isFraction(input.mmr);
  if (!mmrOk) issues.push('mmr');
  if (!capOk) issues.push('maxLeverage');

  // Initial margin (1/L) has to be larger than the maintenance margin (MMR).
  if (leverageOk && mmrOk && 1 / input.leverage <= input.mmr) issues.push('noRoom');

  return issues;
}

export function positionSize(input: PositionSizeInput): PositionSizeResult {
  const issues = validatePositionSizeInput(input);
  if (issues.length > 0) return { ok: false, issues };

  const { accountSize, riskFraction, entryPrice, stopPrice, leverage, feeRate, mmr } = input;
  const side: Side = stopPrice < entryPrice ? 'long' : 'short';

  const riskAmount = accountSize * riskFraction;
  const perUnitLoss = Math.abs(entryPrice - stopPrice);
  const stopDistance = perUnitLoss / entryPrice;
  const quantity = riskAmount / perUnitLoss;
  const notional = quantity * entryPrice;
  const margin = notional / leverage;
  const entryFee = notional * feeRate;
  const exitFee = quantity * stopPrice * feeRate;
  const roundTripFee = entryFee + exitFee;

  const liq = liquidationPrice({ side, entryPrice, leverage, mmr, maxLeverage: input.maxLeverage });
  // Cannot fail: the same checks ran above. Kept so a future change shows up as an error, not a wrong number.
  if (!liq.ok) return { ok: false, issues: ['leverage'] };

  return {
    ok: true,
    side,
    riskAmount,
    stopDistance,
    quantity,
    notional,
    margin,
    entryFee,
    exitFee,
    roundTripFee,
    lossAtStop: riskAmount + roundTripFee,
    liquidationPrice: liq.liquidationPrice,
    liquidationDistance: 1 / leverage - mmr,
    stopBeforeLiquidation: stopComesFirst(stopDistance, leverage, mmr),
    marginFits: margin <= accountSize,
  };
}
