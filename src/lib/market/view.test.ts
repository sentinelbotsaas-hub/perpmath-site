import { describe, expect, it } from 'vitest';
import { survivalTable } from './compute';
import type { Candle } from './compute';
import {
  COINS,
  beforeCjk,
  calculatorQuery,
  hourLabel,
  plainNumber,
  ratePercent,
  signedNumber,
  signedPercent,
  signedPoints,
  summarizeSide,
  utcDay,
  utcMinute,
} from './view';

const DAY = Date.UTC(2026, 0, 10);
const HOUR = 3_600_000;
const RISK = { mmr: 0.005, maxLeverage: 100 };
const day = (high: number, low: number): Candle => ({ start: DAY, open: 100, high, low, close: 100 });
// One hourly candle that carries the whole range, at 14:00.
const at14 = (high: number, low: number): Candle[] => [{ start: DAY + 14 * HOUR, open: 100, high, low, close: 100 }];

describe('summarizeSide', () => {
  it('says "all survived" when nothing was liquidated', () => {
    const rows = survivalTable(day(100.2, 99.8), at14(100.2, 99.8), RISK);
    expect(summarizeSide(rows, 'long')).toEqual({ kind: 'allSurvived', min: 2, max: 100 });
    expect(summarizeSide(rows, 'short')).toEqual({ kind: 'allSurvived', min: 2, max: 100 });
  });

  it('names the highest survivor and the lowest casualty with its hour', () => {
    // Drop of 2%: 20x survives, 50x goes. Rise of 5%: 10x survives, 20x goes.
    const rows = survivalTable(day(105, 98), at14(105, 98), RISK);
    expect(summarizeSide(rows, 'long')).toEqual({ kind: 'mixed', safe: 20, dead: 50, hourUtc: 14 });
    expect(summarizeSide(rows, 'short')).toEqual({ kind: 'mixed', safe: 10, dead: 20, hourUtc: 14 });
  });

  it('says "all liquidated" when even the lowest leverage went', () => {
    const rows = survivalTable(day(100, 50), at14(100, 50), RISK);
    expect(summarizeSide(rows, 'long')).toEqual({ kind: 'allLiquidated', min: 2, max: 100, hourUtc: 14 });
    expect(summarizeSide(rows, 'short')).toEqual({ kind: 'allSurvived', min: 2, max: 100 });
  });

  it('refuses a table without hours, or an empty one', () => {
    expect(() => summarizeSide(survivalTable(day(100, 98), [], RISK), 'long')).toThrow(/no liquidation hour/);
    expect(() => summarizeSide([], 'long')).toThrow(/empty/);
  });
});

describe('formatting', () => {
  it('writes hours and timestamps in UTC', () => {
    expect(hourLabel(2)).toBe('02:00');
    expect(hourLabel(14)).toBe('14:00');
    expect(utcMinute('2026-11-18T12:11:03.262Z')).toBe('2026-11-18 12:11');
    expect(utcDay('2026-11-18T00:00:00.000Z')).toBe('2026-11-18');
  });

  it('uses a real minus sign and an explicit plus for changes', () => {
    expect(signedNumber(1234.5)).toBe('+1,234.50');
    expect(signedNumber(-3)).toBe('−3.00');
    expect(signedNumber(0)).toBe('0.00');
    expect(signedNumber(-0.001)).toBe('0.00');
    expect(signedPercent(0.0195)).toBe('+1.95%');
    expect(signedPercent(-0.00724712)).toBe('−0.72%');
    expect(signedPoints(0.0195)).toBe('+1.95');
  });

  it('writes values without a plus', () => {
    expect(plainNumber(0.12712)).toBe('0.13');
    expect(plainNumber(-0.6)).toBe('−0.60');
    expect(ratePercent(0.00004982)).toBe('0.0050%');
    expect(ratePercent(-0.0001)).toBe('−0.0100%');
    expect(ratePercent(0)).toBe('0.0000%');
  });
});

describe('beforeCjk', () => {
  it('adds a space after a Latin name only', () => {
    expect(beforeCjk('Solana') + '每日報告').toBe('Solana 每日報告');
    expect(beforeCjk('比特幣') + '每日報告').toBe('比特幣每日報告');
  });
});

describe('calculatorQuery', () => {
  it('uses the parameter names the calculator reads, with the rate in percent', () => {
    expect(calculatorQuery({ side: 'long', entry: 64919.9, leverage: 20, mmr: 0.0033 })).toBe(
      '?side=long&entry=64919.9&lev=20&mmr=0.33',
    );
    expect(calculatorQuery({ side: 'short', entry: 71.52, leverage: 10, mmr: 0.005 })).toBe(
      '?side=short&entry=71.52&lev=10&mmr=0.5',
    );
  });
});

describe('COINS', () => {
  it('lists the three contracts in page order', () => {
    expect(COINS.map((c) => `${c.coin}:${c.symbol}`)).toEqual(['btc:BTCUSDT', 'eth:ETHUSDT', 'sol:SOLUSDT']);
  });
});
