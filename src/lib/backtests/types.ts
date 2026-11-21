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

// --- grid results ------------------------------------------------------------
// A grid backtest ("strategy": "grid") has its own layout in the engine's
// output (docs/output-format.md, "Grid result file") and its own slim shape
// here. It shares the split, the equity points and the data block with the
// strategy results, so the same charts draw both.

export type GridSpacing = 'arithmetic' | 'geometric';
export type GridDirection = 'neutral' | 'long' | 'short';
export type GridOutOfRange = 'continue' | 'stop' | 'close';
export type IntrabarPath = 'worst_of_two' | 'low_first' | 'high_first' | 'best_of_two';

export interface GridMetrics {
  /** Percent. Negative is a loss. */
  total_return_pct: number | null;
  /** Percent, reported as a positive number. */
  max_drawdown_pct: number | null;
  final_equity: number;
  /** All fills: grid_fills + market_fills. */
  fills: number;
  grid_fills: number;
  market_fills: number;
  /** Cell positions closed by their own grid order (completed grid pairs). */
  round_trips: number;
  insufficient_sample: boolean;
  /** Price profit of all closed positions, slippage included, before fees and funding. */
  trading_pnl: number;
  total_fees: number;
  grid_fees: number;
  market_fees: number;
  /** Net funding paid; negative = received. null when funding is off. */
  funding_paid: number | null;
  funding_events: number | null;
  liquidated: boolean;
  liquidation_time: string | null;
  liquidation_loss: number;
  range_exit_time: string | null;
  /** Share of bar closes outside [lower, upper], in percent. */
  bars_outside_range_pct: number;
  max_position_notional: number;
  avg_position_notional: number;
}

/** A fill that is not a grid order: the start position, a range close, the end of a sample, a liquidation. */
export interface GridClosingFill {
  n: number;
  time: string;
  kind: 'initial' | 'range_close' | 'end' | 'liquidation';
  side: 'buy' | 'sell';
  cell: null;
  level: null;
  /** Fill price, slippage included. */
  price: number;
  /** Base-asset quantity. */
  quantity: number;
  fee: number;
  /** Profit before fees of the position this fill closed; null when it opened one. */
  pnl: number | null;
}

export interface GridSampleBlock {
  first_bar: string;
  last_bar: string;
  bars: number;
  /** Open of the first bar, where the grid was placed. */
  start_price: number;
  metrics: GridMetrics;
  /** A 1x long perpetual bought at the first open and sold at the last close with market orders. */
  buy_and_hold: {
    return_pct: number | null;
    max_drawdown_pct: number | null;
    funding_paid: number | null;
    return_with_funding_pct: number | null;
  };
  /** Grid total return minus buy and hold (with funding when funding is on), in percentage points. */
  excess_return_vs_buy_and_hold_pct: number | null;
  equity_curve: EquityPoint[];
  closing_fills: GridClosingFill[];
}

/** One line of `comparisons`: the same run with one thing changed. */
export interface GridVariantSample {
  total_return_pct: number | null;
  max_drawdown_pct: number | null;
  round_trips: number;
  grid_fills: number;
  total_fees: number;
  funding_paid: number | null;
  liquidated: boolean;
}

export type GridVariant = Record<SampleKey, GridVariantSample>;

export interface GridResult {
  /** Page address: /backtests/<slug>/. */
  slug: string;
  source: {
    file: string;
    /** SHA-256 of the engine's result file, before the fill list was dropped. */
    sha256: string;
    engine: string;
    engine_version: string;
    fills_dropped: boolean;
  };
  schema_version: number;
  package: string;
  package_version: string;
  generated_at: string;
  strategy: 'grid';
  symbol: string;
  interval: string;
  config: {
    strategy: 'grid';
    params: {
      bounds: 'in_sample_range' | { lower: number; upper: number };
      grid_count: number;
      spacing: GridSpacing;
      direction: GridDirection;
      leverage: number;
      out_of_range: GridOutOfRange;
    };
    execution: {
      /** Fractions: 0.0002 is 0.02%. */
      grid_fee_rate: number;
      taker_fee_rate: number;
      slippage: number;
      initial_capital: number;
      maintenance_margin_rate: number;
      intrabar_path: IntrabarPath;
      funding: boolean;
    };
    split: Record<string, number | string>;
  };
  data: BacktestResult['data'] & {
    /** The funding CSV, or null when funding is off. */
    funding: {
      source: string;
      records_in_range: number;
      first: string;
      last: string;
      file: string;
      file_sha256: string;
    } | null;
  };
  costs: {
    grid_fee_rate: number;
    taker_fee_rate: number;
    fee_source: string;
    slippage_per_fill: number;
    /** 2 x (grid fee + slippage), already in percent: 0.08 is 0.08%. */
    round_trip_cost_pct: number;
    funding_modelled: boolean;
    maintenance_margin_rate: number;
    maintenance_margin_source: string;
  };
  timing: {
    grid_start: string;
    grid_orders: string;
    intrabar_path: IntrabarPath;
    lookahead_check: { passed: boolean; shortened_runs: number };
  };
  /** Every modelling assumption of the run, in the engine's words. */
  assumptions: string[];
  grid: {
    lower: number;
    upper: number;
    bounds_source: string;
    grid_count: number;
    spacing: GridSpacing;
    direction: GridDirection;
    leverage: number;
    out_of_range: GridOutOfRange;
    /** USDT notional each cell opens. */
    cell_notional: number;
    /** Percent of the cell's lower level. */
    cell_width_pct_min: number;
    cell_width_pct_max: number;
    /** All grid_count + 1 level prices, low to high. */
    levels: number[];
  };
  split: { oos_start: string };
  in_sample: GridSampleBlock;
  out_of_sample: GridSampleBlock;
  /** Keys: "intrabar_path=<path>", "grid_fills_at_taker_fee", "without_funding". */
  comparisons: Record<string, GridVariant>;
  warnings: string[];
  disclaimer: string;
}

/** Either kind of file in src/data/backtests/. */
export type AnyResult = BacktestResult | GridResult;

export function isGridResult(result: AnyResult): result is GridResult {
  return result.strategy === 'grid';
}
