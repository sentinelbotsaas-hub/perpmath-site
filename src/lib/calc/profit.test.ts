import { describe, expect, it } from 'vitest';
import { liquidationPrice } from './liquidation';
import { MAX_FUNDING_PERIODS, profit, validateProfitInput } from './profit';
import type { ProfitInput, ProfitOk } from './profit';

// Every rate is passed explicitly. Expected values are worked by hand from
//   gross   = quantity x (exit - entry), sign flipped for a short
//   fee     = quantity x (entry + exit) x fee rate
//   funding = notional x rate x settlements, paid by longs when the rate is positive
//   net     = gross - fee + funding
function ok(input: ProfitInput): ProfitOk {
  const result = profit(input);
  if (!result.ok) throw new Error(`expected ok, got issues: ${result.issues.join(', ')}`);
  return result;
}

// The example the calculator opens with.
const base: ProfitInput = {
  side: 'long',
  entryPrice: 68000,
  exitPrice: 70000,
  sizeUnit: 'quantity',
  size: 0.1,
  leverage: 10,
  feeRate: 0.00055,
  fundingRate: 0.0001,
  fundingPeriods: 3,
  mmr: 0.0033,
  maxLeverage: 150,
};

describe('profit', () => {
  it('worked example 1: long 0.1 BTC from 68,000 to 70,000 at 10x, three settlements at 0.01%', () => {
    const r = ok(base);
    expect(r.quantity).toBeCloseTo(0.1, 12);
    expect(r.notional).toBeCloseTo(6800, 9); // 0.1 x 68,000
    expect(r.margin).toBeCloseTo(680, 9); // 6,800 / 10
    expect(r.priceChange).toBeCloseTo(2000 / 68000, 12); // +2.94%
    expect(r.grossPnl).toBeCloseTo(200, 9); // 0.1 x 2,000
    expect(r.entryFee).toBeCloseTo(3.74, 9); // 6,800 x 0.055%
    expect(r.exitFee).toBeCloseTo(3.85, 9); // 7,000 x 0.055%
    expect(r.roundTripFee).toBeCloseTo(7.59, 9);
    expect(r.funding).toBeCloseTo(-2.04, 9); // 6,800 x 0.01% x 3, paid by the long
    expect(r.netPnl).toBeCloseTo(190.37, 9); // 200 - 7.59 - 2.04
    expect(r.costs).toBeCloseTo(-9.63, 9);
    expect(r.grossReturnOnMargin).toBeCloseTo(200 / 680, 12); // 29.41%
    expect(r.netReturnOnMargin).toBeCloseTo(190.37 / 680, 12); // 28.00%
    expect(r.grossReturnOnNotional).toBeCloseTo(200 / 6800, 12); // 2.94%
    expect(r.netReturnOnNotional).toBeCloseTo(190.37 / 6800, 12); // 2.80%
    expect(r.liquidationPrice).toBeCloseTo(61424.4, 6); // 68,000 x 0.9033
    expect(r.liquidationDistance).toBeCloseTo(0.0967, 12);
    expect(r.liquidatedBeforeExit).toBe(false);
  });

  it('worked example 2: short sized by 500 USDT of margin at 20x, 68,000 to 69,500, six settlements at 0.01%', () => {
    const r = ok({ ...base, side: 'short', exitPrice: 69500, sizeUnit: 'margin', size: 500, leverage: 20, fundingPeriods: 6 });
    expect(r.margin).toBeCloseTo(500, 12);
    expect(r.notional).toBeCloseTo(10000, 9); // 500 x 20
    expect(r.quantity).toBeCloseTo(10000 / 68000, 12); // 0.147059
    expect(r.grossPnl).toBeCloseTo(-(10000 / 68000) * 1500, 9); // -220.59
    expect(r.roundTripFee).toBeCloseTo((10000 / 68000) * 137500 * 0.00055, 9); // 11.12
    expect(r.funding).toBeCloseTo(6, 9); // 10,000 x 0.01% x 6, received by the short
    expect(r.netPnl).toBeCloseTo(-225.7095588, 6);
    expect(r.netReturnOnMargin).toBeCloseTo(-0.451419118, 8); // -45.14%
    expect(r.netReturnOnNotional).toBeCloseTo(-0.0225709559, 9);
    expect(r.liquidationPrice).toBeCloseTo(71175.6, 6); // 68,000 x 1.0467
    expect(r.liquidatedBeforeExit).toBe(false);
  });

  it('the two ways of giving the size agree', () => {
    const byQuantity = ok(base);
    const byMargin = ok({ ...base, sizeUnit: 'margin', size: 680 });
    expect(byMargin.quantity).toBeCloseTo(byQuantity.quantity, 12);
    expect(byMargin.notional).toBeCloseTo(byQuantity.notional, 9);
    expect(byMargin.netPnl).toBeCloseTo(byQuantity.netPnl, 9);
  });

  it('leverage changes the margin and the return on it, not the P&L', () => {
    const at10 = ok(base);
    const at50 = ok({ ...base, leverage: 50 });
    expect(at50.netPnl).toBeCloseTo(at10.netPnl, 9);
    expect(at50.margin).toBeCloseTo(136, 9); // 6,800 / 50
    expect(at50.netReturnOnMargin).toBeCloseTo(at10.netReturnOnMargin * 5, 9);
    expect(at50.netReturnOnNotional).toBeCloseTo(at10.netReturnOnNotional, 12);
  });

  it('a negative funding rate pays longs and charges shorts', () => {
    const long = ok({ ...base, fundingRate: -0.0002, fundingPeriods: 5 });
    expect(long.funding).toBeCloseTo(6.8, 9); // 6,800 x 0.02% x 5
    const short = ok({ ...base, side: 'short', exitPrice: 67000, fundingRate: -0.0002, fundingPeriods: 5 });
    expect(short.funding).toBeCloseTo(-6.8, 9);
  });

  it('funding is optional: left out, it is zero', () => {
    const r = ok({ ...base, fundingRate: undefined, fundingPeriods: undefined });
    expect(r.funding).toBe(0);
    expect(Object.is(r.funding, -0)).toBe(false);
    expect(r.netPnl).toBeCloseTo(192.41, 9); // 200 - 7.59
    const noPeriods = ok({ ...base, fundingPeriods: 0 });
    expect(noPeriods.funding).toBe(0);
    expect(Object.is(noPeriods.funding, -0)).toBe(false);
  });

  it('exit at the entry price: the trade loses the fees and the funding', () => {
    const r = ok({ ...base, exitPrice: 68000 });
    expect(r.grossPnl).toBeCloseTo(0, 12);
    expect(r.roundTripFee).toBeCloseTo(7.48, 9); // 0.1 x 136,000 x 0.055%
    expect(r.netPnl).toBeCloseTo(-9.52, 9);
  });

  it('with no fee and no funding the net equals the gross', () => {
    const r = ok({ ...base, feeRate: 0, fundingPeriods: 0 });
    expect(r.roundTripFee).toBe(0);
    expect(r.netPnl).toBeCloseTo(r.grossPnl, 12);
    expect(r.costs).toBeCloseTo(0, 12);
    expect(r.breakEvenPrice).toBeCloseTo(68000, 9);
  });

  it('the break-even price makes the net P&L zero, long and short', () => {
    const long = ok(base);
    expect(long.breakEvenPrice).toBeCloseTo(68095.2523888, 6);
    expect(ok({ ...base, exitPrice: long.breakEvenPrice }).netPnl).toBeCloseTo(0, 9);

    const shortInput: ProfitInput = { ...base, side: 'short', sizeUnit: 'margin', size: 500, leverage: 20, fundingPeriods: 6 };
    const short = ok(shortInput);
    expect(short.breakEvenPrice).toBeCloseTo(67966.0186897, 6);
    expect(short.breakEvenPrice).toBeLessThan(68000);
    expect(ok({ ...shortInput, exitPrice: short.breakEvenPrice }).netPnl).toBeCloseTo(0, 9);
  });
});

