import { describe, expect, it } from 'vitest';
import { floorTo, maxLeverage, stopComesFirst, stopDistance, validateMaxLeverageInput } from './leverage';
import type { MaxLeverageInput, MaxLeverageOk } from './leverage';
import { liquidationPrice } from './liquidation';

// Every case passes the maintenance margin rate and the exchange cap
// explicitly. Expected values are worked by hand from
//   stop distance = |entry - stop| / entry
//   limit         = 1 / (stop distance + MMR)        (exclusive)
//   liquidation distance at L = 1/L - MMR
function ok(input: MaxLeverageInput): MaxLeverageOk {
  const result = maxLeverage(input);
  if (!result.ok) throw new Error(`expected ok, got issues: ${result.issues.join(', ')}`);
  return result;
}

describe('maxLeverage', () => {
  it('long, stop 2% below entry, MMR 0.33%', () => {
    // d = 1,360 / 68,000 = 0.02; limit = 1 / 0.0233 = 42.918...
    // 42x: 1/42 - 0.0033 = 0.0205095 > 0.02 (stop first)
    // 43x: 1/43 - 0.0033 = 0.0199558 < 0.02 (liquidation first)
    const r = ok({ side: 'long', entryPrice: 68000, stopPrice: 66640, mmr: 0.0033, maxLeverage: 150 });
    expect(r.stopDistance).toBeCloseTo(0.02, 12);
    expect(r.limit).toBeCloseTo(42.9184549, 6);
    expect(r.maxWholeLeverage).toBe(42);
    expect(r.feasible).toBe(true);
    expect(r.cappedByExchange).toBe(false);
    expect(r.liquidationDistance).toBeCloseTo(0.0205095238, 9);
    // 68,000 x (1 - 1/42 + 0.0033) = 66,605.352381
    expect(r.liquidationPrice).toBeCloseTo(66605.352381, 5);
  });

  it('short, stop 5% above entry, MMR 0.5%', () => {
    // d = 3,400 / 68,000 = 0.05; limit = 1 / 0.055 = 18.1818...
    // 18x: 1/18 - 0.005 = 0.0505556 > 0.05
    const r = ok({ side: 'short', entryPrice: 68000, stopPrice: 71400, mmr: 0.005, maxLeverage: 100 });
    expect(r.stopDistance).toBeCloseTo(0.05, 12);
    expect(r.limit).toBeCloseTo(18.1818182, 6);
    expect(r.maxWholeLeverage).toBe(18);
    // 68,000 x (1 + 1/18 - 0.005) = 71,437.777778
    expect(r.liquidationPrice).toBeCloseTo(71437.777778, 5);
  });

  it('short, stop 5% above entry, MMR 0.33%', () => {
    // limit = 1 / 0.0533 = 18.7617...
    const r = ok({ side: 'short', entryPrice: 68000, stopPrice: 71400, mmr: 0.0033, maxLeverage: 150 });
    expect(r.limit).toBeCloseTo(18.7617261, 6);
    expect(r.maxWholeLeverage).toBe(18);
  });

  it('worked example 1 on the page: long, entry 68,000, stop 64,600, MMR 0.33%', () => {
    // d = 3,400 / 68,000 = 0.05; limit = 1 / 0.0533 = 18.7617
    // 18x: 68,000 x (1 - 1/18 + 0.0033) = 64,446.62, below the stop
    // 19x: 68,000 x (1 - 1/19 + 0.0033) = 64,645.45, above the stop
    const r = ok({ side: 'long', entryPrice: 68000, stopPrice: 64600, mmr: 0.0033, maxLeverage: 150 });
    expect(r.limit).toBeCloseTo(18.7617261, 6);
    expect(r.maxWholeLeverage).toBe(18);
    expect(r.liquidationPrice).toBeCloseTo(64446.622222, 5);
    const at19 = liquidationPrice({ side: 'long', entryPrice: 68000, leverage: 19, mmr: 0.0033 });
    if (!at19.ok) throw new Error('unexpected');
    expect(at19.liquidationPrice).toBeCloseTo(64645.452632, 5);
  });

  it('worked example 2 on the page: short, entry 68,000, stop 69,360, MMR 0.33%', () => {
    // d = 1,360 / 68,000 = 0.02; limit = 42.918
    // 42x: 68,000 x (1 + 1/42 - 0.0033) = 69,394.65, above the stop
    // 43x: 68,000 x (1 + 1/43 - 0.0033) = 69,356.99, below the stop
    const r = ok({ side: 'short', entryPrice: 68000, stopPrice: 69360, mmr: 0.0033, maxLeverage: 150 });
    expect(r.maxWholeLeverage).toBe(42);
    expect(r.liquidationPrice).toBeCloseTo(69394.647619, 5);
    const at43 = liquidationPrice({ side: 'short', entryPrice: 68000, leverage: 43, mmr: 0.0033 });
    if (!at43.ok) throw new Error('unexpected');
    expect(at43.liquidationPrice).toBeCloseTo(69356.995349, 5);
  });

  it('the bound is exclusive: when the limit is a whole number, the answer is one below it', () => {
    // d = 0.0467, MMR = 0.0033 -> limit = 1 / 0.05 = 20. At 20x the liquidation
    // price is 64,824.4, which is the stop itself, so 20x does not qualify.
    const r = ok({ side: 'long', entryPrice: 68000, stopPrice: 64824.4, mmr: 0.0033, maxLeverage: 150 });
    expect(r.limit).toBeCloseTo(20, 9);
    expect(r.maxWholeLeverage).toBe(19);

    // entry 100, stop 90, MMR 0 -> limit 10 -> 9x
    expect(ok({ side: 'long', entryPrice: 100, stopPrice: 90, mmr: 0, maxLeverage: 100 }).maxWholeLeverage).toBe(9);
    // entry 100, stop 95, MMR 0 -> limit 20 -> 19x
    expect(ok({ side: 'long', entryPrice: 100, stopPrice: 95, mmr: 0, maxLeverage: 100 }).maxWholeLeverage).toBe(19);
    // entry 100, stop 97, MMR 1% -> limit 1 / 0.04 = 25 -> 24x
    expect(ok({ side: 'long', entryPrice: 100, stopPrice: 97, mmr: 0.01, maxLeverage: 100 }).maxWholeLeverage).toBe(24);
    // short mirror: entry 100, stop 105, MMR 0 -> limit 20 -> 19x
    expect(ok({ side: 'short', entryPrice: 100, stopPrice: 105, mmr: 0, maxLeverage: 100 }).maxWholeLeverage).toBe(19);
  });

  it('at the returned leverage the liquidation price is beyond the stop, one step up it is not', () => {
    const cases: MaxLeverageInput[] = [
      { side: 'long', entryPrice: 68000, stopPrice: 66640, mmr: 0.0033, maxLeverage: 150 },
      { side: 'long', entryPrice: 68000, stopPrice: 67000, mmr: 0.0033, maxLeverage: 150 },
      { side: 'short', entryPrice: 68000, stopPrice: 71400, mmr: 0.005, maxLeverage: 150 },
      { side: 'short', entryPrice: 2500, stopPrice: 2530, mmr: 0.005, maxLeverage: 150 },
      { side: 'long', entryPrice: 0.5, stopPrice: 0.47, mmr: 0.01, maxLeverage: 150 },
    ];
    for (const input of cases) {
      const r = ok(input);
      const at = liquidationPrice({ ...input, leverage: r.maxWholeLeverage, maxLeverage: 1000 });
      const above = liquidationPrice({ ...input, leverage: r.maxWholeLeverage + 1, maxLeverage: 1000 });
      if (!at.ok || !above.ok) throw new Error('liquidationPrice rejected a case');
      expect(r.liquidationPrice).toBeCloseTo(at.liquidationPrice, 6);
      if (input.side === 'long') {
        expect(at.liquidationPrice).toBeLessThan(input.stopPrice);
        expect(above.liquidationPrice).toBeGreaterThanOrEqual(input.stopPrice);
      } else {
        expect(at.liquidationPrice).toBeGreaterThan(input.stopPrice);
        expect(above.liquidationPrice).toBeLessThanOrEqual(input.stopPrice);
      }
    }
  });

  it('is capped by the exchange limit when the stop would allow more', () => {
    // d = 68 / 68,000 = 0.001; limit = 1 / 0.0043 = 232.558...
    const base: MaxLeverageInput = { side: 'long', entryPrice: 68000, stopPrice: 67932, mmr: 0.0033, maxLeverage: 150 };
    const capped = ok(base);
    expect(capped.limit).toBeCloseTo(232.5581395, 6);
    expect(capped.maxWholeLeverage).toBe(150);
    expect(capped.cappedByExchange).toBe(true);
    // 1/150 - 0.0033 = 0.00336667
    expect(capped.liquidationDistance).toBeCloseTo(0.0033666667, 9);

    expect(ok({ ...base, maxLeverage: 100 }).maxWholeLeverage).toBe(100);
    // A cap above the limit does not bind.
    const free = ok({ ...base, maxLeverage: 500 });
    expect(free.maxWholeLeverage).toBe(232);
    expect(free.cappedByExchange).toBe(false);
    // A cap that happens to equal the answer does not count as capping.
    expect(ok({ ...base, maxLeverage: 232 }).cappedByExchange).toBe(false);
    // A fractional cap is rounded down.
    expect(ok({ ...base, maxLeverage: 12.5 }).maxWholeLeverage).toBe(12);
  });

  it('reports "not feasible" when even 1x is liquidated before the stop', () => {
    // Short with a stop 150% above entry: at 1x the liquidation is 99.67% above.
    const short = ok({ side: 'short', entryPrice: 100, stopPrice: 250, mmr: 0.0033, maxLeverage: 150 });
    expect(short.stopDistance).toBeCloseTo(1.5, 12);
    expect(short.feasible).toBe(false);
    expect(short.maxWholeLeverage).toBe(0);
    expect(short.liquidationPrice).toBe(0);
    expect(short.cappedByExchange).toBe(false);

    // Long with a stop 99.8% below entry: at 1x the liquidation is 99.67% below.
    const long = ok({ side: 'long', entryPrice: 100, stopPrice: 0.2, mmr: 0.0033, maxLeverage: 150 });
    expect(long.feasible).toBe(false);

    // Long with a stop 99% below entry: 1x still works (liquidation at 0.33).
    const edge = ok({ side: 'long', entryPrice: 100, stopPrice: 1, mmr: 0.0033, maxLeverage: 150 });
    expect(edge.maxWholeLeverage).toBe(1);
    expect(edge.liquidationPrice).toBeCloseTo(0.33, 9);
  });
});

