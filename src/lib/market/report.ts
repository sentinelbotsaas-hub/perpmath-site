// buildReport(): parsed Bybit data in, the JSON document of one symbol out.
// scripts/fetch-market.mjs writes its result to
//   src/data/market/<SYMBOL>/latest.json  and  <SYMBOL>/<reportDate>.json
// and the pages read those files through store.ts.
//
// The report day is the last complete UTC day. Everything in the document
// except `fetchedAt` and `atFetch` is a function of data stamped before the
// end of that day, so running the script twice for the same day gives the
// same report.
//
// Pure. Run by Node directly (see the note in compute.ts).
import {
  DAY_MS,
  FUNDING_NOTIONAL,
  HOUR_MS,
  adverseMoves,
  changeOverWeek,
  fundingByDay,
  fundingStats,
  ratioStats,
  survivalHistory,
  survivalTable,
  utcDate,
} from './compute.ts';
import type { Candle, FundingPoint, HistoryRow, RatioPoint, Reading, SurvivalRow } from './compute.ts';
import type { Instrument, Ticker, TierOne } from './parse.ts';

/** Daily candles the script must hand over. */
export const MIN_DAILY_CANDLES = 120;
/** Days in the long survival statistic. */
export const HISTORY_DAYS = 90;
/** Rows in the history tables of the data pages. */
export const TABLE_DAYS = 30;

export interface ReportInput {
  symbol: string;
  /** ISO 8601, UTC: when the script fetched the data. */
  fetchedAt: string;
  /** Bybit's own clock at fetch time, Unix milliseconds. */
  serverTime: number;
  /** The exact URLs requested. */
  endpoints: Record<string, string>;
  instrument: Instrument;
  tierOne: TierOne;
  ticker: Ticker;
  /** Complete daily candles, oldest first; the last one is the report day. */
  daily: Candle[];
  /** Hourly candles of the report day. */
  hourly: Candle[];
  funding: FundingPoint[];
  openInterest: Reading[];
  ratio: RatioPoint[];
}

