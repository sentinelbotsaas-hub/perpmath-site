// Geometry of the drawdown chart on /backtests/<slug>/. Pure functions:
// equity points in, coordinates out. Drawn at build time as inline SVG.
//
// Drawdown is computed from the equity points in the result file (one a day)
// and from nothing else: at each point, how far equity sits below the highest
// point so far in the same sample. It is not derived from the summary figure
// `max_drawdown_pct`; that one is measured by the engine trade by trade and
// can be deeper than the lowest daily point, which the page says in words.
//
// The value axis is fixed at 0 to 100%, so a 67% drawdown takes 67% of the
// height. The time axis is the one the equity chart uses (linear, from the
// first in-sample point to the last out-of-sample point), so the two charts
// line up when stacked.
import { PLOT_HEIGHT, PLOT_WIDTH } from '../../lib/backtests/chart';
import type { EquityPoint } from '../../lib/backtests/types';

export interface DrawdownPoint {
  /** UTC, "2026-01-31T00:00:00Z". */
  t: string;
  /** Percent below the running high, 0 to 100. */
  pct: number;
}

export interface DrawdownSeries {
  key: 'in_sample' | 'out_of_sample';
  /** "x,y x,y ..." in the PLOT_WIDTH x PLOT_HEIGHT box, for <polyline points>. */
  line: string;
  /** The same line closed along the top edge (0%), for <polygon points>. */
  area: string;
  /** The deepest point. The first one, when several are equally deep. */
  deepest: DrawdownPoint;
}

export interface DrawdownChart {
  /** Gridlines at 0, 25, 50, 75 and 100%. `y` is 0 at the top of the plot, 1 at the bottom. */
  yTicks: Array<{ value: number; y: number }>;
  series: DrawdownSeries[];
}

function time(point: { t: string }): number {
  const ms = Date.parse(point.t);
  if (!Number.isFinite(ms)) throw new Error(`Equity point has an invalid time: ${point.t}`);
  return ms;
}

/**
 * Percent below the running high at every point.
 *   [100, 120, 90, 120, 60] -> [0, 0, 25, 0, 50]
 */
export function drawdownPoints(points: EquityPoint[]): DrawdownPoint[] {
  let peak = -Infinity;
  return points.map((p) => {
    if (!Number.isFinite(p.equity) || p.equity < 0) throw new Error(`Equity point is not a non-negative number at ${p.t}`);
    if (p.equity > peak) peak = p.equity;
    return { t: p.t, pct: peak > 0 ? ((peak - p.equity) / peak) * 100 : 0 };
  });
}

const round1 = (n: number) => Math.round(n * 10) / 10;

export function drawdownChart(inSample: EquityPoint[], outOfSample: EquityPoint[]): DrawdownChart {
  if (inSample.length < 2 || outOfSample.length < 2) throw new Error('Each sample needs at least two equity points');
  const t0 = time(inSample[0]);
  const t1 = time(outOfSample[outOfSample.length - 1]);
  if (!(t1 > t0)) throw new Error('Equity points do not span any time');
  const x = (ms: number) => round1(((ms - t0) / (t1 - t0)) * PLOT_WIDTH);
  const y = (pct: number) => round1((pct / 100) * PLOT_HEIGHT);

  const series = (key: DrawdownSeries['key'], points: EquityPoint[]): DrawdownSeries => {
    const dd = drawdownPoints(points);
    const line = dd.map((p) => `${x(time(p))},${y(p.pct)}`).join(' ');
    const first = x(time(dd[0]));
    const last = x(time(dd[dd.length - 1]));
    return {
      key,
      line,
      area: `${first},0 ${line} ${last},0`,
      deepest: dd.reduce((worst, p) => (p.pct > worst.pct ? p : worst), dd[0]),
    };
  };

  return {
    yTicks: [0, 25, 50, 75, 100].map((value) => ({ value, y: value / 100 })),
    series: [series('in_sample', inSample), series('out_of_sample', outOfSample)],
  };
}