describe('maxLeverage, invalid input', () => {
  const base: MaxLeverageInput = { side: 'long', entryPrice: 68000, stopPrice: 66640, mmr: 0.0033, maxLeverage: 150 };
  const issues = (patch: Partial<MaxLeverageInput>) => validateMaxLeverageInput({ ...base, ...patch });

  it('accepts the base case', () => {
    expect(issues({})).toEqual([]);
  });

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])('rejects entry price %s', (entryPrice) => {
    expect(issues({ entryPrice })).toContain('entryPrice');
  });

  it.each([0, -5, Number.NaN, Number.POSITIVE_INFINITY])('rejects stop price %s', (stopPrice) => {
    expect(issues({ stopPrice })).toContain('stopPrice');
  });

  it('rejects a stop on the wrong side of the entry, or equal to it', () => {
    expect(issues({ side: 'long', stopPrice: 69000 })).toEqual(['stopSide']);
    expect(issues({ side: 'long', stopPrice: 68000 })).toEqual(['stopSide']);
    expect(issues({ side: 'short', stopPrice: 66640 })).toEqual(['stopSide']);
    expect(issues({ side: 'short', stopPrice: 68000 })).toEqual(['stopSide']);
    expect(issues({ side: 'short', stopPrice: 69000 })).toEqual([]);
  });

  it.each([-0.001, 1, 1.5, Number.NaN])('rejects MMR %s', (mmr) => {
    expect(issues({ mmr })).toContain('mmr');
  });

  it.each([0, 0.5, -3, Number.NaN, undefined as unknown as number])('rejects exchange cap %s', (cap) => {
    expect(issues({ maxLeverage: cap })).toContain('maxLeverage');
  });

  it('rejects an unknown side', () => {
    expect(issues({ side: 'up' as never })).toContain('side');
  });

  it('maxLeverage returns the issues instead of a number', () => {
    const r = maxLeverage({ ...base, entryPrice: 0, stopPrice: -1 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.issues).toEqual(['entryPrice', 'stopPrice']);
  });
});

