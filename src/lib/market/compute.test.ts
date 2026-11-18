// Hand-built candles with round numbers, so every expected value can be
// checked on paper. MMR 0.5% and a 100x cap unless a test says otherwise.
import { describe, expect, it } from 'vitest';
import {
  DAY_MS,
  HOUR_MS,
  LEVERAGES,
  adverseMoves,
  changeOverWeek,
  fundingByDay,
  fundingStats,
  highestSurviving,
  liquidationHour,
  longShortRatio,
  lowestLiquidated,
  offeredLeverages,
  ratioStats,
  reaches,
  roomAt,
  survivalHistory,
  survivalTable,
  utcDate,
  utcDayStart,
} from './compute';
import type { Candle } from './compute';

const DAY = Date.UTC(2026, 0, 10); // 2026-01-10 00:00 UTC
const RISK = { mmr: 0.005, maxLeverage: 100 };

const candle = (start: number, open: number, high: number, low: number, close: number): Candle => ({
  start,
  open,
  high,
  low,
  close,
});

// The day: opens at 100, trades between 96 and 103, closes at 101.
const day = candle(DAY, 100, 103, 96, 101);

// Its 24 hours. Flat hours stay within 99.6 to 100.4 (0.4% either way).
function hours(overrides: Record<number, { high?: number; low?: number }>): Candle[] {
  return Array.from({ length: 24 }, (_, h) => {
    const o = overrides[h] ?? {};
    return candle(DAY + h * HOUR_MS, 100, o.high ?? 100.4, o.low ?? 99.6, 100);
  });
}
const hourly = hours({
  1: { high: 100.6 }, // +0.6%: reaches the 100x room of 0.5%
  3: { low: 99.4 }, // -0.6%: reaches the 100x room
  9: { low: 98.5 }, // -1.5%: exactly the 50x room
  12: { high: 101.5 }, // +1.5%: exactly the 50x room
  14: { high: 103 },
  20: { low: 96 },
});

describe('dates', () => {
  it('converts between UTC dates and timestamps', () => {
    expect(utcDate(DAY)).toBe('2026-01-10');
    expect(utcDate(DAY + DAY_MS - 1)).toBe('2026-01-10');
    expect(utcDayStart('2026-01-10')).toBe(DAY);
  });
});

describe('adverseMoves', () => {
  it('measures both sides from the open', () => {
    const moves = adverseMoves(day);
    expect(moves.long).toBeCloseTo(0.04, 12); // (100 - 96) / 100
    expect(moves.short).toBeCloseTo(0.03, 12); // (103 - 100) / 100
  });

  it('is zero on the side price never went', () => {
    expect(adverseMoves(candle(DAY, 100, 105, 100, 104)).long).toBe(0);
    expect(adverseMoves(candle(DAY, 100, 100, 95, 96)).short).toBe(0);
  });

  it('uses the open, not the close or the previous day', () => {
    const moves = adverseMoves(candle(DAY, 200, 210, 190, 195));
    expect(moves.long).toBeCloseTo(0.05, 12);
    expect(moves.short).toBeCloseTo(0.05, 12);
  });
});

describe('roomAt and offeredLeverages', () => {
  it('is 1 / leverage minus the maintenance margin rate', () => {
    expect(roomAt(2, 0.005)).toBeCloseTo(0.495, 12);
    expect(roomAt(20, 0.005)).toBeCloseTo(0.045, 12);
    expect(roomAt(100, 0.005)).toBeCloseTo(0.005, 12);
    expect(roomAt(20, 0.0033)).toBeCloseTo(0.0467, 12);
  });

  it('lists 2x to 100x by default', () => {
    expect(LEVERAGES).toEqual([2, 5, 10, 20, 50, 100]);
    expect(offeredLeverages(RISK)).toEqual([2, 5, 10, 20, 50, 100]);
  });

  it('skips leverage above the symbol cap', () => {
    expect(offeredLeverages({ mmr: 0.005, maxLeverage: 50 })).toEqual([2, 5, 10, 20, 50]);
    expect(offeredLeverages({ mmr: 0.005, maxLeverage: 25 })).toEqual([2, 5, 10, 20]);
  });

  it('skips leverage that leaves no room at all', () => {
    // At 100x the initial margin is 1%; a 1% maintenance margin leaves nothing.
    expect(offeredLeverages({ mmr: 0.01, maxLeverage: 100 })).toEqual([2, 5, 10, 20, 50]);
  });
});

