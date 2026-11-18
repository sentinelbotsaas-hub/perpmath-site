// Turns Bybit v5 market responses into typed values, and refuses anything
// empty or malformed. Every function throws an Error that names the field, so
// scripts/fetch-market.mjs can stop before it writes a file.
//
// Pure functions. Run by Node directly (see the note in compute.ts).
import type { Candle, FundingPoint, RatioPoint, Reading } from './compute.ts';

function num(value: unknown, name: string): number {
  const n = typeof value === 'string' && value.trim() !== '' ? Number(value) : typeof value === 'number' ? value : Number.NaN;
  if (!Number.isFinite(n)) throw new Error(`${name} is not a number: ${JSON.stringify(value)}`);
  return n;
}

function positive(value: unknown, name: string): number {
  const n = num(value, name);
  if (!(n > 0)) throw new Error(`${name} must be above zero: ${JSON.stringify(value)}`);
  return n;
}

function rows(list: unknown, name: string): unknown[] {
  if (!Array.isArray(list) || list.length === 0) throw new Error(`${name} is empty`);
  return list;
}

function record(value: unknown, name: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${name} row is not an object`);
  return value as Record<string, unknown>;
}

/**
 * /v5/market/kline rows are [startTime, open, high, low, close, volume, turnover],
 * newest first. Returns candles oldest first and checks that each candle is
 * internally consistent and that none is missing in between.
 */
export function parseKlines(list: unknown, intervalMs: number, name = 'kline'): Candle[] {
  const candles = rows(list, name).map((row, i) => {
    if (!Array.isArray(row) || row.length < 5) throw new Error(`${name}[${i}] is not a candle row`);
    const candle: Candle = {
      start: num(row[0], `${name}[${i}].start`),
      open: positive(row[1], `${name}[${i}].open`),
      high: positive(row[2], `${name}[${i}].high`),
      low: positive(row[3], `${name}[${i}].low`),
      close: positive(row[4], `${name}[${i}].close`),
    };
    if (candle.high < Math.max(candle.open, candle.close) || candle.low > Math.min(candle.open, candle.close)) {
      throw new Error(`${name}[${i}] has a high or low inside its open-close range`);
    }
    if (candle.start % intervalMs !== 0) throw new Error(`${name}[${i}] does not start on an interval boundary`);
    return candle;
  });
  candles.sort((a, b) => a.start - b.start);
  for (let i = 1; i < candles.length; i++) {
    if (candles[i].start - candles[i - 1].start !== intervalMs) {
      throw new Error(`${name} has a gap or a duplicate after ${new Date(candles[i - 1].start).toISOString()}`);
    }
  }
  return candles;
}

/** Drop the candle that is still forming at `now` (and anything after it). */
export function completeCandles(candles: readonly Candle[], intervalMs: number, now: number): Candle[] {
  return candles.filter((candle) => candle.start + intervalMs <= now);
}

/** /v5/market/funding/history rows. Returned oldest first. */
export function parseFunding(list: unknown): FundingPoint[] {
  const points = rows(list, 'funding history').map((row, i) => {
    const r = record(row, `funding[${i}]`);
    return {
      time: positive(r.fundingRateTimestamp, `funding[${i}].fundingRateTimestamp`),
      rate: num(r.fundingRate, `funding[${i}].fundingRate`),
    };
  });
  return points.sort((a, b) => a.time - b.time);
}

/** /v5/market/open-interest rows. Value is in the base coin. Returned oldest first. */
export function parseOpenInterest(list: unknown): Reading[] {
  const readings = rows(list, 'open interest').map((row, i) => {
    const r = record(row, `openInterest[${i}]`);
    return {
      time: positive(r.timestamp, `openInterest[${i}].timestamp`),
      value: positive(r.openInterest, `openInterest[${i}].openInterest`),
    };
  });
  return readings.sort((a, b) => a.time - b.time);
}

/** /v5/market/account-ratio rows. Returned oldest first. */
export function parseRatio(list: unknown): RatioPoint[] {
  const points = rows(list, 'account ratio').map((row, i) => {
    const r = record(row, `ratio[${i}]`);
    const point = {
      time: positive(r.timestamp, `ratio[${i}].timestamp`),
      buyRatio: positive(r.buyRatio, `ratio[${i}].buyRatio`),
      sellRatio: positive(r.sellRatio, `ratio[${i}].sellRatio`),
    };
    if (Math.abs(point.buyRatio + point.sellRatio - 1) > 0.001) {
      throw new Error(`ratio[${i}] long and short shares do not add up to 1`);
    }
    return point;
  });
  return points.sort((a, b) => a.time - b.time);
}

export interface TierOne {
  /** Upper bound of the tier, USDT of position value. */
  riskLimitValue: number;
  /** Fraction: 0.005 is 0.5%. */
  maintenanceMargin: number;
  maxLeverage: number;
}

/** /v5/market/risk-limit rows: the tier with the lowest position-value bound. */
export function parseTierOne(list: unknown, symbol: string): TierOne {
  const tiers = rows(list, 'risk limit')
    .map((row, i) => record(row, `riskLimit[${i}]`))
    .filter((r) => r.symbol === symbol)
    .map((r, i) => ({
      riskLimitValue: positive(r.riskLimitValue, `riskLimit[${i}].riskLimitValue`),
      maintenanceMargin: positive(r.maintenanceMargin, `riskLimit[${i}].maintenanceMargin`),
      maxLeverage: positive(r.maxLeverage, `riskLimit[${i}].maxLeverage`),
    }))
    .sort((a, b) => a.riskLimitValue - b.riskLimitValue);
  if (tiers.length === 0) throw new Error(`risk limit has no tier for ${symbol}`);
  if (!(tiers[0].maintenanceMargin < 1)) throw new Error('tier 1 maintenance margin is not a fraction below 1');
  return tiers[0];
}

export interface Ticker {
  lastPrice: number;
  markPrice: number;
  /** Rate of the funding period in progress. Not final until it settles. */
  fundingRate: number;
  /** Unix milliseconds. */
  nextFundingTime: number;
  fundingIntervalHours: number;
  /** In the base coin. */
  openInterest: number;
  /** In USDT. */
  openInterestValue: number;
}

/** /v5/market/tickers row for one symbol. */
export function parseTicker(list: unknown, symbol: string): Ticker {
  const row = rows(list, 'tickers')
    .map((r, i) => record(r, `tickers[${i}]`))
    .find((r) => r.symbol === symbol);
  if (!row) throw new Error(`tickers has no row for ${symbol}`);
  return {
    lastPrice: positive(row.lastPrice, 'tickers.lastPrice'),
    markPrice: positive(row.markPrice, 'tickers.markPrice'),
    fundingRate: num(row.fundingRate, 'tickers.fundingRate'),
    nextFundingTime: positive(row.nextFundingTime, 'tickers.nextFundingTime'),
    fundingIntervalHours: positive(row.fundingIntervalHour, 'tickers.fundingIntervalHour'),
    openInterest: positive(row.openInterest, 'tickers.openInterest'),
    openInterestValue: positive(row.openInterestValue, 'tickers.openInterestValue'),
  };
}

export interface Instrument {
  baseCoin: string;
  tickSize: number;
}

/** /v5/market/instruments-info row for one symbol. */
export function parseInstrument(list: unknown, symbol: string): Instrument {
  const row = rows(list, 'instruments info')
    .map((r, i) => record(r, `instruments[${i}]`))
    .find((r) => r.symbol === symbol);
  if (!row) throw new Error(`instruments-info has no row for ${symbol}`);
  if (typeof row.baseCoin !== 'string' || row.baseCoin === '') throw new Error('instruments-info has no baseCoin');
  const priceFilter = record(row.priceFilter, 'instruments.priceFilter');
  return { baseCoin: row.baseCoin, tickSize: positive(priceFilter.tickSize, 'instruments.priceFilter.tickSize') };
}
