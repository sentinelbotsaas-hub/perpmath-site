// Every result in src/data/backtests/, in a fixed order. Build-time only.
// Add a result by running scripts/backtests-import.mjs; its page and its row
// on /backtests/ appear by themselves.
//
// There are two kinds of file. `results` holds the signal strategies (one
// position at a time, trades with a stop: fvg, liquidity_sweep, ma_cross).
// `gridResults` holds the grid backtests, which have their own shape and
// their own page layout. `allResults` is both, for the things they share
// (a page address, a data period).
import { isGridResult } from './types';
import type { AnyResult, BacktestResult, GridResult } from './types';

const files = import.meta.glob<AnyResult>('../../data/backtests/*.json', { eager: true, import: 'default' });

export const allResults: AnyResult[] = Object.values(files).sort((a, b) => a.slug.localeCompare(b.slug));

export const results: BacktestResult[] = allResults.filter((r): r is BacktestResult => !isGridResult(r));

export const gridResults: GridResult[] = allResults.filter(isGridResult);

export function backtestPath(slug: string): string {
  return `/backtests/${slug}/`;
}
