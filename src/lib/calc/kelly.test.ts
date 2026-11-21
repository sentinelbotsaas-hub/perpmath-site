import { describe, expect, it } from 'vitest';
import { MAX_PAYOFF, growthAt, kelly, kellyFraction, validateKellyInput } from './kelly';
import type { KellyInput, KellyOk } from './kelly';

// Expected values are worked by hand from
//   f* = p - (1 - p) / b
//   g(f) = p ln(1 + b f) + (1 - p) ln(1 - f)
function ok(input: KellyInput): KellyOk {
  const result = kelly(input);
  if (!result.ok) throw new Error(`expected ok, got issues: ${result.issues.join(', ')}`);
  return result;
}

describe('kellyFraction', () => {
  const cases: Array<[number, number, number]> = [
    [0.4, 2, 0.1], // 0.4 - 0.6 / 2
    [0.55, 1, 0.1], // 0.55 - 0.45
    [0.6, 1, 0.2],
    [0.5, 2, 0.25], // 0.5 - 0.5 / 2
    [0.55, 1.5, 0.25], // 0.55 - 0.45 / 1.5
    [0.35, 2, 0.025], // 0.35 - 0.65 / 2
    [0.9, 0.5, 0.7], // 0.9 - 0.1 / 0.5
    [0.25, 3, 0], // break-even: 0.25 - 0.75 / 3
    [0.5, 1, 0], // a coin toss at even money
    [0.3, 2, -0.05], // no edge: 0.3 - 0.7 / 2
    [0.4, 1, -0.2],
  ];

  it.each(cases)('p = %s, b = %s gives %s', (p, b, expected) => {
    expect(kellyFraction(p, b)).toBeCloseTo(expected, 12);
  });

  it('is below the win rate, so it never reaches 100%', () => {
    expect(kellyFraction(0.99, MAX_PAYOFF)).toBeLessThan(0.99);
  });

  it('is NaN for unusable input', () => {
    expect(kellyFraction(0, 2)).toBeNaN();
    expect(kellyFraction(1, 2)).toBeNaN();
    expect(kellyFraction(-0.1, 2)).toBeNaN();
    expect(kellyFraction(1.2, 2)).toBeNaN();
    expect(kellyFraction(0.4, 0)).toBeNaN();
    expect(kellyFraction(0.4, -1)).toBeNaN();
    expect(kellyFraction(0.4, MAX_PAYOFF + 1)).toBeNaN();
    expect(kellyFraction(Number.NaN, 2)).toBeNaN();
    expect(kellyFraction(0.4, Number.POSITIVE_INFINITY)).toBeNaN();
  });
});

describe('growthAt', () => {
  it('is p ln(1 + b f) + (1 - p) ln(1 - f)', () => {
    // 0.4 x ln 1.2 + 0.6 x ln 0.9 = 0.0729286227 - 0.0632163094
    expect(growthAt(0.4, 2, 0.1)).toBeCloseTo(0.0097123133, 9);
    // 0.4 x ln 1.1 + 0.6 x ln 0.95 = 0.0381240719 - 0.0307759766
    expect(growthAt(0.4, 2, 0.05)).toBeCloseTo(0.0073480953, 9);
    // 0.4 x ln 1.05 + 0.6 x ln 0.975 = 0.0195160657 - 0.0151906848
    expect(growthAt(0.4, 2, 0.025)).toBeCloseTo(0.0043253809, 9);
  });

  it('is 0 when nothing is risked', () => {
    expect(growthAt(0.4, 2, 0)).toBe(0);
  });

  it('peaks at the Kelly fraction', () => {
    const best = growthAt(0.4, 2, 0.1);
    expect(growthAt(0.4, 2, 0.09)).toBeLessThan(best);
    expect(growthAt(0.4, 2, 0.11)).toBeLessThan(best);
    const other = growthAt(0.55, 1.5, 0.25);
    expect(growthAt(0.55, 1.5, 0.24)).toBeLessThan(other);
    expect(growthAt(0.55, 1.5, 0.26)).toBeLessThan(other);
  });

  it('turns negative when far more than Kelly is risked', () => {
    // Twice Kelly: 0.4 x ln 1.4 + 0.6 x ln 0.8 = 0.1345889 - 0.1338861, almost nothing left.
    expect(growthAt(0.4, 2, 0.2)).toBeCloseTo(0.0007028, 6);
    // Two and a half times Kelly: 0.4 x ln 1.5 + 0.6 x ln 0.75 = 0.1621860 - 0.1726092
    expect(growthAt(0.4, 2, 0.25)).toBeCloseTo(-0.0104232, 6);
  });

  it('shows what an overestimated win rate costs', () => {
    // Sized for a 40% win rate (10%) while the true rate is 35%:
    // 0.35 x ln 1.2 + 0.65 x ln 0.9 = 0.0638125 - 0.0684843
    expect(growthAt(0.35, 2, 0.1)).toBeCloseTo(-0.0046718, 6);
    // The Kelly fraction of the true rate still grows.
    expect(growthAt(0.35, 2, 0.025)).toBeGreaterThan(0);
  });

  it('is NaN for unusable input', () => {
    expect(growthAt(0.4, 2, 1)).toBeNaN(); // risking everything: ln 0
    expect(growthAt(0.4, 2, -0.1)).toBeNaN();
    expect(growthAt(0.4, 2, Number.NaN)).toBeNaN();
    expect(growthAt(0, 2, 0.1)).toBeNaN();
    expect(growthAt(0.4, 0, 0.1)).toBeNaN();
  });
});

