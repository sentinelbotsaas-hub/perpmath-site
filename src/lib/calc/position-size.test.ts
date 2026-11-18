import { describe, expect, it } from 'vitest';
import { positionSize, validatePositionSizeInput } from './position-size';
import type { PositionSizeInput, PositionSizeOk } from './position-size';

// Every rate is passed explicitly. Expected values are worked by hand from
//   risk amount = account x risk
//   quantity    = risk amount / |entry - stop|
//   notional    = quantity x entry
//   margin      = notional / leverage
//   fee         = quantity x (entry + stop) x fee rate
function ok(input: PositionSizeInput): PositionSizeOk {
  const result = positionSize(input);
  if (!result.ok) throw new Error(`expected ok, got issues: ${result.issues.join(', ')}`);
  return result;
}

const base: PositionSizeInput = {
  accountSize: 10000,
  riskFraction: 0.01,
  entryPrice: 68000,
  stopPrice: 66640,
  leverage: 10,
  feeRate: 0.00055,
  mmr: 0.0033,
  maxLeverage: 150,
};

describe('positionSize', () => {
  it('long: 10,000 account, 1% risk, entry 68,000, stop 66,640, 10x', () => {
    const r = ok(base);
    expect(r.side).toBe('long');
    expect(r.riskAmount).toBeCloseTo(100, 9); // 10,000 x 1%
    expect(r.stopDistance).toBeCloseTo(0.02, 12); // 1,360 / 68,000
    expect(r.quantity).toBeCloseTo(0.0735294118, 9); // 100 / 1,360
    expect(r.notional).toBeCloseTo(5000, 6); // quantity x 68,000
    expect(r.margin).toBeCloseTo(500, 6); // 5,000 / 10
    expect(r.entryFee).toBeCloseTo(2.75, 9); // 5,000 x 0.055%
    expect(r.exitFee).toBeCloseTo(2.695, 9); // 4,900 x 0.055%
    expect(r.roundTripFee).toBeCloseTo(5.445, 9);
    expect(r.lossAtStop).toBeCloseTo(105.445, 9);
    // 68,000 x (1 - 1/10 + 0.0033) = 61,424.4, which is 9.67% away
    expect(r.liquidationPrice).toBeCloseTo(61424.4, 6);
    expect(r.liquidationDistance).toBeCloseTo(0.0967, 12);
    expect(r.stopBeforeLiquidation).toBe(true);
    expect(r.marginFits).toBe(true);
  });

  it('short: 5,000 account, 2% risk, entry 68,000, stop 71,400, 25x is liquidated before the stop', () => {
    const r = ok({ ...base, accountSize: 5000, riskFraction: 0.02, stopPrice: 71400, leverage: 25 });
    expect(r.side).toBe('short');
    expect(r.riskAmount).toBeCloseTo(100, 9);
    expect(r.stopDistance).toBeCloseTo(0.05, 12); // 3,400 / 68,000
    expect(r.quantity).toBeCloseTo(0.0294117647, 9); // 100 / 3,400
    expect(r.notional).toBeCloseTo(2000, 6);
    expect(r.margin).toBeCloseTo(80, 6); // 2,000 / 25
    expect(r.entryFee).toBeCloseTo(1.1, 9); // 2,000 x 0.055%
    expect(r.exitFee).toBeCloseTo(1.155, 9); // 2,100 x 0.055%
    expect(r.roundTripFee).toBeCloseTo(2.255, 9);
    // 68,000 x (1 + 1/25 - 0.0033) = 70,495.6, below the stop at 71,400
    expect(r.liquidationPrice).toBeCloseTo(70495.6, 6);
    expect(r.liquidationDistance).toBeCloseTo(0.0367, 12);
    expect(r.stopBeforeLiquidation).toBe(false);
  });

  it('worked example 1 on the page: 10,000 account, 1% risk, entry 68,000, stop 66,400, 10x', () => {
    const r = ok({ ...base, stopPrice: 66400 });
    expect(r.side).toBe('long');
    expect(r.riskAmount).toBeCloseTo(100, 9);
    expect(r.quantity).toBeCloseTo(0.0625, 12); // 100 / 1,600
    expect(r.notional).toBeCloseTo(4250, 6); // 0.0625 x 68,000
    expect(r.margin).toBeCloseTo(425, 6); // 4,250 / 10
    expect(r.roundTripFee).toBeCloseTo(4.62, 9); // 0.0625 x (68,000 + 66,400) x 0.055% = 8,400 x 0.055%
    expect(r.lossAtStop).toBeCloseTo(104.62, 9);
    expect(r.liquidationPrice).toBeCloseTo(61424.4, 6);
    expect(r.stopBeforeLiquidation).toBe(true);
    expect(r.marginFits).toBe(true);
  });

  it('worked example 2 on the page: 4,000 account, 2% risk, entry 68,000, stop 72,000, 25x', () => {
    const r = ok({ ...base, accountSize: 4000, riskFraction: 0.02, stopPrice: 72000, leverage: 25 });
    expect(r.side).toBe('short');
    expect(r.riskAmount).toBeCloseTo(80, 9);
    expect(r.quantity).toBeCloseTo(0.02, 12); // 80 / 4,000
    expect(r.notional).toBeCloseTo(1360, 6);
    expect(r.margin).toBeCloseTo(54.4, 6); // 1,360 / 25
    expect(r.roundTripFee).toBeCloseTo(1.54, 9); // 0.02 x (68,000 + 72,000) x 0.055% = 2,800 x 0.055%
    // 68,000 x (1 + 1/25 - 0.0033) = 70,495.6, reached before the stop at 72,000
    expect(r.liquidationPrice).toBeCloseTo(70495.6, 6);
    expect(r.stopBeforeLiquidation).toBe(false);
  });

  it('the same short at 18x keeps the stop first', () => {
    // 1/18 - 0.0033 = 0.0522556 > 0.05
    const r = ok({ ...base, accountSize: 5000, riskFraction: 0.02, stopPrice: 71400, leverage: 18 });
    expect(r.stopBeforeLiquidation).toBe(true);
    expect(r.margin).toBeCloseTo(111.111111, 5); // 2,000 / 18
  });

  it('leverage changes the margin, not the quantity or the loss at the stop', () => {
    const low = ok({ ...base, leverage: 2 });
    const high = ok({ ...base, leverage: 40 });
    expect(low.quantity).toBeCloseTo(high.quantity, 12);
    expect(low.riskAmount).toBeCloseTo(high.riskAmount, 12);
    expect(low.roundTripFee).toBeCloseTo(high.roundTripFee, 12);
    expect(low.margin).toBeCloseTo(2500, 6);
    expect(high.margin).toBeCloseTo(125, 6);
  });

  it('a stop exactly at the liquidation price does not count as "before"', () => {
    // 20x, MMR 0.33%: liquidation at 64,824.4
    const r = ok({ ...base, stopPrice: 64824.4, leverage: 20 });
    expect(r.stopBeforeLiquidation).toBe(false);
  });

  it('flags a margin larger than the account', () => {
    // 1,000 account, 2% risk = 20; stop 0.5% away (340) -> notional 4,000; at 2x margin 2,000
    const r = ok({ ...base, accountSize: 1000, riskFraction: 0.02, stopPrice: 67660, leverage: 2 });
    expect(r.notional).toBeCloseTo(4000, 6);
    expect(r.margin).toBeCloseTo(2000, 6);
    expect(r.marginFits).toBe(false);
    expect(ok({ ...base, accountSize: 1000, riskFraction: 0.02, stopPrice: 67660, leverage: 4 }).marginFits).toBe(true);
  });

  it('a fee rate of 0 gives a fee of 0', () => {
    const r = ok({ ...base, feeRate: 0 });
    expect(r.roundTripFee).toBe(0);
    expect(r.lossAtStop).toBeCloseTo(100, 9);
  });

  it('risking the whole account is allowed (risk = 100%)', () => {
    const r = ok({ ...base, riskFraction: 1 });
    expect(r.riskAmount).toBeCloseTo(10000, 6);
    expect(r.notional).toBeCloseTo(500000, 3);
  });
});

