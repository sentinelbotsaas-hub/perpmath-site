// Risk of ruin for fixed-fraction betting: the chance that an account falls
// to a drawdown threshold, measured from the balance it started with.
//
// The model, and everything it assumes:
//   - every trade risks the same share `r` of the balance at that moment;
//   - a trade wins with probability `p` and then adds b x r of the balance,
//     or loses with probability 1 - p and takes r of it (b is the payoff ratio);
//   - trades are independent, and p and b never change.
// So after w wins and l losses, in any order, the balance is
//   start x (1 + b r)^w x (1 - r)^l
// A balance like that never reaches zero: each loss takes a share of what is
// left. "Ruin" therefore has to be a threshold: the balance is at or below
// start x (1 - threshold).
//
// Three numbers come out of it:
//   1. ruinWithin(): the probability of touching the threshold within N
//      trades. Exact for the model: the balance only depends on the counts of
//      wins and losses, so the tree of outcomes is walked once, trade by
//      trade, and the probability that arrives at the threshold is set aside
//      (first-passage probabilities of a binomial tree).
//   2. eventualRuin(): bounds for "ever, with no end to the trading". With
//      S = log(balance / start) and theta > 0 the root of
//        p (1 + b r)^-theta + (1 - p) (1 - r)^-theta = 1
//      exp(-theta S) is a martingale (Wald's identity), which gives Lundberg's
//      inequality:
//        ((1 - threshold)(1 - r))^theta < P(ever) <= (1 - threshold)^theta
//      The lower end is there because a loss can carry the balance past the
//      threshold, by at most one loss. When the expected log growth per trade
//      is zero or negative there is no such root and the threshold is reached
//      with probability 1.
//   3. simulateRuin(): a Monte Carlo estimate with a fixed seed, as a check
//      on 1. It is an estimate; its standard error is returned with it.
//
// Pure functions, no I/O, no defaults. Percentages are fractions: 0.02 is 2%.

/** Most trades the horizon accepts. A bound on the input (it caps the work), not a market fact. */
export const MAX_TRADES = 1000;

/** Largest payoff ratio accepted. A bound on the input, not a market fact. */
export const MAX_PAYOFF = 100;

/** Paths of the Monte Carlo check the page runs. */
export const SIM_PATHS = 10000;

/** Seed of the Monte Carlo check the page runs: the same inputs give the same estimate. */
export const SIM_SEED = 20261122;

// Two balances closer than this (in log terms) are the same balance. 0.9 x 0.9
// is 0.81 on paper and 0.81000000000000005 in binary; the threshold must not
// be missed for that.
const EPS = 1e-9;

export interface RuinInput {
  /** Probability that a trade wins, 0 < p < 1. */
  winRate: number;
  /** Average win divided by average loss, 0 < b <= MAX_PAYOFF. */
  payoff: number;
  /** Share of the current balance lost on a losing trade, 0 < r < 1. */
  riskPerTrade: number;
  /** Drawdown from the starting balance that counts as ruin, 0 < d < 1. */
  threshold: number;
  /** Number of trades looked at. Whole number, 1 to MAX_TRADES. */
  trades: number;
}

export type RuinIssue = 'winRate' | 'payoff' | 'risk' | 'threshold' | 'trades';

export type EventualRuin =
  | {
      /** Expected log growth per trade is zero or negative: the threshold is reached sooner or later. */
      certain: true;
    }
  | {
      certain: false;
      /** theta, the positive root described at the top of this file. */
      exponent: number;
      /** (1 - threshold)^theta: the probability is at most this. */
      upper: number;
      /** ((1 - threshold)(1 - r))^theta: and more than this. */
      lower: number;
    };

export interface RuinOk {
  ok: true;
  /** Probability of touching the threshold within `trades` trades. Exact for the model. */
  probability: number;
  /** The same with no end to the trading. */
  eventual: EventualRuin;
  /** Expected result of one trade in units of the amount risked: p b - (1 - p). */
  edge: number;
  /** Expected log growth of the balance per trade: p ln(1 + b r) + (1 - p) ln(1 - r). */
  logGrowth: number;
  /** Losses in a row, from the start, that reach the threshold: the smallest k with (1 - r)^k <= 1 - threshold. */
  lossesToThreshold: number;
}

