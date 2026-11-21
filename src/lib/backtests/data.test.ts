// Guards for the published data and the things built from it:
// - every file in src/data/backtests/ is a complete slim result;
// - the import script drops the trades, keeps the rest and records the hash;
// - the commands quoted on the pages are the ones in the engine's README
//   (checked only when the engine repository sits next to this one).
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
// @ts-ignore: a plain .mjs script; it has no type declarations
import { serialize, slim, slugOf } from '../../../scripts/backtests-import.mjs';
import { equityChart } from './chart';
import {
  BACKTEST_COMMAND,
  DOWNLOAD_COMMAND,
  GRID_COMMAND,
  GRID_DOWNLOAD_COMMAND,
  GRID_FUNDING_COMMAND,
  INSTALL_COMMANDS,
  LIVE_BREAKERS,
  LIVE_DRY_RUN_COMMAND,
  LIVE_HALT_EXIT_CODE,
  LIVE_KEY_ENV,
  LIVE_MAX_SIGNAL_DELAY_SECONDS,
  LIVE_ORDER_NOTIONAL_USDT,
  gridReproduceCommands,
  reproduceCommands,
} from './engine';
import { formatCount, formatPct, formatSigned } from './format';
import { backtestPath, gridResults, results } from './load';
import { SAMPLE_KEYS } from './types';
import type { BacktestResult } from './types';
import { verdictOf } from './verdict';

