import { describe, expect, it } from 'vitest';
import { liquidationPrice, roomLeft, roundToTick, validateLiquidationInput } from './liquidation';
import type { LiquidationInput, LiquidationOk } from './liquidation';

// Every case passes the maintenance margin rate explicitly. Expected values
// are the simplified formula worked by hand:
//   long  = entry x (1 - 1/leverage + MMR)
//   short = entry x (1 + 1/leverage - MMR)
function ok(input: LiquidationInput): LiquidationOk {
  const result = liquidationPrice(input);
  if (!result.ok) throw new Error(`expected ok, got issues: ${result.issues.join(', ')}`);
  return result;
}

describe('liquidationPrice, simplified formula without extra margin', () => {
  const cases: Array<[string, LiquidationInput, number]> = [
    ['long 20x, MMR 0.33%', { side: 'long', entryPrice: 68000, leverage: 20, mmr: 0.0033 }, 64824.4],
    ['short 20x, MMR 0.33%', { side: 'short', entryPrice: 68000, leverage: 20, mmr: 0.0033 }, 71175.6],
    ['long 20x, MMR 0.5%', { side: 'long', entryPrice: 68000, leverage: 20, mmr: 0.005 }, 64940],
    ['short 20x, MMR 0.5%', { side: 'short', entryPrice: 68000, leverage: 20, mmr: 0.005 }, 71060],
    ['long 2x', { side: 'long', entryPrice: 68000, leverage: 2, mmr: 0.0033 }, 34224.4],
    ['short 2x', { side: 'short', entryPrice: 68000, leverage: 2, mmr: 0.0033 }, 101775.6],
    ['long 5x', { side: 'long', entryPrice: 68000, leverage: 5, mmr: 0.0033 }, 54624.4],
    ['short 10x, entry 2,500, MMR 0.5%', { side: 'short', entryPrice: 2500, leverage: 10, mmr: 0.005 }, 2737.5],
    ['long 50x, MMR 0.5%', { side: 'long', entryPrice: 68000, leverage: 50, mmr: 0.005 }, 66980],
    ['long 100x', { side: 'long', entryPrice: 68000, leverage: 100, mmr: 0.0033 }, 67544.4],
    ['short 100x', { side: 'short', entryPrice: 68000, leverage: 100, mmr: 0.0033 }, 68455.6],
    ['long 1x', { side: 'long', entryPrice: 68000, leverage: 1, mmr: 0.0033 }, 224.4],
    ['short 1x', { side: 'short', entryPrice: 68000, leverage: 1, mmr: 0.0033 }, 135775.6],
    ['long 12.5x (fractional leverage)', { side: 'long', entryPrice: 40000, leverage: 12.5, mmr: 0.004 }, 36960],
    ['long, MMR 0', { side: 'long', entryPrice: 100, leverage: 4, mmr: 0 }, 75],
  ];

  it.each(cases)('%s', (_name, input, expected) => {
    const result = ok(input);
    expect(result.liquidationPrice).toBeCloseTo(expected, 6);
    expect(result.reachable).toBe(true);
  });

  it('reports the distance as a fraction of entry: 1/leverage - MMR', () => {
    const long = ok({ side: 'long', entryPrice: 68000, leverage: 20, mmr: 0.0033 });
    const short = ok({ side: 'short', entryPrice: 68000, leverage: 20, mmr: 0.0033 });
    expect(long.distance).toBeCloseTo(0.0467, 10);
    expect(short.distance).toBeCloseTo(0.0467, 10);
    expect(long.room).toBeCloseTo(0.0467, 10);
  });

  it('long and short are symmetric around the entry price', () => {
    const long = ok({ side: 'long', entryPrice: 68000, leverage: 7, mmr: 0.0033 });
    const short = ok({ side: 'short', entryPrice: 68000, leverage: 7, mmr: 0.0033 });
    expect(68000 - long.liquidationPrice).toBeCloseTo(short.liquidationPrice - 68000, 6);
  });
});

