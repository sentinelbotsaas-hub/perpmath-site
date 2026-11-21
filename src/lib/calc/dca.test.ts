import { describe, expect, it } from 'vitest';
import { MAX_DCA_FILLS, averagePrice, dca, validateDcaInput } from './dca';
import type { DcaFuturesInput, DcaInput, DcaOk } from './dca';
import { liquidationPrice } from './liquidation';

// Expected values are worked by hand from
//   quantity = size (or size / price when the size is an amount)
//   cost     = price x quantity
//   average  = sum of costs / sum of quantities
// and, for futures, from the liquidation formula of liquidation.ts with the
// average price as the entry: long = average x (1 - 1/L + MMR).
function ok(input: DcaInput): DcaOk {
  const result = dca(input);
  if (!result.ok) {
    throw new Error(`expected ok, got ${JSON.stringify(result.issues)} ${JSON.stringify(result.rowIssues)}`);
  }
  return result;
}

const MMR = 0.0033;
const long10: DcaFuturesInput = { side: 'long', leverage: 10, mmr: MMR, maxLeverage: 150 };

// The example the calculator opens with.
const start: DcaInput = {
  fills: [
    { price: 68000, size: 0.01 },
    { price: 64000, size: 0.01 },
    { price: 62000, size: 0.02 },
  ],
  sizeUnit: 'quantity',
  futures: long10,
};

describe('averagePrice', () => {
  it('weights each price by its quantity', () => {
    // (100 x 1 + 50 x 3) / 4 = 250 / 4
    expect(averagePrice([{ price: 100, quantity: 1 }, { price: 50, quantity: 3 }])).toBeCloseTo(62.5, 12);
  });

  it('is the price itself for one fill, whatever the quantity', () => {
    expect(averagePrice([{ price: 68000, quantity: 0.37 }])).toBeCloseTo(68000, 9);
  });

  it('is the plain mean when the quantities are equal', () => {
    expect(averagePrice([{ price: 10, quantity: 2 }, { price: 20, quantity: 2 }, { price: 60, quantity: 2 }])).toBeCloseTo(30, 12);
  });

  it('returns NaN for nothing or for a value that is not above 0', () => {
    expect(averagePrice([])).toBeNaN();
    expect(averagePrice([{ price: 0, quantity: 1 }])).toBeNaN();
    expect(averagePrice([{ price: 10, quantity: -1 }])).toBeNaN();
    expect(averagePrice([{ price: Number.NaN, quantity: 1 }])).toBeNaN();
  });
});

