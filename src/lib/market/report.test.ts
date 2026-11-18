// buildReport() on a synthetic, hand-checkable market: 120 days that all open
// at 100, and a report day that trades between 96 and 103.
import { describe, expect, it } from 'vitest';
import { DAY_MS, HOUR_MS } from './compute';
import type { Candle } from './compute';
import { buildReport } from './report';
import type { ReportInput } from './report';

const REPORT_DAY = Date.UTC(2026, 0, 10);
const DAY_END = REPORT_DAY + DAY_MS;

function input(change: Partial<ReportInput> = {}): ReportInput {
  // 119 quiet days (range 99.8 to 100.2), then the report day.
  const daily: Candle[] = Array.from({ length: 120 }, (_, i) => ({
    start: REPORT_DAY - (119 - i) * DAY_MS,
    open: 100,
    high: 100.2,
    low: 99.8,
    close: 100,
  }));
  daily[119] = { start: REPORT_DAY, open: 100, high: 103, low: 96, close: 101 };
  // Ten days ago: a 2% drop, which takes out 50x and 100x longs.
  daily[109] = { ...daily[109], low: 98 };

  const hourly: Candle[] = Array.from({ length: 24 }, (_, h) => ({
    start: REPORT_DAY + h * HOUR_MS,
    open: 100,
    high: h === 14 ? 103 : h === 1 ? 100.6 : 100.4,
    low: h === 20 ? 96 : h === 9 ? 98.5 : h === 3 ? 99.4 : 99.6,
    close: 100,
  }));

  // 40 days of funding at 0.01% every eight hours.
  const funding = Array.from({ length: 120 }, (_, i) => ({ time: DAY_END - (120 - i) * 8 * HOUR_MS, rate: 0.0001 }));
  // 31 daily readings ending at the close of the report day.
  const openInterest = Array.from({ length: 31 }, (_, i) => ({ time: DAY_END - (30 - i) * DAY_MS, value: 1000 + i * 10 }));
  const ratio = Array.from({ length: 31 }, (_, i) => ({ time: DAY_END - (30 - i) * DAY_MS, buyRatio: 0.6, sellRatio: 0.4 }));
  ratio[30] = { time: DAY_END, buyRatio: 0.75, sellRatio: 0.25 };

  return {
    symbol: 'TESTUSDT',
    fetchedAt: '2026-01-11T00:20:05.000Z',
    serverTime: DAY_END + 20 * 60 * 1000,
    endpoints: { dailyKlines: 'https://api.bybit.com/v5/market/kline?example' },
    instrument: { baseCoin: 'TEST', tickSize: 0.1 },
    tierOne: { riskLimitValue: 50000, maintenanceMargin: 0.005, maxLeverage: 100 },
    ticker: {
      lastPrice: 100.5,
      markPrice: 100.4,
      fundingRate: 0.00007,
      nextFundingTime: DAY_END + 8 * HOUR_MS,
      fundingIntervalHours: 8,
      openInterest: 1310,
      openInterestValue: 131000,
    },
    daily,
    hourly,
    funding,
    openInterest,
    ratio,
    ...change,
  };
}