describe('kelly', () => {
  it('40% wins at 2 to 1: full 10%, half 5%, quarter 2.5%', () => {
    const r = ok({ winRate: 0.4, payoff: 2 });
    expect(r.bet).toBe(true);
    expect(r.raw).toBeCloseTo(0.1, 12);
    expect(r.full).toBeCloseTo(0.1, 12);
    expect(r.half).toBeCloseTo(0.05, 12);
    expect(r.quarter).toBeCloseTo(0.025, 12);
    expect(r.edge).toBeCloseTo(0.2, 12); // 0.4 x 2 - 0.6
    expect(r.growthFull).toBeCloseTo(0.0097123133, 9);
    expect(r.growthHalf).toBeCloseTo(0.0073480953, 9);
    expect(r.growthQuarter).toBeCloseTo(0.0043253809, 9);
  });

  it('half Kelly keeps about three quarters of the growth', () => {
    const r = ok({ winRate: 0.4, payoff: 2 });
    // 0.0073480953 / 0.0097123133
    expect(r.growthHalf / r.growthFull).toBeCloseTo(0.7566, 4);
    expect(r.growthQuarter).toBeLessThan(r.growthHalf);
  });

  it('full Kelly is edge / payoff', () => {
    for (const input of [
      { winRate: 0.4, payoff: 2 },
      { winRate: 0.55, payoff: 1.5 },
      { winRate: 0.62, payoff: 0.8 },
      { winRate: 0.2, payoff: 7.5 },
    ]) {
      const r = ok(input);
      expect(r.full).toBeCloseTo(r.edge / input.payoff, 12);
    }
  });

  it('no edge: says not to bet instead of returning a negative share', () => {
    const r = ok({ winRate: 0.3, payoff: 2 });
    expect(r.bet).toBe(false);
    expect(r.raw).toBeCloseTo(-0.05, 12);
    expect(r.edge).toBeCloseTo(-0.1, 12);
    expect(r.full).toBe(0);
    expect(r.half).toBe(0);
    expect(r.quarter).toBe(0);
    expect(r.growthFull).toBe(0);
    expect(r.growthHalf).toBe(0);
    expect(r.growthQuarter).toBe(0);
  });

  it('exactly break-even is also "do not bet"', () => {
    for (const input of [
      { winRate: 0.5, payoff: 1 },
      { winRate: 0.25, payoff: 3 },
      { winRate: 0.2, payoff: 4 },
      { winRate: 0.1, payoff: 9 },
    ]) {
      const r = ok(input);
      expect(r.bet).toBe(false);
      expect(r.full).toBe(0);
    }
  });

  it('never returns a share of 100% or more', () => {
    const r = ok({ winRate: 0.99, payoff: MAX_PAYOFF });
    expect(r.full).toBeLessThan(1);
    expect(Number.isFinite(r.growthFull)).toBe(true);
  });

  it('every figure is finite across the accepted range', () => {
    for (const winRate of [0.001, 0.01, 0.25, 0.5, 0.75, 0.99, 0.999]) {
      for (const payoff of [0.01, 0.5, 1, 2, 10, MAX_PAYOFF]) {
        const r = ok({ winRate, payoff });
        for (const value of [r.edge, r.raw, r.full, r.half, r.quarter, r.growthFull, r.growthHalf, r.growthQuarter]) {
          expect(Number.isFinite(value)).toBe(true);
        }
        expect(r.full).toBeGreaterThanOrEqual(0);
        expect(r.growthFull).toBeGreaterThanOrEqual(0);
      }
    }
  });
});

describe('validateKellyInput', () => {
  it('accepts a normal input', () => {
    expect(validateKellyInput({ winRate: 0.4, payoff: 2 })).toEqual([]);
  });

  it('names each unusable field', () => {
    expect(validateKellyInput({ winRate: 0, payoff: 2 })).toEqual(['winRate']);
    expect(validateKellyInput({ winRate: 1, payoff: 2 })).toEqual(['winRate']);
    expect(validateKellyInput({ winRate: Number.NaN, payoff: 2 })).toEqual(['winRate']);
    expect(validateKellyInput({ winRate: 0.4, payoff: 0 })).toEqual(['payoff']);
    expect(validateKellyInput({ winRate: 0.4, payoff: -2 })).toEqual(['payoff']);
    expect(validateKellyInput({ winRate: 0.4, payoff: MAX_PAYOFF + 0.01 })).toEqual(['payoff']);
    expect(validateKellyInput({ winRate: 0.4, payoff: Number.POSITIVE_INFINITY })).toEqual(['payoff']);
    expect(validateKellyInput({ winRate: 40, payoff: Number.NaN })).toEqual(['winRate', 'payoff']);
  });

  it('kelly() reports the same issues', () => {
    const r = kelly({ winRate: 1.5, payoff: 0 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.issues).toEqual(['winRate', 'payoff']);
  });
});