describe('liquidationPrice with extra margin', () => {
  // long = entry x (1 - 1/L + MMR) - extra / quantity
  it('moves a long liquidation price down by extra / quantity', () => {
    const r = ok({ side: 'long', entryPrice: 68000, leverage: 20, mmr: 0.0033, extraMargin: 1000, quantity: 0.5 });
    expect(r.liquidationPrice).toBeCloseTo(64824.4 - 2000, 6);
    expect(r.distance).toBeCloseTo(0.0467 + 2000 / 68000, 10);
  });

  it('moves a short liquidation price up by extra / quantity', () => {
    const r = ok({ side: 'short', entryPrice: 68000, leverage: 20, mmr: 0.0033, extraMargin: 1000, quantity: 0.5 });
    expect(r.liquidationPrice).toBeCloseTo(71175.6 + 2000, 6);
  });

  it('extra margin of 0 changes nothing and needs no quantity', () => {
    const r = ok({ side: 'long', entryPrice: 68000, leverage: 20, mmr: 0.0033, extraMargin: 0 });
    expect(r.liquidationPrice).toBeCloseTo(64824.4, 6);
  });

  it('a long with more margin than the position is worth cannot be liquidated above zero', () => {
    const r = ok({ side: 'long', entryPrice: 68000, leverage: 20, mmr: 0.0033, extraMargin: 1000, quantity: 0.01 });
    expect(r.reachable).toBe(false);
    expect(r.liquidationPrice).toBe(0);
    expect(r.room).toBe(1);
  });
});

describe('invalid input', () => {
  const base: LiquidationInput = { side: 'long', entryPrice: 68000, leverage: 20, mmr: 0.0033 };
  const issues = (patch: Partial<LiquidationInput>) => validateLiquidationInput({ ...base, ...patch });

  it('accepts the base case', () => {
    expect(issues({})).toEqual([]);
  });

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])('rejects entry price %s', (entryPrice) => {
    expect(issues({ entryPrice })).toContain('entryPrice');
  });

  it.each([0, 0.5, -3, 101, Number.NaN])('rejects leverage %s with the default limit of 100', (leverage) => {
    expect(issues({ leverage })).toContain('leverage');
  });

  it('uses maxLeverage when given', () => {
    expect(issues({ leverage: 125, maxLeverage: 150 })).toEqual([]);
    expect(issues({ leverage: 151, maxLeverage: 150 })).toContain('leverage');
  });

  it.each([-0.001, 1, 1.5, Number.NaN])('rejects MMR %s', (mmr) => {
    expect(issues({ mmr })).toContain('mmr');
  });

  it('rejects leverage that leaves no room: 1/leverage <= MMR', () => {
    expect(issues({ leverage: 100, mmr: 0.01 })).toEqual(['noRoom']);
    expect(issues({ leverage: 100, mmr: 0.02 })).toEqual(['noRoom']);
    expect(issues({ leverage: 100, mmr: 0.0099 })).toEqual([]);
  });

  it('rejects negative extra margin, and extra margin without a position size', () => {
    expect(issues({ extraMargin: -1 })).toContain('extraMargin');
    expect(issues({ extraMargin: 100 })).toContain('quantity');
    expect(issues({ extraMargin: 100, quantity: 0 })).toContain('quantity');
    expect(issues({ extraMargin: 100, quantity: 0.1 })).toEqual([]);
  });

  it('rejects an unknown side', () => {
    expect(issues({ side: 'up' as never })).toContain('side');
  });

  it('liquidationPrice returns the issues instead of a number', () => {
    const r = liquidationPrice({ ...base, entryPrice: 0, leverage: 0 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.issues).toEqual(['entryPrice', 'leverage']);
  });
});

describe('roomLeft', () => {
  it('is 1/leverage - MMR', () => {
    expect(roomLeft(20, 0.0033)).toBeCloseTo(0.0467, 10);
    expect(roomLeft(2, 0.0033)).toBeCloseTo(0.4967, 10);
    expect(roomLeft(100, 0.0033)).toBeCloseTo(0.0067, 10);
  });

  it('never goes below 0 or above 1', () => {
    expect(roomLeft(100, 0.02)).toBe(0);
    expect(roomLeft(1, 0)).toBe(1);
    expect(roomLeft(0, 0.0033)).toBe(0);
  });
});

describe('roundToTick', () => {
  it('rounds to the tick size', () => {
    expect(roundToTick(64824.44, 0.1)).toBe(64824.4);
    expect(roundToTick(64824.45, 0.1)).toBe(64824.5);
    expect(roundToTick(64824.399999999994, 0.1)).toBe(64824.4);
    expect(roundToTick(2737.512, 0.01)).toBe(2737.51);
    expect(roundToTick(64824.4, 1)).toBe(64824);
    expect(roundToTick(64826, 5)).toBe(64825);
    expect(roundToTick(0.123456, 0.0001)).toBe(0.1235);
  });
});