export interface RuinError {
  ok: false;
  issues: RuinIssue[];
}

export type RuinResult = RuinOk | RuinError;

const isOpenFraction = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n > 0 && n < 1;

export function validateRuinInput(input: RuinInput): RuinIssue[] {
  const issues: RuinIssue[] = [];
  if (!isOpenFraction(input.winRate)) issues.push('winRate');
  if (!(typeof input.payoff === 'number' && Number.isFinite(input.payoff) && input.payoff > 0 && input.payoff <= MAX_PAYOFF)) {
    issues.push('payoff');
  }
  if (!isOpenFraction(input.riskPerTrade)) issues.push('risk');
  if (!isOpenFraction(input.threshold)) issues.push('threshold');
  if (!(typeof input.trades === 'number' && Number.isInteger(input.trades) && input.trades >= 1 && input.trades <= MAX_TRADES)) {
    issues.push('trades');
  }
  return issues;
}

/** The walk in log terms: a win adds `up`, a loss takes `down`, ruin is `distance` below the start. */
function steps(input: Pick<RuinInput, 'payoff' | 'riskPerTrade' | 'threshold'>) {
  return {
    up: Math.log1p(input.payoff * input.riskPerTrade),
    down: -Math.log1p(-input.riskPerTrade),
    distance: -Math.log1p(-input.threshold),
  };
}

/**
 * Losses in a row, counted from the start, that put the balance at or below
 * the threshold: the smallest k with (1 - risk)^k <= 1 - threshold.
 *   lossesToThreshold(0.1, 0.19) -> 2   (0.9 x 0.9 = 0.81)
 * NaN for input outside 0 < risk < 1, 0 < threshold < 1.
 */
export function lossesToThreshold(riskPerTrade: number, threshold: number): number {
  if (!isOpenFraction(riskPerTrade) || !isOpenFraction(threshold)) return Number.NaN;
  const { down, distance } = steps({ payoff: 1, riskPerTrade, threshold });
  return Math.max(1, Math.ceil(distance / down - EPS));
}

/**
 * Probability that the balance touches the threshold at some point within
 * `trades` trades. Exact for the model at the top of this file.
 *
 * After n trades with l losses the balance is fixed, so one row of
 * probabilities (one cell per count of losses) is carried from trade to
 * trade. A win keeps the count, a loss raises it by one. Only a loss can
 * reach the threshold, and for a given n the cells past it are the ones with
 * the most losses; their probability is moved to `ruined` and leaves the row.
 * Returns NaN for invalid input.
 */
export function ruinWithin(input: RuinInput): number {
  if (validateRuinInput(input).length > 0) return Number.NaN;
  const p = input.winRate;
  const q = 1 - p;
  const { up, down, distance } = steps(input);
  const span = up + down;

  const alive = new Float64Array(input.trades + 2);
  alive[0] = 1;
  let top = 0; // highest count of losses that is still alive
  let ruined = 0;

  for (let n = 1; n <= input.trades; n++) {
    // In place, from the most losses down, so alive[l - 1] is still the old row.
    for (let l = top + 1; l >= 1; l--) alive[l] = alive[l] * p + alive[l - 1] * q;
    alive[0] *= p;
    top += 1;
    // (n - l) up - l down <= -distance  <=>  l (up + down) >= n up + distance
    while (top >= 0 && top * span >= n * up + distance - EPS) {
      ruined += alive[top];
      alive[top] = 0;
      top -= 1;
    }
  }
  return Math.min(1, ruined);
}

/**
 * theta > 0 with p (1 + b r)^-theta + (1 - p) (1 - r)^-theta = 1, found by
 * bisection. 0 when the expected log growth per trade is not positive (then
 * no positive root exists). NaN for invalid input.
 */