describe('reaches', () => {
  it('counts a move that lands exactly on the room', () => {
    // 1/20 - 0.005 is 0.045000000000000005 in binary; 4.5% must still reach it.
    expect(reaches(0.045, roomAt(20, 0.005))).toBe(true);
    expect(reaches(0.0449, roomAt(20, 0.005))).toBe(false);
    expect(reaches(0.0451, roomAt(20, 0.005))).toBe(true);
  });
});

describe('liquidationHour', () => {
  it('returns the first hour that reaches the room, long side', () => {
    expect(liquidationHour('long', 100, 0.005, hourly)).toBe(3);
    expect(liquidationHour('long', 100, 0.015, hourly)).toBe(9);
    expect(liquidationHour('long', 100, 0.04, hourly)).toBe(20);
  });

  it('returns the first hour that reaches the room, short side', () => {
    expect(liquidationHour('short', 100, 0.005, hourly)).toBe(1);
    expect(liquidationHour('short', 100, 0.015, hourly)).toBe(12);
    expect(liquidationHour('short', 100, 0.03, hourly)).toBe(14);
  });

  it('returns null when no hour reaches it', () => {
    expect(liquidationHour('long', 100, 0.045, hourly)).toBeNull();
    expect(liquidationHour('short', 100, 0.045, hourly)).toBeNull();
  });

  it('does not depend on the order of the candles', () => {
    expect(liquidationHour('long', 100, 0.005, [...hourly].reverse())).toBe(3);
  });

  it('measures from the daily open, not from the hour open', () => {
    // An hour that opens at 98 and dips to 97.9 is 2.1% below an entry of 100.
    const late = [candle(DAY + 5 * HOUR_MS, 98, 98.2, 97.9, 98)];
    expect(liquidationHour('long', 100, 0.02, late)).toBe(5);
  });
});

describe('survivalTable', () => {
  const table = survivalTable(day, hourly, RISK);

  it('has one row per offered leverage with its room', () => {
    expect(table.map((row) => row.leverage)).toEqual([2, 5, 10, 20, 50, 100]);
    expect(table.map((row) => Number(row.room.toFixed(6)))).toEqual([0.495, 0.195, 0.095, 0.045, 0.015, 0.005]);
  });

  it('liquidates a long when the drop from the open reaches the room', () => {
    // Drop is 4%. 20x has 4.5% of room and survives; 50x has 1.5% and does not.
    expect(table.map((row) => row.long.liquidated)).toEqual([false, false, false, false, true, true]);
    expect(table.map((row) => row.long.hourUtc)).toEqual([null, null, null, null, 9, 3]);
  });

  it('liquidates a short when the rise from the open reaches the room', () => {
    // Rise is 3%.
    expect(table.map((row) => row.short.liquidated)).toEqual([false, false, false, false, true, true]);
    expect(table.map((row) => row.short.hourUtc)).toEqual([null, null, null, null, 12, 1]);
  });

  it('liquidates on a move exactly equal to the room', () => {
    // Low 95.5 is a 4.5% drop; 20x with 0.5% MMR has exactly 4.5% of room.
    const exact = survivalTable(candle(DAY, 100, 100.2, 95.5, 96), [], RISK);
    expect(exact.find((row) => row.leverage === 20)?.long.liquidated).toBe(true);
    expect(exact.find((row) => row.leverage === 10)?.long.liquidated).toBe(false);
  });

  it('uses the maintenance margin rate it is given', () => {
    // Drop of 4.6%: with MMR 0.33% a 20x long has 4.67% of room and survives;
    // with MMR 0.5% it has 4.5% and is liquidated.
    const d = candle(DAY, 100, 100.2, 95.4, 96);
    const at = (mmr: number) => survivalTable(d, [], { mmr, maxLeverage: 100 }).find((row) => row.leverage === 20);
    expect(at(0.0033)?.long.liquidated).toBe(false);
    expect(at(0.005)?.long.liquidated).toBe(true);
  });

  it('leaves out leverage above the cap', () => {
    expect(survivalTable(day, hourly, { mmr: 0.005, maxLeverage: 50 }).map((row) => row.leverage)).toEqual([2, 5, 10, 20, 50]);
  });

  it('reports a liquidation without an hour when there are no hourly candles', () => {
    const noHours = survivalTable(day, [], RISK);
    expect(noHours[5].long).toEqual({ liquidated: true, hourUtc: null });
  });
});

