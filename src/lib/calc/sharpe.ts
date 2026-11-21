// Sharpe ratio of a series of per-period returns, its annualised value, and
// how much of it is sampling noise.
//
//   mean                 m  = sum(r) / n
//   standard deviation   s  = sqrt( sum((r - m)^2) / (n - 1) )     sample, n - 1
//   Sharpe per period    SR = (m - rf) / s
//   annualised Sharpe       = SR x sqrt(periods per year)
//   t statistic             = SR x sqrt(n)
//   standard error       SE = sqrt( (1 + SR^2 / 2) / n )
//   95% interval            = SR +/- 1.96 x SE
//
// The risk-free rate rf is per period and constant, so the deviation of the
// excess returns equals the deviation of the returns.
//
// The standard error and the interval are equations 9 and 10 of
//   Andrew W. Lo, "The Statistics of Sharpe Ratios", Financial Analysts
//   Journal 58(4), July/August 2002, pp. 36-52. doi:10.2469/faj.v58.n4.2453
// They are large-sample results for returns that are independent and
// identically distributed (IID). The same paper shows that multiplying by the
// square root of the number of periods is correct only for IID returns, and
// that the annualised estimator then has sqrt(periods) times the standard
// error (its V_IID(q) = q x V_IID). With serially correlated returns both the
// annualised figure and its error are different; this file does not model
// that.
//
// The t statistic is the ordinary one-sample t for "the mean excess return is
// zero": (m - rf) / (s / sqrt(n)).
//
// Pure functions, no I/O, no defaults. Returns and the risk-free rate are
// fractions here: 0.012 means 1.2%.

/** Below this many returns the result carries a small-sample warning. A convention, not a law. */
export const MIN_SAMPLE = 30;

/** Most returns the calculator accepts. A bound on the input, not a market fact. */
export const MAX_RETURNS = 5000;

/** Two-sided 95% point of the normal distribution, as used in Lo (2002), equation 10. */
export const Z_95 = 1.96;

export interface SharpeInput {
  /** Per-period returns as fractions: 0.012 means 1.2%. At least 2, at most MAX_RETURNS. */
  returns: number[];
  /** Risk-free rate per period as a fraction, in the same period as the returns. -1 < rf < 1. */
  riskFreeRate: number;
  /** How many of these periods make a year: 365 or 252 for daily, 52 weekly, 12 monthly. > 0. */
  periodsPerYear: number;
}

/**
 * Which input is wrong.
 * 'tooFew'  fewer than two returns: a sample deviation needs two.
 * 'flat'    every return is the same, so the deviation is 0 and the ratio is undefined.
 */
export type SharpeIssue = 'returns' | 'tooFew' | 'tooMany' | 'riskFreeRate' | 'periodsPerYear' | 'flat';

export interface SharpeInterval {
  low: number;
  high: number;
}

export interface SharpeOk {
  ok: true;
  /** Number of returns, n. */
  count: number;
  /** Mean return per period, a fraction. */
  mean: number;
  /** mean - riskFreeRate. */
  excessMean: number;
  /** Sample standard deviation per period (n - 1), a fraction. */
  standardDeviation: number;
  /** excessMean / standardDeviation, per period. */
  sharpe: number;
  /** sqrt(periodsPerYear). */
  annualFactor: number;
  /** sharpe x annualFactor. */
  annualizedSharpe: number;
  /** sharpe x sqrt(count). */
  tStatistic: number;
  /** Lo (2002), eq. 9: sqrt((1 + sharpe^2 / 2) / count). Per period. */
  standardError: number;
  /** standardError x annualFactor. */
  annualizedStandardError: number;
  /** sharpe +/- 1.96 x standardError. */
  interval: SharpeInterval;
  /** annualizedSharpe +/- 1.96 x annualizedStandardError. */
  annualizedInterval: SharpeInterval;
  /** count < MIN_SAMPLE. */
  smallSample: boolean;
  /** true when the 95% interval does not contain 0. */
  distinctFromZero: boolean;
}

export interface SharpeError {
  ok: false;
  issues: SharpeIssue[];
}

export type SharpeResult = SharpeOk | SharpeError;

const isFiniteNumber = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);

/** Arithmetic mean. NaN for an empty list or a value that is not a finite number. */
export function mean(values: number[]): number {
  if (!Array.isArray(values) || values.length === 0 || !values.every(isFiniteNumber)) return Number.NaN;
  let sum = 0;
  for (const v of values) sum += v;
  return sum / values.length;
}

/**
 * Sample standard deviation: the squared distances from the mean are divided
 * by n - 1, not n.
 *   sampleStandardDeviation([2, 4, 4, 4, 5, 5, 7, 9]) -> 2.138...
 * NaN for fewer than two values.
 */