describe('dca, spot', () => {
  it('three buys by quantity', () => {
    // costs 680 + 640 + 1,240 = 2,560; quantity 0.04; 2,560 / 0.04 = 64,000
    const r = ok({ ...start, futures: undefined });
    expect(r.totalQuantity).toBeCloseTo(0.04, 12);
    expect(r.totalCost).toBeCloseTo(2560, 9);
    expect(r.averagePrice).toBeCloseTo(64000, 6);
    expect(r.firstPrice).toBe(68000);
    expect(r.lastPrice).toBe(62000);
    expect(r.averageVsFirst).toBeCloseTo(-4000 / 68000, 12); // -5.88%
    expect(r.costMultiple).toBeCloseTo(2560 / 680, 12); // 3.76x
    expect(r.quantityMultiple).toBeCloseTo(4, 12);
    // 0.04 x (62,000 - 64,000) = -80
    expect(r.unrealizedAtLast).toBeCloseTo(-80, 9);
    // (64,000 - 62,000) / 62,000 = +3.23%
    expect(r.lastToAverage).toBeCloseTo(2000 / 62000, 12);
    expect(r.futures).toBeUndefined();
    expect(r.steps.every((step) => step.liquidationPrice === undefined)).toBe(true);
  });

  it('reports the position after every buy', () => {
    const r = ok({ ...start, futures: undefined });
    expect(r.steps.map((s) => s.cost)).toEqual([680, 640, 1240]);
    expect(r.steps[0].averagePrice).toBeCloseTo(68000, 6);
    expect(r.steps[1].averagePrice).toBeCloseTo(66000, 6); // 1,320 / 0.02
    expect(r.steps[2].averagePrice).toBeCloseTo(64000, 6);
    expect(r.steps[1].totalQuantity).toBeCloseTo(0.02, 12);
    expect(r.steps[1].totalCost).toBeCloseTo(1320, 9);
  });

  it('gives each buy its share of the final quantity, adding up to 1', () => {
    const r = ok({ ...start, futures: undefined });
    expect(r.steps[0].share).toBeCloseTo(0.25, 12);
    expect(r.steps[1].share).toBeCloseTo(0.25, 12);
    expect(r.steps[2].share).toBeCloseTo(0.5, 12);
    expect(r.steps.reduce((sum, s) => sum + s.share, 0)).toBeCloseTo(1, 12);
  });

  it('buys by amount: the same money buys more when the price is lower', () => {
    // 100 USDT at 50, 40 and 25 buys 2, 2.5 and 4: 8.5 in all for 300
    const r = ok({
      fills: [
        { price: 50, size: 100 },
        { price: 40, size: 100 },
        { price: 25, size: 100 },
      ],
      sizeUnit: 'amount',
    });
    expect(r.steps.map((s) => s.quantity)).toEqual([2, 2.5, 4]);
    expect(r.totalQuantity).toBeCloseTo(8.5, 12);
    expect(r.totalCost).toBeCloseTo(300, 12);
    expect(r.averagePrice).toBeCloseTo(300 / 8.5, 12); // 35.2941
    // Below the plain mean of the three prices (38.33): the cheap buy weighs most.
    expect(r.averagePrice).toBeLessThan((50 + 40 + 25) / 3);
    expect(r.steps[2].share).toBeCloseTo(4 / 8.5, 12);
  });

  it('one buy: the average is its price and nothing has changed', () => {
    const r = ok({ fills: [{ price: 68000, size: 0.5 }], sizeUnit: 'quantity' });
    expect(r.averagePrice).toBeCloseTo(68000, 6);
    expect(r.averageVsFirst).toBeCloseTo(0, 12);
    expect(r.costMultiple).toBeCloseTo(1, 12);
    expect(r.unrealizedAtLast).toBeCloseTo(0, 9);
    expect(r.lastToAverage).toBeCloseTo(0, 12);
    expect(r.steps[0].share).toBe(1);
  });

  it('buying higher raises the average', () => {
    const r = ok({ fills: [{ price: 100, size: 1 }, { price: 200, size: 1 }], sizeUnit: 'quantity' });
    expect(r.averagePrice).toBeCloseTo(150, 12);
    expect(r.averageVsFirst).toBeCloseTo(0.5, 12);
    expect(r.unrealizedAtLast).toBeCloseTo(100, 12); // 2 x (200 - 150)
    expect(r.lastToAverage).toBeCloseTo(-0.25, 12); // back down to 150 from 200
  });

  it('handles very small and very large numbers', () => {
    const tiny = ok({ fills: [{ price: 0.00001234, size: 1e9 }, { price: 0.00000617, size: 1e9 }], sizeUnit: 'quantity' });
    expect(tiny.averagePrice).toBeCloseTo(0.000009255, 15);
    const huge = ok({ fills: [{ price: 1e9, size: 1e6 }, { price: 3e9, size: 1e6 }], sizeUnit: 'quantity' });
    expect(huge.averagePrice).toBeCloseTo(2e9, 0);
  });
});

