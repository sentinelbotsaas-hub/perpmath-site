// The parsers get rows shaped like Bybit's v5 responses (numbers as strings,
// newest first) and must refuse anything empty or malformed.
import { describe, expect, it } from 'vitest';
import { DAY_MS, HOUR_MS } from './compute';
import {
  completeCandles,
  parseFunding,
  parseInstrument,
  parseKlines,
  parseOpenInterest,
  parseRatio,
  parseTicker,
  parseTierOne,
} from './parse';

const DAY = Date.UTC(2026, 0, 10);
const row = (start: number, o: string, h: string, l: string, c: string) => [String(start), o, h, l, c, '10', '1000'];

describe('parseKlines', () => {
  const list = [
    row(DAY + 2 * DAY_MS, '102', '104', '101', '103'),
    row(DAY + DAY_MS, '101', '103', '99.5', '102'),
    row(DAY, '100', '101', '99', '101'),
  ];

  it('returns numbers, oldest first', () => {
    const candles = parseKlines(list, DAY_MS);
    expect(candles.map((c) => c.start)).toEqual([DAY, DAY + DAY_MS, DAY + 2 * DAY_MS]);
    expect(candles[1]).toEqual({ start: DAY + DAY_MS, open: 101, high: 103, low: 99.5, close: 102 });
  });

  it('refuses an empty or missing list', () => {
    expect(() => parseKlines([], DAY_MS)).toThrow(/empty/);
    expect(() => parseKlines(undefined, DAY_MS)).toThrow(/empty/);
    expect(() => parseKlines({ list: [] }, DAY_MS)).toThrow(/empty/);
  });

  it('refuses a row that is not a candle', () => {
    expect(() => parseKlines([['1', '2']], DAY_MS)).toThrow(/not a candle row/);
    expect(() => parseKlines([row(DAY, '100', 'abc', '99', '100')], DAY_MS)).toThrow(/not a number/);
    expect(() => parseKlines([row(DAY, '100', '', '99', '100')], DAY_MS)).toThrow(/not a number/);
    expect(() => parseKlines([row(DAY, '0', '101', '99', '100')], DAY_MS)).toThrow(/above zero/);
  });

  it('refuses a candle whose high or low contradicts its open and close', () => {
    expect(() => parseKlines([row(DAY, '100', '99.9', '99', '99.5')], DAY_MS)).toThrow(/high or low/);
    expect(() => parseKlines([row(DAY, '100', '101', '100.5', '100.8')], DAY_MS)).toThrow(/high or low/);
  });

  it('refuses a gap, a duplicate and a start off the interval', () => {
    const gap = [row(DAY + 2 * DAY_MS, '102', '104', '101', '103'), row(DAY, '100', '101', '99', '101')];
    expect(() => parseKlines(gap, DAY_MS)).toThrow(/gap or a duplicate/);
    const twice = [row(DAY, '100', '101', '99', '101'), row(DAY, '100', '101', '99', '101')];
    expect(() => parseKlines(twice, DAY_MS)).toThrow(/gap or a duplicate/);
    expect(() => parseKlines([row(DAY + HOUR_MS, '100', '101', '99', '101')], DAY_MS)).toThrow(/interval boundary/);
  });
});

describe('completeCandles', () => {
  const candles = parseKlines(
    [row(DAY + DAY_MS, '101', '103', '99.5', '102'), row(DAY, '100', '101', '99', '101')],
    DAY_MS,
  );

  it('drops the candle that is still forming', () => {
    const noon = DAY + DAY_MS + 12 * HOUR_MS;
    expect(completeCandles(candles, DAY_MS, noon).map((c) => c.start)).toEqual([DAY]);
  });

  it('keeps a candle from the moment it closes', () => {
    expect(completeCandles(candles, DAY_MS, DAY + 2 * DAY_MS)).toHaveLength(2);
    expect(completeCandles(candles, DAY_MS, DAY + 2 * DAY_MS - 1)).toHaveLength(1);
  });
});

describe('parseFunding', () => {
  it('reads rate and settlement time, oldest first, keeping the sign', () => {
    const points = parseFunding([
      { symbol: 'BTCUSDT', fundingRate: '-0.00002', fundingRateTimestamp: String(DAY + 8 * HOUR_MS) },
      { symbol: 'BTCUSDT', fundingRate: '0.0001', fundingRateTimestamp: String(DAY) },
    ]);
    expect(points).toEqual([
      { time: DAY, rate: 0.0001 },
      { time: DAY + 8 * HOUR_MS, rate: -0.00002 },
    ]);
  });

  it('refuses empty and malformed input', () => {
    expect(() => parseFunding([])).toThrow(/empty/);
    expect(() => parseFunding([{ fundingRate: '', fundingRateTimestamp: String(DAY) }])).toThrow(/not a number/);
    expect(() => parseFunding([{ fundingRate: '0.0001' }])).toThrow(/not a number/);
    expect(() => parseFunding(['x'])).toThrow(/not an object/);
  });
});

