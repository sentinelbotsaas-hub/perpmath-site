import { describe, expect, it } from 'vitest';
import { MAX_STREAK, MIN_REMAINING, capitalAfterStreak, drawdown, recoveryGain, validateDrawdownInput } from './drawdown';
import type { DrawdownInput, DrawdownOk } from './drawdown';

// Expected values are worked by hand from
//   gain needed = drawdown / (1 - drawdown)
//   capital left after n losses = (1 - risk)^n
function ok(input: DrawdownInput): DrawdownOk {
  const result = drawdown(input);
  if (!result.ok) throw new Error(`expected ok, got issues: ${result.issues.join(', ')}`);
  return result;
}

describe('recoveryGain', () => {
  const cases: Array<[number, number]> = [
    [0.05, 0.05 / 0.95], // 5.26%
    [0.1, 1 / 9], // 11.11%
    [0.2, 0.25],
    [0.25, 1 / 3],
    [0.5, 1],
    [0.75, 3],
    [0.9, 9],
    [0.99, 99],
  ];

  it.each(cases)('lose %s, need %s', (lost, needed) => {
    expect(recoveryGain(lost)).toBeCloseTo(needed, 10);
  });

  it('is 0 for no drawdown', () => {
    expect(recoveryGain(0)).toBe(0);
  });

  it('is NaN at or beyond a total loss, and for unusable input', () => {
    expect(recoveryGain(1)).toBeNaN();
    expect(recoveryGain(1.2)).toBeNaN();
    expect(recoveryGain(-0.1)).toBeNaN();
    expect(recoveryGain(Number.NaN)).toBeNaN();
  });
});

describe('capitalAfterStreak', () => {
  it('is (1 - risk)^n', () => {
    expect(capitalAfterStreak(0.02, 10)).toBeCloseTo(0.8170728069, 9); // 0.98^10
    expect(capitalAfterStreak(0.1, 5)).toBeCloseTo(0.59049, 12); // 0.9^5
    expect(capitalAfterStreak(0.01, 20)).toBeCloseTo(0.8179069376, 9); // 0.99^20
    expect(capitalAfterStreak(0.5, 1)).toBe(0.5);
    expect(capitalAfterStreak(0.5, 3)).toBe(0.125);
  });

  it('handles the ends of the range', () => {
    expect(capitalAfterStreak(0.02, 0)).toBe(1);
    expect(capitalAfterStreak(0, 10)).toBe(1);
    expect(capitalAfterStreak(1, 1)).toBe(0);
  });

  it('is NaN for unusable input', () => {
    expect(capitalAfterStreak(-0.1, 3)).toBeNaN();
    expect(capitalAfterStreak(1.1, 3)).toBeNaN();
    expect(capitalAfterStreak(0.02, -1)).toBeNaN();
    expect(capitalAfterStreak(0.02, 2.5)).toBeNaN();
    expect(capitalAfterStreak(Number.NaN, 3)).toBeNaN();
  });
});

describe('drawdown, from a drawdown percentage', () => {
  it('50% lost needs 100%, and the two bars are 50 and 100 on a scale of 100', () => {
    const r = ok({ mode: 'drawdown', drawdown: 0.5 });
    expect(r.drawdown).toBe(0.5);
    expect(r.remaining).toBe(0.5);
    expect(r.recoveryGain).toBe(1);
    expect(r.scaleMax).toBe(1);
    expect(r.lostShare).toBe(0.5);
    expect(r.neededShare).toBe(1);
  });

  it('below 50% the scale stays at 100% and both bars are shorter than the full width', () => {
    const r = ok({ mode: 'drawdown', drawdown: 0.2 });
    expect(r.remaining).toBeCloseTo(0.8, 12);
    expect(r.recoveryGain).toBeCloseTo(0.25, 12);
    expect(r.scaleMax).toBe(1);
    expect(r.lostShare).toBeCloseTo(0.2, 12);
    expect(r.neededShare).toBeCloseTo(0.25, 12);
  });

  it('above 50% the scale grows to the gain needed, so both bars keep their true ratio', () => {
    // 75% lost needs 300%. Full width = 300%: lost bar 75/300 = 0.25, needed bar 1.
    const r = ok({ mode: 'drawdown', drawdown: 0.75 });
    expect(r.recoveryGain).toBeCloseTo(3, 12);
    expect(r.scaleMax).toBeCloseTo(3, 12);
    expect(r.lostShare).toBeCloseTo(0.25, 12);
    expect(r.neededShare).toBe(1);

    // 90% lost needs 900%: lost bar 90/900 = 0.1
    expect(ok({ mode: 'drawdown', drawdown: 0.9 }).lostShare).toBeCloseTo(0.1, 12);
  });
});

