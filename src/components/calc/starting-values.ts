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