describe('buildReport', () => {
  const report = buildReport(input());

  it('reports on the last complete day and keeps the provenance', () => {
    expect(report.reportDate).toBe('2026-01-10');
    expect(report.symbol).toBe('TESTUSDT');
    expect(report.fetchedAt).toBe('2026-01-11T00:20:05.000Z');
    expect(report.endpoints.dailyKlines).toContain('api.bybit.com');
    expect(report.instrument.tierOne.maintenanceMargin).toBe(0.005);
  });

  it('measures the adverse moves of the day', () => {
    expect(report.day).toMatchObject({ date: '2026-01-10', open: 100, high: 103, low: 96, close: 101 });
    expect(report.day.adverseLong).toBeCloseTo(0.04, 12);
    expect(report.day.adverseShort).toBeCloseTo(0.03, 12);
  });

  it('builds the survival table with liquidation hours', () => {
    expect(report.survival.map((r) => [r.leverage, r.long.liquidated, r.long.hourUtc, r.short.liquidated, r.short.hourUtc])).toEqual([
      [2, false, null, false, null],
      [5, false, null, false, null],
      [10, false, null, false, null],
      [20, false, null, false, null],
      [50, true, 9, true, 14],
      [100, true, 3, true, 1],
    ]);
  });

  it('counts the last 90 days', () => {
    expect(report.survival90.days).toBe(90);
    expect(report.survival90.from).toBe('2025-10-13');
    expect(report.survival90.to).toBe('2026-01-10');
    const at = (leverage: number) => report.survival90.rows.find((r) => r.leverage === leverage)!;
    // The report day and the 2% drop ten days earlier.
    expect(at(100).long.days).toBe(2);
    expect(at(50).long.days).toBe(2);
    expect(at(20).long.days).toBe(0);
    expect(at(100).short.days).toBe(1);
    expect(at(100).long.share).toBeCloseTo(2 / 90, 12);
    expect(report.history.daily).toHaveLength(90);
    expect(report.history.daily[89].date).toBe('2026-01-10');
  });

  it('computes funding from settlements before the end of the day', () => {
    expect(report.funding.latest).toEqual({ time: '2026-01-10T16:00:00.000Z', rate: 0.0001 });
    expect(report.funding.settlements7d).toBe(21);
    expect(report.funding.average7d).toBeCloseTo(0.0001, 12);
    expect(report.funding.costPerDay).toBeCloseTo(0.3, 10);
    expect(report.funding.costPer30Days).toBeCloseTo(9, 10);
    expect(report.history.funding).toHaveLength(30);
    expect(report.history.funding[29]).toMatchObject({ date: '2026-01-10', settlements: 3 });
  });

  it('reads open interest and the ratio at the close of the day', () => {
    expect(report.openInterest.latest).toEqual({ time: '2026-01-11T00:00:00.000Z', value: 1300 });
    expect(report.openInterest.weekAgo.value).toBe(1230);
    expect(report.openInterest.change7d).toBeCloseTo(70 / 1230, 12);
    expect(report.openInterest.unit).toBe('TEST');
    expect(report.ratio.latest.longShort).toBeCloseTo(3, 12);
    expect(report.ratio.longShareChange7d).toBeCloseTo(0.15, 12);
    expect(report.history.openInterest).toHaveLength(30);
    expect(report.history.ratio).toHaveLength(30);
  });

  it('keeps the live values apart from the report day', () => {
    expect(report.atFetch).toMatchObject({ lastPrice: 100.5, fundingRate: 0.00007, openInterest: 1310 });
    expect(report.atFetch.time).toBe('2026-01-11T00:20:00.000Z');
    expect(report.atFetch.nextFundingTime).toBe('2026-01-11T08:00:00.000Z');
  });

  it('gives the same report whenever it is run on the following day', () => {
    const later = buildReport(input({ serverTime: DAY_END + 13 * HOUR_MS, fetchedAt: '2026-01-11T13:00:00.000Z' }));
    const strip = ({ fetchedAt, atFetch, ...rest }: typeof report) => rest;
    expect(strip(later)).toEqual(strip(report));
  });

  it('skips leverage above the symbol cap', () => {
    const capped = buildReport(input({ tierOne: { riskLimitValue: 50000, maintenanceMargin: 0.005, maxLeverage: 50 } }));
    expect(capped.survival.map((r) => r.leverage)).toEqual([2, 5, 10, 20, 50]);
    expect(capped.survival90.rows.map((r) => r.leverage)).toEqual([2, 5, 10, 20, 50]);
  });
});

describe('buildReport refuses bad input', () => {
  const base = input();

  it('too few daily candles', () => {
    expect(() => buildReport(input({ daily: base.daily.slice(1) }))).toThrow(/need 120 complete daily candles/);
  });

  it('a last daily candle that is still forming, or stale', () => {
    expect(() => buildReport(input({ serverTime: DAY_END - 1 }))).toThrow(/not complete/);
    expect(() => buildReport(input({ serverTime: DAY_END + DAY_MS }))).toThrow(/older than yesterday/);
  });

  it('hourly candles that are missing or from another day', () => {
    expect(() => buildReport(input({ hourly: base.hourly.slice(0, 23) }))).toThrow(/need 24 hourly candles/);
    const shifted = base.hourly.map((c) => ({ ...c, start: c.start - DAY_MS }));
    expect(() => buildReport(input({ hourly: shifted }))).toThrow(/is not hour 0 of the report day/);
  });

  it('hourly candles that disagree with the daily candle', () => {
    const lower = base.hourly.map((c, h) => (h === 20 ? { ...c, low: 97 } : c));
    expect(() => buildReport(input({ hourly: lower }))).toThrow(/do not add up/);
    const open = base.hourly.map((c, h) => (h === 0 ? { ...c, open: 100.3 } : c));
    expect(() => buildReport(input({ hourly: open }))).toThrow(/first hourly open/);
  });

  it('funding that stops early or starts late', () => {
    const stale = base.funding.filter((p) => p.time < DAY_END - DAY_MS);
    expect(() => buildReport(input({ funding: stale }))).toThrow(/no funding settlement on the report day/);
    const short = base.funding.filter((p) => p.time >= DAY_END - 10 * DAY_MS);
    expect(() => buildReport(input({ funding: short }))).toThrow(/does not reach back 30 days/);
    const hole = base.funding.filter((p) => p.time < DAY_END - 15 * DAY_MS || p.time >= DAY_END - 14 * DAY_MS);
    expect(() => buildReport(input({ funding: hole }))).toThrow(/has no settlement/);
  });

  it('open interest or ratio without the two readings it needs', () => {
    expect(() => buildReport(input({ openInterest: base.openInterest.slice(0, 30) }))).toThrow(/no reading stamped/);
    const noWeekAgo = base.openInterest.filter((r) => r.time !== DAY_END - 7 * DAY_MS);
    expect(() => buildReport(input({ openInterest: noWeekAgo }))).toThrow(/no reading stamped/);
    expect(() => buildReport(input({ ratio: base.ratio.slice(0, 30) }))).toThrow(/no long\/short reading/);
  });

  it('a symbol that offers none of the leverage values', () => {
    const none = { riskLimitValue: 1000, maintenanceMargin: 0.005, maxLeverage: 1 };
    expect(() => buildReport(input({ tierOne: none }))).toThrow(/no leverage in the table/);
  });
});
