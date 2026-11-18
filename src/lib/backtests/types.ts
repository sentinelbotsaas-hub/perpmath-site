// Shape of the slim result files in src/data/backtests/, written by
// scripts/backtests-import.mjs from the engine's schema-1 output
// (perpmath-engine/docs/output-format.md). A value the engine could not
// compute is null, never 0.

export interface Metrics {
  trades: number;
  insufficient_sample: boolean;
  wins: number;
  losses: number;
  /** Percent, 0 to 100. */
  win_rate_pct: number | null;
  avg_r: number | null;
  avg_trade_return_pct: number | null;
  t_stat: number | null;
  t_stat_n: number;
  /** Percent. Negative is a loss. */
  total_return_pct: number | null;
  /** Percent, reported as a positive number. */
  max_drawdown_pct: number | null;
  profit_factor: number | null;
  total_fees: number;
  avg_bars_held: number | null;
  final_equity: number;
  exit_reasons: Record<string, number>;
}

export interface EquityPoint {
  /** UTC, "2026-01-31T00:00:00Z". */
  t: string;
  equity: number;
}

export interface SampleBlock {
  first_bar: string;
  last_bar: string;
  bars: number;
  metrics: Metrics;
  signals: Record<string, number>;
  equity_curve: EquityPoint[];
}

export type SampleKey = 'in_sample' | 'out_of_sample';
export const SAMPLE_KEYS: readonly SampleKey[] = ['in_sample', 'out_of_sample'];

export interface BacktestResult {
  /** Page address: /backtests/<slug>/. */
  slug: string;
  source: {
    file: string;
    /** SHA-256 of the engine's result file, before the trade list was dropped. */
    sha256: string;
    engine: string;
    engine_version: string;
    trades_dropped: boolean;
  };
  schema_version: number;
  package: string;
  package_version: string;
  generated_at: string;
  strategy: string;
  symbol: string;
  interval: string;
  config: {
    strategy: string;
    params: Record<string, number>;
    execution: {
      /** Fraction: 0.00055 is 0.055%. */
      fee_rate: number;
      slippage: number;
      initial_capital: number;
      notional_fraction: number;
      max_hold_bars: number | null;
    };
    split: Record<string, number | string>;
  };
  data: {
    exchange: string;
    category: string;
    source: string;
    first_bar: string;
    last_bar: string;
    bars: number;
    missing_bars: number;
    file: string;
    file_sha256: string;
  };
  costs: {
    fee_rate_per_side: number;
    slippage_per_fill: number;
    funding_modelled: boolean;
  };
  timing: {
    signal: string;
    fill: string;
    same_bar_stop_and_target: string;
    lookahead_check: { passed: boolean; shortened_runs: number };
  };
  split: { oos_start: string };
  in_sample: SampleBlock;
  out_of_sample: SampleBlock;
  warnings: string[];
  disclaimer: string;
}
