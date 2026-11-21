import { describe, expect, it } from 'vitest';
import { headline } from '../../components/research/headline';
import { backtests } from '../../i18n/backtests';
import { locales } from '../../i18n/config';
import { formatPlusPct } from './format';
import { gridResults, results } from './load';
import { BOUNDS_FIXED, BOUNDS_HINDSIGHT, gainedInBothSamples, hasHindsightBounds, overviewOf, stayedInRange } from './overview';
import type { BacktestResult, GridResult } from './types';

// Hand-made results: only the fields the rule reads.
const strategy = (inSample: number | null, outOfSample: number | null) =>
  ({
    in_sample: { metrics: { total_return_pct: inSample } },
    out_of_sample: { metrics: { total_return_pct: outOfSample } },
  }) as BacktestResult;

const grid = (
  inSample: number | null,
  outOfSample: number | null,
  oos: { outside?: number; liquidated?: boolean; exit?: string | null } = {},
  boundsSource = BOUNDS_HINDSIGHT,
) =>
  ({
    grid: { bounds_source: boundsSource },
    in_sample: { metrics: { total_return_pct: inSample, bars_outside_range_pct: 0, liquidated: false, range_exit_time: null } },
    out_of_sample: {
      metrics: {
        total_return_pct: outOfSample,
        bars_outside_range_pct: oos.outside ?? 0,
        liquidated: oos.liquidated ?? false,
        range_exit_time: oos.exit ?? null,
      },
    },
  }) as GridResult;

const losers = [strategy(-66.9, -42.9), strategy(-94, -69), strategy(-62.3, -18.5)];

describe('overviewOf', () => {
  it('says "all lost" only when every result lost in both samples', () => {
    expect(overviewOf(losers, [])).toBe('all-lost');
    expect(overviewOf(losers, [grid(-5, -2)])).toBe('all-lost');
    expect(overviewOf([...losers, strategy(-10, 3)], [])).toBe('as-they-came');
    expect(overviewOf([...losers, strategy(null, -3)], [])).toBe('as-they-came');
  });

  it('never says "all lost" once a grid gained', () => {
    expect(overviewOf(losers, [grid(3.17, 4.37)])).not.toBe('all-lost');
    expect(overviewOf(losers, [grid(-3, 4.37)])).not.toBe('all-lost');
  });

  it('names the grid gain only together with its condition', () => {
    expect(overviewOf(losers, [grid(3.17, 4.37)])).toBe('grid-ranged');
    // price left the range, the grid was liquidated, or the range rule ended it: no such sentence
    expect(overviewOf(losers, [grid(3.17, 4.37, { outside: 0.4 })])).toBe('as-they-came');
    expect(overviewOf(losers, [grid(3.17, 4.37, { liquidated: true })])).toBe('as-they-came');
    expect(overviewOf(losers, [grid(3.17, 4.37, { exit: '2026-09-01T00:00:00Z' })])).toBe('as-they-came');
    // a gain in one sample only is not "gained"
    expect(overviewOf(losers, [grid(3.17, -1)])).toBe('as-they-came');
    expect(overviewOf(losers, [grid(0, 4.37)])).toBe('as-they-came');
    // a strategy that did not lose, or more than one grid: the sentence would not be true
    expect(overviewOf([...losers, strategy(2, 1)], [grid(3.17, 4.37)])).toBe('as-they-came');
    expect(overviewOf(losers, [grid(3.17, 4.37), grid(1, 1)])).toBe('as-they-came');
    expect(overviewOf([], [grid(3.17, 4.37)])).toBe('as-they-came');
  });

  it('has nothing to say about no results', () => {
    expect(overviewOf([], [])).toBe('as-they-came');
  });
});

describe('the two facts a grid result is read with', () => {
  it('knows hindsight bounds from fixed ones', () => {
    expect(hasHindsightBounds(grid(1, 1))).toBe(true);
    expect(hasHindsightBounds(grid(1, 1, {}, BOUNDS_FIXED))).toBe(false);
  });

  it('counts a sample as in range only when nothing took it out', () => {
    expect(stayedInRange(grid(1, 1))).toBe(true);
    expect(stayedInRange(grid(1, 1, { outside: 0.01 }))).toBe(false);
    expect(stayedInRange(grid(1, 1, { liquidated: true }))).toBe(false);
    expect(stayedInRange(grid(1, 1, { outside: 3 }), 'in_sample')).toBe(true);
  });

  it('needs a gain in both samples', () => {
    expect(gainedInBothSamples(grid(3.17, 4.37))).toBe(true);
    expect(gainedInBothSamples(grid(3.17, 0))).toBe(false);
    expect(gainedInBothSamples(grid(null, 4.37))).toBe(false);
  });
});

describe('the headline over the published results', () => {
  it('is the mixed one today: signal strategies lost, the grid gained in its range', () => {
    // If this fails because a result was added or removed, read the new
    // headline on /backtests/ before changing the expectation.
    expect(overviewOf(results, gridResults)).toBe('grid-ranged');
  });

  it.each(locales)('%s: leaves no placeholder and counts the results it names', (locale) => {
    const t = backtests[locale];
    const top = headline(t.index, t.na);
    for (const text of [top.head, top.sub, top.caption, top.strategyCaption, top.fundingNote]) expect(text).not.toMatch(/\{\w+\}/);
    expect(top.n).toBe(String(results.length + gridResults.length));
    expect(top.head).toContain(String(results.length));
    expect(top.head).toContain(String(gridResults.length));
  });

  it('does not claim every result lost, and does not print the gain without its condition', () => {
    const t = backtests.en;
    const top = headline(t.index, t.na);
    expect(top.head).not.toMatch(/\ball\b/i);
    expect(top.head).toContain('range');
    // the two returns in the line under the headline are the grid's own, signed
    const grid = gridResults[0];
    expect(top.sub).toContain(formatPlusPct(grid.in_sample.metrics.total_return_pct));
    expect(top.sub).toContain(formatPlusPct(grid.out_of_sample.metrics.total_return_pct));
    expect(top.sub).toContain('+');
    expect(top.sub).toContain('afterwards');
    // funding: counted for the grid, not for the strategies, and the caption says exactly that
    expect(top.caption).toBe(t.index.captionMixed);
    expect(top.strategyCaption).toBe(t.index.caption);
    // the home page adds only the funding half to a sentence that already names fees and slippage
    expect(top.fundingNote).toBe(t.index.fundingGridOnly);
    expect(t.index.captionMixed.endsWith(top.fundingNote)).toBe(true);
  });
});
