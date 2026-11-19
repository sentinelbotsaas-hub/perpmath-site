// Facts about the open-source engine that the pages quote: where it lives and
// the commands from its README. They are copied by hand from
// perpmath-engine/README.md ("Install" and "Use"); engine.test.ts compares
// them with that file whenever the engine repository sits next to this one.
import { exclusiveEnd } from './format';
import type { BacktestResult } from './types';

export const REPO_URL = 'https://github.com/sentinelbotsaas-hub/perpmath';

/** The latest release (pyproject.toml "version"). The published results may come from an older one. */
export const ENGINE_VERSION = '0.2.0';
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

const file = (path: string) => `${REPO_URL}/blob/${BRANCH}/${path}`;

/** The strategy module; its docstring holds the exact rules. */
export function strategySourceUrl(strategy: string): string {
  return file(`src/perpmath/strategies/${strategy}.py`);
}

/** The full result in the engine repository, every trade included. */
export function resultSourceUrl(result: BacktestResult): string {
  return file(`results/${result.source.file}`);
}

/**
 * The two commands that reproduce a published result, built from the result
 * itself. The download uses dates (not --days) so the range is the same
 * whenever it is run; --end is exclusive, hence one bar after the last bar.
 * The config path follows the engine's layout: configs/<strategy>.json.
 */
export function reproduceCommands(result: BacktestResult): { download: string; backtest: string } {
  const { symbol, interval, strategy, data, source } = result;
  return {
    download: `perpmath download ${symbol} ${interval} --start ${data.first_bar} --end ${exclusiveEnd(data.last_bar, interval)}`,
    backtest: `perpmath backtest ${strategy} --symbol ${symbol} --interval ${interval} --config configs/${strategy}.json --out results/${source.file}`,
  };
}
