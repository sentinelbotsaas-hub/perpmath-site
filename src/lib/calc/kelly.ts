// The Kelly criterion for a bet with two outcomes.
//
//   f* = p - (1 - p) / b
//
//   p   probability that the trade wins
//   b   payoff ratio: the average win divided by the average loss
//   f*  the share of the account to put at risk on one trade, where "at risk"
//       means what a losing trade takes. It is not the leverage and not the
//       position value.
//
// f* is the fraction that makes the expected log growth of the account
//   g(f) = p ln(1 + b f) + (1 - p) ln(1 - f)
// as large as it can be (J. L. Kelly Jr., "A New Interpretation of
// Information Rate", Bell System Technical Journal 35(4), 1956). g is zero
// again near 2 f*, and negative beyond that: betting more than Kelly lowers
// the growth, and enough more turns it negative.
//
// When p b <= 1 - p the bet has no edge. f* is then zero or negative, which
// means "do not take this bet", and the result says so instead of handing
// back a negative share.
//
// The formula takes p and b as known. In trading they are estimates from a
// sample of past trades; see growthAt() for what an overestimate costs.
//
// Pure functions, no I/O, no defaults. Percentages are fractions: 0.4 is 40%.

/** Largest payoff ratio accepted. A bound on the input, not a market fact. */
export const MAX_PAYOFF = 100;

export interface KellyInput {
  /** Probability that a trade wins, 0 < p < 1. */
  winRate: number;
  /** Average win divided by average loss, 0 < b <= MAX_PAYOFF. */
  payoff: number;
}

export type KellyIssue = 'winRate' | 'payoff';

export interface KellyOk {
  ok: true;
  /** Expected result of one trade in units of the amount risked: p b - (1 - p). */
  edge: number;
  /** p - (1 - p) / b as it comes out of the formula. Zero or negative when there is no edge. */
  raw: number;
  /** false = no edge: the formula says not to bet. full, half and quarter are then 0. */
  bet: boolean;
  /** Full Kelly: the share of the account to risk per trade. max(0, raw). */
  full: number;
  /** Half of full Kelly. */
  half: number;
  /** A quarter of full Kelly. */
  quarter: number;
  /** Expected log growth per trade at each of the three, as a fraction (0.01 = about 1% per trade). 0 when bet is false. */
  growthFull: number;
  growthHalf: number;
  growthQuarter: number;
}

export interface KellyError {
  ok: false;
  issues: KellyIssue[];
}

export type KellyResult = KellyOk | KellyError;

const isOpenFraction = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n > 0 && n < 1;
const isPayoff = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n > 0 && n <= MAX_PAYOFF;

export function validateKellyInput(input: KellyInput): KellyIssue[] {
  const issues: KellyIssue[] = [];
  if (!isOpenFraction(input.winRate)) issues.push('winRate');
  if (!isPayoff(input.payoff)) issues.push('payoff');
  return issues;
}

/**
 * p - (1 - p) / b, as it comes out of the formula (it can be negative).
 *   kellyFraction(0.4, 2) -> 0.1
 *   kellyFraction(0.5, 1) -> 0
 *   kellyFraction(0.3, 2) -> -0.05
 * NaN for input outside 0 < p < 1, 0 < b <= MAX_PAYOFF.
 */
export function kellyFraction(winRate: number, payoff: number): number {
  if (!isOpenFraction(winRate) || !isPayoff(payoff)) return Number.NaN;
  return winRate - (1 - winRate) / payoff;
}

/**
 * Expected log growth of the account per trade when the share `fraction` is
 * risked every time: p ln(1 + b f) + (1 - p) ln(1 - f).
 *   growthAt(0.4, 2, 0.1) -> 0.4 ln 1.2 + 0.6 ln 0.9 = 0.009711...
 * Pass the true win rate with a fraction sized from an estimated one to see
 * what the estimate costs. NaN for input outside 0 < p < 1, 0 < b <=
 * MAX_PAYOFF, 0 <= f < 1.
 */
export function growthAt(winRate: number, payoff: number, fraction: number): number {
  const fractionOk = typeof fraction === 'number' && Number.isFinite(fraction) && fraction >= 0 && fraction < 1;
  if (!isOpenFraction(winRate) || !isPayoff(payoff) || !fractionOk) return Number.NaN;
  return winRate * Math.log1p(payoff * fraction) + (1 - winRate) * Math.log1p(-fraction);
}

export function kelly(input: KellyInput): KellyResult {
  const issues = validateKellyInput(input);
  if (issues.length > 0) return { ok: false, issues };

  const { winRate, payoff } = input;
  const raw = kellyFraction(winRate, payoff);
  const edge = winRate * payoff - (1 - winRate);
  // The edge decides: it is computed without a division, so a bet at exactly
  // break-even is not turned into a tiny positive share by rounding.
  const bet = edge > 1e-12 && raw > 0;
  const full = bet ? raw : 0;
  const half = full / 2;
  const quarter = full / 4;

  return {
    ok: true,
    edge,
    raw,
    bet,
    full,
    half,
    quarter,
    growthFull: bet ? growthAt(winRate, payoff, full) : 0,
    growthHalf: bet ? growthAt(winRate, payoff, half) : 0,
    growthQuarter: bet ? growthAt(winRate, payoff, quarter) : 0,
  };
}
