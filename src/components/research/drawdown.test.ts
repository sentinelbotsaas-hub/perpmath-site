import { describe, expect, it } from 'vitest';
import { PLOT_HEIGHT, PLOT_WIDTH } from '../../lib/backtests/chart';
import { results } from '../../lib/backtests/load';
import { drawdownChart, drawdownPoints } from './drawdown';

const day = (n: number) => `2026-01-${String(n).padStart(2, '0')}T00:00:00Z`;
const curve = (values: number[], from = 1) => values.map((equity, i) => ({ t: day(from + i), equity }));

describe('drawdownPoints', () => {
  it('measures each point against the highest point so far', () => {
    expect(drawdownPoints(curve([100, 120, 90, 120, 60])).map((p) => p.pct)).toEqual([0, 0, 25, 0, 50]);
  });

  it('is 0 while equity only rises', () => {
    expect(drawdownPoints(curve([100, 101, 150])).every((p) => p.pct === 0)).toBe(true);
  });

  it('reaches 100 when equity reaches 0', () => {
    expect(drawdownPoints(curve([100, 0]))[1].pct).toBe(100);
  });

  it('rejects a negative or missing equity value', () => {
    expect(() => drawdownPoints(curve([100, -1]))).toThrow();
    expect(() => drawdownPoints(curve([100, Number.NaN]))).toThrow();
  });
});

describe('drawdownChart', () => {
  const chart = drawdownChart(curve([100, 80, 90], 1), curve([100, 50, 75], 3));

  it('puts the value axis at 0 to 100 percent', () => {
    expect(chart.yTicks.map((tick) => tick.value)).toEqual([0, 25, 50, 75, 100]);
    expect(chart.yTicks[0].y).toBe(0);
    expect(chart.yTicks[4].y).toBe(1);
  });

  it('draws a 50% drawdown at half the height', () => {
    const [, oos] = chart.series;
    expect(oos.deepest.pct).toBe(50);
    expect(oos.line.split(' ')[1].split(',')[1]).toBe(String(PLOT_HEIGHT / 2));
  });

  it('spans the plot from the first in-sample point to the last out-of-sample point', () => {
    const [is, oos] = chart.series;
    expect(is.line.startsWith('0,')).toBe(true);
    expect(oos.line.split(' ').at(-1)?.startsWith(`${PLOT_WIDTH},`)).toBe(true);
  });

  it('closes the area along the top edge', () => {
    const [is] = chart.series;
    const corners = is.area.split(' ');
    expect(corners[0].endsWith(',0')).toBe(true);
    expect(corners.at(-1)?.endsWith(',0')).toBe(true);
  });

  it('starts each sample again from its own first point', () => {
    const [, oos] = chart.series;
    expect(oos.line.split(' ')[0].endsWith(',0')).toBe(true);
  });

  it('needs two points in each sample', () => {
    expect(() => drawdownChart(curve([100]), curve([100, 90]))).toThrow();
  });
});

describe('published results', () => {
  it.each(results.map((r) => [r.slug, r] as const))('%s: daily drawdown never exceeds the engine’s trade-level figure', (_slug, r) => {
    const chart = drawdownChart(r.in_sample.equity_curve, r.out_of_sample.equity_curve);
    const reported = [r.in_sample.metrics.max_drawdown_pct, r.out_of_sample.metrics.max_drawdown_pct];
    chart.series.forEach((s, i) => {
      expect(s.deepest.pct).toBeGreaterThan(0);
      // Daily points can miss an intraday low, so they are never deeper.
      expect(s.deepest.pct).toBeLessThanOrEqual((reported[i] as number) + 0.005);
    });
  });
});
