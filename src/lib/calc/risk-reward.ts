// Risk to reward of one trade, from three prices, and the win rate at which a
// run of such trades breaks even, before and after fees.
//
//   risk   = |entry - stop|       what one unit loses at the stop
//   reward = |target - entry|     what one unit makes at the target
//   R      = reward / risk        the reward as a multiple of the risk
//   break-even win rate = 1 / (1 + R)
//
// The last line is the win rate w at which w x reward = (1 - w) x risk.
//
// Fees are charged on the traded value on the way in and on the way out
// (the same convention as position-size.ts):
//   fee if stopped   = (entry + stop)   x fee rate
//   fee at target    = (entry + target) x fee rate
//   net risk         = risk + fee if stopped
//   net reward       = reward - fee at target
//   break-even win rate after fees = net risk / (net risk + net reward)
//
// Everything is per one unit of the base currency, so the size of the
// position drops out: both sides of every ratio scale with it.
//
// The side follows from the prices: a stop below the entry with a target
// above it is a long, the mirror image is a short. A stop and a target on the
// same side of the entry are not a trade.
//
// Pure functions, no I/O. The fee rate is passed in by the caller; nothing is
// defaulted.
import type { Side } from './liquidation';

export interface RiskRewardInput {
  /** Entry price. Must be > 0. */
  entryPrice: number;
  /** Stop price. Must be > 0 and different from the entry. */
  stopPrice: number;
  /** Target price. Must be > 0 and on the other side of the entry from the stop. */
  targetPrice: number;
  /** Fee per side as a fraction of the traded value: 0.00055 means 0.055%. 0 <= fee < 1. */
  feeRate: number;
}

/** Which input is wrong. 'sameSide' = the target is not on the other side of the entry from the stop. */
export type RiskRewardIssue = 'entryPrice' | 'stopPrice' | 'targetPrice' | 'sameSide' | 'feeRate';

export interface RiskRewardOk {
  ok: true;
  /** long when the stop is below the entry, short when it is above. */
  side: Side;
  /** |entry - stop|, in price units per one unit of the base currency. */
  risk: number;
  /** |target - entry|, likewise. */
  reward: number;
  /** risk / entry, a fraction of the entry price. */
  riskDistance: number;
  /** reward / entry, a fraction of the entry price. */
  rewardDistance: number;
  /** reward / risk: the R multiple of the target. */
  ratio: number;
  /** 1 / (1 + ratio): the win rate at which the trade breaks even before fees. */
  breakevenWinRate: number;
  /** (entry + stop) x fee rate: fees of a trade that ends at the stop, per unit. */
  feeAtStop: number;
  /** (entry + target) x fee rate: fees of a trade that ends at the target, per unit. */
  feeAtTarget: number;
  /** risk + feeAtStop. */
  netRisk: number;
  /** reward - feeAtTarget. Zero or negative when the fees are as large as the target. */
  netReward: number;
  /** netReward / netRisk. Zero or negative when a winning trade makes nothing after fees. */
  netRatio: number;
  /**
   * netRisk / (netRisk + netReward): the win rate at which the trade breaks
   * even after fees. null when netReward <= 0: then even a trade that reaches
   * its target loses money, and no win rate breaks even.
   */
  breakevenWinRateNet: number | null;
}

export interface RiskRewardError {
  ok: false;
  issues: RiskRewardIssue[];
}

export type RiskRewardResult = RiskRewardOk | RiskRewardError;

const isPositive = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n > 0;
const isFraction = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n < 1;

/**
 * Win rate at which wins of `ratio` times the risk pay for losses of one
 * times the risk: 1 / (1 + ratio).
 *   breakevenWinRate(1) -> 0.5
 *   breakevenWinRate(3) -> 0.25
 * NaN unless ratio is a finite number above 0.
 */
export function breakevenWinRate(ratio: number): number {
  if (!isPositive(ratio)) return Number.NaN;
  return 1 / (1 + ratio);
}

export function validateRiskRewardInput(input: RiskRewardInput): RiskRewardIssue[] {
  const issues: RiskRewardIssue[] = [];
  const entryOk = isPositive(input.entryPrice);
  const stopOk = isPositive(input.stopPrice) && !(entryOk && input.stopPrice === input.entryPrice);
  const targetOk = isPositive(input.targetPrice) && !(entryOk && input.targetPrice === input.entryPrice);
  if (!entryOk) issues.push('entryPrice');
  if (!stopOk) issues.push('stopPrice');
  if (!targetOk) issues.push('targetPrice');
  if (entryOk && stopOk && targetOk && (input.stopPrice < input.entryPrice) === (input.targetPrice < input.entryPrice)) {
    issues.push('sameSide');
  }
  if (!isFraction(input.feeRate)) issues.push('feeRate');
  return issues;
}

export function riskReward(input: RiskRewardInput): RiskRewardResult {
  const issues = validateRiskRewardInput(input);
  if (issues.length > 0) return { ok: false, issues };

  const { entryPrice, stopPrice, targetPrice, feeRate } = input;
  const side: Side = stopPrice < entryPrice ? 'long' : 'short';
  const risk = Math.abs(entryPrice - stopPrice);
  const reward = Math.abs(targetPrice - entryPrice);
  const ratio = reward / risk;

  const feeAtStop = (entryPrice + stopPrice) * feeRate;
  const feeAtTarget = (entryPrice + targetPrice) * feeRate;
  const netRisk = risk + feeAtStop;
  const netReward = reward - feeAtTarget;

  return {
    ok: true,
    side,
    risk,
    reward,
    riskDistance: risk / entryPrice,
    rewardDistance: reward / entryPrice,
    ratio,
    breakevenWinRate: 1 / (1 + ratio),
    feeAtStop,
    feeAtTarget,
    netRisk,
    netReward,
    netRatio: netReward / netRisk,
    // A net reward that is zero on paper can come out as a hair above zero in
    // binary (99 + 101 at 1% against a reward of 2). That is still "nothing".
    breakevenWinRateNet: netReward > entryPrice * 1e-12 ? netRisk / (netRisk + netReward) : null,
  };
}
