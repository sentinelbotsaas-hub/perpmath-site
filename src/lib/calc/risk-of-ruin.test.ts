import { describe, expect, it } from 'vitest';
import {
  MAX_PAYOFF,
  MAX_TRADES,
  SIM_PATHS,
  SIM_SEED,
  eventualRuin,
  lossesToThreshold,
  lundbergExponent,
  mulberry32,
  riskOfRuin,
  ruinWithin,
  simulateRuin,
  validateRuinInput,
} from './risk-of-ruin';
import type { RuinInput, RuinOk } from './risk-of-ruin';

// The model: a win multiplies the balance by (1 + b r), a loss by (1 - r).
// The short cases below are small enough to list every order of wins and
// losses by hand; the long ones are checked against the classical gambler's
// ruin formula in the one case where it applies, and against a simulation.
function ok(input: RuinInput): RuinOk {
  const result = riskOfRuin(input);
  if (!result.ok) throw new Error(`expected ok, got issues: ${result.issues.join(', ')}`);
  return result;
}

const base: RuinInput = { winRate: 0.4, payoff: 2, riskPerTrade: 0.02, threshold: 0.2, trades: 200 };

describe('lossesToThreshold', () => {
  it('is the smallest k with (1 - risk)^k <= 1 - threshold', () => {
    expect(lossesToThreshold(0.5, 0.5)).toBe(1);
    expect(lossesToThreshold(0.1, 0.05)).toBe(1);
    expect(lossesToThreshold(0.1, 0.1)).toBe(1); // 0.9 is exactly the threshold
    expect(lossesToThreshold(0.1, 0.19)).toBe(2); // 0.9 x 0.9 = 0.81, exactly the threshold
    expect(lossesToThreshold(0.1, 0.2)).toBe(3); // 0.81 is still above 0.8; 0.729 is not
    expect(lossesToThreshold(0.02, 0.2)).toBe(12); // 0.98^11 = 0.8007, 0.98^12 = 0.7847
    expect(lossesToThreshold(0.02, 0.3)).toBe(18); // 0.98^17 = 0.7093, 0.98^18 = 0.6951
    expect(lossesToThreshold(0.01, 0.5)).toBe(69); // 0.99^68 = 0.5049, 0.99^69 = 0.4998
  });

  it('is NaN for unusable input', () => {
    expect(lossesToThreshold(0, 0.2)).toBeNaN();
    expect(lossesToThreshold(1, 0.2)).toBeNaN();
    expect(lossesToThreshold(0.02, 0)).toBeNaN();
    expect(lossesToThreshold(0.02, 1)).toBeNaN();
    expect(lossesToThreshold(Number.NaN, 0.2)).toBeNaN();
  });
});