export function lundbergExponent(winRate: number, payoff: number, riskPerTrade: number): number {
  const valid =
    isOpenFraction(winRate) &&
    typeof payoff === 'number' &&
    Number.isFinite(payoff) &&
    payoff > 0 &&
    payoff <= MAX_PAYOFF &&
    isOpenFraction(riskPerTrade);
  if (!valid) return Number.NaN;
  const p = winRate;
  const q = 1 - p;
  const { up, down } = steps({ payoff, riskPerTrade, threshold: 0.5 });
  if (p * up - q * down <= 0) return 0;

  // f is convex, f(0) = 0 and f'(0) < 0: between 0 and the root it is
  // negative, past the root positive. expm1 keeps it accurate near 0.
  const f = (theta: number) => p * Math.expm1(-theta * up) + q * Math.expm1(theta * down);
  let low = 0;
  let high = 1;
  while (f(high) <= 0) high *= 2;
  for (let i = 0; i < 200; i++) {
    const mid = (low + high) / 2;
    if (mid === low || mid === high) break;
    if (f(mid) <= 0) low = mid;
    else high = mid;
  }
  return (low + high) / 2;
}

/** Bounds for touching the threshold with no end to the trading. See the top of this file. */
export function eventualRuin(input: Pick<RuinInput, 'winRate' | 'payoff' | 'riskPerTrade' | 'threshold'>): EventualRuin | null {
  const theta = lundbergExponent(input.winRate, input.payoff, input.riskPerTrade);
  if (!Number.isFinite(theta) || !isOpenFraction(input.threshold)) return null;
  if (theta === 0) return { certain: true };
  const { down, distance } = steps(input);
  // Both bounds are above zero on paper. With a large theta the exponential
  // underflows to 0; the smallest positive number keeps "tiny" from being
  // reported as "impossible".
  const positive = (value: number) => Math.max(Number.MIN_VALUE, value);
  return {
    certain: false,
    exponent: theta,
    upper: positive(Math.exp(-theta * distance)),
    lower: positive(Math.exp(-theta * (distance + down))),
  };
}

export function riskOfRuin(input: RuinInput): RuinResult {
  const issues = validateRuinInput(input);
  if (issues.length > 0) return { ok: false, issues };
  const p = input.winRate;
  const q = 1 - p;
  const { up, down } = steps(input);
  return {
    ok: true,
    probability: ruinWithin(input),
    eventual: eventualRuin(input) as EventualRuin,
    edge: p * input.payoff - q,
    logGrowth: p * up - q * down,
    lossesToThreshold: lossesToThreshold(input.riskPerTrade, input.threshold),
  };
}

/**
 * mulberry32: a small seeded generator of numbers in [0, 1). The same seed
 * gives the same sequence in every browser, which is what makes the Monte
 * Carlo check reproducible.
 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface RuinSimulation {
  paths: number;
  seed: number;
  /** Paths that touched the threshold within the horizon. */
  ruined: number;
  /** ruined / paths. */
  estimate: number;
  /** sqrt(estimate (1 - estimate) / paths): about two of these either side covers the true value 95% of the time. */
  standardError: number;
}

/**
 * Monte Carlo estimate of ruinWithin(): `paths` runs of `trades` random
 * trades each, drawn from mulberry32(seed). A run stops at the first touch of
 * the threshold. Returns null for invalid input or a path count that is not a
 * whole number from 1 to 1,000,000.
 */
export function simulateRuin(input: RuinInput, options: { paths: number; seed: number }): RuinSimulation | null {
  if (validateRuinInput(input).length > 0) return null;
  const { paths, seed } = options;
  if (!(Number.isInteger(paths) && paths >= 1 && paths <= 1_000_000) || !Number.isFinite(seed)) return null;

  const p = input.winRate;
  const { up, down, distance } = steps(input);
  const span = up + down;
  const random = mulberry32(seed);
  let ruined = 0;

  for (let path = 0; path < paths; path++) {
    let losses = 0;
    for (let n = 1; n <= input.trades; n++) {
      if (random() < p) continue; // a win cannot reach the threshold
      losses += 1;
      if (losses * span >= n * up + distance - EPS) {
        ruined += 1;
        break;
      }
    }
  }
  const estimate = ruined / paths;
  return { paths, seed, ruined, estimate, standardError: Math.sqrt((estimate * (1 - estimate)) / paths) };
}