describe('profit, liquidation before the exit', () => {
  it('uses the existing liquidation formula', () => {
    for (const side of ['long', 'short'] as const) {
      for (const leverage of [1, 3, 10, 25, 100]) {
        const direct = liquidationPrice({ side, entryPrice: 68000, leverage, mmr: 0.0033, maxLeverage: 150 });
        if (!direct.ok) throw new Error('liquidationPrice failed');
        expect(ok({ ...base, side, leverage }).liquidationPrice).toBe(direct.liquidationPrice);
      }
    }
  });

  it('a long exit below the liquidation price is flagged', () => {
    // 20x long from 68,000 is liquidated at 64,824.4
    const r = ok({ ...base, leverage: 20, exitPrice: 60000 });
    expect(r.liquidationPrice).toBeCloseTo(64824.4, 6);
    expect(r.liquidatedBeforeExit).toBe(true);
    // The arithmetic at that exit would lose more than the margin, which isolated margin does not allow.
    expect(r.netPnl).toBeLessThan(-r.margin);
  });

  it('a short exit above the liquidation price is flagged', () => {
    // 20x short from 68,000 is liquidated at 71,175.6
    expect(ok({ ...base, side: 'short', leverage: 20, exitPrice: 72000 }).liquidatedBeforeExit).toBe(true);
    expect(ok({ ...base, side: 'short', leverage: 20, exitPrice: 71000 }).liquidatedBeforeExit).toBe(false);
  });

  it('exactly at the liquidation price counts as liquidated; one tick inside does not', () => {
    const liq = ok({ ...base, leverage: 20 }).liquidationPrice;
    expect(ok({ ...base, leverage: 20, exitPrice: liq }).liquidatedBeforeExit).toBe(true);
    expect(ok({ ...base, leverage: 20, exitPrice: liq + 0.1 }).liquidatedBeforeExit).toBe(false);
  });

  it('a winning exit is never flagged', () => {
    expect(ok({ ...base, leverage: 100, exitPrice: 200000 }).liquidatedBeforeExit).toBe(false);
    expect(ok({ ...base, side: 'short', leverage: 100, exitPrice: 1 }).liquidatedBeforeExit).toBe(false);
  });
});

