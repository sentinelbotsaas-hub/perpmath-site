// Article en/walk-forward-analysis: the nine test-window returns of the
// walk-forward run, put through the site's Sharpe ratio calculator.
//
// Runs the calculator's own code, src/lib/calc/sharpe.ts (Node 22.18 or newer
// strips the type annotations when it imports a .ts file). The returns come
// from walk_forward.json, written by walk_forward.py. Risk-free rate 0. A test
// window is 30 days, so 12 periods a year is an approximation of 365 / 30.
//
// Usage, from the site's root folder, after walk_forward.py:
//   node research/walk-forward-analysis/sharpe_of_test_windows.mjs
// Output: research/walk-forward-analysis/sharpe_of_test_windows.json and a printout.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sharpe } from '../../src/lib/calc/sharpe.ts';

const here = dirname(fileURLToPath(import.meta.url));
const data = JSON.parse(readFileSync(join(here, 'walk_forward.json'), 'utf8'));
const round = (value, digits) => Number(value.toFixed(digits));

// Worked by hand: returns +1% and +3%. Mean 2%, sample deviation sqrt(2) %, Sharpe 1.41421, t = 2.
const check = sharpe({ returns: [0.01, 0.03], riskFreeRate: 0, periodsPerYear: 12 });
if (!check.ok || Math.abs(check.sharpe - Math.SQRT2) > 1e-9 || Math.abs(check.tStatistic - 2) > 1e-9) {
  throw new Error('self-check failed');
}

const out = {};
for (const key of ['rolling_total_return_pct', 'anchored_total_return_pct']) {
  const percents = data.walk_forward[key].test_return_pct_by_fold;
  const result = sharpe({ returns: percents.map((p) => p / 100), riskFreeRate: 0, periodsPerYear: 12 });
  if (!result.ok) throw new Error(`calculator refused the input: ${result.issues.join(', ')}`);
  out[key] = {
    returns_pct: percents,
    count: result.count,
    mean_pct: round(result.mean * 100, 4),
    standard_deviation_pct: round(result.standardDeviation * 100, 4),
    sharpe_per_period: round(result.sharpe, 4),
    annualized_sharpe: round(result.annualizedSharpe, 4),
    t_statistic: round(result.tStatistic, 4),
    interval_95_annualized: [round(result.annualizedInterval.low, 4), round(result.annualizedInterval.high, 4)],
    small_sample: result.smallSample,
    distinct_from_zero: result.distinctFromZero,
  };
  console.log(key, JSON.stringify(out[key]));
}
writeFileSync(join(here, 'sharpe_of_test_windows.json'), JSON.stringify(out, null, 1) + '\n');
console.log('wrote research/walk-forward-analysis/sharpe_of_test_windows.json');