describe('ruinWithin, cases small enough to list by hand', () => {
  it('one trade: a loss reaches the threshold or it does not', () => {
    // A loss leaves 0.9. Threshold 5% (0.95): reached. Probability = 1 - p.
    expect(ruinWithin({ winRate: 0.6, payoff: 1, riskPerTrade: 0.1, threshold: 0.05, trades: 1 })).toBeCloseTo(0.4, 12);
    // Threshold 20% (0.8): one loss is not enough.
    expect(ruinWithin({ winRate: 0.6, payoff: 1, riskPerTrade: 0.1, threshold: 0.2, trades: 1 })).toBe(0);
  });

  it('a balance exactly on the threshold counts as reaching it', () => {
    // 0.9 x 0.9 = 0.81 = 1 - 0.19. Two trades: only loss, loss. 0.4 x 0.4.
    expect(ruinWithin({ winRate: 0.6, payoff: 1, riskPerTrade: 0.1, threshold: 0.19, trades: 2 })).toBeCloseTo(0.16, 12);
  });

  it('three trades, a win that does not save the account', () => {
    // b = 0.1, r = 0.1: a win is x1.01, a loss x0.9. Threshold 18% (0.82).
    // loss, loss                 0.81   reached at trade 2   0.4 x 0.4         = 0.16
    // win, loss, loss            0.8181 reached at trade 3   0.6 x 0.4 x 0.4   = 0.096
    // loss, win, loss            0.8181 reached at trade 3   0.4 x 0.6 x 0.4   = 0.096
    // every other order stays above 0.82
    expect(ruinWithin({ winRate: 0.6, payoff: 0.1, riskPerTrade: 0.1, threshold: 0.18, trades: 3 })).toBeCloseTo(0.352, 12);
  });

  it('three trades, a win that does save it', () => {
    // b = 1, r = 0.1: a win is x1.1. Threshold 19% (0.81).
    // loss, loss reaches 0.81. win, loss, loss and loss, win, loss end at 0.891: not reached.
    expect(ruinWithin({ winRate: 0.6, payoff: 1, riskPerTrade: 0.1, threshold: 0.19, trades: 3 })).toBeCloseTo(0.16, 12);
  });

  it('a path that touched the threshold stays counted even if it would recover', () => {
    // r = 0.5, b = 4: a loss halves, a win triples. Threshold 50%.
    // Trade 1 loses (0.5): reached, whatever comes next. Trade 1 wins (3), then loss (1.5), loss (0.75): not reached in 3.
    // win, loss, loss, loss = 0.375 would be reached at trade 4.
    const input = { winRate: 0.5, payoff: 4, riskPerTrade: 0.5, threshold: 0.5 };
    expect(ruinWithin({ ...input, trades: 1 })).toBeCloseTo(0.5, 12);
    expect(ruinWithin({ ...input, trades: 3 })).toBeCloseTo(0.5, 12);
    expect(ruinWithin({ ...input, trades: 4 })).toBeCloseTo(0.5 + 0.5 ** 4, 12);
  });

  it('is at least the chance of losing every trade from the start', () => {
    // 12 losses in a row reach a 20% drawdown at 2% a trade: 0.6^12.
    const twelve = ruinWithin({ ...base, trades: 12 });
    expect(twelve).toBeCloseTo(0.6 ** 12, 12);
    expect(ruinWithin({ ...base, trades: 11 })).toBe(0);
  });
});

describe('ruinWithin, behaviour', () => {
  it('never falls as trades are added', () => {
    let previous = 0;
    for (const trades of [1, 10, 12, 20, 50, 100, 200, 500, MAX_TRADES]) {
      const now = ruinWithin({ ...base, trades });
      expect(now).toBeGreaterThanOrEqual(previous);
      previous = now;
    }
  });

  it('rises with the risk per trade and falls with a deeper threshold', () => {
    expect(ruinWithin({ ...base, riskPerTrade: 0.04 })).toBeGreaterThan(ruinWithin(base));
    expect(ruinWithin({ ...base, riskPerTrade: 0.01 })).toBeLessThan(ruinWithin(base));
    expect(ruinWithin({ ...base, threshold: 0.4 })).toBeLessThan(ruinWithin(base));
  });

  it('falls with a better win rate and a better payoff', () => {
    expect(ruinWithin({ ...base, winRate: 0.5 })).toBeLessThan(ruinWithin(base));
    expect(ruinWithin({ ...base, payoff: 3 })).toBeLessThan(ruinWithin(base));
  });

  it('is a probability over the whole accepted range', () => {
    for (const winRate of [0.001, 0.3, 0.5, 0.999]) {
      for (const payoff of [0.01, 1, MAX_PAYOFF]) {
        for (const riskPerTrade of [0.0001, 0.02, 0.5, 0.9999]) {
          for (const threshold of [0.0001, 0.2, 0.9999]) {
            const value = ruinWithin({ winRate, payoff, riskPerTrade, threshold, trades: 300 });
            expect(Number.isFinite(value)).toBe(true);
            expect(value).toBeGreaterThanOrEqual(0);
            expect(value).toBeLessThanOrEqual(1);
          }
        }
      }
    }
  });

  it('is NaN for invalid input', () => {
    expect(ruinWithin({ ...base, winRate: 0 })).toBeNaN();
    expect(ruinWithin({ ...base, trades: 0 })).toBeNaN();
    expect(ruinWithin({ ...base, trades: MAX_TRADES + 1 })).toBeNaN();
  });
});