export interface DayRow {
  /** UTC date, "2026-11-17". */
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface MarketReport {
  schema: 1;
  symbol: string;
  baseCoin: string;
  category: 'linear';
  /** The last complete UTC day. */
  reportDate: string;
  fetchedAt: string;
  source: string;
  endpoints: Record<string, string>;
  instrument: {
    tickSize: number;
    fundingIntervalHours: number;
    tierOne: TierOne;
  };
  day: DayRow & { adverseLong: number; adverseShort: number };
  hourly: Array<{ hour: number; open: number; high: number; low: number; close: number }>;
  survival: SurvivalRow[];
  survival90: { days: number; from: string; to: string; rows: HistoryRow[] };
  funding: {
    /** Last settlement of the report day. */
    latest: { time: string; rate: number };
    settlements7d: number;
    sum7d: number;
    average7d: number;
    notional: number;
    costPerDay: number;
    costPer30Days: number;
  };
  openInterest: {
    unit: string;
    latest: { time: string; value: number };
    weekAgo: { time: string; value: number };
    change7d: number;
  };
  ratio: {
    latest: { time: string; buyRatio: number; sellRatio: number; longShort: number };
    weekAgo: { time: string; buyRatio: number; sellRatio: number; longShort: number };
    longShareChange7d: number;
    longShortChange7d: number;
  };
  /** Values that were live when the script ran. They are not part of the report day. */
  atFetch: {
    time: string;
    lastPrice: number;
    markPrice: number;
    fundingRate: number;
    nextFundingTime: string;
    openInterest: number;
    openInterestValue: number;
  };
  history: {
    /** The 90 daily candles behind `survival90`, oldest first. */
    daily: DayRow[];
    /** Funding settled per UTC day, 30 days, oldest first. */
    funding: Array<{ date: string; settlements: number; sum: number }>;
    /** Readings stamped 00:00 UTC, up to 30, oldest first. */
    openInterest: Array<{ time: string; value: number }>;
    ratio: Array<{ time: string; buyRatio: number; sellRatio: number }>;
  };
}

const iso = (ms: number) => new Date(ms).toISOString();

export function buildReport(input: ReportInput): MarketReport {
  const { symbol, daily, hourly, tierOne, ticker, instrument } = input;

  // ---- the report day ------------------------------------------------------
  if (daily.length < MIN_DAILY_CANDLES) {
    throw new Error(`need ${MIN_DAILY_CANDLES} complete daily candles, got ${daily.length}`);
  }
  const day = daily[daily.length - 1];
  const dayEnd = day.start + DAY_MS;
  if (dayEnd > input.serverTime) throw new Error('the last daily candle is not complete yet');
  if (input.serverTime - dayEnd >= DAY_MS) throw new Error('the last daily candle is older than yesterday');

  // ---- hourly candles must be that day, all 24, and agree with the daily one
  if (hourly.length !== 24) throw new Error(`need 24 hourly candles for the report day, got ${hourly.length}`);
  hourly.forEach((candle, i) => {
    if (candle.start !== day.start + i * HOUR_MS) throw new Error(`hourly candle ${i} is not hour ${i} of the report day`);
  });
  const tolerance = instrument.tickSize / 2;
  const hourHigh = Math.max(...hourly.map((c) => c.high));
  const hourLow = Math.min(...hourly.map((c) => c.low));
  if (Math.abs(hourHigh - day.high) > tolerance || Math.abs(hourLow - day.low) > tolerance) {
    throw new Error('hourly candles do not add up to the daily high and low');
  }
  if (Math.abs(hourly[0].open - day.open) > tolerance) throw new Error('first hourly open differs from the daily open');

  // ---- survival ------------------------------------------------------------
  const risk = { mmr: tierOne.maintenanceMargin, maxLeverage: tierOne.maxLeverage };
  const survival = survivalTable(day, hourly, risk);
  if (survival.length === 0) throw new Error('no leverage in the table is offered for this symbol');
  for (const row of survival) {
    for (const side of ['long', 'short'] as const) {
      if (row[side].liquidated && row[side].hourUtc === null) {
        throw new Error(`${row.leverage}x ${side} is liquidated on the daily candle but no hourly candle shows it`);
      }
    }
  }
  const last90 = daily.slice(-HISTORY_DAYS);
  const history90 = survivalHistory(last90, risk);
  const moves = adverseMoves(day);

  // ---- funding ---------------------------------------------------------------
  const funding = fundingStats(input.funding, dayEnd, FUNDING_NOTIONAL);
  if (funding.latest.time < dayEnd - DAY_MS) throw new Error('no funding settlement on the report day');
  const oldestFunding = Math.min(...input.funding.map((p) => p.time));
  if (oldestFunding > dayEnd - TABLE_DAYS * DAY_MS) {
    throw new Error(`funding history does not reach back ${TABLE_DAYS} days`);
  }
  const fundingDays = fundingByDay(input.funding, dayEnd, TABLE_DAYS);
  if (fundingDays.some((d) => d.settlements === 0)) throw new Error('a day in the funding history has no settlement');

  // ---- open interest and long/short ratio: readings stamped at the day's end
  const oi = changeOverWeek(input.openInterest, dayEnd);
  const ratio = ratioStats(input.ratio, dayEnd);
  const upToDayEnd = <T extends { time: number }>(points: T[]) =>
    points.filter((p) => p.time <= dayEnd && p.time % DAY_MS === 0).slice(-TABLE_DAYS);
  const oiHistory = upToDayEnd(input.openInterest);
  const ratioHistory = upToDayEnd(input.ratio);
  if (oiHistory.length < 8) throw new Error(`need 8 daily open-interest readings, got ${oiHistory.length}`);
  if (ratioHistory.length < 8) throw new Error(`need 8 daily long/short readings, got ${ratioHistory.length}`);

  const dayRow = (c: Candle): DayRow => ({ date: utcDate(c.start), open: c.open, high: c.high, low: c.low, close: c.close });
  const ratioOut = (p: RatioPoint & { longShort: number }) => ({
    time: iso(p.time),
    buyRatio: p.buyRatio,
    sellRatio: p.sellRatio,
    longShort: p.longShort,
  });

  return {
    schema: 1,
    symbol,
    baseCoin: instrument.baseCoin,
    category: 'linear',
    reportDate: utcDate(day.start),
    fetchedAt: input.fetchedAt,
    source: 'Bybit public API v5 (no API key)',
    endpoints: input.endpoints,
    instrument: {
      tickSize: instrument.tickSize,
      fundingIntervalHours: ticker.fundingIntervalHours,
      tierOne,
    },
    day: { ...dayRow(day), adverseLong: moves.long, adverseShort: moves.short },
    hourly: hourly.map((c, hour) => ({ hour, open: c.open, high: c.high, low: c.low, close: c.close })),
    survival,
    survival90: {
      days: history90.days,
      from: utcDate(last90[0].start),
      to: utcDate(day.start),
      rows: history90.rows,
    },
    funding: {
      latest: { time: iso(funding.latest.time), rate: funding.latest.rate },
      settlements7d: funding.settlements7d,
      sum7d: funding.sum7d,
      average7d: funding.average7d,
      notional: funding.notional,
      costPerDay: funding.costPerDay,
      costPer30Days: funding.costPer30Days,
    },
    openInterest: {
      unit: instrument.baseCoin,
      latest: { time: iso(oi.latest.time), value: oi.latest.value },
      weekAgo: { time: iso(oi.weekAgo.time), value: oi.weekAgo.value },
      change7d: oi.change7d,
    },
    ratio: {
      latest: ratioOut(ratio.latest),
      weekAgo: ratioOut(ratio.weekAgo),
      longShareChange7d: ratio.longShareChange7d,
      longShortChange7d: ratio.longShortChange7d,
    },
    atFetch: {
      time: iso(input.serverTime),
      lastPrice: ticker.lastPrice,
      markPrice: ticker.markPrice,
      fundingRate: ticker.fundingRate,
      nextFundingTime: iso(ticker.nextFundingTime),
      openInterest: ticker.openInterest,
      openInterestValue: ticker.openInterestValue,
    },
    history: {
      daily: last90.map(dayRow),
      funding: fundingDays,
      openInterest: oiHistory.map((r) => ({ time: iso(r.time), value: r.value })),
      ratio: ratioHistory.map((p) => ({ time: iso(p.time), buyRatio: p.buyRatio, sellRatio: p.sellRatio })),
    },
  };
}