describe('stopDistance', () => {
  it('is |entry - stop| / entry', () => {
    expect(stopDistance(68000, 66640)).toBeCloseTo(0.02, 12);
    expect(stopDistance(68000, 71400)).toBeCloseTo(0.05, 12);
    expect(stopDistance(100, 100)).toBe(0);
  });

  it('is NaN for unusable prices', () => {
    expect(stopDistance(0, 100)).toBeNaN();
    expect(stopDistance(100, -1)).toBeNaN();
    expect(stopDistance(Number.NaN, 100)).toBeNaN();
  });
});

describe('stopComesFirst', () => {
  it('compares the stop distance with 1/leverage - MMR', () => {
    // 20x, MMR 0.33%: liquidation is 4.67% away
    expect(stopComesFirst(0.02, 20, 0.0033)).toBe(true);
    expect(stopComesFirst(0.046, 20, 0.0033)).toBe(true);
    expect(stopComesFirst(0.05, 20, 0.0033)).toBe(false);
  });

  it('an exact tie is not "first"', () => {
    expect(stopComesFirst(0.0467, 20, 0.0033)).toBe(false);
    expect(stopComesFirst(0.1, 10, 0)).toBe(false);
  });

  it('is false for unusable input', () => {
    expect(stopComesFirst(Number.NaN, 20, 0.0033)).toBe(false);
    expect(stopComesFirst(-0.01, 20, 0.0033)).toBe(false);
    expect(stopComesFirst(0.02, 0, 0.0033)).toBe(false);
    expect(stopComesFirst(0.02, 20, -1)).toBe(false);
  });
});

describe('floorTo', () => {
  it('cuts without rounding up', () => {
    expect(floorTo(18.7699, 2)).toBe(18.76);
    expect(floorTo(42.9184549, 2)).toBe(42.91);
    expect(floorTo(20, 2)).toBe(20);
    expect(floorTo(20.000000000000004, 2)).toBe(20);
    expect(floorTo(19.999999999999996, 2)).toBe(20);
    expect(floorTo(0.0735294, 4)).toBe(0.0735);
  });
});
