// Guards for the published grid results and the things built from them:
// - every grid file in src/data/backtests/ is a complete slim grid result
//   whose ledger adds up;
// - the import script drops the fills, keeps the ones that are not grid
//   orders, and refuses a result that is not complete;
// - the figures the pages print are the ones in the engine's README
//   (checked only when the engine repository sits next to this one).
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
// @ts-ignore: a plain .mjs script; it has no type declarations
import { serialize, slim } from '../../../scripts/backtests-import.mjs';
import { comparisonVariant, formatPrice, formatUsdt, gridViews, publishedVariant } from '../../components/research/grid-views';
import { backtests } from '../../i18n/backtests';
import { equityChart } from './chart';
import { formatCount } from './format';
import { allResults, backtestPath, gridResults, results } from './load';
import { BOUNDS_FIXED, BOUNDS_HINDSIGHT } from './overview';
import { SAMPLE_KEYS, isGridResult } from './types';
import type { GridResult } from './types';

const t = backtests.en;

describe('loading', () => {
  it('sorts every file into exactly one of the two kinds', () => {
    expect(results.length + gridResults.length).toBe(allResults.length);
    expect(results.every((r) => !isGridResult(r))).toBe(true);
    expect(gridResults.every((r) => r.strategy === 'grid')).toBe(true);
  });

  it('gives every result its own page address', () => {
    const slugs = allResults.map((r) => r.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });
});

describe('published grid results', () => {
  it('finds the shipped grid', () => {
    expect(gridResults.map((r) => r.slug)).toContain('grid-btcusdt');
  });

  describe.each(gridResults.map((r) => [r.slug, r] as const))('%s', (_slug, result) => {
    it('records where it came from', () => {
      expect(result.source.sha256).toMatch(/^[0-9a-f]{64}$/);
      expect(result.source.file).toBe(`${result.slug}.json`);
      expect(result.source.engine_version).toBe(result.package_version);
      expect(result.schema_version).toBe(1);
      expect(backtestPath(result.slug)).toBe(`/backtests/${result.slug}/`);
    });

    it('carries no list of fills, only the ones that are not grid orders', () => {
      expect(result.source.fills_dropped).toBe(true);
      for (const key of SAMPLE_KEYS) {
        const block = result[key];
        expect('fills' in block).toBe(false);
        expect(block.closing_fills.every((fill) => (fill.kind as string) !== 'grid')).toBe(true);
        // every market fill is there: the count is the engine's own
        expect(block.closing_fills).toHaveLength(block.metrics.market_fills);
      }
    });

    it('has a grid block that agrees with its config', () => {
      const { grid, config } = result;
      expect(grid.levels).toHaveLength(grid.grid_count + 1);
      expect(grid.levels[0]).toBe(grid.lower);
      expect(grid.levels[grid.levels.length - 1]).toBe(grid.upper);
      expect(grid.grid_count).toBe(config.params.grid_count);
      expect(grid.cell_notional).toBeCloseTo((config.execution.initial_capital * grid.leverage) / grid.grid_count, 6);
      expect([BOUNDS_HINDSIGHT, BOUNDS_FIXED]).toContain(grid.bounds_source);
      expect(result.costs.round_trip_cost_pct).toBeCloseTo(2 * (result.costs.grid_fee_rate + result.costs.slippage_per_fill) * 100, 6);
    });

    it('has metric blocks whose ledger adds up', () => {
      const capital = result.config.execution.initial_capital;
      for (const key of SAMPLE_KEYS) {
        const m = result[key].metrics;
        expect(m.fills).toBe(m.grid_fills + m.market_fills);
        expect(m.total_fees).toBeCloseTo(m.grid_fees + m.market_fees, 2);
        expect(m.insufficient_sample).toBe(m.round_trips < 100);
        // docs/output-format.md: final_equity - initial_capital =
        // trading_pnl - total_fees - funding_paid - liquidation_loss, up to rounding
        const explained = m.trading_pnl - m.total_fees - (m.funding_paid ?? 0) - m.liquidation_loss;
        expect(Math.abs(m.final_equity - capital - explained)).toBeLessThan(0.03);
        expect(m.total_return_pct).toBeCloseTo((m.final_equity / capital - 1) * 100, 3);
      }
    });

    it('has equity points that start at the starting capital and end at the final equity', () => {
      for (const key of SAMPLE_KEYS) {
        const curve = result[key].equity_curve;
        expect(curve.length).toBeGreaterThanOrEqual(2);
        expect(curve[0].equity).toBe(result.config.execution.initial_capital);
        expect(curve[curve.length - 1].equity).toBe(result[key].metrics.final_equity);
      }
    });

    it('can be drawn with the charts the strategy pages use', () => {
      const chart = equityChart(result.in_sample.equity_curve, result.out_of_sample.equity_curve, result.split.oos_start);
      expect(chart.series).toHaveLength(2);
      expect(chart.yMax).toBeGreaterThan(chart.maxEquity);
    });

    it('has the comparison runs the page prints', () => {
      const used = result.timing.intrabar_path;
      const paths = ['worst_of_two', 'low_first', 'high_first', 'best_of_two'].filter((path) => path !== used);
      for (const path of paths) expect(result.comparisons).toHaveProperty([`intrabar_path=${path}`]);
      expect(result.comparisons).not.toHaveProperty([`intrabar_path=${used}`]);
    });
  });
});

describe('grid views', () => {
  const grid = gridResults.find((r) => r.slug === 'grid-btcusdt');

  it('formats prices and money without inventing digits', () => {
    expect(formatPrice(57755.8)).toBe('57,755.8');
    expect(formatPrice(64738.14978)).toBe('64,738.15');
    expect(formatPrice(91423)).toBe('91,423');
    expect(formatPrice(100)).toBe('100');
    expect(formatUsdt(3)).toBe('3.00');
    expect(formatUsdt(null)).toBeNull();
  });

  it.skipIf(!grid)('splits the trading profit into round trips and positions closed at market', () => {
    const result = grid as GridResult;
    for (const view of gridViews(result, t)) {
      const m = result[view.key].metrics;
      const closed = result[view.key].closing_fills.reduce((sum, fill) => sum + (fill.pnl ?? 0), 0);
      const number = (text: string) => Number(text.replace(/,/g, '').replace('−', '-'));
      // the two lines add back up to the engine's trading profit
      expect(number(view.ledger.roundTrips.text) + number(view.ledger.inventory.text)).toBeCloseTo(m.trading_pnl, 1);
      expect(number(view.ledger.inventory.text)).toBeCloseTo(closed, 2);
      // costs are shown as effects on equity: paid is negative
      expect(number(view.ledger.fees.text)).toBeCloseTo(-m.total_fees, 2);
      expect(number(view.ledger.funding.text)).toBeCloseTo(-(m.funding_paid as number), 2);
      expect(number(view.ledger.net.text)).toBeCloseTo(m.final_equity - result.config.execution.initial_capital, 2);
    }
  });

  it.skipIf(!grid)('says what each sample has to be read with', () => {
    const [inSample, outOfSample] = gridViews(grid as GridResult, t);
    expect(inSample.note).toBe(t.grid.notes.hindsight);
    expect(inSample.noteShort).toBe(t.grid.card.hindsight);
    expect(outOfSample.note).toBe(t.grid.notes.inRange);
    expect(outOfSample.noteShort).toBe(t.grid.card.inRange);
  });

  it('says so when price left the range, and when the bounds were fixed', () => {
    if (!grid) return;
    const moved: GridResult = {
      ...grid,
      grid: { ...grid.grid, bounds_source: BOUNDS_FIXED },
      out_of_sample: { ...grid.out_of_sample, metrics: { ...grid.out_of_sample.metrics, bars_outside_range_pct: 12.5 } },
    };
    const [inSample, outOfSample] = gridViews(moved, t);
    expect(inSample.note).toBe(t.grid.notes.fixed);
    expect(outOfSample.note).toContain('12.50%');
    expect(outOfSample.noteShort).toBe(t.grid.card.outOfRange);
    expect(() => gridViews({ ...grid, grid: { ...grid.grid, bounds_source: 'somewhere else' } }, t)).toThrow(/bounds_source/);
  });
});

describe('grid import', () => {
  // A hand-made schema-1 grid document: one round trip and one closing fill per sample.
  const sample = (finalEquity: number) => ({
    first_bar: '2026-01-01T00:00:00Z',
    last_bar: '2026-01-02T00:00:00Z',
    bars: 97,
    start_price: 100,
    metrics: {
      total_return_pct: (finalEquity / 1000 - 1) * 100,
      max_drawdown_pct: 1,
      final_equity: finalEquity,
      fills: 3,
      grid_fills: 2,
      market_fills: 1,
      round_trips: 1,
      insufficient_sample: true,
      trading_pnl: 1.5,
      total_fees: 0.5,
      grid_fees: 0.4,
      market_fees: 0.1,
      funding_paid: 0,
      funding_events: 3,
      liquidated: false,
      liquidation_time: null,
      liquidation_loss: 0,
      range_exit_time: null,
      bars_outside_range_pct: 0,
      max_position_notional: 100,
      avg_position_notional: 50,
    },
    buy_and_hold: { return_pct: -1, max_drawdown_pct: 2, funding_paid: 0.1, return_with_funding_pct: -1.1 },
    excess_return_vs_buy_and_hold_pct: 1.2,
    equity_curve: [
      { t: '2026-01-01T00:00:00Z', equity: 1000 },
      { t: '2026-01-02T00:00:00Z', equity: finalEquity },
    ],
    fills: [
      { n: 1, time: '2026-01-01T01:00:00Z', kind: 'grid', side: 'buy', cell: 0, level: 99, price: 99.02, quantity: 1, fee: 0.2, pnl: null },
      { n: 2, time: '2026-01-01T02:00:00Z', kind: 'grid', side: 'sell', cell: 0, level: 101, price: 100.98, quantity: 1, fee: 0.2, pnl: 1.96 },
      { n: 3, time: '2026-01-02T00:00:00Z', kind: 'end', side: 'sell', cell: null, level: null, price: 99.5, quantity: 1, fee: 0.1, pnl: -0.46 },
    ],
  });
  const variant = { total_return_pct: 0.2, max_drawdown_pct: 1, round_trips: 1, grid_fills: 2, total_fees: 0.5, funding_paid: 0, liquidated: false };
  const doc = {
    schema_version: 1,
    package: 'perpmath',
    package_version: '9.9.9',
    generated_at: '2026-01-03T00:00:00Z',
    strategy: 'grid',
    symbol: 'TESTUSDT',
    interval: '15m',
    config: { strategy: 'grid', params: {}, execution: { initial_capital: 1000 }, split: {} },
    data: { first_bar: '2026-01-01T00:00:00Z', last_bar: '2026-01-03T00:00:00Z', funding: null },
    costs: { grid_fee_rate: 0.0002, taker_fee_rate: 0.00055, slippage_per_fill: 0.0002, funding_modelled: true },
    timing: {},
    assumptions: ['one', 'two'],
    grid: {
      lower: 90,
      upper: 110,
      bounds_source: 'fixed in config',
      grid_count: 2,
      spacing: 'arithmetic',
      direction: 'neutral',
      leverage: 1,
      out_of_range: 'continue',
      cell_notional: 500,
      cell_width_pct_min: 10,
      cell_width_pct_max: 11.1111,
      levels: [90, 100, 110],
    },
    split: { oos_start: '2026-01-02T00:00:00Z' },
    in_sample: sample(1001),
    out_of_sample: sample(1000.5),
    comparisons: { 'intrabar_path=low_first': { in_sample: variant, out_of_sample: variant } },
    warnings: [],
    disclaimer: 'Fixed text.',
  };
  const bytes = Buffer.from(JSON.stringify(doc), 'utf8');
  const opts = { fileName: 'grid-testusdt.json', bytes };

  it('drops the fills, keeps the ones that are not grid orders and keeps everything else', () => {
    const out = slim(doc, opts) as GridResult & Record<string, unknown>;
    expect(out.slug).toBe('grid-testusdt');
    expect(isGridResult(out)).toBe(true);
    for (const key of SAMPLE_KEYS) {
      expect('fills' in out[key]).toBe(false);
      expect(out[key].closing_fills).toEqual([doc[key].fills[2]]);
      expect(out[key].metrics).toEqual(doc[key].metrics);
      expect(out[key].buy_and_hold).toEqual(doc[key].buy_and_hold);
      expect(out[key].equity_curve).toEqual(doc[key].equity_curve);
    }
    expect(out.grid).toEqual(doc.grid);
    expect(out.comparisons).toEqual(doc.comparisons);
    expect(out.assumptions).toEqual(doc.assumptions);
    expect(out.source).toEqual({
      file: 'grid-testusdt.json',
      sha256: createHash('sha256').update(bytes).digest('hex'),
      engine: 'perpmath',
      engine_version: '9.9.9',
      fills_dropped: true,
    });
  });

  it('writes the same text every time', () => {
    expect(serialize(slim(doc, opts))).toBe(serialize(slim(doc, opts)));
    expect(serialize(slim(doc, opts))).toContain('{ "t": "2026-01-02T00:00:00Z", "equity": 1000.5 }');
  });

  it('refuses a grid result that is not complete', () => {
    const { grid: _grid, ...withoutGrid } = doc;
    expect(() => slim(withoutGrid, opts)).toThrow(/"grid" is missing/);
    const { levels: _levels, ...gridWithoutLevels } = doc.grid;
    expect(() => slim({ ...doc, grid: gridWithoutLevels }, opts)).toThrow(/grid\.levels/);
    expect(() => slim({ ...doc, comparisons: [] }, opts)).toThrow(/comparisons/);
    expect(() => slim({ ...doc, comparisons: { x: { in_sample: variant } } }, opts)).toThrow(/comparisons\.x\.out_of_sample/);
    const { start_price: _start, ...sampleWithoutStart } = doc.in_sample;
    expect(() => slim({ ...doc, in_sample: sampleWithoutStart }, opts)).toThrow(/start_price/);
    // a fill list that does not match the engine's own count means a truncated file
    expect(() => slim({ ...doc, in_sample: { ...doc.in_sample, fills: doc.in_sample.fills.slice(0, 2) } }, opts)).toThrow(/fills/);
    expect(() => slim({ ...doc, split: {} }, opts)).toThrow(/oos_start/);
  });
});

const readme = fileURLToPath(new URL('../../../../perpmath-engine/README.md', import.meta.url));
const hasEngine = existsSync(readme);
const shipped = gridResults.find((r) => r.slug === 'grid-btcusdt');

describe('grid figures as printed, against the engine README', () => {
  const ascii = (text: string) => text.replace(/−/g, '-');

  // README rows look like:
  // | in-sample | 669 | 1,371 | +3.17% | 12.52% | 58.04 | 38.09 | -29.30% | -30.39% |
  it.skipIf(!hasEngine || !shipped)('prints the shipped result the way the README table does', () => {
    const text = readFileSync(readme, 'utf8');
    const result = shipped as GridResult;
    for (const view of gridViews(result, t)) {
      const m = result[view.key].metrics;
      const row = [
        view.key === 'in_sample' ? 'in-sample' : 'out-of-sample',
        view.roundTrips,
        view.fills,
        ascii(view.totalReturn),
        view.maxDrawdown,
        formatUsdt(m.total_fees),
        ascii(formatUsdt(m.funding_paid) ?? ''),
        ascii(view.buyHold),
        ascii(view.buyHoldFunding),
      ].join(' | ');
      expect(text).toContain(`| ${row} |`);
    }
  });

  // | `worst_of_two` (default) | +3.17% | +4.37% | +3.30% | +4.37% |   (15m in-sample, 15m out-of-sample, then 1m)
  it.skipIf(!hasEngine || !shipped)('prints the four intrabar paths the way the README does', () => {
    const text = readFileSync(readme, 'utf8');
    const result = shipped as GridResult;
    const used = result.timing.intrabar_path;
    for (const path of ['worst_of_two', 'low_first', 'high_first', 'best_of_two']) {
      const view = path === used ? publishedVariant(result, t.na) : comparisonVariant(result, `intrabar_path=${path}`, t.na);
      expect(view).not.toBeNull();
      const cells = `${ascii(view!.totalReturn.in_sample)} | ${ascii(view!.totalReturn.out_of_sample)}`;
      const label = path === used ? `\`${path}\` (default)` : `\`${path}\``;
      expect(text).toContain(`| ${label} | ${cells} |`);
    }
    const worst = publishedVariant(result, t.na).roundTrips.in_sample;
    const best = comparisonVariant(result, 'intrabar_path=best_of_two', t.na)!.roundTrips.in_sample;
    expect(text).toContain(`from ${worst} (worst) to ${best} (best)`);
  });

  it.skipIf(!hasEngine || !shipped)('prints the taker-fee and no-funding runs the way the README does', () => {
    const text = readFileSync(readme, 'utf8').replace(/\s+/g, ' ');
    const result = shipped as GridResult;
    const taker = comparisonVariant(result, 'grid_fills_at_taker_fee', t.na)!;
    const noFunding = comparisonVariant(result, 'without_funding', t.na)!;
    expect(text).toContain(`${ascii(taker.totalReturn.in_sample)} in-sample and ${ascii(taker.totalReturn.out_of_sample)} out-of-sample`);
    expect(text).toContain(`${ascii(noFunding.totalReturn.in_sample)} and ${ascii(noFunding.totalReturn.out_of_sample)}`);
  });

  it.skipIf(!hasEngine || !shipped)('has the bounds and the cell count the README gives', () => {
    const text = readFileSync(readme, 'utf8');
    const { grid } = shipped as GridResult;
    expect(text).toContain(`(${formatPrice(grid.lower)} to ${formatPrice(grid.upper)})`);
    expect(text).toContain(`${formatCount(grid.grid_count)} cells`);
  });
});