describe('dca, futures', () => {
  it('the opening example: a 10x long added to twice on the way down', () => {
    const r = ok(start);
    const f = r.futures!;
    expect(r.averagePrice).toBeCloseTo(64000, 6);
    expect(f.side).toBe('long');
    expect(f.firstMargin).toBeCloseTo(68, 9); // 680 / 10
    expect(f.margin).toBeCloseTo(256, 9); // 2,560 / 10
    // 68,000 x (1 - 1/10 + 0.0033) = 68,000 x 0.9033
    expect(f.firstLiquidationPrice).toBeCloseTo(61424.4, 6);
    // 64,000 x 0.9033
    expect(f.liquidationPrice).toBeCloseTo(57811.2, 6);
    expect(f.liquidationDistance).toBeCloseTo(0.0967, 12);
    // (62,000 - 57,811.2) / 62,000 = 6.756%: less room than the 9.67% a fresh position has
    expect(f.lastToLiquidation).toBeCloseTo(4188.8 / 62000, 12);
    expect(f.lastToLiquidation).toBeLessThan(f.liquidationDistance);
    expect(f.liquidatedBeforeFill).toBeNull();
    expect(r.unrealizedAtLast).toBeCloseTo(-80, 9);
  });

  it('uses the existing liquidation formula, with the average price as the entry', () => {
    const r = ok(start);
    r.steps.forEach((step) => {
      const direct = liquidationPrice({ side: 'long', entryPrice: step.averagePrice, leverage: 10, mmr: MMR, maxLeverage: 150 });
      if (!direct.ok) throw new Error('liquidationPrice failed');
      expect(step.liquidationPrice).toBe(direct.liquidationPrice);
    });
    expect(r.steps[1].liquidationPrice).toBeCloseTo(59617.8, 6); // 66,000 x 0.9033
  });

  it('a short added to on the way up', () => {
    // 0.02 at 68,000 and 0.02 at 70,000, 20x: average 69,000
    const r = ok({
      fills: [
        { price: 68000, size: 0.02 },
        { price: 70000, size: 0.02 },
      ],
      sizeUnit: 'quantity',
      futures: { side: 'short', leverage: 20, mmr: MMR, maxLeverage: 150 },
    });
    const f = r.futures!;
    expect(r.averagePrice).toBeCloseTo(69000, 6);
    // 68,000 x (1 + 1/20 - 0.0033) = 68,000 x 1.0467
    expect(f.firstLiquidationPrice).toBeCloseTo(71175.6, 6);
    // 69,000 x 1.0467
    expect(f.liquidationPrice).toBeCloseTo(72222.3, 6);
    // (72,222.3 - 70,000) / 70,000
    expect(f.lastToLiquidation).toBeCloseTo(2222.3 / 70000, 9);
    // short: 0.04 x (69,000 - 70,000) = -40
    expect(r.unrealizedAtLast).toBeCloseTo(-40, 9);
    expect(r.lastToAverage).toBeCloseTo(-1000 / 70000, 12);
    expect(f.margin).toBeCloseTo(138, 9); // 2,760 / 20
    expect(f.liquidatedBeforeFill).toBeNull();
  });

  it('sizes given as amounts are position value, not margin', () => {
    // 1,000 USDT of position at 50,000 and at 40,000, 2x
    const r = ok({
      fills: [
        { price: 50000, size: 1000 },
        { price: 40000, size: 1000 },
      ],
      sizeUnit: 'amount',
      futures: { side: 'long', leverage: 2, mmr: MMR, maxLeverage: 150 },
    });
    expect(r.totalQuantity).toBeCloseTo(0.045, 12); // 0.02 + 0.025
    expect(r.averagePrice).toBeCloseTo(2000 / 0.045, 9); // 44,444.44
    expect(r.futures!.margin).toBeCloseTo(1000, 9); // 2,000 / 2
    // 50,000 x (1 - 0.5 + 0.0033) = 25,165: the second fill at 40,000 is well above it
    expect(r.futures!.firstLiquidationPrice).toBeCloseTo(25165, 6);
    expect(r.futures!.liquidatedBeforeFill).toBeNull();
    // 44,444.44 x 0.5033
    expect(r.futures!.liquidationPrice).toBeCloseTo((2000 / 0.045) * 0.5033, 6);
  });

  it('the same two fills at 5x: the second one is below the first liquidation price', () => {
    // 50,000 x (1 - 0.2 + 0.0033) = 40,165, and the next fill is at 40,000
    const r = ok({
      fills: [
        { price: 50000, size: 1000 },
        { price: 40000, size: 1000 },
      ],
      sizeUnit: 'amount',
      futures: { side: 'long', leverage: 5, mmr: MMR, maxLeverage: 150 },
    });
    expect(r.futures!.firstLiquidationPrice).toBeCloseTo(40165, 6);
    expect(r.futures!.liquidatedBeforeFill).toBe(1);
  });

  it('flags a fill that lies beyond the liquidation price of the position before it', () => {
    // 20x long from 68,000 is liquidated at 64,824.4: it cannot be added to at 60,000
    const r = ok({
      fills: [
        { price: 68000, size: 0.01 },
        { price: 60000, size: 0.01 },
        { price: 59000, size: 0.01 },
      ],
      sizeUnit: 'quantity',
      futures: { ...long10, leverage: 20 },
    });
    expect(r.futures!.firstLiquidationPrice).toBeCloseTo(64824.4, 6);
    expect(r.futures!.liquidatedBeforeFill).toBe(1);
  });

  it('a fill exactly at the previous liquidation price counts as liquidated', () => {
    const first = liquidationPrice({ side: 'long', entryPrice: 68000, leverage: 10, mmr: MMR });
    if (!first.ok) throw new Error('liquidationPrice failed');
    const at = ok({ ...start, fills: [{ price: 68000, size: 0.01 }, { price: first.liquidationPrice, size: 0.01 }] });
    expect(at.futures!.liquidatedBeforeFill).toBe(1);
    const above = ok({ ...start, fills: [{ price: 68000, size: 0.01 }, { price: first.liquidationPrice + 0.1, size: 0.01 }] });
    expect(above.futures!.liquidatedBeforeFill).toBeNull();
  });

  it('a short is flagged when a fill is above the previous liquidation price', () => {
    const r = ok({
      fills: [
        { price: 68000, size: 0.01 },
        { price: 72000, size: 0.01 },
      ],
      sizeUnit: 'quantity',
      futures: { side: 'short', leverage: 20, mmr: MMR, maxLeverage: 150 },
    });
    expect(r.futures!.liquidatedBeforeFill).toBe(1); // 72,000 >= 71,175.6
  });

  it('adding at a better price for the position is never flagged', () => {
    const r = ok({ ...start, fills: [{ price: 68000, size: 0.01 }, { price: 90000, size: 0.01 }] });
    expect(r.futures!.liquidatedBeforeFill).toBeNull();
    expect(r.averagePrice).toBeCloseTo(79000, 6);
  });
});