describe('the one case with a textbook formula', () => {
  // When a win exactly undoes a loss, (1 + b r)(1 - r) = 1, the balance moves
  // on a ladder of equal steps and this is the classical gambler's ruin
  // against an opponent with unlimited capital: starting k steps above the
  // threshold, P(ever reaching it) = (q / p)^k for p > q.
  // r = 0.2 and b = 1.25: a loss is x0.8, a win x1.25. Threshold 1 - 0.8^3 = 0.488 is 3 steps down.
  const ladder = { winRate: 0.6, payoff: 1.25, riskPerTrade: 0.2, threshold: 1 - 0.8 ** 3 };
  const classical = (0.4 / 0.6) ** 3; // 0.296296...

  it('the exponent is ln(p / q) / ln(1 + b r)', () => {
    expect(lundbergExponent(0.6, 1.25, 0.2)).toBeCloseTo(Math.log(1.5) / Math.log(1.25), 9);
  });

  it('the upper bound is the classical formula', () => {
    const e = eventualRuin(ladder);
    expect(e && !e.certain && e.upper).toBeCloseTo(classical, 9);
  });

  it('the exact count over many trades converges to it', () => {
    expect(ruinWithin({ ...ladder, trades: MAX_TRADES })).toBeCloseTo(classical, 9);
    expect(ruinWithin({ ...ladder, trades: 3 })).toBeCloseTo(0.4 ** 3, 12);
    // Within 5 trades. Reached at trade 3: loss, loss, loss. Reached at trade 5: four losses and one win, with
    // the win among the first three trades (WLLLL, LWLLL, LLWLL). Trade 4 cannot be the first touch.
    expect(ruinWithin({ ...ladder, trades: 5 })).toBeCloseTo(0.4 ** 3 + 3 * 0.6 * 0.4 ** 4, 12);
  });
});

describe('lundbergExponent and eventualRuin', () => {
  it('the exponent solves p (1 + b r)^-t + q (1 - r)^-t = 1', () => {
    for (const [p, b, r] of [
      [0.4, 2, 0.02],
      [0.4, 2, 0.05],
      [0.55, 1, 0.01],
      [0.3, 5, 0.1],
      [0.9, 0.5, 0.25],
    ]) {
      const t = lundbergExponent(p, b, r);
      expect(t).toBeGreaterThan(0);
      expect(p * (1 + b * r) ** -t + (1 - p) * (1 - r) ** -t).toBeCloseTo(1, 10);
    }
  });

  it('is 0 when the expected log growth is zero or negative', () => {
    expect(lundbergExponent(0.5, 1, 0.02)).toBe(0); // 0.5 ln 1.02 + 0.5 ln 0.98 < 0
    expect(lundbergExponent(0.3, 2, 0.02)).toBe(0); // no edge at all
    // An edge, but risked far past Kelly: 0.4 ln 1.6 + 0.6 ln 0.7 = 0.1880 - 0.2140 < 0
    expect(lundbergExponent(0.4, 2, 0.3)).toBe(0);
  });

  it('then the threshold is certain to be reached sooner or later', () => {
    expect(eventualRuin({ winRate: 0.5, payoff: 1, riskPerTrade: 0.02, threshold: 0.3 })).toEqual({ certain: true });
    expect(ok({ winRate: 0.4, payoff: 2, riskPerTrade: 0.3, threshold: 0.5, trades: 100 }).eventual).toEqual({ certain: true });
  });

  it('the bounds are (1 - d)^t and ((1 - d)(1 - r))^t', () => {
    const e = eventualRuin(base);
    if (!e || e.certain) throw new Error('expected bounds');
    expect(e.upper).toBeCloseTo(0.8 ** e.exponent, 12);
    expect(e.lower).toBeCloseTo((0.8 * 0.98) ** e.exponent, 12);
    expect(e.lower).toBeLessThan(e.upper);
  });

  it('the exact count over the longest horizon sits between the bounds, and never above the upper one', () => {
    for (const input of [
      base,
      { winRate: 0.4, payoff: 2, riskPerTrade: 0.05, threshold: 0.5, trades: 1 },
      { winRate: 0.55, payoff: 1, riskPerTrade: 0.03, threshold: 0.25, trades: 1 },
      { winRate: 0.3, payoff: 4, riskPerTrade: 0.04, threshold: 0.3, trades: 1 },
    ]) {
      const e = eventualRuin(input);
      if (!e || e.certain) throw new Error('expected bounds');
      for (const trades of [50, 200, MAX_TRADES]) {
        expect(ruinWithin({ ...input, trades })).toBeLessThanOrEqual(e.upper + 1e-12);
      }
      // After 1,000 trades almost every path that will ever touch the threshold has done so.
      expect(ruinWithin({ ...input, trades: MAX_TRADES })).toBeGreaterThan(e.lower);
    }
  });

  it('is NaN or null for unusable input', () => {
    expect(lundbergExponent(0, 2, 0.02)).toBeNaN();
    expect(lundbergExponent(0.4, 0, 0.02)).toBeNaN();
    expect(lundbergExponent(0.4, 2, 1)).toBeNaN();
    expect(eventualRuin({ winRate: 0.4, payoff: 2, riskPerTrade: 0.02, threshold: 1 })).toBeNull();
    expect(eventualRuin({ winRate: Number.NaN, payoff: 2, riskPerTrade: 0.02, threshold: 0.2 })).toBeNull();
  });
});

