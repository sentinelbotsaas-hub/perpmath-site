import { describe, expect, it } from 'vitest';
import { PLOT_HEIGHT, PLOT_WIDTH, equityChart, niceStep } from './chart';
import type { EquityPoint } from './types';

describe('niceStep', () => {
  it('picks a round spacing that reaches the maximum in at most five steps', () => {
    expect(niceStep(10000)).toBe(2000);
    expect(niceStep(10200)).toBe(2500);
    expect(niceStep(12500)).toBe(2500);
    expect(niceStep(950)).toBe(200);
    expect(niceStep(4)).toBe(1);
    expect(niceStep(0.8)).toBeCloseTo(0.2, 12);
  });

  it('refuses zero and negative maxima', () => {
    expect(() => niceStep(0)).toThrow();
    expect(() => niceStep(-5)).toThrow();
  });
});

// A hand-made run: 100 days, cut at day 60. Equity starts at 1,000 in both
// parts, as the engine does.
//   in-sample:      day 0 = 1,000   day 30 = 800   day 60 = 500
//   out-of-sample:  day 60 = 1,000  day 80 = 1,100 day 100 = 900
const DAY = 86_400_000;
const start = Date.UTC(2026, 0, 1); // 2026-01-01
const at = (day: number, equity: number): EquityPoint => ({
  t: new Date(start + day * DAY).toISOString().replace('.000Z', 'Z'),
  equity,
});
const inSample = [at(0, 1000), at(30, 800), at(60, 500)];
const outOfSample = [at(60, 1000), at(80, 1100), at(100, 900)];
const oosStart = at(60, 0).t;

describe('equityChart', () => {
  const chart = equityChart(inSample, outOfSample, oosStart);

  it('starts the value axis at zero and ends it above the highest point', () => {
    // highest equity 1,100 -> spacing 250 -> top of the axis 1,250
    expect(chart.maxEquity).toBe(1100);
    expect(chart.minEquity).toBe(500);
    expect(chart.yStep).toBe(250);
    expect(chart.yMax).toBe(1250);
    expect(chart.yTicks.map((t) => t.value)).toEqual([0, 250, 500, 750, 1000]);
    expect(chart.yTicks[0].y).toBe(1); // zero is the bottom edge
    expect(chart.yTicks[4].y).toBeCloseTo(0.2, 12); // 1,000 of 1,250 is 80% of the way up
  });

  it('adds a step of headroom when the highest point sits on a gridline', () => {
    const flat = equityChart([at(0, 1000), at(60, 600)], [at(60, 1000), at(100, 700)], oosStart);
    // highest equity 1,000 -> spacing 200 -> top 1,200, not 1,000
    expect(flat.yStep).toBe(200);
    expect(flat.yMax).toBe(1200);
  });

  it('places points linearly in time and in value', () => {
    const [first, second] = chart.series;
    expect(first.key).toBe('in_sample');
    expect(second.key).toBe('out_of_sample');
    // x: day / 100 x 1000.  y: (1 - equity / 1250) x 400.
    expect(first.points).toBe('0,80 300,144 600,240');
    expect(second.points).toBe('600,80 800,48 1000,112');
    expect(PLOT_WIDTH).toBe(1000);
    expect(PLOT_HEIGHT).toBe(400);
  });

  it('draws the two samples as separate lines that both start from the same capital', () => {
    const [first, second] = chart.series;
    expect(first.first.equity).toBe(1000);
    expect(second.first.equity).toBe(1000);
    expect(first.last.equity).toBe(500);
    expect(second.last.equity).toBe(900);
    expect(first.x1).toBeCloseTo(0.6, 12);
    expect(second.x0).toBeCloseTo(0.6, 12);
    expect(chart.splitX).toBeCloseTo(0.6, 12);
  });

  it('marks month starts on the time axis', () => {
    // 2026-01-01 + 100 days = 2026-04-11: February, March and April start inside.
    expect(chart.xTicks.map((t) => t.label)).toEqual(['2026-02', '2026-03', '2026-04']);
    expect(chart.xTicks[0].x).toBeCloseTo(31 / 100, 12);
    expect(chart.xTicks[1].x).toBeCloseTo(59 / 100, 12);
    expect(chart.xTicks[2].x).toBeCloseTo(90 / 100, 12);
    // a short range labels every month that is not too close to an edge
    expect(chart.xTicks.map((t) => t.labelled)).toEqual([true, true, true]);
  });

  it('labels only quarter starts on a long range, and nothing at the edges', () => {
    const year = equityChart(
      [{ t: '2025-11-18T11:30:00Z', equity: 10000 }, { t: '2026-07-31T00:00:00Z', equity: 4000 }],
      [{ t: '2026-07-31T00:00:00Z', equity: 10000 }, { t: '2026-11-18T11:30:00Z', equity: 6000 }],
      '2026-07-31T00:00:00Z',
    );
    expect(year.xTicks).toHaveLength(12); // 2025-12 to 2026-11
    expect(year.xTicks.filter((t) => t.labelled).map((t) => t.label)).toEqual([
      '2026-01',
      '2026-04',
      '2026-07',
      '2026-10',
    ]);
    expect(year.xTicks[0].label).toBe('2025-12');
    expect(year.xTicks[1].label).toBe('2026-01');
  });

  it('handles a range that starts in December without repeating a month', () => {
    const chartDec = equityChart(
      [{ t: '2025-12-10T00:00:00Z', equity: 100 }, { t: '2026-01-20T00:00:00Z', equity: 90 }],
      [{ t: '2026-01-20T00:00:00Z', equity: 100 }, { t: '2026-03-05T00:00:00Z', equity: 95 }],
      '2026-01-20T00:00:00Z',
    );
    expect(chartDec.xTicks.map((t) => t.label)).toEqual(['2026-01', '2026-02', '2026-03']);
  });

  it('refuses data it cannot draw honestly', () => {
    expect(() => equityChart([at(0, 1000)], outOfSample, oosStart)).toThrow();
    expect(() => equityChart(inSample, outOfSample, at(200, 0).t)).toThrow();
    expect(() => equityChart([at(0, 1000), at(60, -5)], outOfSample, oosStart)).toThrow();
    expect(() => equityChart([at(0, 1000), { t: 'yesterday', equity: 900 }], outOfSample, oosStart)).toThrow();
  });
});