describe('dca, invalid input', () => {
  it('needs at least one fill and at most MAX_DCA_FILLS', () => {
    expect(dca({ fills: [], sizeUnit: 'quantity' })).toEqual({ ok: false, issues: ['noFills'], rowIssues: [] });
    const many = Array.from({ length: MAX_DCA_FILLS + 1 }, () => ({ price: 100, size: 1 }));
    expect(dca({ fills: many, sizeUnit: 'quantity' })).toEqual({ ok: false, issues: ['tooManyFills'], rowIssues: [] });
    expect(dca({ fills: many.slice(1), sizeUnit: 'quantity' }).ok).toBe(true);
  });

  it('names the row and the field of every bad value', () => {
    const r = dca({
      fills: [
        { price: 68000, size: 0.01 },
        { price: 0, size: 0.01 },
        { price: 64000, size: Number.NaN },
        { price: -1, size: Number.POSITIVE_INFINITY },
      ],
      sizeUnit: 'quantity',
    });
    expect(r).toEqual({
      ok: false,
      issues: [],
      rowIssues: [
        { row: 1, field: 'price' },
        { row: 2, field: 'size' },
        { row: 3, field: 'price' },
        { row: 3, field: 'size' },
      ],
    });
  });

  it('rejects an unknown size unit', () => {
    const r = dca({ fills: [{ price: 1, size: 1 }], sizeUnit: 'coins' as never });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.issues).toEqual(['sizeUnit']);
  });

  it('checks the futures settings', () => {
    const fills = [{ price: 68000, size: 0.01 }];
    const issues = (futures: DcaFuturesInput) => validateDcaInput({ fills, sizeUnit: 'quantity', futures }).issues;
    expect(issues({ ...long10, side: 'up' as never })).toEqual(['side']);
    expect(issues({ ...long10, leverage: 0.5 })).toEqual(['leverage']);
    expect(issues({ ...long10, leverage: 151 })).toEqual(['leverage']);
    expect(issues({ ...long10, leverage: Number.NaN })).toEqual(['leverage']);
    expect(issues({ ...long10, mmr: 1 })).toEqual(['mmr']);
    expect(issues({ ...long10, maxLeverage: 0 })).toEqual(['maxLeverage']);
    // 1/100 is not larger than a 1% maintenance margin
    expect(issues({ ...long10, leverage: 100, mmr: 0.01 })).toEqual(['noRoom']);
  });

  it('never returns NaN or Infinity in an ok result', () => {
    const r = ok(start);
    const numbers = [
      r.totalQuantity,
      r.totalCost,
      r.averagePrice,
      r.averageVsFirst,
      r.costMultiple,
      r.quantityMultiple,
      r.unrealizedAtLast,
      r.lastToAverage,
      ...Object.values(r.futures!).filter((v): v is number => typeof v === 'number'),
      ...r.steps.flatMap((s) => Object.values(s).filter((v): v is number => typeof v === 'number')),
    ];
    expect(numbers.every(Number.isFinite)).toBe(true);
  });
});