describe('published results', () => {
  it('finds at least one result', () => {
    expect(results.length).toBeGreaterThan(0);
  });

  describe.each(results.map((r) => [r.slug, r] as const))('%s', (_slug, result) => {
    it('records where it came from', () => {
      expect(result.source.sha256).toMatch(/^[0-9a-f]{64}$/);
      expect(result.source.file).toBe(`${result.slug}.json`);
      expect(result.source.engine_version).toBe(result.package_version);
      expect(result.schema_version).toBe(1);
    });

    it('carries no per-trade list', () => {
      for (const key of SAMPLE_KEYS) expect('trades' in result[key]).toBe(false);
      expect(result.source.trades_dropped).toBe(true);
    });

    it('has consistent metric blocks', () => {
      for (const key of SAMPLE_KEYS) {
        const m = result[key].metrics;
        expect(m.wins + m.losses).toBeLessThanOrEqual(m.trades);
        expect(m.insufficient_sample).toBe(m.trades < 100);
        expect(m.t_stat_n).toBe(m.trades);
        if (m.win_rate_pct !== null) expect(m.win_rate_pct).toBeCloseTo((m.wins / m.trades) * 100, 3);
        // the verdict rule must give an answer for every published block
        expect(['insufficient', 'not-computable', 'loss-clear', 'gain-clear', 'no-difference']).toContain(verdictOf(m));
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

    it('can be drawn', () => {
      const chart = equityChart(result.in_sample.equity_curve, result.out_of_sample.equity_curve, result.split.oos_start);
      expect(chart.series).toHaveLength(2);
      expect(chart.yMax).toBeGreaterThan(chart.maxEquity);
    });

    it('has a page address with slashes at both ends', () => {
      expect(backtestPath(result.slug)).toBe(`/backtests/${result.slug}/`);
    });
  });
});

describe('import script', () => {
  // A hand-made schema-1 document with one trade per sample.
  const sample = (finalEquity: number) => ({
    first_bar: '2026-01-01T00:00:00Z',
    last_bar: '2026-01-02T00:00:00Z',
    bars: 97,
    metrics: {
      trades: 1,
      insufficient_sample: true,
      wins: 0,
      losses: 1,
      win_rate_pct: 0,
      avg_r: -1,
      avg_trade_return_pct: -1,
      t_stat: null,
      t_stat_n: 1,
      total_return_pct: -1,
      max_drawdown_pct: 1,
      profit_factor: 0,
      total_fees: 1.1,
      avg_bars_held: 3,
      final_equity: finalEquity,
      exit_reasons: { stop: 1 },
    },
    signals: { seen: 1, skipped_in_position: 0, skipped_invalid_stop: 0, skipped_no_equity: 0 },
    equity_curve: [
      { t: '2026-01-01T00:00:00Z', equity: 1000 },
      { t: '2026-01-02T00:00:00Z', equity: finalEquity },
    ],
    trades: [{ n: 1, side: 'long', pnl: -10 }],
  });
  const doc = {
    schema_version: 1,
    package: 'perpmath',
    package_version: '9.9.9',
    generated_at: '2026-01-03T00:00:00Z',
    strategy: 'demo',
    symbol: 'TESTUSDT',
    interval: '15m',
    config: { strategy: 'demo', params: {}, execution: {}, split: {} },
    data: { first_bar: '2026-01-01T00:00:00Z', last_bar: '2026-01-03T00:00:00Z' },
    costs: { fee_rate_per_side: 0.00055, slippage_per_fill: 0.0002, funding_modelled: false },
    timing: {},
    split: { oos_start: '2026-01-02T00:00:00Z' },
    in_sample: sample(990),
    out_of_sample: sample(985.5),
    warnings: ['in_sample: fewer than 100 trades'],
    disclaimer: 'Fixed text.',
  };
  const bytes = Buffer.from(JSON.stringify(doc), 'utf8');

  it('drops the trades and keeps everything else', () => {
    const out = slim(doc, { fileName: 'demo-testusdt.json', bytes }) as BacktestResult & Record<string, unknown>;
    expect(out.slug).toBe('demo-testusdt');
    expect('trades' in out.in_sample).toBe(false);
    expect('trades' in out.out_of_sample).toBe(false);
    expect(out.in_sample.metrics).toEqual(doc.in_sample.metrics);
    expect(out.out_of_sample.equity_curve).toEqual(doc.out_of_sample.equity_curve);
    expect(out.config).toEqual(doc.config);
    expect(out.costs).toEqual(doc.costs);
    expect(out.generated_at).toBe('2026-01-03T00:00:00Z');
    expect(out.warnings).toEqual(doc.warnings);
  });

  it('records the SHA-256 of the source bytes and the engine version', () => {
    const out = slim(doc, { fileName: 'demo-testusdt.json', bytes });
    expect(out.source.sha256).toBe(createHash('sha256').update(bytes).digest('hex'));
    expect(out.source.engine_version).toBe('9.9.9');
    expect(out.source.file).toBe('demo-testusdt.json');
  });

  it('writes the same text every time and keeps one equity point per line', () => {
    const a = serialize(slim(doc, { fileName: 'demo-testusdt.json', bytes }));
    const b = serialize(slim(doc, { fileName: 'demo-testusdt.json', bytes }));
    expect(a).toBe(b);
    expect(a).toContain('{ "t": "2026-01-02T00:00:00Z", "equity": 985.5 }');
    expect(JSON.parse(a).out_of_sample.equity_curve[1].equity).toBe(985.5);
  });

  it('refuses anything that is not a complete schema-1 result', () => {
    const opts = { fileName: 'demo-testusdt.json', bytes };
    expect(() => slim({ ...doc, schema_version: 2 }, opts)).toThrow(/schema_version/);
    const { costs: _costs, ...withoutCosts } = doc;
    expect(() => slim(withoutCosts, opts)).toThrow(/costs/);
    expect(() => slim({ ...doc, out_of_sample: { ...doc.out_of_sample, equity_curve: [] } }, opts)).toThrow(/equity_curve/);
    expect(() => slim({ ...doc, split: {} }, opts)).toThrow(/oos_start/);
    expect(() => slim([], opts)).toThrow();
  });

  it('only accepts file names that make a clean page address', () => {
    expect(slugOf('fvg-btcusdt.json')).toBe('fvg-btcusdt');
    expect(() => slugOf('FVG BTC.json')).toThrow();
    expect(() => slugOf('fvg_btcusdt.json')).toThrow();
  });
});

const readme = fileURLToPath(new URL('../../../../perpmath-engine/README.md', import.meta.url));
const hasEngine = existsSync(readme);

describe('figures as printed, against the table in the engine README', () => {
  // README rows look like:
  // | fvg | in-sample | 801 | 31.46% | -0.57 | -4.93 | -66.94% | 66.97% |
  it.skipIf(!hasEngine)('prints every shipped metric the way the README does', () => {
    const text = readFileSync(readme, 'utf8');
    const ascii = (s: string | null) => (s ?? 'n/a').replace(/−/g, '-');
    let compared = 0;
    for (const result of results) {
      for (const key of SAMPLE_KEYS) {
        const m = result[key].metrics;
        const label = key === 'in_sample' ? 'in-sample' : 'out-of-sample';
        const row = [
          result.strategy,
          label,
          formatCount(m.trades),
          ascii(formatPct(m.win_rate_pct)),
          ascii(formatSigned(m.avg_r)),
          ascii(formatSigned(m.t_stat)),
          ascii(formatPct(m.total_return_pct)),
          ascii(formatPct(m.max_drawdown_pct)),
        ].join(' | ');
        if (!text.includes(`| ${result.strategy} | ${label} |`)) continue; // a result the README does not list
        expect(text).toContain(`| ${row} |`);
        compared += 1;
      }
    }
    expect(compared).toBeGreaterThan(0);
  });
});

describe('commands quoted from the engine README', () => {

  it.skipIf(!hasEngine)('are in the README word for word', () => {
    const text = readFileSync(readme, 'utf8').replace(/\r\n/g, '\n');
    expect(text).toContain(INSTALL_COMMANDS.join('\n'));
    expect(text).toContain(DOWNLOAD_COMMAND);
    expect(text).toContain(BACKTEST_COMMAND);
  });

  it('builds the reproduction commands from a result', () => {
    const fvg = results.find((r) => r.slug === 'fvg-btcusdt');
    if (!fvg) return; // the shipped example was removed; nothing to compare
    const commands = reproduceCommands(fvg);
    expect(commands.backtest).toBe(BACKTEST_COMMAND);
    expect(commands.download).toBe(
      `perpmath download ${fvg.symbol} ${fvg.interval} --start ${fvg.data.first_bar} --end 2026-11-18T11:30:00Z`,
    );
  });

  it.skipIf(!hasEngine)('reproduces the exact-range download line of the README', () => {
    const fvg = results.find((r) => r.slug === 'fvg-btcusdt');
    if (!fvg) return;
    const text = readFileSync(readme, 'utf8');
    expect(text).toContain(reproduceCommands(fvg).download);
  });

  it.skipIf(!hasEngine)('has the grid and dry-run commands word for word', () => {
    const text = readFileSync(readme, 'utf8').replace(/\r\n/g, '\n');
    // The three grid lines are one block in the README, in this order.
    expect(text).toContain([GRID_DOWNLOAD_COMMAND, GRID_FUNDING_COMMAND, GRID_COMMAND].join('\n'));
    expect(text).toContain(LIVE_DRY_RUN_COMMAND);
  });

  it('builds the grid reproduction commands from a result', () => {
    const grid = gridResults.find((r) => r.slug === 'grid-btcusdt');
    if (!grid) return; // the shipped example was removed; nothing to compare
    expect(gridReproduceCommands(grid)).toEqual({
      download: GRID_DOWNLOAD_COMMAND,
      funding: GRID_FUNDING_COMMAND,
      grid: GRID_COMMAND,
    });
  });

  it('covers every funding settlement inside the bars with the funding command', () => {
    for (const grid of gridResults) {
      const funding = grid.data.funding;
      if (!funding) continue;
      const [, start, end] = /--start (\S+) --end (\S+)$/.exec(gridReproduceCommands(grid).funding) ?? [];
      expect(Date.parse(start)).toBeLessThanOrEqual(Date.parse(funding.first));
      expect(Date.parse(end)).toBeGreaterThan(Date.parse(funding.last));
      expect(Date.parse(start)).toBeLessThanOrEqual(Date.parse(grid.data.first_bar));
    }
  });
});

describe('testnet runner facts quoted from the engine README', () => {
  it.skipIf(!hasEngine)('has every circuit breaker with its default', () => {
    const text = readFileSync(readme, 'utf8');
    // README rows look like: | `max_daily_loss_usdt` | 20 | USDT equity has fallen ...
    for (const breaker of LIVE_BREAKERS) {
      expect(text).toContain(`| \`${breaker.setting}\` | ${breaker.value} |`);
    }
    // ...and the page lists all of them, not a selection.
    const rows = text.match(/^\| `max_[a-z_]+` \| \d+ \|/gm) ?? [];
    expect(rows).toHaveLength(LIVE_BREAKERS.length);
  });

  it.skipIf(!hasEngine)('has the exit code, the signal delay, the entry size and the key variables', () => {
    const text = readFileSync(readme, 'utf8').replace(/\s+/g, ' ');
    expect(text).toContain(`exits with code ${LIVE_HALT_EXIT_CODE}`);
    expect(text).toContain(`\`max_signal_delay_seconds\` (default ${LIVE_MAX_SIGNAL_DELAY_SECONDS})`);
    expect(text).toContain(`\`order_notional_usdt\` (${LIVE_ORDER_NOTIONAL_USDT},`);
    expect(text).toContain(`perpmath reads only ${LIVE_KEY_ENV.map((name) => `\`${name}\``).join(' and ')}`);
  });
});
