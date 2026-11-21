// Facts about the open-source engine that the pages quote: where it lives, the
// commands from its README and the default limits of its testnet runner. They
// are copied by hand from perpmath-engine/README.md ("Install", "Use", "Grid
// backtest", "Testnet runner"); data.test.ts compares them with that file
// whenever the engine repository sits next to this one.
import { exclusiveEnd } from './format';
import type { GridResult } from './types';

export const REPO_URL = 'https://github.com/sentinelbotsaas-hub/perpmath';

/** The latest release (pyproject.toml "version"). The published results may come from an older one. */
export const ENGINE_VERSION = '0.2.2';
const BRANCH = 'main';

/** README, "Install". Python 3.10 or newer; the only dependency is NumPy. */
export const INSTALL_COMMANDS = [
  'git clone https://github.com/sentinelbotsaas-hub/perpmath.git',
  'cd perpmath',
  'python -m venv .venv',
  'source .venv/bin/activate        # Windows: .venv\\Scripts\\activate',
  'pip install -e .',
];

/** README, "Use": one year of 15-minute candles from the public endpoint. */
export const DOWNLOAD_COMMAND = 'perpmath download BTCUSDT 15m --days 365';

/** README, "Use": run a strategy with a fixed config and write the result. */
export const BACKTEST_COMMAND =
  'perpmath backtest fvg --symbol BTCUSDT --interval 15m --config configs/fvg.json --out results/fvg-btcusdt.json';

/**
 * README, "Grid backtest": candles for an exact range, the settled funding
 * rates over it, then the grid run. These three lines reproduce the shipped
 * grid result.
 */
export const GRID_DOWNLOAD_COMMAND = 'perpmath download BTCUSDT 15m --start 2025-11-18T11:30:00Z --end 2026-11-18T11:30:00Z';
export const GRID_FUNDING_COMMAND = 'perpmath funding BTCUSDT --start 2025-11-18T00:00:00Z --end 2026-11-18T12:00:00Z';
export const GRID_COMMAND =
  'perpmath grid --symbol BTCUSDT --interval 15m --config configs/grid.json --out results/grid-btcusdt.json';

/** README, "Testnet runner", "Dry run first": no key, no signed request, one bar and stop. */
export const LIVE_DRY_RUN_COMMAND =
  'perpmath live ma_cross --symbol BTCUSDT --interval 15m --config configs/live/ma_cross.json --dry-run --once';

/** The only two environment variables the runner reads (README, "Getting a testnet key"). Names, not values. */
export const LIVE_KEY_ENV = ['BYBIT_TESTNET_API_KEY', 'BYBIT_TESTNET_API_SECRET'] as const;

/**
 * README, "Circuit breakers": the settings in the `live` section of a config
 * and their defaults. `unit` says what the number counts; the sentence that
 * says when each one trips is in src/i18n/bot.ts under the same key.
 */
export const LIVE_BREAKERS = [
  { setting: 'max_daily_loss_usdt', value: 20, unit: 'usdt' },
  { setting: 'max_position_notional_usdt', value: 200, unit: 'usdt' },
  { setting: 'max_consecutive_api_errors', value: 5, unit: 'count' },
  { setting: 'max_clock_skew_ms', value: 5000, unit: 'ms' },
] as const;

/** README, "Circuit breakers": the exit code of a tripped breaker and two more defaults quoted on /bot/. */
export const LIVE_HALT_EXIT_CODE = 3;
export const LIVE_MAX_SIGNAL_DELAY_SECONDS = 60;
export const LIVE_ORDER_NOTIONAL_USDT = 100;

const file = (path: string) => `${REPO_URL}/blob/${BRANCH}/${path}`;

/** The strategy module; its docstring holds the exact rules. */
export function strategySourceUrl(strategy: string): string {
  return file(`src/perpmath/strategies/${strategy}.py`);
}

/** The grid simulator. */
export const GRID_SOURCE_URL = file('src/perpmath/grid.py');

/** Sections of the README on GitHub (the anchors GitHub makes from the headings). */
export const README_GRID_URL = `${REPO_URL}#grid-backtest`;
export const README_INTRABAR_URL = `${REPO_URL}#intrabar-path-the-main-assumption`;
export const README_LIVE_URL = `${REPO_URL}#testnet-runner-02`;
export const README_BROKER_URL = `${REPO_URL}#broker-id`;

/** The full result in the engine repository, every trade (or every fill) included. */
export function resultSourceUrl(result: { source: { file: string } }): string {
  return file(`results/${result.source.file}`);
}

interface Reproducible {
  symbol: string;
  interval: string;
  strategy: string;
  data: { first_bar: string; last_bar: string };
  source: { file: string };
}

/**
 * The two commands that reproduce a published result, built from the result
 * itself. The download uses dates (not --days) so the range is the same
 * whenever it is run; --end is exclusive, hence one bar after the last bar.
 * The config path follows the engine's layout: configs/<strategy>.json.
 */
export function reproduceCommands(result: Reproducible): { download: string; backtest: string } {
  const { symbol, interval, strategy, data, source } = result;
  return {
    download: `perpmath download ${symbol} ${interval} --start ${data.first_bar} --end ${exclusiveEnd(data.last_bar, interval)}`,
    backtest: `perpmath backtest ${strategy} --symbol ${symbol} --interval ${interval} --config configs/${strategy}.json --out results/${source.file}`,
  };
}

const HOUR_MS = 3_600_000;

/**
 * The three commands that reproduce a published grid result. The candles are
 * the same line as for a strategy. The funding range is wider than the candle
 * range on both sides, the way the README writes it: from the UTC midnight of
 * the first bar's day to the first whole hour at or after the end of the last
 * bar, so every settlement inside the bars is covered.
 */
export function gridReproduceCommands(result: GridResult): { download: string; funding: string; grid: string } {
  const { symbol, interval, data, source } = result;
  const end = exclusiveEnd(data.last_bar, interval);
  const fundingStart = `${data.first_bar.slice(0, 10)}T00:00:00Z`;
  const fundingEnd = `${new Date(Math.ceil(Date.parse(end) / HOUR_MS) * HOUR_MS).toISOString().slice(0, 19)}Z`;
  return {
    download: `perpmath download ${symbol} ${interval} --start ${data.first_bar} --end ${end}`,
    funding: `perpmath funding ${symbol} --start ${fundingStart} --end ${fundingEnd}`,
    grid: `perpmath grid --symbol ${symbol} --interval ${interval} --config configs/grid.json --out results/${source.file}`,
  };
}
