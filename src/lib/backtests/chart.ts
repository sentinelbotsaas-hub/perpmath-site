// Geometry of the equity chart on /backtests/<slug>/. Pure functions: equity
// points in, coordinates out. The page turns the result into an inline SVG at
// build time; nothing is drawn in the browser.
//
// The chart is honest in two ways that are decided here:
// - the value axis starts at 0, so a fall from 10,000 to 3,000 looks like
//   losing 70% of the height;
// - the time axis is linear in time, and the two samples are drawn as two
//   separate lines because the engine simulates each on its own, both from
//   the same starting capital.
import type { EquityPoint } from './types';

/** The line is drawn in a box of this size and stretched to the plot area. */
export const PLOT_WIDTH = 1000;
export const PLOT_HEIGHT = 400;

export interface ChartSeries {
  key: 'in_sample' | 'out_of_sample';
  /** "x,y x,y ..." in the PLOT_WIDTH x PLOT_HEIGHT box, for <polyline points>. */
  points: string;
  first: EquityPoint;
  last: EquityPoint;
  /** 0 to 1 across the plot. */
  x0: number;
  x1: number;
}

export interface EquityChart {
  /** Top of the value axis. Always above the highest equity point. */
  yMax: number;
  yStep: number;
  /** Labelled gridlines, 0 first. `y` is 0 at the top of the plot, 1 at the bottom. */
  yTicks: Array<{ value: number; y: number }>;
  /** Month starts inside the range. `x` is 0 at the left, 1 at the right. */
  xTicks: Array<{ label: string; x: number; labelled: boolean }>;
  /** Where the out-of-sample part starts, 0 to 1. */
  splitX: number;
  series: ChartSeries[];
  minEquity: number;
  maxEquity: number;
}

/**
 * Gridline spacing: the smallest of 1, 2, 2.5, 5 or 10 times a power of ten
 * that needs at most five steps to reach `max`.
 *   niceStep(10200) -> 2500;  niceStep(950) -> 200;  niceStep(4) -> 1
 */
export function niceStep(max: number): number {
  if (!Number.isFinite(max) || max <= 0) throw new Error('niceStep needs a positive number');
  const raw = max / 5;
  const power = 10 ** Math.floor(Math.log10(raw));
  for (const m of [1, 2, 2.5, 5, 10]) {
    // Tolerance for values such as 0.30000000000000004.
    if (m * power >= raw * (1 - 1e-9)) return m * power;
  }
  return 10 * power;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

function time(point: EquityPoint): number {
  const ms = Date.parse(point.t);
  if (!Number.isFinite(ms)) throw new Error(`Equity point has an invalid time: ${point.t}`);
  return ms;
}

/** First instants of the UTC months that start strictly inside (from, to). */
function monthStarts(from: number, to: number): number[] {
  const out: number[] = [];
  const d = new Date(from);
  let year = d.getUTCFullYear();
  let month = d.getUTCMonth(); // 0 to 11; the loop starts with the month after it
  for (;;) {
    month += 1;
    if (month > 11) {
      month = 0;
      year += 1;
    }
    const ms = Date.UTC(year, month, 1);
    if (ms >= to) break;
    out.push(ms);
  }
  return out;
}

export function equityChart(inSample: EquityPoint[], outOfSample: EquityPoint[], oosStart: string): EquityChart {
  if (inSample.length < 2 || outOfSample.length < 2) throw new Error('Each sample needs at least two equity points');
  const all = [...inSample, ...outOfSample];
  for (const p of all) {
    if (!Number.isFinite(p.equity) || p.equity < 0) throw new Error(`Equity point is not a non-negative number at ${p.t}`);
  }

  const t0 = time(inSample[0]);
  const t1 = time(outOfSample[outOfSample.length - 1]);
  if (!(t1 > t0)) throw new Error('Equity points do not span any time');
  const split = Date.parse(oosStart);
  if (!Number.isFinite(split) || split <= t0 || split >= t1) throw new Error('oos_start is outside the equity points');

  const maxEquity = Math.max(...all.map((p) => p.equity));
  const minEquity = Math.min(...all.map((p) => p.equity));
  if (maxEquity <= 0) throw new Error('Equity is never above zero');
  const yStep = niceStep(maxEquity);
  // Strictly above the data: a line that touches the top edge reads as cut off.
  const yMax = yStep * (Math.floor(maxEquity / yStep + 1e-9) + 1);

  const x = (ms: number) => (ms - t0) / (t1 - t0);
  const y = (equity: number) => 1 - equity / yMax;

  const yTicks: EquityChart['yTicks'] = [];
  for (let value = 0; value < yMax - yStep / 2; value += yStep) yTicks.push({ value, y: y(value) });

  const months = monthStarts(t0, t1);
  // Label every month on a short range, every quarter on a long one, and keep
  // labels away from the edges where they would be cut off.
  const everyQuarter = months.length > 6;
  const xTicks = months.map((ms) => {
    const d = new Date(ms);
    const month = d.getUTCMonth();
    const pos = x(ms);
    return {
      label: `${d.getUTCFullYear()}-${String(month + 1).padStart(2, '0')}`,
      x: pos,
      labelled: (!everyQuarter || month % 3 === 0) && pos >= 0.08 && pos <= 0.92,
    };
  });

  const line = (key: ChartSeries['key'], points: EquityPoint[]): ChartSeries => ({
    key,
    points: points.map((p) => `${round1(x(time(p)) * PLOT_WIDTH)},${round1(y(p.equity) * PLOT_HEIGHT)}`).join(' '),
    first: points[0],
    last: points[points.length - 1],
    x0: x(time(points[0])),
    x1: x(time(points[points.length - 1])),
  });

  return {
    yMax,
    yStep,
    yTicks,
    xTicks,
    splitX: x(split),
    series: [line('in_sample', inSample), line('out_of_sample', outOfSample)],
    minEquity,
    maxEquity,
  };
}
