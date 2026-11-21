import { describe, expect, it } from 'vitest';
import { breakevenWinRate, riskReward, validateRiskRewardInput } from './risk-reward';
import type { RiskRewardInput, RiskRewardOk } from './risk-reward';

// Expected values are worked by hand from
//   R = |target - entry| / |entry - stop|
//   break-even win rate = 1 / (1 + R)
//   net risk = risk + (entry + stop) x fee, net reward = reward - (entry + target) x fee
//   break-even win rate after fees = net risk / (net risk + net reward)
function ok(input: RiskRewardInput): RiskRewardOk {
  const result = riskReward(input);
  if (!result.ok) throw new Error(`expected ok, got issues: ${result.issues.join(', ')}`);
  return result;
}

describe('breakevenWinRate', () => {
  const cases: Array<[number, number]> = [
    [0.5, 2 / 3],
    [1, 0.5],
    [1.5, 0.4],
    [2, 1 / 3],
    [3, 0.25],
    [4, 0.2],
    [9, 0.1],
  ];

  it.each(cases)('a reward of %s times the risk breaks even at %s', (ratio, rate) => {
    expect(breakevenWinRate(ratio)).toBeCloseTo(rate, 12);
  });

  it('at that win rate the expected result is zero', () => {
    for (const ratio of [0.3, 1, 2.5, 7]) {
      const w = breakevenWinRate(ratio);
      expect(w * ratio - (1 - w)).toBeCloseTo(0, 12);
    }
  });

  it('is NaN for unusable input', () => {
    expect(breakevenWinRate(0)).toBeNaN();
    expect(breakevenWinRate(-1)).toBeNaN();
    expect(breakevenWinRate(Number.NaN)).toBeNaN();
    expect(breakevenWinRate(Number.POSITIVE_INFINITY)).toBeNaN();
  });
});

describe('riskReward, a long', () => {
  // Entry 68,000, stop 66,400, target 72,000: risk 1,600, reward 4,000.
  const prices = { entryPrice: 68000, stopPrice: 66400, targetPrice: 72000 };

  it('before fees: 2.5 times the risk, break-even at 1 / 3.5', () => {
    const r = ok({ ...prices, feeRate: 0 });
    expect(r.side).toBe('long');
    expect(r.risk).toBe(1600);
    expect(r.reward).toBe(4000);
    expect(r.riskDistance).toBeCloseTo(1600 / 68000, 12); // 2.3529%
    expect(r.rewardDistance).toBeCloseTo(4000 / 68000, 12); // 5.8824%
    expect(r.ratio).toBe(2.5);
    expect(r.breakevenWinRate).toBeCloseTo(0.2857142857, 9);
  });

  it('with no fee the figures after fees are the same', () => {
    const r = ok({ ...prices, feeRate: 0 });
    expect(r.feeAtStop).toBe(0);
    expect(r.feeAtTarget).toBe(0);
    expect(r.netRisk).toBe(1600);
    expect(r.netReward).toBe(4000);
    expect(r.netRatio).toBe(2.5);
    expect(r.breakevenWinRateNet).toBeCloseTo(0.2857142857, 9);
  });

  it('at 0.055% per side the break-even win rate rises to 29.91%', () => {
    const r = ok({ ...prices, feeRate: 0.00055 });
    // (68,000 + 66,400) x 0.00055 = 73.92; (68,000 + 72,000) x 0.00055 = 77
    expect(r.feeAtStop).toBeCloseTo(73.92, 9);
    expect(r.feeAtTarget).toBeCloseTo(77, 9);
    expect(r.netRisk).toBeCloseTo(1673.92, 9);
    expect(r.netReward).toBeCloseTo(3923, 9);
    // 3,923 / 1,673.92
    expect(r.netRatio).toBeCloseTo(2.3436006, 6);
    // 1,673.92 / (1,673.92 + 3,923) = 1,673.92 / 5,596.92
    expect(r.breakevenWinRateNet).toBeCloseTo(0.2990788, 6);
    // The price-only figures do not move.
    expect(r.ratio).toBe(2.5);
    expect(r.breakevenWinRate).toBeCloseTo(0.2857142857, 9);
  });

  it('fees always raise the break-even win rate', () => {
    const free = ok({ ...prices, feeRate: 0 });
    const low = ok({ ...prices, feeRate: 0.0002 });
    const high = ok({ ...prices, feeRate: 0.001 });
    expect(low.breakevenWinRateNet as number).toBeGreaterThan(free.breakevenWinRateNet as number);
    expect(high.breakevenWinRateNet as number).toBeGreaterThan(low.breakevenWinRateNet as number);
  });

  it('at the break-even win rate after fees the expected result is zero', () => {
    const r = ok({ ...prices, feeRate: 0.00055 });
    const w = r.breakevenWinRateNet as number;
    expect(w * r.netReward - (1 - w) * r.netRisk).toBeCloseTo(0, 9);
  });
});

