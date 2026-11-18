// Pure computations behind the daily report and the market-data pages.
// No I/O, no dates from the system clock, no defaults for exchange parameters:
// the caller passes the maintenance margin rate and the leverage cap it read
// from Bybit's risk-limit data.
//
// Imported by Astro pages, by vitest, and directly by
// scripts/fetch-market.mjs (Node runs this file as-is, so it uses only
// erasable TypeScript: no enums, no namespaces, no parameter properties, and
// relative imports carry the .ts extension).
//
// Definitions (the pages print the same words):
//   largest adverse move, long side   (open - low)  / open
//   largest adverse move, short side  (high - open) / open
//   room at a leverage                1 / leverage - MMR   (isolated margin)
//   liquidated                        adverse move >= room
// Every fraction is a share of the daily open: 0.0467 means 4.67%.

export const DAY_MS = 86_400_000;
export const HOUR_MS = 3_600_000;

/** The leverage column of the survival table. */
export const LEVERAGES: readonly number[] = [2, 5, 10, 20, 50, 100];

/** Notional used for the funding cost example, in USDT. */
export const FUNDING_NOTIONAL = 1000;

// Guards the comparison "move >= room" against binary rounding: 1/20 - 0.005
// is 0.045000000000000005 in floating point, and a move of exactly 4.5% must
// still count as reaching it.
const EPSILON = 1e-12;

export type Side = 'long' | 'short';

