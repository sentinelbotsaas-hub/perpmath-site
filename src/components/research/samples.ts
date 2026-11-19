// The figures of one backtest result, formatted for display: one view per
// sample (in-sample, out-of-sample). Used by /backtests/, /backtests/<slug>/
// and /bot/, so the three pages can never print the same number differently.
//
// Build-time only. Nothing is computed here that the result file does not
// hold: every value is read from `metrics` and passed through the formatters
// in src/lib/backtests/format.ts. A value the engine could not compute stays
// "not computed" (`na`), never 0.
import { formatCount, formatDay, formatPct, formatSigned } from '../../lib/backtests/format';
import { SAMPLE_KEYS } from '../../lib/backtests/types';
import type { BacktestResult, SampleKey } from '../../lib/backtests/types';
import { verdictOf } from '../../lib/backtests/verdict';
import type { VerdictCode } from '../../lib/backtests/verdict';
import { fmt } from '../../lib/fmt';

/** The strings this needs, from src/i18n/backtests.ts. */
export interface SampleStrings {
  na: string;
  range: string;
  samples: Record<SampleKey, string>;
  verdict: Record<VerdictCode, string>;
}

export interface SampleView {
  key: SampleKey;
  /** "In-sample", "Out-of-sample". */
  sample: string;
  /** "2025-11-18 to" and "2026-07-30": two parts, so a narrow column can stack them. */
  rangeLead: string;
  rangeEnd: string;
  trades: string;
  wins: string;
  /** Percent, 0 to 100, or null when the engine did not compute it. */
  winRate: number | null;
  winRateText: string;
  avgR: string;
  /** -1, 0 or 1, like totalReturnSign. */
  avgRSign: -1 | 0 | 1;
  tStat: string;
  totalReturn: string;
  /** -1, 0 or 1; 0 also when the value was not computed. Colour follows it, next to the printed sign. */
  totalReturnSign: -1 | 0 | 1;
  maxDrawdown: string;
  /** Percent, 0 to 100, or null when the engine did not compute it. For the depth bar. */
  maxDrawdownPct: number | null;
  verdictCode: VerdictCode;
  verdict: string;
}

export function sampleViews(result: BacktestResult, t: SampleStrings): SampleView[] {
  return SAMPLE_KEYS.map((key) => {
    const block = result[key];
    const m = block.metrics;
    const verdictCode = verdictOf(m);
    const r = m.total_return_pct;
    return {
      key,
      sample: t.samples[key],
      rangeLead: fmt(t.range, { from: formatDay(block.first_bar), to: '' }).trim(),
      rangeEnd: formatDay(block.last_bar),
      trades: formatCount(m.trades),
      wins: formatCount(m.wins),
      winRate: m.win_rate_pct,
      winRateText: formatPct(m.win_rate_pct) ?? t.na,
      avgR: formatSigned(m.avg_r) ?? t.na,
      avgRSign: m.avg_r === null || !Number.isFinite(m.avg_r) || m.avg_r === 0 ? 0 : m.avg_r < 0 ? -1 : 1,
      tStat: formatSigned(m.t_stat) ?? t.na,
      totalReturn: formatPct(r) ?? t.na,
      totalReturnSign: r === null || !Number.isFinite(r) || r === 0 ? 0 : r < 0 ? -1 : 1,
      maxDrawdown: formatPct(m.max_drawdown_pct) ?? t.na,
      maxDrawdownPct: m.max_drawdown_pct,
      verdictCode,
      verdict: t.verdict[verdictCode],
    };
  });
}

/** "negative" for a loss, "positive" for a gain: the value of data-tone. */
export function toneOf(sign: -1 | 0 | 1): 'negative' | 'positive' | undefined {
  return sign < 0 ? 'negative' : sign > 0 ? 'positive' : undefined;
}