describe('profit, invalid input', () => {
  const issues = (patch: Partial<ProfitInput>) => validateProfitInput({ ...base, ...patch });

  it('accepts the base input', () => {
    expect(issues({})).toEqual([]);
  });

  it('names the wrong field', () => {
    expect(issues({ side: 'up' as never })).toEqual(['side']);
    expect(issues({ entryPrice: 0 })).toEqual(['entryPrice']);
    expect(issues({ exitPrice: -1 })).toEqual(['exitPrice']);
    expect(issues({ exitPrice: Number.NaN })).toEqual(['exitPrice']);
    expect(issues({ sizeUnit: 'lots' as never })).toEqual(['sizeUnit']);
    expect(issues({ size: 0 })).toEqual(['size']);
    expect(issues({ size: Number.POSITIVE_INFINITY })).toEqual(['size']);
    expect(issues({ leverage: 0.5 })).toEqual(['leverage']);
    expect(issues({ leverage: 151 })).toEqual(['leverage']);
    expect(issues({ feeRate: -0.001 })).toEqual(['feeRate']);
    expect(issues({ feeRate: 1 })).toEqual(['feeRate']);
    expect(issues({ fundingRate: 1 })).toEqual(['fundingRate']);
    expect(issues({ fundingRate: Number.NaN })).toEqual(['fundingRate']);
    expect(issues({ fundingPeriods: -1 })).toEqual(['fundingPeriods']);
    expect(issues({ fundingPeriods: 2.5 })).toEqual(['fundingPeriods']);
    expect(issues({ fundingPeriods: MAX_FUNDING_PERIODS + 1 })).toEqual(['fundingPeriods']);
    expect(issues({ mmr: 1 })).toEqual(['mmr']);
    expect(issues({ maxLeverage: 0 })).toEqual(['maxLeverage']);
  });

  it('reports leverage with no room above the maintenance margin', () => {
    expect(issues({ leverage: 100, mmr: 0.01 })).toEqual(['noRoom']);
  });

  it('collects several issues at once and returns them from profit()', () => {
    const r = profit({ ...base, entryPrice: 0, size: -1, feeRate: 2 });
    expect(r).toEqual({ ok: false, issues: ['entryPrice', 'size', 'feeRate'] });
  });

  it('never returns NaN or Infinity in an ok result', () => {
    for (const input of [base, { ...base, side: 'short' as const, exitPrice: 1 }, { ...base, leverage: 1, exitPrice: 0.01 }]) {
      const r = ok(input);
      const numbers = Object.values(r).filter((v): v is number => typeof v === 'number');
      expect(numbers.every(Number.isFinite)).toBe(true);
    }
  });
});
