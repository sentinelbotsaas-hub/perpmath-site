// Number and date formatting for the backtest pages. Pure functions, no
// dependencies. A value the engine could not compute (null) stays null here,
// so the page prints its "not computed" text instead of a made-up 0.

/** The real minus sign, not a hyphen. */
export const MINUS = '−';

// Rounding is toFixed(), which rounds the stored binary value. That is what
// the engine's own summary table does (Python's '.2f'), so a figure such as
// -66.945 prints as −66.94 here and in the engine's README alike.
function fixed(value: number, decimals: number): string {
  const [whole, fraction] = Math.abs(value).toFixed(decimals).split('.');
  const text = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (fraction ? `.${fraction}` : '');
  // A value that rounds to zero carries no sign: "0.00", never "−0.00".
  const isZero = Number(`${whole}.${fraction ?? 0}`) === 0;
  return value < 0 && !isZero ? MINUS + text : text;
}

/** -0.5692 -> "−0.57"; 0.5692 -> "0.57"; 1639 -> "1,639". No plus sign. */
export function formatSigned(value: number | null, decimals = 2): string | null {
  if (value === null || !Number.isFinite(value)) return null;
  return fixed(value, decimals);
}

/** A value already in percent units: -66.945 -> "−66.94%"; 31.4607 -> "31.46%". */
export function formatPct(value: number | null, decimals = 2): string | null {
  const text = formatSigned(value, decimals);
  return text === null ? null : `${text}%`;
}

/** 1639 -> "1,639". */
export function formatCount(value: number): string {
  return fixed(Math.round(value), 0);
}

/** Money in account currency: 3305.5 -> "3,305.50"; 10000 -> "10,000". */
export function formatMoney(value: number): string {
  return fixed(value, Number.isInteger(value) ? 0 : 2);
}

/**
 * A rate stored as a fraction, printed as a percentage without padding:
 * 0.00055 -> "0.055%"; 0.0002 -> "0.02%"; 1 -> "100%".
 */
export function formatRate(fraction: number): string {
  const text = (fraction * 100).toFixed(4).replace(/\.?0+$/, '');
  return `${text.startsWith('-') ? MINUS + text.slice(1) : text}%`;
}

/** A config parameter as written in the config file: 2 -> "2"; 0.5 -> "0.5". */
export function formatParam(value: number | string | null): string | null {
  if (value === null) return null;
  return typeof value === 'number' ? String(value).replace('-', MINUS) : value;
}

function parts(iso: string): { day: string; time: string } {
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}):\d{2}Z$/.exec(iso);
  if (!m) throw new Error(`Not a UTC timestamp like 2026-01-31T00:00:00Z: ${iso}`);
  return { day: m[1], time: m[2] };
}

/** "2025-11-18T11:30:00Z" -> "2025-11-18". */
export function formatDay(iso: string): string {
  return parts(iso).day;
}

/** "2025-11-18T11:30:00Z" -> "2025-11-18 11:30 UTC". */
export function formatUtc(iso: string): string {
  const { day, time } = parts(iso);
  return `${day} ${time} UTC`;
}

/** Bar length in minutes: "15m" -> 15, "4h" -> 240, "1d" -> 1440. */
export function intervalMinutes(interval: string): number {
  const m = /^(\d+)([mhd])$/.exec(interval);
  if (!m) throw new Error(`Unknown bar interval: ${interval}`);
  return Number(m[1]) * { m: 1, h: 60, d: 1440 }[m[2] as 'm' | 'h' | 'd'];
}

/**
 * The exclusive end of a data range: the open time of the last bar plus one
 * bar. This is the value the engine's `download --end` expects.
 *   exclusiveEnd('2026-11-18T11:15:00Z', '15m') -> '2026-11-18T11:30:00Z'
 */
export function exclusiveEnd(lastBar: string, interval: string): string {
  parts(lastBar);
  const end = new Date(Date.parse(lastBar) + intervalMinutes(interval) * 60_000);
  return end.toISOString().replace(/\.\d{3}Z$/, 'Z');
}
