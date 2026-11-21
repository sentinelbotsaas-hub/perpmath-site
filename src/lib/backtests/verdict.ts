// The one-line verdict printed next to every metric block. It is decided by
// this rule and nothing else; the rule is printed on /backtests/.
//
//   1. fewer than MIN_TRADES trades            -> 'insufficient'
//      (the engine's own flag: below 100 trades every other number is noise)
//   2. the t-statistic could not be computed    -> 'not-computable'
//   3. t <= -T_THRESHOLD                        -> 'loss-clear'
//   4. t >=  T_THRESHOLD                        -> 'gain-clear'
//   5. otherwise (|t| < T_THRESHOLD)            -> 'no-difference'
//
// t is the engine's one-sample t-statistic of per-trade net returns against
// zero. Rule 1 wins over the others: a large t on 30 trades is still 30 trades.
import type { Metrics, SampleKey } from './types';
import { SAMPLE_KEYS } from './types';

export const MIN_TRADES = 100;
export const T_THRESHOLD = 2;

export type VerdictCode = 'insufficient' | 'not-computable' | 'loss-clear' | 'gain-clear' | 'no-difference';

export function verdictOf(metrics: Pick<Metrics, 'trades' | 't_stat'>): VerdictCode {
  if (!Number.isFinite(metrics.trades) || metrics.trades < MIN_TRADES) return 'insufficient';
  const t = metrics.t_stat;
  if (t === null || !Number.isFinite(t)) return 'not-computable';
  if (t <= -T_THRESHOLD) return 'loss-clear';
  if (t >= T_THRESHOLD) return 'gain-clear';
  return 'no-difference';
}

/** True when equity ended lower than it started in both samples. */
export function lostInBothSamples(result: Record<SampleKey, { metrics: { total_return_pct: number | null } }>): boolean {
  return SAMPLE_KEYS.every((key) => {
    const r = result[key].metrics.total_return_pct;
    return r !== null && r < 0;
  });
}
