// The example each calculator opens with. One place, so that the calculator
// page and the example on its card in the tool directory cannot drift apart.
// These are illustrations (a round BTC price, a round account), not market
// data: exchange parameters such as the maintenance margin rate always come
// from the risk-limit snapshot. Build-time only.
import type { Side } from '../../lib/calc/liquidation';

/** Liquidation price calculator: a 20x long. */
export const LIQUIDATION_START = { side: 'long' as Side, entry: 68000, lev: 20 };

/** Leverage calculator: a long with the stop 5% below the entry (worked example 1). */
export const LEVERAGE_START = { side: 'long' as Side, entry: 68000, stop: 64600 };

/** Position size calculator: 1% of a 10,000 USDT account at risk (worked example 1). */
export const POSITION_START = { account: 10000, riskPct: 1, entry: 68000, stop: 66400, lev: 10 };

/**
 * The one assumption of the position size calculator: the fee per side, in
 * percent. It is shown next to its field as an assumption and the reader can
 * change it.
 */
export const ASSUMED_FEE_PCT = 0.055;

/** Drawdown calculator: a 50% drawdown; the streak mode starts at 10 losses of 2%. */
export const DRAWDOWN_START = { mode: 'drawdown', dd: 50, n: 10, risk: 2 };

/** DCA calculator: a 10x long, added to twice on the way down (worked example 1). */
export const DCA_START = {
  mode: 'futures',
  unit: 'quantity',
  side: 'long' as Side,
  lev: 10,
  fills: [
    { price: 68000, size: 0.01 },
    { price: 64000, size: 0.01 },
    { price: 62000, size: 0.02 },
  ],
};

/**
 * Futures profit calculator: a 10x long of 0.1 BTC held through three funding
 * settlements (worked example 1). The funding rate is an illustration, in
 * percent per settlement; real rates are on /data/funding-rate/.
 */
export const PROFIT_START = {
  side: 'long' as Side,
  entry: 68000,
  exit: 70000,
  unit: 'quantity',
  qty: 0.1,
  margin: 680,
  lev: 10,
  fundingPct: 0.01,
  periods: 3,
};

/**
 * Sharpe ratio calculator: twelve monthly returns in percent (worked example
 * 1). An illustration, not the record of any account or strategy.
 */
export const SHARPE_START = {
  returns: [3.2, -1.5, 4.1, 0.8, -2.7, 5.0, 1.9, -0.6, 2.4, -3.1, 3.6, 1.1],
  rf: 0,
  periods: 12,
};