export interface Candle {
  /** Start of the candle, Unix milliseconds, UTC. */
  start: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface RiskParams {
  /** Maintenance margin rate of risk tier 1, as a fraction. */
  mmr: number;
  /** Highest leverage the symbol offers in risk tier 1. */
  maxLeverage: number;
  /** Leverage values to tabulate. Defaults to LEVERAGES. */
  leverages?: readonly number[];
}

/** "2026-11-17" for a Unix-millisecond timestamp, in UTC. */
export function utcDate(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** Start of a UTC day given as "2026-11-17", in Unix milliseconds. */
export function utcDayStart(date: string): number {
  return Date.parse(`${date}T00:00:00.000Z`);
}

/** Largest move against each side, measured from the open of the candle. */
export function adverseMoves(candle: Candle): { long: number; short: number } {
  return {
    long: (candle.open - candle.low) / candle.open,
    short: (candle.high - candle.open) / candle.open,
  };
}

/** Share of the entry price a position can lose before liquidation. May be zero or negative. */
export function roomAt(leverage: number, mmr: number): number {
  return 1 / leverage - mmr;
}

/** True when a move of this size reaches the room. */
export function reaches(move: number, room: number): boolean {
  return move >= room - EPSILON;
}

/**
 * The leverage values that can actually be opened: at or below the symbol's
 * cap, and with initial margin larger than the maintenance margin.
 */
export function offeredLeverages(risk: RiskParams): number[] {
  return (risk.leverages ?? LEVERAGES).filter(
    (leverage) => leverage <= risk.maxLeverage && roomAt(leverage, risk.mmr) > 0,
  );
}

/**
 * UTC hour (0 to 23) of the first hourly candle in which a position opened at
 * `entry` reaches its liquidation distance. null when no candle reaches it.
 */
export function liquidationHour(side: Side, entry: number, room: number, hourly: readonly Candle[]): number | null {
  const ordered = [...hourly].sort((a, b) => a.start - b.start);
  for (const candle of ordered) {
    const move = side === 'long' ? (entry - candle.low) / entry : (candle.high - entry) / entry;
    if (reaches(move, room)) return new Date(candle.start).getUTCHours();
  }
  return null;
}

export interface SideOutcome {
  liquidated: boolean;
  /** UTC hour of the liquidation, when the hourly candles show it. */
  hourUtc: number | null;
}

export interface SurvivalRow {
  leverage: number;
  room: number;
  long: SideOutcome;
  short: SideOutcome;
}

/**
 * One row per offered leverage: would a long, and a short, opened at the
 * daily open on isolated margin have been liquidated before the day closed?
 */
export function survivalTable(day: Candle, hourly: readonly Candle[], risk: RiskParams): SurvivalRow[] {
  const moves = adverseMoves(day);
  const outcome = (side: Side, room: number): SideOutcome => {
    const liquidated = reaches(moves[side], room);
    return { liquidated, hourUtc: liquidated ? liquidationHour(side, day.open, room, hourly) : null };
  };
  return offeredLeverages(risk).map((leverage) => {
    const room = roomAt(leverage, risk.mmr);
    return { leverage, room, long: outcome('long', room), short: outcome('short', room) };
  });
}

export interface HistoryRow {
  leverage: number;
  room: number;
  long: { days: number; share: number };
  short: { days: number; share: number };
}

export interface SurvivalHistory {
  /** Number of daily candles counted. */
  days: number;
  rows: HistoryRow[];
}

/** Over a run of daily candles: on how many days would each leverage have been liquidated? */
export function survivalHistory(days: readonly Candle[], risk: RiskParams): SurvivalHistory {
  const total = days.length;
  const moves = days.map(adverseMoves);
  const rows = offeredLeverages(risk).map((leverage) => {
    const room = roomAt(leverage, risk.mmr);
    const long = moves.filter((m) => reaches(m.long, room)).length;
    const short = moves.filter((m) => reaches(m.short, room)).length;
    return {
      leverage,
      room,
      long: { days: long, share: total > 0 ? long / total : 0 },
      short: { days: short, share: total > 0 ? short / total : 0 },
    };
  });
  return { days: total, rows };
}

const liquidatedOn = (row: SurvivalRow, side: Side | 'both') =>
  side === 'both' ? row.long.liquidated || row.short.liquidated : row[side].liquidated;

/** Highest leverage in the table that was not liquidated. null when every row was. */
export function highestSurviving(rows: readonly SurvivalRow[], side: Side | 'both'): number | null {
  const alive = rows.filter((row) => !liquidatedOn(row, side)).map((row) => row.leverage);
  return alive.length > 0 ? Math.max(...alive) : null;
}

/** The liquidated row with the lowest leverage. null when nothing was liquidated. */
export function lowestLiquidated(rows: readonly SurvivalRow[], side: Side): SurvivalRow | null {
  const dead = rows.filter((row) => row[side].liquidated).sort((a, b) => a.leverage - b.leverage);
  return dead[0] ?? null;
}

// ---- funding ---------------------------------------------------------------

export interface FundingPoint {
  /** Settlement time, Unix milliseconds. */
  time: number;
  /** Rate of that settlement as a fraction. Positive: longs pay shorts. */
  rate: number;
}

export interface FundingStats {
  /** The last settlement before `dayEnd`. */
  latest: FundingPoint;
  /** Settlements in the seven UTC days that end at `dayEnd`. */
  settlements7d: number;
  sum7d: number;
  /** Mean rate per settlement over those seven days. */
  average7d: number;
  notional: number;
  /**
   * What a long pays per day on `notional`, at the seven-day pace:
   * sum7d / 7 x notional. Negative means the long receives it.
   */
  costPerDay: number;
  /** costPerDay x 30. */
  costPer30Days: number;
}

/**
 * Funding figures for the report day. `dayEnd` is 00:00 UTC of the following
 * day; only settlements stamped before it are used, so the result does not
 * depend on when the script happened to run.
 */
export function fundingStats(points: readonly FundingPoint[], dayEnd: number, notional: number): FundingStats {
  const settled = points.filter((p) => p.time < dayEnd).sort((a, b) => a.time - b.time);
  const window = settled.filter((p) => p.time >= dayEnd - 7 * DAY_MS);
  if (window.length === 0) throw new Error('no funding settlement in the seven days before the end of the report day');
  const sum7d = window.reduce((sum, p) => sum + p.rate, 0);
  const costPerDay = (sum7d / 7) * notional;
  return {
    latest: settled[settled.length - 1],
    settlements7d: window.length,
    sum7d,
    average7d: sum7d / window.length,
    notional,
    costPerDay,
    costPer30Days: costPerDay * 30,
  };
}

export interface FundingDay {
  /** UTC date of the settlements. */
  date: string;
  settlements: number;
  /** Sum of the day's settlement rates. */
  sum: number;
}

/** Settlement rates added up per UTC day, for the `days` days that end at `dayEnd`. Oldest first. */
export function fundingByDay(points: readonly FundingPoint[], dayEnd: number, days: number): FundingDay[] {
  const out: FundingDay[] = [];
  for (let i = days; i >= 1; i--) {
    const start = dayEnd - i * DAY_MS;
    const inDay = points.filter((p) => p.time >= start && p.time < start + DAY_MS);
    out.push({ date: utcDate(start), settlements: inDay.length, sum: inDay.reduce((sum, p) => sum + p.rate, 0) });
  }
  return out;
}

// ---- open interest and long/short ratio -------------------------------------

export interface Reading {
  /** Time of the reading, Unix milliseconds. */
  time: number;
  value: number;
}

export interface ChangeStats {
  latest: Reading;
  weekAgo: Reading;
  /** (latest - weekAgo) / weekAgo. */
  change7d: number;
}

/**
 * The reading stamped exactly `at` and the one stamped seven days before it.
 * Throws when either is missing: a gap must stop the build, not be papered over.
 */
export function changeOverWeek(readings: readonly Reading[], at: number): ChangeStats {
  const latest = readings.find((r) => r.time === at);
  const weekAgo = readings.find((r) => r.time === at - 7 * DAY_MS);
  if (!latest) throw new Error(`no reading stamped ${new Date(at).toISOString()}`);
  if (!weekAgo) throw new Error(`no reading stamped ${new Date(at - 7 * DAY_MS).toISOString()}`);
  if (!(weekAgo.value > 0)) throw new Error('reading from seven days earlier is not positive');
  return { latest, weekAgo, change7d: (latest.value - weekAgo.value) / weekAgo.value };
}

export interface RatioPoint {
  time: number;
  /** Share of accounts holding a net long position, 0 to 1. */
  buyRatio: number;
  /** Share of accounts holding a net short position, 0 to 1. */
  sellRatio: number;
}

/** Long accounts divided by short accounts. */
export function longShortRatio(point: { buyRatio: number; sellRatio: number }): number {
  return point.buyRatio / point.sellRatio;
}

export interface RatioStats {
  latest: RatioPoint & { longShort: number };
  weekAgo: RatioPoint & { longShort: number };
  /** Change of the long share in percentage points, as a fraction: 0.012 is 1.2 points. */
  longShareChange7d: number;
  /** Change of the long/short ratio itself: latest - weekAgo. */
  longShortChange7d: number;
}

export function ratioStats(points: readonly RatioPoint[], at: number): RatioStats {
  const latest = points.find((p) => p.time === at);
  const weekAgo = points.find((p) => p.time === at - 7 * DAY_MS);
  if (!latest) throw new Error(`no long/short reading stamped ${new Date(at).toISOString()}`);
  if (!weekAgo) throw new Error(`no long/short reading stamped ${new Date(at - 7 * DAY_MS).toISOString()}`);
  const withRatio = (p: RatioPoint) => ({ ...p, longShort: longShortRatio(p) });
  const a = withRatio(latest);
  const b = withRatio(weekAgo);
  return {
    latest: a,
    weekAgo: b,
    longShareChange7d: a.buyRatio - b.buyRatio,
    longShortChange7d: a.longShort - b.longShort,
  };
}
