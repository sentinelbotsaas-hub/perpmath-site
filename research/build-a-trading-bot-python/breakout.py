"""Channel breakout: the minimal strategy module written for the article.

Rules (everything is evaluated on a bar's close; orders fill at the next
bar's open):

1. prior high = highest high of the ``lookback`` bars before this bar.
   prior low  = lowest low of the ``lookback`` bars before this bar.
2. Close above the prior high: go long. Close below the prior low: go short.
3. Stop: the signal bar's close minus (long) or plus (short)
   ``stop_atr_mult`` x ATR, ATR being the simple average of the last
   ``atr_period`` true ranges.
4. Target: ``r_multiple`` x risk from the fill price.
5. One position at a time (the engine ignores signals while one is open).

Parameters were written down on 2026-11-22 before the first run and were not
changed afterwards. This is a teaching example, not a strategy to trade.
"""

from __future__ import annotations

import numpy as np

from ..data import Bars
from ..engine import Signals
from ..indicators import atr, prior_high, prior_low

DEFAULTS = {
    "lookback": 96,
    "atr_period": 14,
    "stop_atr_mult": 2.0,
    "r_multiple": 2.0,
}


def generate(bars: Bars, params: dict) -> Signals:
    signals = Signals.empty(len(bars))
    top = prior_high(bars.high, params["lookback"])
    bottom = prior_low(bars.low, params["lookback"])
    distance = params["stop_atr_mult"] * atr(bars.high, bars.low, bars.close, params["atr_period"])

    # Comparisons against NaN (warm-up bars) are False, so no signal there.
    ready = np.isfinite(distance)
    go_long = (bars.close > top) & ready
    go_short = (bars.close < bottom) & ready

    signals.side[go_long] = 1
    signals.side[go_short] = -1
    signals.stop[go_long] = bars.close[go_long] - distance[go_long]
    signals.stop[go_short] = bars.close[go_short] + distance[go_short]
    signals.target_r[go_long | go_short] = params["r_multiple"]
    return signals
