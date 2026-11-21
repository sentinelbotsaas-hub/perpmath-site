// What can be said about all the published backtests in one line. The
// headline of /backtests/, the home page preview and the results section of
// /bot/ all ask this file, so the three can never disagree, and none of them
// can call a mixed set of results "all lost" or advertise the one that gained.
//
//   'all-lost'    every result ended lower than it started in both samples
//   'grid-ranged' every signal strategy lost in both samples, and the one
//                 grid gained in both while price never left its range
//                 out-of-sample: a gain that depends on that condition
//   'as-they-came' anything else: no summary sentence, the results speak
//
// The two facts a grid result has to be read with are decided here too, from
// the result file alone: whether its bounds were taken from the in-sample
// period itself (hindsight), and whether price stayed inside them.
import { SAMPLE_KEYS } from './types';
import type { BacktestResult, GridResult, SampleKey } from './types';
import { lostInBothSamples } from './verdict';

/** `grid.bounds_source` as the engine writes it (docs/output-format.md). */
export const BOUNDS_HINDSIGHT = 'in-sample lowest low and highest high';
export const BOUNDS_FIXED = 'fixed in config';

export type OverviewCode = 'all-lost' | 'grid-ranged' | 'as-they-came';

type Returns = Record<SampleKey, { metrics: { total_return_pct: number | null } }>;

/** True when equity ended higher than it started in both samples. */
export function gainedInBothSamples(result: Returns): boolean {
  return SAMPLE_KEYS.every((key) => {
    const r = result[key].metrics.total_return_pct;
    return r !== null && r > 0;
  });
}

/** True when the grid's bounds are the in-sample period's own low and high. */
export function hasHindsightBounds(grid: Pick<GridResult, 'grid'>): boolean {
  return grid.grid.bounds_source === BOUNDS_HINDSIGHT;
}

/**
 * True when no bar of the sample closed outside the grid and nothing ended it
 * early: not liquidated, no range exit.
 */
export function stayedInRange(grid: GridResult, key: SampleKey = 'out_of_sample'): boolean {
  const m = grid[key].metrics;
  return m.bars_outside_range_pct === 0 && !m.liquidated && m.range_exit_time === null;
}

export function overviewOf(strategies: BacktestResult[], grids: GridResult[]): OverviewCode {
  const everything: Returns[] = [...strategies, ...grids];
  if (everything.length > 0 && everything.every(lostInBothSamples)) return 'all-lost';
  if (
    strategies.length > 0 &&
    strategies.every(lostInBothSamples) &&
    grids.length === 1 &&
    gainedInBothSamples(grids[0]) &&
    stayedInRange(grids[0])
  ) {
    return 'grid-ranged';
  }
  return 'as-they-came';
}