describe('positionSize, invalid input', () => {
  const issues = (patch: Partial<PositionSizeInput>) => validatePositionSizeInput({ ...base, ...patch });

  it('accepts the base case', () => {
    expect(issues({})).toEqual([]);
  });

  it.each([0, -100, Number.NaN, Number.POSITIVE_INFINITY])('rejects account size %s', (accountSize) => {
    expect(issues({ accountSize })).toContain('accountSize');
  });

  it.each([0, -0.01, 1.01, Number.NaN])('rejects risk %s', (riskFraction) => {
    expect(issues({ riskFraction })).toContain('risk');
  });

  it.each([0, -1, Number.NaN])('rejects entry price %s', (entryPrice) => {
    expect(issues({ entryPrice })).toContain('entryPrice');
  });

  it('rejects a stop that is missing, negative or equal to the entry', () => {
    expect(issues({ stopPrice: 0 })).toContain('stopPrice');
    expect(issues({ stopPrice: -1 })).toContain('stopPrice');
    expect(issues({ stopPrice: Number.NaN })).toContain('stopPrice');
    expect(issues({ stopPrice: 68000 })).toEqual(['stopPrice']);
  });

  it.each([0, 0.5, -3, 151, Number.NaN])('rejects leverage %s with an exchange cap of 150', (leverage) => {
    expect(issues({ leverage })).toContain('leverage');
  });

  it('uses the exchange cap that was passed in', () => {
    expect(issues({ leverage: 125 })).toEqual([]);
    expect(issues({ leverage: 125, maxLeverage: 100 })).toContain('leverage');
    expect(issues({ maxLeverage: 0 })).toContain('maxLeverage');
    expect(issues({ maxLeverage: Number.NaN })).toContain('maxLeverage');
  });

  it.each([-0.0001, 1, Number.NaN])('rejects fee rate %s', (feeRate) => {
    expect(issues({ feeRate })).toContain('feeRate');
  });

  it.each([-0.001, 1, Number.NaN])('rejects MMR %s', (mmr) => {
    expect(issues({ mmr })).toContain('mmr');
  });

  it('rejects leverage that leaves no room: 1/leverage <= MMR', () => {
    expect(issues({ leverage: 100, mmr: 0.01 })).toEqual(['noRoom']);
    expect(issues({ leverage: 100, mmr: 0.0099 })).toEqual([]);
  });

  it('positionSize returns the issues instead of numbers', () => {
    const r = positionSize({ ...base, accountSize: 0, riskFraction: 2 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.issues).toEqual(['accountSize', 'risk']);
  });
});