describe('riskReward, a short', () => {
  it('entry 100, stop 105, target 90 at 0.1% per side', () => {
    const r = ok({ entryPrice: 100, stopPrice: 105, targetPrice: 90, feeRate: 0.001 });
    expect(r.side).toBe('short');
    expect(r.risk).toBe(5);
    expect(r.reward).toBe(10);
    expect(r.ratio).toBe(2);
    expect(r.breakevenWinRate).toBeCloseTo(1 / 3, 12);
    // (100 + 105) x 0.001 = 0.205; (100 + 90) x 0.001 = 0.19
    expect(r.feeAtStop).toBeCloseTo(0.205, 12);
    expect(r.feeAtTarget).toBeCloseTo(0.19, 12);
    expect(r.netRisk).toBeCloseTo(5.205, 12);
    expect(r.netReward).toBeCloseTo(9.81, 12);
    // 5.205 / (5.205 + 9.81) = 5.205 / 15.015
    expect(r.breakevenWinRateNet).toBeCloseTo(0.3466533, 6);
  });

  it('mirrors the long with the same distances', () => {
    const long = ok({ entryPrice: 100, stopPrice: 95, targetPrice: 110, feeRate: 0 });
    const short = ok({ entryPrice: 100, stopPrice: 105, targetPrice: 90, feeRate: 0 });
    expect(short.ratio).toBe(long.ratio);
    expect(short.riskDistance).toBe(long.riskDistance);
    expect(short.rewardDistance).toBe(long.rewardDistance);
  });
});

describe('riskReward, the edges', () => {
  it('a target closer than the stop is a ratio below 1', () => {
    const r = ok({ entryPrice: 100, stopPrice: 98, targetPrice: 101, feeRate: 0 });
    expect(r.ratio).toBe(0.5);
    expect(r.breakevenWinRate).toBeCloseTo(2 / 3, 12);
  });

  it('fees as large as the target: no win rate breaks even', () => {
    // Reward 0.1 a unit; fees at the target (100 + 100.1) x 0.001 = 0.2001.
    const r = ok({ entryPrice: 100, stopPrice: 99, targetPrice: 100.1, feeRate: 0.001 });
    expect(r.netReward).toBeCloseTo(-0.1001, 9);
    expect(r.netRatio).toBeLessThan(0);
    expect(r.breakevenWinRateNet).toBeNull();
    // The price-only figures are still there.
    expect(r.ratio).toBeCloseTo(0.1, 9);
    expect(r.breakevenWinRate).toBeCloseTo(1 / 1.1, 9);
  });

  it('fees exactly as large as the target count as no break-even too', () => {
    // Entry 99, target 101: reward 2. Fees at the target (99 + 101) x 0.01 = 2, the whole reward.
    // In binary the difference may come out as a hair above or below zero; either way a winning
    // trade makes nothing, so the answer is "none".
    const r = ok({ entryPrice: 99, stopPrice: 98, targetPrice: 101, feeRate: 0.01 });
    expect(r.netReward).toBeCloseTo(0, 12);
    expect(r.breakevenWinRateNet).toBeNull();
  });

  it('never returns NaN or Infinity for valid input', () => {
    for (const input of [
      { entryPrice: 0.00001234, stopPrice: 0.00001, targetPrice: 0.00002, feeRate: 0.00055 },
      { entryPrice: 1e9, stopPrice: 1e9 - 1, targetPrice: 2e9, feeRate: 0 },
      { entryPrice: 100, stopPrice: 99.999999, targetPrice: 100.000001, feeRate: 0.5 },
    ]) {
      const r = ok(input);
      for (const value of [r.risk, r.reward, r.riskDistance, r.rewardDistance, r.ratio, r.breakevenWinRate, r.netRisk, r.netReward, r.netRatio]) {
        expect(Number.isFinite(value)).toBe(true);
      }
      expect(r.breakevenWinRateNet === null || Number.isFinite(r.breakevenWinRateNet)).toBe(true);
    }
  });
});

describe('validateRiskRewardInput', () => {
  const good = { entryPrice: 68000, stopPrice: 66400, targetPrice: 72000, feeRate: 0.00055 };

  it('accepts a long and a short', () => {
    expect(validateRiskRewardInput(good)).toEqual([]);
    expect(validateRiskRewardInput({ ...good, stopPrice: 70000, targetPrice: 64000 })).toEqual([]);
  });

  it('rejects a stop and a target on the same side of the entry', () => {
    expect(validateRiskRewardInput({ ...good, targetPrice: 66000 })).toEqual(['sameSide']);
    expect(validateRiskRewardInput({ ...good, stopPrice: 70000 })).toEqual(['sameSide']);
  });

  it('rejects a stop or a target at the entry', () => {
    expect(validateRiskRewardInput({ ...good, stopPrice: 68000 })).toEqual(['stopPrice']);
    expect(validateRiskRewardInput({ ...good, targetPrice: 68000 })).toEqual(['targetPrice']);
  });

  it('names each unusable field', () => {
    expect(validateRiskRewardInput({ ...good, entryPrice: 0 })).toEqual(['entryPrice']);
    expect(validateRiskRewardInput({ ...good, entryPrice: Number.NaN })).toEqual(['entryPrice']);
    expect(validateRiskRewardInput({ ...good, stopPrice: -1 })).toEqual(['stopPrice']);
    expect(validateRiskRewardInput({ ...good, targetPrice: Number.POSITIVE_INFINITY })).toEqual(['targetPrice']);
    expect(validateRiskRewardInput({ ...good, feeRate: -0.001 })).toEqual(['feeRate']);
    expect(validateRiskRewardInput({ ...good, feeRate: 1 })).toEqual(['feeRate']);
    expect(validateRiskRewardInput({ entryPrice: Number.NaN, stopPrice: Number.NaN, targetPrice: Number.NaN, feeRate: Number.NaN })).toEqual([
      'entryPrice',
      'stopPrice',
      'targetPrice',
      'feeRate',
    ]);
  });

  it('riskReward() reports the same issues', () => {
    const r = riskReward({ ...good, targetPrice: 60000 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.issues).toEqual(['sameSide']);
  });
});
