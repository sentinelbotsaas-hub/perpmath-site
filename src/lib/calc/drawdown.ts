// Drawdown and the gain needed to recover from it.
//
//   gain needed to recover = drawdown / (1 - drawdown)
//   capital left after n losses in a row, each losing `risk` of what is
//   left at that moment = (1 - risk)^n
//
// Why the two differ: the loss is measured against the balance before it, the
// recovery against the smaller balance after it. Lose 50% of 100 and 50 is
// left; getting from 50 back to 100 is a gain of 100%.
//
// Pure functions, no I/O, no defaults. All percentages are fractions here:
// 0.5 means 50%.

/** Longest losing streak the calculator accepts. A bound on the input, not a market fact. */
export const MAX_STREAK = 1000;

/**
 * Below this share of the starting balance the result is reported as
 * 'wipedOut' instead of a recovery figure in the millions of percent.
 * One ten-thousandth (0.01%): 1 USDT left of 10,000. It is also the smallest
 * share that still shows as more than "0.00%" at two decimals.
 * A bound on the output, not a market fact.
 */
export const MIN_REMAINING = 1e-4;

// 1 - 0.9999 is 0.0000999999999999889 in binary; do not let that count as "below".
const below = (remaining: number) => remaining < MIN_REMAINING - 1e-12;

export type DrawdownInput =
  | { mode: 'drawdown'; /** Share of the peak balance lost, 0 < d < 1. */ drawdown: number }
  | {
      mode: 'streak';
      /** Number of losing trades in a row. Whole number, 1 to MAX_STREAK. */
      losses: number;
      /** Share of the current balance lost on each trade, 0 < r < 1. */
      riskPerTrade: number;
    };

/** Which input is wrong. 'wipedOut' = less than MIN_REMAINING of the balance is left. */
export type DrawdownIssue = 'mode' | 'drawdown' | 'losses' | 'risk' | 'wipedOut';

export interface DrawdownOk {
  ok: true;
  mode: 'drawdown' | 'streak';
  /** Share of the starting balance that is gone, 0 < d < 1. */
  drawdown: number;
  /** Share of the starting balance that is left: 1 - drawdown. */
  remaining: number;
  /** Gain needed on what is left to be back at the start: drawdown / (1 - drawdown). 1 means 100%. */
  recoveryGain: number;
  /** What the full width of the two bars stands for: the larger of 100% (1) and recoveryGain. */
  scaleMax: number;
  /** drawdown / scaleMax: length of the "lost" bar, 0 to 1. */
  lostShare: number;
  /** recoveryGain / scaleMax: length of the "needed to recover" bar, 0 to 1. */
  neededShare: number;
}

export interface DrawdownError {
  ok: false;
  issues: DrawdownIssue[];
}

export type DrawdownResult = DrawdownOk | DrawdownError;

const isOpenFraction = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n > 0 && n < 1;

/**
 * Gain needed to get back to the starting balance after losing `drawdown` of it.
 *   recoveryGain(0.5) -> 1     (lose 50%, need +100%)
 *   recoveryGain(0.2) -> 0.25  (lose 20%, need +25%)
 * Returns NaN outside 0 <= drawdown < 1: after a 100% loss nothing is left to grow.
 */
export function recoveryGain(drawdown: number): number {
  if (!(typeof drawdown === 'number' && Number.isFinite(drawdown) && drawdown >= 0 && drawdown < 1)) return Number.NaN;
  return drawdown / (1 - drawdown);
}

/**
 * Share of the starting balance left after `losses` losing trades in a row,
 * each losing `riskPerTrade` of the balance at that moment.
 *   capitalAfterStreak(0.02, 10) -> 0.8170728...
 * Returns NaN for input outside 0 <= risk <= 1 or a negative or fractional count.
 */
export function capitalAfterStreak(riskPerTrade: number, losses: number): number {
  const riskOk = typeof riskPerTrade === 'number' && Number.isFinite(riskPerTrade) && riskPerTrade >= 0 && riskPerTrade <= 1;
  const lossesOk = typeof losses === 'number' && Number.isInteger(losses) && losses >= 0;
  if (!riskOk || !lossesOk) return Number.NaN;
  return (1 - riskPerTrade) ** losses;
}

export function validateDrawdownInput(input: DrawdownInput): DrawdownIssue[] {
  const issues: DrawdownIssue[] = [];
  if (input.mode === 'drawdown') {
    if (!isOpenFraction(input.drawdown)) issues.push('drawdown');
    else if (below(1 - input.drawdown)) issues.push('wipedOut');
  } else if (input.mode === 'streak') {
    const lossesOk = typeof input.losses === 'number' && Number.isInteger(input.losses) && input.losses >= 1 && input.losses <= MAX_STREAK;
    const riskOk = isOpenFraction(input.riskPerTrade);
    if (!lossesOk) issues.push('losses');
    if (!riskOk) issues.push('risk');
    // (1 - risk)^n shrinks towards zero fast. Report that instead of dividing
    // by (almost) nothing.
    if (lossesOk && riskOk && below(capitalAfterStreak(input.riskPerTrade, input.losses))) issues.push('wipedOut');
  } else {
    issues.push('mode');
  }
  return issues;
}

export function drawdown(input: DrawdownInput): DrawdownResult {
  const issues = validateDrawdownInput(input);
  if (issues.length > 0) return { ok: false, issues };

  const remaining = input.mode === 'drawdown' ? 1 - input.drawdown : capitalAfterStreak(input.riskPerTrade, input.losses);
  const lost = input.mode === 'drawdown' ? input.drawdown : 1 - remaining;
  const gain = lost / remaining;
  const scaleMax = Math.max(1, gain);

  return {
    ok: true,
    mode: input.mode,
    drawdown: lost,
    remaining,
    recoveryGain: gain,
    scaleMax,
    lostShare: lost / scaleMax,
    neededShare: gain / scaleMax,
  };
}
