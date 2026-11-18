import { describe, expect, it } from 'vitest';
import type { BacktestResult } from './types';
import { MIN_TRADES, T_THRESHOLD, lostInBothSamples, verdictOf } from './verdict';

// Hand-made metric blocks. Expected verdicts follow the rule written at the
// top of verdict.ts, worked by hand.
describe('verdictOf', () => {
  it('uses 100 trades and |t| = 2 as its two thresholds', () => {
    expect(MIN_TRADES).toBe(100);
    expect(T_THRESHOLD).toBe(2);
  });

  const cases: Array<[string, { trades: number; t_stat: number | null }, string]> = [
    ['clear loss', { trades: 801, t_stat: -4.928 }, 'loss-clear'],
    ['exactly -2 counts as a clear loss', { trades: 250, t_stat: -2 }, 'loss-clear'],
    ['just inside -2', { trades: 250, t_stat: -1.9999 }, 'no-difference'],
    ['negative but small', { trades: 263, t_stat: -0.6771 }, 'no-difference'],
    ['zero', { trades: 400, t_stat: 0 }, 'no-difference'],
    ['positive but small', { trades: 400, t_stat: 1.4 }, 'no-difference'],
    ['just inside 2', { trades: 400, t_stat: 1.9999 }, 'no-difference'],
    ['exactly 2 counts as a clear gain', { trades: 400, t_stat: 2 }, 'gain-clear'],
    ['clear gain', { trades: 400, t_stat: 3.1 }, 'gain-clear'],
    ['99 trades is too few, whatever t says', { trades: 99, t_stat: -6 }, 'insufficient'],
    ['99 trades with a large positive t is still too few', { trades: 99, t_stat: 6 }, 'insufficient'],
    ['100 trades is enough', { trades: 100, t_stat: -6 }, 'loss-clear'],
    ['no trades', { trades: 0, t_stat: null }, 'insufficient'],
    ['enough trades but t was not computed', { trades: 150, t_stat: null }, 'not-computable'],
    ['enough trades but t is not a number', { trades: 150, t_stat: Number.NaN }, 'not-computable'],
  ];

  it.each(cases)('%s', (_name, metrics, expected) => {
    expect(verdictOf(metrics)).toBe(expected);
  });
});

describe('lostInBothSamples', () => {
  const result = (inSample: number | null, outOfSample: number | null) =>
    ({
      in_sample: { metrics: { total_return_pct: inSample } },
      out_of_sample: { metrics: { total_return_pct: outOfSample } },
    }) as unknown as BacktestResult;

  it('is true only when both total returns are below zero', () => {
    expect(lostInBothSamples(result(-66.945, -42.8564))).toBe(true);
    expect(lostInBothSamples(result(-66.945, 3.2))).toBe(false);
    expect(lostInBothSamples(result(5, -1))).toBe(false);
    expect(lostInBothSamples(result(0, -1))).toBe(false);
  });

  it('does not call a result a loss when a return could not be computed', () => {
    expect(lostInBothSamples(result(null, -1))).toBe(false);
  });
});