describe('highestSurviving and lowestLiquidated', () => {
  // Long side goes at 50x, short side already at 20x.
  const d = candle(DAY, 100, 104.6, 98, 99);
  const table = survivalTable(d, [], RISK);

  it('finds the split on each side', () => {
    expect(highestSurviving(table, 'long')).toBe(20);
    expect(highestSurviving(table, 'short')).toBe(10);
    expect(highestSurviving(table, 'both')).toBe(10);
    expect(lowestLiquidated(table, 'long')?.leverage).toBe(50);
    expect(lowestLiquidated(table, 'short')?.leverage).toBe(20);
  });

  it('returns null at the ends', () => {
    const calm = survivalTable(candle(DAY, 100, 100.1, 99.9, 100), [], RISK);
    expect(lowestLiquidated(calm, 'long')).toBeNull();
    expect(highestSurviving(calm, 'both')).toBe(100);
    const crash = survivalTable(candle(DAY, 100, 100, 50, 60), [], RISK);
    expect(highestSurviving(crash, 'long')).toBeNull();
    expect(highestSurviving(crash, 'short')).toBe(100);
  });
});

describe('survivalHistory', () => {
  // Four days, all opening at 100:
  //   day 0  low 99.6  high 100.4   -0.4% / +0.4%   nothing is liquidated
  //   day 1  low 99    high 100.2   -1.0%           100x long
  //   day 2  low 98    high 101.6   -2.0% / +1.6%   100x and 50x, both sides
  //   day 3  low 95    high 100.6   -5.0% / +0.6%   long 100x, 50x, 20x; short 100x
  const days = [
    candle(DAY, 100, 100.4, 99.6, 100),
    candle(DAY + DAY_MS, 100, 100.2, 99, 100),
    candle(DAY + 2 * DAY_MS, 100, 101.6, 98, 100),
    candle(DAY + 3 * DAY_MS, 100, 100.6, 95, 96),
  ];
  const history = survivalHistory(days, RISK);
  const row = (leverage: number) => history.rows.find((r) => r.leverage === leverage)!;

  it('counts the days', () => {
    expect(history.days).toBe(4);
    expect(history.rows.map((r) => r.leverage)).toEqual([2, 5, 10, 20, 50, 100]);
  });

  it('counts long liquidations per leverage', () => {
    expect(row(100).long).toEqual({ days: 3, share: 0.75 });
    expect(row(50).long).toEqual({ days: 2, share: 0.5 });
    expect(row(20).long).toEqual({ days: 1, share: 0.25 });
    expect(row(10).long).toEqual({ days: 0, share: 0 });
  });

  it('counts short liquidations per leverage', () => {
    expect(row(100).short).toEqual({ days: 2, share: 0.5 });
    expect(row(50).short).toEqual({ days: 1, share: 0.25 });
    expect(row(20).short).toEqual({ days: 0, share: 0 });
  });

  it('handles an empty run', () => {
    expect(survivalHistory([], RISK).rows[0].long).toEqual({ days: 0, share: 0 });
  });
});

describe('fundingStats', () => {
  const END = DAY + DAY_MS; // the report day is 2026-01-10
  // Three settlements a day (00:00, 08:00, 16:00) for the 10 days before END.
  const every8h = (rate: (index: number) => number) =>
    Array.from({ length: 30 }, (_, i) => ({ time: END - (30 - i) * 8 * HOUR_MS, rate: rate(i) }));

  it('averages the 21 settlements of the last seven days', () => {
    const stats = fundingStats(every8h(() => 0.0001), END, 1000);
    expect(stats.settlements7d).toBe(21);
    expect(stats.sum7d).toBeCloseTo(0.0021, 12);
    expect(stats.average7d).toBeCloseTo(0.0001, 12);
    // 0.01% three times a day on 1,000 USDT is 0.30 USDT a day, 9 USDT in 30 days.
    expect(stats.costPerDay).toBeCloseTo(0.3, 10);
    expect(stats.costPer30Days).toBeCloseTo(9, 10);
    expect(stats.notional).toBe(1000);
  });

  it('takes the last settlement before the end of the day as the latest', () => {
    const points = every8h((i) => i / 1e6);
    const stats = fundingStats(points, END, 1000);
    expect(stats.latest).toEqual({ time: END - 8 * HOUR_MS, rate: 29 / 1e6 });
  });

  it('ignores settlements stamped at or after the end of the day', () => {
    const points = [...every8h(() => 0.0001), { time: END, rate: 0.05 }, { time: END + 8 * HOUR_MS, rate: 0.05 }];
    const stats = fundingStats(points, END, 1000);
    expect(stats.settlements7d).toBe(21);
    expect(stats.latest.time).toBe(END - 8 * HOUR_MS);
    expect(stats.average7d).toBeCloseTo(0.0001, 12);
  });

  it('ignores settlements older than seven days', () => {
    // Old settlements are 1%, the last seven days are 0.01%.
    const stats = fundingStats(every8h((i) => (i < 9 ? 0.01 : 0.0001)), END, 1000);
    expect(stats.average7d).toBeCloseTo(0.0001, 12);
  });

  it('keeps the sign: a negative rate means the long is paid', () => {
    const stats = fundingStats(every8h(() => -0.0002), END, 1000);
    expect(stats.costPerDay).toBeCloseTo(-0.6, 10);
    expect(stats.costPer30Days).toBeCloseTo(-18, 10);
  });

  it('follows the settlements, not an assumed interval', () => {
    // Hourly funding of 0.001% for seven days: 168 settlements.
    const hourlyPoints = Array.from({ length: 168 }, (_, i) => ({ time: END - (168 - i) * HOUR_MS, rate: 0.00001 }));
    const stats = fundingStats(hourlyPoints, END, 1000);
    expect(stats.settlements7d).toBe(168);
    expect(stats.costPerDay).toBeCloseTo(0.24, 10); // 24 x 0.001% x 1,000
  });

  it('throws when the seven days hold no settlement', () => {
    expect(() => fundingStats([{ time: END - 9 * DAY_MS, rate: 0.0001 }], END, 1000)).toThrow(/no funding settlement/);
    expect(() => fundingStats([], END, 1000)).toThrow();
  });
});

