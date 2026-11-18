// Every result in src/data/backtests/, in a fixed order. Build-time only.
// Add a result by running scripts/backtests-import.mjs; its page and its row
// on /backtests/ appear by themselves.
import type { BacktestResult } from './types';

const files = import.meta.glob<BacktestResult>('../../data/backtests/*.json', { eager: true, import: 'default' });

export const results: BacktestResult[] = Object.values(files).sort((a, b) => a.slug.localeCompare(b.slug));

export function backtestPath(slug: string): string {
  return `/backtests/${slug}/`;
}