export function sampleStandardDeviation(values: number[]): number {
  if (!Array.isArray(values) || values.length < 2 || !values.every(isFiniteNumber)) return Number.NaN;
  const m = mean(values);
  let squares = 0;
  for (const v of values) squares += (v - m) ** 2;
  return Math.sqrt(squares / (values.length - 1));
}

/**
 * Standard error of a Sharpe ratio estimated from `count` IID returns:
 * sqrt((1 + SR^2 / 2) / count). Lo (2002), equation 9.
 *   sharpeStandardError(1.5, 60) -> 0.188   (his Table 1)
 */
export function sharpeStandardError(sharpe: number, count: number): number {
  if (!isFiniteNumber(sharpe) || !isFiniteNumber(count) || count <= 0) return Number.NaN;
  return Math.sqrt((1 + (sharpe * sharpe) / 2) / count);
}

export interface ParsedReturns {
  /** The readable entries as fractions, in the order given: "1.5" -> 0.015. */
  values: number[];
  /** Entries that are not numbers, as typed. */
  rejected: string[];
}

/**
 * Read a pasted list of percentages. Entries are separated by commas,
 * semicolons, spaces, tabs or line breaks; a trailing percent sign and a
 * leading plus are allowed, and the minus may be a hyphen or a real minus
 * sign. The decimal mark is a point.
 *   parseReturns('1.5, -2%\n0.4') -> { values: [0.015, -0.02, 0.004], rejected: [] }
 */
export function parseReturns(text: string): ParsedReturns {
  const values: number[] = [];
  const rejected: string[] = [];
  if (typeof text !== 'string') return { values, rejected };
  for (const token of text.split(/[\s,;，；、]+/)) {
    if (token === '') continue;
    const cleaned = token.replace(/[−–﹣－]/g, '-').replace(/[%％]$/, '');
    if (!/^[+-]?(\d+\.?\d*|\.\d+)$/.test(cleaned)) {
      rejected.push(token);
      continue;
    }
    values.push(Number(cleaned) / 100);
  }
  return { values, rejected };
}

export function validateSharpeInput(input: SharpeInput): SharpeIssue[] {
  const issues: SharpeIssue[] = [];
  const returns = input.returns;
  const listOk = Array.isArray(returns) && returns.every(isFiniteNumber);

  if (!listOk) issues.push('returns');
  else if (returns.length < 2) issues.push('tooFew');
  else if (returns.length > MAX_RETURNS) issues.push('tooMany');

  if (!(isFiniteNumber(input.riskFreeRate) && input.riskFreeRate > -1 && input.riskFreeRate < 1)) issues.push('riskFreeRate');
  if (!(isFiniteNumber(input.periodsPerYear) && input.periodsPerYear > 0)) issues.push('periodsPerYear');

  if (listOk && returns.length >= 2 && returns.length <= MAX_RETURNS && isFlat(returns)) issues.push('flat');

  return issues;
}

/**
 * Is the deviation zero? Equal values are flat. So is a list whose computed
 * deviation is only rounding noise (0.1 + 0.2 style), which would otherwise
 * turn into a Sharpe ratio in the trillions.
 */
function isFlat(values: number[]): boolean {
  let low = values[0];
  let high = values[0];
  let largest = 0;
  for (const v of values) {
    if (v < low) low = v;
    if (v > high) high = v;
    if (Math.abs(v) > largest) largest = Math.abs(v);
  }
  if (low === high) return true;
  return sampleStandardDeviation(values) <= largest * 1e-12;
}

export function sharpe(input: SharpeInput): SharpeResult {
  const issues = validateSharpeInput(input);
  if (issues.length > 0) return { ok: false, issues };

  const { returns, riskFreeRate, periodsPerYear } = input;
  const count = returns.length;
  const m = mean(returns);
  const deviation = sampleStandardDeviation(returns);
  const excessMean = m - riskFreeRate;
  const ratio = excessMean / deviation;
  const annualFactor = Math.sqrt(periodsPerYear);
  const standardError = sharpeStandardError(ratio, count);
  const half = Z_95 * standardError;
  const interval = { low: ratio - half, high: ratio + half };

  return {
    ok: true,
    count,
    mean: m,
    excessMean,
    standardDeviation: deviation,
    sharpe: ratio,
    annualFactor,
    annualizedSharpe: ratio * annualFactor,
    tStatistic: ratio * Math.sqrt(count),
    standardError,
    annualizedStandardError: standardError * annualFactor,
    interval,
    annualizedInterval: { low: interval.low * annualFactor, high: interval.high * annualFactor },
    smallSample: count < MIN_SAMPLE,
    distinctFromZero: interval.low > 0 || interval.high < 0,
  };
}