describe('fundingByDay', () => {
  const END = DAY + DAY_MS;
  it('adds up each UTC day, oldest first', () => {
    const points = [
      { time: DAY - DAY_MS, rate: 0.0001 },
      { time: DAY - DAY_MS + 8 * HOUR_MS, rate: 0.0002 },
      { time: DAY - DAY_MS + 16 * HOUR_MS, rate: -0.0001 },
      { time: DAY, rate: 0.0003 },
      { time: DAY + 8 * HOUR_MS, rate: 0.0003 },
      { time: END, rate: 0.9 }, // next day: not counted
    ];
    const days = fundingByDay(points, END, 3);
    expect(days.map((d) => d.date)).toEqual(['2026-01-08', '2026-01-09', '2026-01-10']);
    expect(days.map((d) => d.settlements)).toEqual([0, 3, 2]);
    expect(days[1].sum).toBeCloseTo(0.0002, 12);
    expect(days[2].sum).toBeCloseTo(0.0006, 12);
  });
});

describe('changeOverWeek', () => {
  const AT = DAY + DAY_MS;
  const readings = Array.from({ length: 8 }, (_, i) => ({ time: AT - (7 - i) * DAY_MS, value: 1000 + i * 50 }));

  it('compares the reading at the day end with the one seven days earlier', () => {
    const stats = changeOverWeek(readings, AT);
    expect(stats.latest).toEqual({ time: AT, value: 1350 });
    expect(stats.weekAgo).toEqual({ time: AT - 7 * DAY_MS, value: 1000 });
    expect(stats.change7d).toBeCloseTo(0.35, 12);
  });

  it('gives a negative change when the value fell', () => {
    const falling = [
      { time: AT - 7 * DAY_MS, value: 200 },
      { time: AT, value: 150 },
    ];
    expect(changeOverWeek(falling, AT).change7d).toBeCloseTo(-0.25, 12);
  });

  it('throws when either reading is missing', () => {
    expect(() => changeOverWeek(readings.slice(1), AT)).toThrow(/no reading stamped/);
    expect(() => changeOverWeek(readings.slice(0, 7), AT)).toThrow(/no reading stamped/);
    expect(() => changeOverWeek([], AT)).toThrow();
  });
});

describe('ratioStats', () => {
  const AT = DAY + DAY_MS;
  const points = [
    { time: AT - 7 * DAY_MS, buyRatio: 0.6, sellRatio: 0.4 },
    { time: AT - DAY_MS, buyRatio: 0.9, sellRatio: 0.1 },
    { time: AT, buyRatio: 0.75, sellRatio: 0.25 },
  ];

  it('divides long accounts by short accounts', () => {
    expect(longShortRatio({ buyRatio: 0.75, sellRatio: 0.25 })).toBeCloseTo(3, 12);
  });

  it('reports the latest reading and the change over seven days', () => {
    const stats = ratioStats(points, AT);
    expect(stats.latest.longShort).toBeCloseTo(3, 12);
    expect(stats.weekAgo.longShort).toBeCloseTo(1.5, 12);
    expect(stats.longShareChange7d).toBeCloseTo(0.15, 12); // 60% -> 75%: 15 points
    expect(stats.longShortChange7d).toBeCloseTo(1.5, 12);
  });

  it('throws when a reading is missing', () => {
    expect(() => ratioStats(points.slice(1), AT)).toThrow(/no long\/short reading/);
    expect(() => ratioStats(points.slice(0, 2), AT)).toThrow(/no long\/short reading/);
  });
});