describe('drawdown, from a losing streak', () => {
  it('10 losses at 2% each', () => {
    // 0.98^10 = 0.8170728 left, 18.29% lost, 0.1829272 / 0.8170728 = 22.39% to recover
    const r = ok({ mode: 'streak', losses: 10, riskPerTrade: 0.02 });
    expect(r.remaining).toBeCloseTo(0.8170728069, 9);
    expect(r.drawdown).toBeCloseTo(0.1829271931, 9);
    expect(r.recoveryGain).toBeCloseTo(0.223881, 5);
    expect(r.scaleMax).toBe(1);
  });

  it('5 losses at 10% each', () => {
    // 0.9^5 = 0.59049 left, 40.951% lost, 0.40951 / 0.59049 = 69.35% to recover
    const r = ok({ mode: 'streak', losses: 5, riskPerTrade: 0.1 });
    expect(r.remaining).toBeCloseTo(0.59049, 12);
    expect(r.drawdown).toBeCloseTo(0.40951, 12);
    expect(r.recoveryGain).toBeCloseTo(0.693509, 5);
  });

  it('one loss of 50% is the same as a 50% drawdown', () => {
    const streak = ok({ mode: 'streak', losses: 1, riskPerTrade: 0.5 });
    const direct = ok({ mode: 'drawdown', drawdown: 0.5 });
    expect(streak.recoveryGain).toBe(direct.recoveryGain);
    expect(streak.remaining).toBe(direct.remaining);
  });

  it('a streak is not n x risk: 10 losses of 10% leave 34.87%, not 0%', () => {
    const r = ok({ mode: 'streak', losses: 10, riskPerTrade: 0.1 });
    expect(r.remaining).toBeCloseTo(0.3486784401, 9); // 0.9^10
    expect(r.recoveryGain).toBeCloseTo(1.867972, 5); // 0.6513216 / 0.3486784
    expect(r.scaleMax).toBeCloseTo(1.867972, 5);
    expect(r.neededShare).toBe(1);
  });
});

describe('drawdown, invalid input', () => {
  it.each([0, -0.1, 1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])('rejects drawdown %s', (value) => {
    expect(validateDrawdownInput({ mode: 'drawdown', drawdown: value })).toEqual(['drawdown']);
  });

  it.each([0, -1, 2.5, MAX_STREAK + 1, Number.NaN])('rejects a streak of %s losses', (losses) => {
    expect(validateDrawdownInput({ mode: 'streak', losses, riskPerTrade: 0.02 })).toEqual(['losses']);
  });

  it.each([0, -0.01, 1, 1.2, Number.NaN])('rejects risk per trade %s', (riskPerTrade) => {
    expect(validateDrawdownInput({ mode: 'streak', losses: 10, riskPerTrade })).toEqual(['risk']);
  });

  it('accepts the longest streak', () => {
    expect(validateDrawdownInput({ mode: 'streak', losses: MAX_STREAK, riskPerTrade: 0.001 })).toEqual([]);
  });

  it('reports "wiped out" when less than a ten-thousandth of the balance is left', () => {
    // 0.5^13 = 1.22e-4 (still reported), 0.5^14 = 6.1e-5 (below the bound)
    expect(MIN_REMAINING).toBe(1e-4);
    expect(validateDrawdownInput({ mode: 'streak', losses: 13, riskPerTrade: 0.5 })).toEqual([]);
    expect(validateDrawdownInput({ mode: 'streak', losses: 14, riskPerTrade: 0.5 })).toEqual(['wipedOut']);
    expect(validateDrawdownInput({ mode: 'streak', losses: 1000, riskPerTrade: 0.99 })).toEqual(['wipedOut']);
    expect(validateDrawdownInput({ mode: 'drawdown', drawdown: 0.99995 })).toEqual(['wipedOut']);
    // Exactly a ten-thousandth left is still reported: 99.99% lost needs 999,900%.
    expect(validateDrawdownInput({ mode: 'drawdown', drawdown: 0.9999 })).toEqual([]);
    expect(ok({ mode: 'drawdown', drawdown: 0.9999 }).recoveryGain).toBeCloseTo(9999, 3);
  });

  it('rejects an unknown mode', () => {
    expect(validateDrawdownInput({ mode: 'other' } as never)).toEqual(['mode']);
  });

  it('drawdown returns the issues instead of numbers', () => {
    const r = drawdown({ mode: 'streak', losses: 0, riskPerTrade: 0 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.issues).toEqual(['losses', 'risk']);
  });
});