describe('parseOpenInterest', () => {
  it('reads value and time, oldest first', () => {
    const readings = parseOpenInterest([
      { openInterest: '68965.20699999', timestamp: String(DAY + DAY_MS) },
      { openInterest: '69754.333', timestamp: String(DAY) },
    ]);
    expect(readings).toEqual([
      { time: DAY, value: 69754.333 },
      { time: DAY + DAY_MS, value: 68965.20699999 },
    ]);
  });

  it('refuses empty, zero and malformed input', () => {
    expect(() => parseOpenInterest([])).toThrow(/empty/);
    expect(() => parseOpenInterest([{ openInterest: '0', timestamp: String(DAY) }])).toThrow(/above zero/);
    expect(() => parseOpenInterest([{ openInterest: null, timestamp: String(DAY) }])).toThrow(/not a number/);
  });
});

describe('parseRatio', () => {
  it('reads the long and short shares', () => {
    expect(parseRatio([{ symbol: 'BTCUSDT', buyRatio: '0.7289', sellRatio: '0.2711', timestamp: String(DAY) }])).toEqual([
      { time: DAY, buyRatio: 0.7289, sellRatio: 0.2711 },
    ]);
  });

  it('refuses shares that do not add up to 1', () => {
    expect(() => parseRatio([{ buyRatio: '0.7', sellRatio: '0.7', timestamp: String(DAY) }])).toThrow(/add up to 1/);
    expect(() => parseRatio([])).toThrow(/empty/);
  });
});

describe('parseTierOne', () => {
  const tiers = [
    { id: 2, symbol: 'BTCUSDT', riskLimitValue: '2000000', maintenanceMargin: '0.005', maxLeverage: '100.00' },
    { id: 1, symbol: 'BTCUSDT', riskLimitValue: '300000', maintenanceMargin: '0.0033', maxLeverage: '150.00' },
    { id: 9, symbol: 'ETHUSDT', riskLimitValue: '1000', maintenanceMargin: '0.02', maxLeverage: '25.00' },
  ];

  it('picks the tier with the lowest position-value bound for the symbol', () => {
    expect(parseTierOne(tiers, 'BTCUSDT')).toEqual({ riskLimitValue: 300000, maintenanceMargin: 0.0033, maxLeverage: 150 });
    expect(parseTierOne(tiers, 'ETHUSDT').maintenanceMargin).toBe(0.02);
  });

  it('refuses a response without that symbol', () => {
    expect(() => parseTierOne(tiers, 'SOLUSDT')).toThrow(/no tier for SOLUSDT/);
    expect(() => parseTierOne([], 'BTCUSDT')).toThrow(/empty/);
  });
});

describe('parseTicker and parseInstrument', () => {
  const ticker = {
    symbol: 'BTCUSDT',
    lastPrice: '64147.00',
    markPrice: '64147.10',
    fundingRate: '0.00004038',
    nextFundingTime: '1795017600000',
    fundingIntervalHour: '8',
    openInterest: '69920.408',
    openInterestValue: '4485191404.02',
  };

  it('reads the ticker row of the symbol', () => {
    expect(parseTicker([ticker], 'BTCUSDT')).toEqual({
      lastPrice: 64147,
      markPrice: 64147.1,
      fundingRate: 0.00004038,
      nextFundingTime: 1795017600000,
      fundingIntervalHours: 8,
      openInterest: 69920.408,
      openInterestValue: 4485191404.02,
    });
  });

  it('refuses a missing symbol or field', () => {
    expect(() => parseTicker([ticker], 'ETHUSDT')).toThrow(/no row for ETHUSDT/);
    expect(() => parseTicker([{ ...ticker, lastPrice: '' }], 'BTCUSDT')).toThrow(/lastPrice/);
  });

  it('reads tick size and base coin', () => {
    const info = [{ symbol: 'SOLUSDT', baseCoin: 'SOL', priceFilter: { tickSize: '0.010' } }];
    expect(parseInstrument(info, 'SOLUSDT')).toEqual({ baseCoin: 'SOL', tickSize: 0.01 });
    expect(() => parseInstrument(info, 'BTCUSDT')).toThrow(/no row for BTCUSDT/);
    expect(() => parseInstrument([{ symbol: 'SOLUSDT', baseCoin: 'SOL' }], 'SOLUSDT')).toThrow(/priceFilter/);
  });
});