describe('riskOfRuin', () => {
  it('the starting example: 40% wins at 2 to 1, 2% a trade, 20% drawdown, 200 trades', () => {
    const r = ok(base);
    expect(r.probability).toBe(ruinWithin(base));
    // Not a hand sum (it adds up 200 rows of the tree): pinned here, and checked against the simulation below.
    expect(r.probability).toBeCloseTo(0.124651, 6);
    expect(r.edge).toBeCloseTo(0.2, 12); // 0.4 x 2 - 0.6
    // 0.4 x ln 1.04 + 0.6 x ln 0.98 = 0.0156883 - 0.0121216
    expect(r.logGrowth).toBeCloseTo(0.0035666, 6);
    expect(r.lossesToThreshold).toBe(12);
    expect(r.eventual.certain).toBe(false);
  });

  it('a strategy without an edge: likely within the horizon, certain in the end', () => {
    const r = ok({ winRate: 0.5, payoff: 1, riskPerTrade: 0.02, threshold: 0.3, trades: MAX_TRADES });
    expect(r.edge).toBeCloseTo(0, 12);
    expect(r.logGrowth).toBeLessThan(0);
    expect(r.probability).toBeGreaterThan(0.5);
    expect(r.probability).toBeLessThan(1);
    expect(r.eventual).toEqual({ certain: true });
  });

  it('reports each unusable field', () => {
    expect(validateRuinInput(base)).toEqual([]);
    expect(validateRuinInput({ ...base, winRate: 0 })).toEqual(['winRate']);
    expect(validateRuinInput({ ...base, winRate: 1 })).toEqual(['winRate']);
    expect(validateRuinInput({ ...base, payoff: 0 })).toEqual(['payoff']);
    expect(validateRuinInput({ ...base, payoff: MAX_PAYOFF + 1 })).toEqual(['payoff']);
    expect(validateRuinInput({ ...base, riskPerTrade: 0 })).toEqual(['risk']);
    expect(validateRuinInput({ ...base, riskPerTrade: 1 })).toEqual(['risk']);
    expect(validateRuinInput({ ...base, threshold: 0 })).toEqual(['threshold']);
    // Risking a share of what is left never empties the account: 100% is not a threshold it can reach.
    expect(validateRuinInput({ ...base, threshold: 1 })).toEqual(['threshold']);
    expect(validateRuinInput({ ...base, trades: 0 })).toEqual(['trades']);
    expect(validateRuinInput({ ...base, trades: 2.5 })).toEqual(['trades']);
    expect(validateRuinInput({ ...base, trades: MAX_TRADES + 1 })).toEqual(['trades']);
    expect(
      validateRuinInput({ winRate: Number.NaN, payoff: Number.NaN, riskPerTrade: Number.NaN, threshold: Number.NaN, trades: Number.NaN }),
    ).toEqual(['winRate', 'payoff', 'risk', 'threshold', 'trades']);
    const r = riskOfRuin({ ...base, threshold: 1.2, trades: -3 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.issues).toEqual(['threshold', 'trades']);
  });
});

describe('mulberry32', () => {
  it('gives the same sequence for the same seed, in [0, 1)', () => {
    const a = mulberry32(SIM_SEED);
    const b = mulberry32(SIM_SEED);
    for (let i = 0; i < 1000; i++) {
      const x = a();
      expect(x).toBe(b());
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    }
  });

  it('gives another sequence for another seed', () => {
    expect(mulberry32(1)()).not.toBe(mulberry32(2)());
  });

  it('is roughly uniform', () => {
    const random = mulberry32(7);
    let sum = 0;
    let low = 0;
    const n = 100000;
    for (let i = 0; i < n; i++) {
      const x = random();
      sum += x;
      if (x < 0.25) low += 1;
    }
    expect(sum / n).toBeCloseTo(0.5, 2);
    expect(low / n).toBeCloseTo(0.25, 2);
  });
});

describe('simulateRuin', () => {
  const options = { paths: SIM_PATHS, seed: SIM_SEED };

  it('is reproducible: the same inputs and seed give the same count', () => {
    const one = simulateRuin(base, options);
    const two = simulateRuin(base, options);
    expect(one).toEqual(two);
    expect(one?.paths).toBe(SIM_PATHS);
    expect(one?.seed).toBe(SIM_SEED);
    expect(one?.estimate).toBe((one?.ruined ?? 0) / SIM_PATHS);
  });

  it('agrees with the exact figure to within its sampling error', () => {
    for (const input of [
      base,
      { winRate: 0.4, payoff: 2, riskPerTrade: 0.05, threshold: 0.5, trades: 1000 },
      { winRate: 0.5, payoff: 1, riskPerTrade: 0.02, threshold: 0.3, trades: 1000 },
      { winRate: 0.35, payoff: 1.5, riskPerTrade: 0.03, threshold: 0.5, trades: 500 },
      { winRate: 0.6, payoff: 0.1, riskPerTrade: 0.1, threshold: 0.18, trades: 3 },
    ]) {
      const sim = simulateRuin(input, options);
      if (!sim) throw new Error('expected a simulation');
      const exact = ruinWithin(input);
      // Four standard errors: a miss by chance is about 1 in 16,000 per case, and the seed is fixed.
      expect(Math.abs(sim.estimate - exact)).toBeLessThanOrEqual(4 * Math.sqrt((exact * (1 - exact)) / SIM_PATHS));
    }
  });

  it('reports the standard error of a proportion', () => {
    const sim = simulateRuin(base, options);
    if (!sim) throw new Error('expected a simulation');
    expect(sim.standardError).toBeCloseTo(Math.sqrt((sim.estimate * (1 - sim.estimate)) / SIM_PATHS), 15);
  });

  it('another seed gives another, nearby, estimate', () => {
    const one = simulateRuin(base, options);
    const two = simulateRuin(base, { paths: SIM_PATHS, seed: SIM_SEED + 1 });
    if (!one || !two) throw new Error('expected a simulation');
    expect(two.ruined).not.toBe(one.ruined);
    expect(Math.abs(two.estimate - one.estimate)).toBeLessThan(0.03);
  });

  it('is null for invalid input or an unusable path count', () => {
    expect(simulateRuin({ ...base, winRate: 2 }, options)).toBeNull();
    expect(simulateRuin(base, { paths: 0, seed: 1 })).toBeNull();
    expect(simulateRuin(base, { paths: 2.5, seed: 1 })).toBeNull();
    expect(simulateRuin(base, { paths: 1_000_001, seed: 1 })).toBeNull();
    expect(simulateRuin(base, { paths: 100, seed: Number.NaN })).toBeNull();
  });
});

describe('eventualRuin, far out in the tail', () => {
  it('keeps both bounds above zero when the exponential underflows', () => {
    // A 99% win rate at 100 to 1 with a 99% threshold: theta is in the tens of thousands.
    const e = eventualRuin({ winRate: 0.99, payoff: 100, riskPerTrade: 0.0001, threshold: 0.99 });
    if (!e || e.certain) throw new Error('expected bounds');
    expect(e.upper).toBeGreaterThan(0);
    expect(e.lower).toBeGreaterThan(0);
    expect(e.upper).toBeLessThan(1e-300);
  });
});
