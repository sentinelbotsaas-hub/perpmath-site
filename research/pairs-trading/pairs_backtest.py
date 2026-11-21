import sys, io; sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')  # noqa: E401,E702
"""Article en/pairs-trading: a z-score pairs trade on BTCUSDT and ETHUSDT perpetuals.

The open-source engine (https://github.com/sentinelbotsaas-hub/perpmath,
version 0.2.2) trades one symbol at a time, so THIS SIMULATION IS NOT THE
ENGINE. It is written here, follows the engine's timing and cost rules, and
uses the engine only to download and load the candles. Nothing in the engine
folder is changed.

EVERYTHING IN THIS BLOCK WAS FIXED BEFORE THE FIRST RUN ON REAL DATA
--------------------------------------------------------------------
Data       BTCUSDT and ETHUSDT, 15-minute bars, Bybit public kline endpoint:
             perpmath download BTCUSDT 15m --start 2025-11-18T11:30:00Z --end 2026-11-18T11:30:00Z --data-dir research/pairs-trading/data
             perpmath download ETHUSDT 15m --start 2025-11-18T11:30:00Z --end 2026-11-18T11:30:00Z --data-dir research/pairs-trading/data
           Both files must hold the same 35,040 bar times, none missing.
Split      The engine's rule: first 70% in-sample, cut at a UTC midnight.
Spread     x = ln(BTC close), y = ln(ETH close). On every bar an ordinary
           least-squares line y = a + b x is fitted to the last WINDOW = 672
           bars (7 days), the current bar included. e = y - a - b x on the
           current bar, z = e / (standard error of that regression).
Entry      Flat, |z| >= ENTRY_Z = 2.0 on this close, |z| < 2.0 on the close
           before, and b > 0. Filled at the NEXT bar's open, both legs:
             z > 0  (ETH dear against BTC): short ETH, long BTC  ("short spread")
             z < 0  (ETH cheap):            long ETH, short BTC  ("long spread")
Size       ETH notional = equity / (1 + b), BTC notional = b x ETH notional,
           so the two legs add up to 100% of equity (no leverage). b and both
           quantities are frozen for the life of the trade.
Exit       On a bar's close, filled at the next bar's open, first that applies:
             "revert"  z has crossed zero (z <= 0 for a short spread, z >= 0 for a long one);
             "stop"    z has gone to STOP_Z = 4.0 against the trade;
             "time"    the trade has been open MAX_HOLD = 672 bars.
           z is always the current window's z, not one frozen at entry.
           A position open on the last bar of a sample is closed at that close ("end").
Costs      Every fill of every leg: fee 0.055% of its notional, and the price
           moved 0.02% against the order. Four fills per trade.
           FUNDING IS NOT MODELLED. No leverage, margin or liquidation.
Reported   The same run with slippage 0 and with fee and slippage 0, to show
           how much of the result is cost. That changes costs, not rules.

DECLARED AS HINDSIGHT (run after the main result, never used to pick a setting):
           WINDOW 192 / 672 / 2880 x ENTRY_Z 1.5 / 2.0 / 2.5, nine runs, only
           to show how much the answer moves. MAX_HOLD = WINDOW in each.

Stationarity (NumPy only, descriptive):
           - correlation of 15-minute log returns, whole sample and rolling 672 bars;
           - one fixed line y = a + b x fitted on the in-sample period; its
             residual's AR(1) coefficient, half-life and the plain
             Dickey-Fuller t-ratio (no lag terms), in-sample, and again on the
             out-of-sample period with the in-sample a and b kept.
           NO FORMAL COINTEGRATION TEST IS RUN: the Engle-Granger test needs an
           augmented regression and MacKinnon's critical values, which are not
           in NumPy. The t-ratio is printed without a verdict.

Usage, from the site's root folder, with the engine's own Python:
    <engine>/.venv/Scripts/python research/pairs-trading/pairs_backtest.py

Output: research/pairs-trading/pairs_summary.json, pairs_trades.json and a table.
"""
import json
import math
from datetime import datetime, timezone
from pathlib import Path

import numpy as np

import perpmath
from perpmath.data import count_missing_bars, file_sha256, interval_ms, iso_utc, load_bars
from perpmath.metrics import max_drawdown_pct, t_statistic

HERE = Path(__file__).resolve().parent
DATA = HERE / "data"
DAY_MS = 86_400_000

WINDOW = 672
ENTRY_Z = 2.0
STOP_Z = 4.0
MAX_HOLD = 672
IN_SAMPLE_FRACTION = 0.7
CAPITAL = 10000.0
COSTS = {"published": {"fee_rate": 0.00055, "slippage": 0.0002},
         "fee_only": {"fee_rate": 0.00055, "slippage": 0.0},
         "zero_cost": {"fee_rate": 0.0, "slippage": 0.0}}
HINDSIGHT_WINDOWS = (192, 672, 2880)
HINDSIGHT_ENTRIES = (1.5, 2.0, 2.5)
CHECK_SEED = 20261204


def rolling_line(x, y, window):
    """Rolling least squares of y on x. Returns (a, b, z): intercept, slope and
    the current bar's residual divided by the regression's standard error.
    NaN until `window` bars exist. Uses bars up to and including the current one.
    """
    n = len(x)
    a, b, z = (np.full(n, np.nan) for _ in range(3))
    if n < window:
        return a, b, z
    # Shift by the first value: a line with an intercept does not care, and the
    # sums stay small. The first value is known from the first bar on.
    u, v = x - x[0], y - y[0]

    def window_sum(values):
        total = np.concatenate(([0.0], np.cumsum(values)))
        return total[window:] - total[:-window]

    su, sv, suu, svv, suv = (window_sum(s) for s in (u, v, u * u, v * v, u * v))
    sxx = suu - su * su / window
    sxy = suv - su * sv / window
    syy = svv - sv * sv / window
    slope = sxy / sxx
    intercept_shifted = (sv - slope * su) / window
    sse = np.maximum(syy - slope * sxy, 0.0)
    sigma = np.sqrt(sse / (window - 2))
    residual = v[window - 1:] - intercept_shifted - slope * u[window - 1:]
    b[window - 1:] = slope
    a[window - 1:] = intercept_shifted + y[0] - slope * x[0]
    with np.errstate(divide="ignore", invalid="ignore"):
        z[window - 1:] = np.where(sigma > 0, residual / sigma, np.nan)
    return a, b, z


def direct_z(x, y, window, t):
    """The same z on bar t, computed the slow way from that window alone."""
    xs, ys = x[t - window + 1: t + 1], y[t - window + 1: t + 1]
    slope, intercept = np.polyfit(xs, ys, 1)
    residuals = ys - intercept - slope * xs
    sigma = math.sqrt(float(np.sum(residuals ** 2)) / (window - 2))
    return float(residuals[-1] / sigma), float(slope)


def simulate(eth, btc, z, beta, start, end, fee_rate, slippage,
             entry_z=ENTRY_Z, stop_z=STOP_Z, max_hold=MAX_HOLD, capital=CAPITAL):
    """Simulate bars [start, end). `eth` and `btc` are dicts of open/close/ts arrays.

    Decisions are made on a bar's close and filled at the next bar's open.
    Returns (trades, bar-close equity array).
    """
    cash = capital
    pos = None
    trades = []
    equity = np.empty(end - start)

    def fill(price, side):
        return price * (1 + side * slippage)      # a buy fills higher, a sell lower

    def close(index, eth_price, btc_price, reason):
        nonlocal cash, pos
        s = pos["spread_side"]                       # +1 long spread: long ETH, short BTC
        eth_exit, btc_exit = fill(eth_price, -s), fill(btc_price, s)
        gross = s * pos["eth_qty"] * (eth_exit - pos["eth_entry"]) - s * pos["btc_qty"] * (btc_exit - pos["btc_entry"])
        exit_fee = (pos["eth_qty"] * eth_exit + pos["btc_qty"] * btc_exit) * fee_rate
        cash += gross - exit_fee
        fees = pos["entry_fee"] + exit_fee
        pnl = gross - fees
        raw = s * (eth_price / pos["eth_raw"] - 1) * pos["eth_notional"] \
            - s * (btc_price / pos["btc_raw"] - 1) * pos["btc_notional"]
        trades.append({
            "side": "long_spread" if s == 1 else "short_spread",
            "entry_index": pos["index"], "exit_index": index,
            "entry_time": iso_utc(int(eth["ts"][pos["index"]])), "exit_time": iso_utc(int(eth["ts"][index])),
            "beta": pos["beta"], "z_at_signal": pos["z"],
            "eth_notional": pos["eth_notional"], "btc_notional": pos["btc_notional"],
            "fees": fees, "pnl": pnl,
            "return_pct": pnl / pos["notional"] * 100,
            "price_move_pct": raw / pos["notional"] * 100,   # both legs, open to open, no costs
            "exit_reason": reason, "bars_held": index - pos["index"],
        })
        pos = None

    for i in range(start, end):
        prev = i - 1
        if prev >= start:
            zp = z[prev]
            if pos is not None:
                s = pos["spread_side"]
                reason = None
                if np.isfinite(zp) and ((s == -1 and zp <= 0) or (s == 1 and zp >= 0)):
                    reason = "revert"
                elif np.isfinite(zp) and ((s == -1 and zp >= stop_z) or (s == 1 and zp <= -stop_z)):
                    reason = "stop"
                elif i - pos["index"] >= max_hold:
                    reason = "time"
                if reason:
                    close(i, eth["open"][i], btc["open"][i], reason)
            elif prev - 1 >= start and cash > 0:
                zpp = z[prev - 1]
                if np.isfinite(zp) and np.isfinite(zpp) and abs(zp) >= entry_z and abs(zpp) < entry_z and beta[prev] > 0:
                    s = -1 if zp > 0 else 1
                    b = float(beta[prev])
                    notional = cash
                    eth_notional = notional / (1 + b)
                    btc_notional = notional - eth_notional
                    entry_fee = notional * fee_rate
                    cash -= entry_fee
                    eth_entry, btc_entry = fill(eth["open"][i], s), fill(btc["open"][i], -s)
                    pos = {"spread_side": s, "index": i, "beta": b, "z": float(zp), "notional": notional,
                           "eth_notional": eth_notional, "btc_notional": btc_notional,
                           "eth_entry": eth_entry, "btc_entry": btc_entry,
                           "eth_raw": float(eth["open"][i]), "btc_raw": float(btc["open"][i]),
                           "eth_qty": eth_notional / eth_entry, "btc_qty": btc_notional / btc_entry,
                           "entry_fee": entry_fee}
        if pos is not None and i == end - 1:
            close(i, eth["close"][i], btc["close"][i], "end")
        if pos is None:
            equity[i - start] = cash
        else:
            s = pos["spread_side"]
            equity[i - start] = cash + s * pos["eth_qty"] * (eth["close"][i] - pos["eth_entry"]) \
                - s * pos["btc_qty"] * (btc["close"][i] - pos["btc_entry"])
    return trades, equity


def metrics(trades, equity, capital=CAPITAL):
    n = len(trades)
    returns = [t["return_pct"] for t in trades]
    reasons = {}
    for t in trades:
        reasons[t["exit_reason"]] = reasons.get(t["exit_reason"], 0) + 1
    t_stat = t_statistic(returns)
    return {
        "trades": n, "insufficient_sample": n < 100,
        "win_rate_pct": round(sum(1 for t in trades if t["pnl"] > 0) / n * 100, 4) if n else None,
        "avg_trade_return_pct": round(float(np.mean(returns)), 4) if n else None,
        "avg_price_move_pct": round(float(np.mean([t["price_move_pct"] for t in trades])), 4) if n else None,
        "t_stat": None if t_stat is None else round(t_stat, 4),
        "total_return_pct": round((float(equity[-1]) / capital - 1) * 100, 4),
        "max_drawdown_pct": round(max_drawdown_pct(equity, capital), 4),
        "total_fees": round(float(sum(t["fees"] for t in trades)), 2),
        "avg_bars_held": round(float(np.mean([t["bars_held"] for t in trades])), 2) if n else None,
        "final_equity": round(float(equity[-1]), 2),
        "exit_reasons": dict(sorted(reasons.items())),
        "long_spread_trades": sum(1 for t in trades if t["side"] == "long_spread"),
    }


def by_reason(trades):
    out = {}
    for reason in sorted({t["exit_reason"] for t in trades}):
        group = [t for t in trades if t["exit_reason"] == reason]
        out[reason] = {
            "trades": len(group),
            "avg_price_move_pct": round(float(np.mean([t["price_move_pct"] for t in group])), 4),
            "avg_return_pct": round(float(np.mean([t["return_pct"] for t in group])), 4),
            "price_move_negative": sum(1 for t in group if t["price_move_pct"] < 0),
            "avg_bars_held": round(float(np.mean([t["bars_held"] for t in group])), 2),
        }
    return out


def ar1(series):
    """d(e) = c + phi * e[-1]: phi, its t-ratio and the half-life in bars."""
    lagged, change = series[:-1], np.diff(series)
    design = np.column_stack((np.ones(len(lagged)), lagged))
    coef, _, _, _ = np.linalg.lstsq(design, change, rcond=None)
    residuals = change - design @ coef
    variance = float(residuals @ residuals) / (len(change) - 2)
    covariance = variance * np.linalg.inv(design.T @ design)
    phi = float(coef[1])
    t_ratio = phi / math.sqrt(float(covariance[1, 1]))
    half_life = -math.log(2) / math.log(1 + phi) if -1 < phi < 0 else None
    return {"phi": round(phi, 8), "dickey_fuller_t_ratio_no_lags": round(t_ratio, 4),
            "half_life_bars": None if half_life is None else round(half_life, 1),
            "half_life_days": None if half_life is None else round(half_life / 96, 2)}


def self_check():
    """Small cases with answers worked out by hand."""
    # A hand-made z series: entry signal on bar 1 (|z| crosses 2), exit signal on bar 3 (z <= 0).
    ts = np.arange(6, dtype=np.int64) * 900_000
    eth = {"ts": ts, "open": np.array([100.0, 100, 100, 99, 95, 95]), "close": np.array([100.0, 100, 100, 99, 95, 95])}
    btc = {"ts": ts, "open": np.array([200.0, 200, 200, 201, 202, 202]), "close": np.array([200.0, 200, 200, 201, 202, 202])}
    z = np.array([0.0, 2.5, 1.0, -0.1, 0.0, 0.0])
    beta = np.ones(6)
    # No costs. Short spread at bar 2's open: short 5,000 of ETH at 100, long 5,000 of BTC at 200.
    # Closed at bar 4's open: ETH 95 -> +250, BTC 202 -> +50. Equity 10,300.
    trades, equity = simulate(eth, btc, z, beta, 0, 6, 0.0, 0.0)
    assert len(trades) == 1 and trades[0]["side"] == "short_spread" and trades[0]["exit_reason"] == "revert"
    assert trades[0]["entry_index"] == 2 and trades[0]["exit_index"] == 4 and trades[0]["bars_held"] == 2
    assert abs(trades[0]["pnl"] - 300.0) < 1e-9 and abs(equity[-1] - 10300.0) < 1e-9
    assert abs(trades[0]["price_move_pct"] - 3.0) < 1e-9
    # Marked to market at bar 3's close: ETH 99 -> +50, BTC 201 -> +25.
    assert abs(equity[3] - 10075.0) < 1e-9 and equity[1] == 10000.0
    # Fee 0.1% a fill, no slippage: entry 10,000 x 0.001 = 10; exit (50 x 95 + 25 x 202) x 0.001 = 9.8.
    trades, equity = simulate(eth, btc, z, beta, 0, 6, 0.001, 0.0)
    assert abs(trades[0]["fees"] - 19.8) < 1e-9 and abs(trades[0]["pnl"] - 280.2) < 1e-9
    # Slippage 1%, no fee: ETH sold at 99, bought back at 95.95; BTC bought at 202, sold at 199.98.
    # ETH: 5,000 / 99 x 3.05 = 154.0404; BTC: 5,000 / 202 x -2.02 = -50. Total 104.0404.
    trades, equity = simulate(eth, btc, z, beta, 0, 6, 0.0, 0.01)
    assert abs(trades[0]["pnl"] - (5000 / 99 * 3.05 - 50.0)) < 1e-9
    # Hedge ratio 3: ETH leg 2,500, BTC leg 7,500.
    trades, _ = simulate(eth, btc, z, beta * 3, 0, 6, 0.0, 0.0)
    assert abs(trades[0]["eth_notional"] - 2500) < 1e-9 and abs(trades[0]["btc_notional"] - 7500) < 1e-9
    assert abs(trades[0]["pnl"] - (2500 * 0.05 + 7500 * 0.01)) < 1e-9
    # Mirror image: z = -2.5 goes long the spread and loses what the short made.
    trades, _ = simulate(eth, btc, -z, beta, 0, 6, 0.0, 0.0)
    assert trades[0]["side"] == "long_spread" and abs(trades[0]["pnl"] + 300.0) < 1e-9
    # No fresh crossing, no entry: z already above 2 on the first bar it can be compared with.
    trades, _ = simulate(eth, btc, np.array([2.5, 2.6, 2.7, 2.8, 2.9, 3.0]), beta, 0, 6, 0.0, 0.0)
    assert trades == []
    # Stop: z runs to 4 against a short spread. Signal on bar 3, filled at bar 4's open.
    trades, _ = simulate(eth, btc, np.array([0.0, 2.5, 3.0, 4.1, 4.5, 4.5]), beta, 0, 6, 0.0, 0.0)
    assert trades[0]["exit_reason"] == "stop" and trades[0]["exit_index"] == 4
    # Time stop after max_hold bars, and the end-of-sample close.
    trades, _ = simulate(eth, btc, np.array([0.0, 2.5, 3.0, 3.0, 3.0, 3.0]), beta, 0, 6, 0.0, 0.0, max_hold=2)
    assert trades[0]["exit_reason"] == "time" and trades[0]["bars_held"] == 2
    trades, _ = simulate(eth, btc, np.array([0.0, 2.5, 3.0, 3.0, 3.0, 3.0]), beta, 0, 6, 0.0, 0.0)
    assert trades[0]["exit_reason"] == "end" and trades[0]["exit_index"] == 5
    # Rolling line on an exact line y = 1 + 2x: slope 2, intercept 1, residual 0.
    x = np.array([0.0, 1.0, 2.0, 3.0, 5.0, 8.0])
    a, b, _ = rolling_line(x, 1 + 2 * x, 4)
    assert np.allclose(b[3:], 2.0) and np.allclose(a[3:], 1.0) and np.all(np.isnan(b[:3]))
    # Four points (0,0) (1,0) (2,0) (3,2): slope 0.6, intercept -0.4, residuals 0.4 -0.2 -0.8 0.6,
    # SSE 1.2, standard error sqrt(1.2 / 2), z of the last point 0.6 / 0.774597 = 0.774597.
    a, b, zz = rolling_line(np.array([0.0, 1.0, 2.0, 3.0]), np.array([0.0, 0.0, 0.0, 2.0]), 4)
    assert abs(b[3] - 0.6) < 1e-12 and abs(a[3] + 0.4) < 1e-12 and abs(zz[3] - 0.6 / math.sqrt(0.6)) < 1e-12
    # AR(1): e halves every bar -> phi = -0.5, half-life 1 bar.
    series = 0.5 ** np.arange(12) + np.tile([1e-9, -1e-9], 6)
    assert abs(ar1(series)["phi"] + 0.5) < 1e-6 and ar1(series)["half_life_bars"] == 1.0


def load(symbol):
    path = DATA / f"{symbol}-15m.csv"
    bars = load_bars(path)
    return bars, file_sha256(path)


def main():
    self_check()
    step = interval_ms("15m")
    btc_bars, btc_sha = load("BTCUSDT")
    eth_bars, eth_sha = load("ETHUSDT")
    assert len(btc_bars) == len(eth_bars) == 35040, "expected 35,040 bars in each file"
    assert np.array_equal(btc_bars.ts, eth_bars.ts), "the two files do not hold the same bar times"
    assert count_missing_bars(btc_bars, step) == 0 and count_missing_bars(eth_bars, step) == 0
    # If the engine is checked out next to this site, the BTCUSDT file must be the one behind its published results.
    published = HERE.parent.parent.parent / "perpmath-engine" / "results" / "ma-cross-btcusdt.json"
    same_as_engine = None
    if published.exists():
        with open(published, encoding="utf-8") as handle:
            same_as_engine = json.load(handle)["data"]["file_sha256"] == btc_sha
        assert same_as_engine, "BTCUSDT candles differ from the file behind the engine's published results"
    n = len(btc_bars)
    ts = btc_bars.ts
    first, end_ms = int(ts[0]), int(ts[-1]) + step
    oos_start = int(first + IN_SAMPLE_FRACTION * (end_ms - first)) // DAY_MS * DAY_MS
    split = int(np.searchsorted(ts, oos_start))
    eth = {"ts": ts, "open": eth_bars.open, "close": eth_bars.close}
    btc = {"ts": ts, "open": btc_bars.open, "close": btc_bars.close}
    x, y = np.log(btc_bars.close), np.log(eth_bars.close)

    a, b, z = rolling_line(x, y, WINDOW)

    # --- checks on the indicator -------------------------------------------------
    # 1. The fast rolling fit equals a plain fit of each window (every entry-signal bar and 500 others).
    crossing = np.zeros(n, dtype=bool)
    crossing[1:] = (np.abs(z[1:]) >= ENTRY_Z) & (np.abs(z[:-1]) < ENTRY_Z)
    rng = np.random.default_rng(CHECK_SEED)
    sample = np.unique(np.concatenate((np.flatnonzero(crossing), rng.integers(WINDOW - 1, n, size=500))))
    worst = 0.0
    for t in sample.tolist():
        zd, bd = direct_z(x, y, WINDOW, t)
        worst = max(worst, abs(zd - z[t]), abs(bd - b[t]))
    assert worst < 1e-6, f"rolling fit differs from the direct fit by {worst}"
    # 2. No look-ahead: cut the data after a bar and that bar's z and b do not change.
    cuts = np.unique(np.concatenate((np.flatnonzero(crossing)[::5], rng.integers(WINDOW, n, size=200))))
    for t in cuts.tolist():
        _, b_cut, z_cut = rolling_line(x[: t + 1], y[: t + 1], WINDOW)
        assert z_cut[t] == z[t] and b_cut[t] == b[t], f"bar {t} changes when later bars are removed"

    # --- main runs ---------------------------------------------------------------
    runs = {}
    trade_lists = {}
    for label, costs in COSTS.items():
        runs[label] = {}
        for sample_name, (lo, hi) in (("in_sample", (0, split)), ("out_of_sample", (split, n))):
            trades, equity = simulate(eth, btc, z, b, lo, hi, **costs)
            again_trades, again_equity = simulate(eth, btc, z, b, lo, hi, **costs)
            assert trades == again_trades and np.array_equal(equity, again_equity), "rerun differs"
            block = metrics(trades, equity)
            # Equity must equal the starting capital plus the trades' profits.
            assert abs(CAPITAL + sum(t["pnl"] for t in trades) - equity[-1]) < 1e-6
            block["first_bar"], block["last_bar"], block["bars"] = iso_utc(int(ts[lo])), iso_utc(int(ts[hi - 1])), hi - lo
            block["by_exit_reason"] = by_reason(trades)
            runs[label][sample_name] = block
            if label == "published":
                trade_lists[sample_name] = trades
    # Costs only move the fills: the same trades at the same times in all three runs.
    for sample_name in ("in_sample", "out_of_sample"):
        assert runs["published"][sample_name]["trades"] == runs["zero_cost"][sample_name]["trades"]

    # --- hindsight sensitivity (declared as such) -----------------------------------
    hindsight = []
    for window in HINDSIGHT_WINDOWS:
        _, bw, zw = rolling_line(x, y, window)
        for entry in HINDSIGHT_ENTRIES:
            row = {"window": window, "entry_z": entry}
            for sample_name, (lo, hi) in (("in_sample", (0, split)), ("out_of_sample", (split, n))):
                for label in ("published", "zero_cost"):
                    trades, equity = simulate(eth, btc, zw, bw, lo, hi, entry_z=entry, max_hold=window, **COSTS[label])
                    m = metrics(trades, equity)
                    row[f"{sample_name}_{label}"] = {k: m[k] for k in (
                        "trades", "insufficient_sample", "win_rate_pct", "avg_trade_return_pct",
                        "avg_price_move_pct", "t_stat", "total_return_pct", "max_drawdown_pct")}
            hindsight.append(row)
    main_row = next(r for r in hindsight if r["window"] == WINDOW and r["entry_z"] == ENTRY_Z)
    for sample_name in ("in_sample", "out_of_sample"):
        assert main_row[f"{sample_name}_published"]["total_return_pct"] == runs["published"][sample_name]["total_return_pct"]

    # --- stationarity, descriptive --------------------------------------------------
    rx, ry = np.diff(x), np.diff(y)

    def corr(lo, hi):
        return round(float(np.corrcoef(rx[lo:hi], ry[lo:hi])[0, 1]), 4)

    def window_sum(values, window):
        total = np.concatenate(([0.0], np.cumsum(values)))
        return total[window:] - total[:-window]

    sx, sy = window_sum(rx, WINDOW), window_sum(ry, WINDOW)
    sxx, syy, sxy = window_sum(rx * rx, WINDOW), window_sum(ry * ry, WINDOW), window_sum(rx * ry, WINDOW)
    rolling_corr = (sxy - sx * sy / WINDOW) / np.sqrt((sxx - sx * sx / WINDOW) * (syy - sy * sy / WINDOW))
    slope_is, intercept_is = np.polyfit(x[:split], y[:split], 1)
    residual_is = y[:split] - intercept_is - slope_is * x[:split]
    residual_oos = y[split:] - intercept_is - slope_is * x[split:]
    sd_is = float(residual_is.std(ddof=2))
    slope_oos, intercept_oos = np.polyfit(x[split:], y[split:], 1)
    residual_oos_own = y[split:] - intercept_oos - slope_oos * x[split:]
    beta_valid = b[WINDOW - 1:]
    stationarity = {
        "return_correlation": {"whole": corr(0, n - 1), "in_sample": corr(0, split - 1), "out_of_sample": corr(split, n - 1)},
        "rolling_672_bar_return_correlation": {
            "min": round(float(rolling_corr.min()), 4), "p5": round(float(np.percentile(rolling_corr, 5)), 4),
            "median": round(float(np.median(rolling_corr)), 4), "p95": round(float(np.percentile(rolling_corr, 95)), 4),
            "max": round(float(rolling_corr.max()), 4)},
        "rolling_672_bar_hedge_ratio": {
            "min": round(float(beta_valid.min()), 4), "p5": round(float(np.percentile(beta_valid, 5)), 4),
            "median": round(float(np.median(beta_valid)), 4), "p95": round(float(np.percentile(beta_valid, 95)), 4),
            "max": round(float(beta_valid.max()), 4),
            "share_of_bars_not_positive_pct": round(float(np.mean(beta_valid <= 0) * 100), 4)},
        "fixed_line_fitted_in_sample": {
            "slope": round(float(slope_is), 4), "intercept": round(float(intercept_is), 4),
            "residual_sd": round(sd_is, 5),
            "in_sample": ar1(residual_is),
            "out_of_sample_with_in_sample_line": {
                **ar1(residual_oos),
                "mean_in_units_of_in_sample_sd": round(float(residual_oos.mean()) / sd_is, 2),
                "largest_in_units_of_in_sample_sd": round(float(np.max(np.abs(residual_oos))) / sd_is, 2),
                "last_in_units_of_in_sample_sd": round(float(residual_oos[-1]) / sd_is, 2),
                "share_of_bars_beyond_2_sd_pct": round(float(np.mean(np.abs(residual_oos) > 2 * sd_is) * 100), 2)},
            "out_of_sample_own_line": {"slope": round(float(slope_oos), 4), **ar1(residual_oos_own)},
        },
        "formal_cointegration_test": "not run (needs an augmented regression and MacKinnon critical values)",
    }

    def hold(bars, lo, hi):
        return round((float(bars.close[hi - 1]) / float(bars.open[lo]) - 1) * 100, 2)

    summary = {
        "generated_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "engine_used_for": "download and loading of candles, max_drawdown_pct and t_statistic; the simulation is this script",
        "engine_version": perpmath.__version__, "numpy": np.__version__, "python": sys.version.split()[0],
        "data": {"exchange": "bybit", "category": "linear", "interval": "15m", "bars": n,
                 "first_bar": iso_utc(first), "last_bar": iso_utc(int(ts[-1])), "missing_bars": 0,
                 "files": {"BTCUSDT-15m.csv": btc_sha, "ETHUSDT-15m.csv": eth_sha},
                 "btc_file_equals_engine_published_file": same_as_engine},
        "rules": {"window": WINDOW, "entry_z": ENTRY_Z, "stop_z": STOP_Z, "max_hold_bars": MAX_HOLD,
                  "in_sample_fraction": IN_SAMPLE_FRACTION, "oos_start": iso_utc(oos_start),
                  "initial_capital": CAPITAL, "gross_notional": "100% of equity, split 1 : beta between ETH and BTC",
                  "funding_modelled": False},
        "costs": COSTS,
        "checks": {"rolling_fit_vs_direct_fit_largest_difference": worst, "bars_compared": int(len(sample)),
                   "lookahead_cuts": int(len(cuts)), "entry_signal_bars": int(crossing.sum())},
        "runs": runs,
        "buy_and_hold_pct": {
            "BTCUSDT": {"in_sample": hold(btc_bars, 0, split), "out_of_sample": hold(btc_bars, split, n)},
            "ETHUSDT": {"in_sample": hold(eth_bars, 0, split), "out_of_sample": hold(eth_bars, split, n)}},
        "stationarity": stationarity,
        "hindsight_sensitivity": hindsight,
    }
    with open(HERE / "pairs_summary.json", "w", encoding="utf-8", newline="\n") as handle:
        json.dump(summary, handle, indent=1)
        handle.write("\n")
    rounded = {name: [{k: (round(v, 6) if isinstance(v, float) else v) for k, v in t.items()} for t in trades]
               for name, trades in trade_lists.items()}
    with open(HERE / "pairs_trades.json", "w", encoding="utf-8", newline="\n") as handle:
        handle.write("{\n")
        for position, (name, trades) in enumerate(rounded.items()):
            handle.write(f' "{name}": [\n')
            handle.write(",\n".join("  " + json.dumps(t) for t in trades))
            handle.write("\n ]" + ("," if position == 0 else "") + "\n")
        handle.write("}\n")

    print(f"BTCUSDT / ETHUSDT 15m  {iso_utc(first)} to {iso_utc(int(ts[-1]))}  {n} bars each, none missing")
    print(f"window {WINDOW} bars, entry |z| >= {ENTRY_Z}, exit z through 0, stop |z| >= {STOP_Z}, max hold {MAX_HOLD} bars")
    print(f"out-of-sample starts {iso_utc(oos_start)}; funding not modelled")
    print()
    print(f"{'costs':<11}{'sample':<15}{'trades':>7}{'win %':>8}{'avg %':>9}{'move %':>9}{'t-stat':>8}{'return %':>10}{'max DD %':>10}{'fees':>10}{'bars':>8}")
    for label in COSTS:
        for sample_name in ("in_sample", "out_of_sample"):
            m = runs[label][sample_name]
            print(f"{label:<11}{sample_name:<15}{m['trades']:>7}{m['win_rate_pct']:>8.2f}{m['avg_trade_return_pct']:>9.4f}"
                  f"{m['avg_price_move_pct']:>9.4f}{m['t_stat']:>8.2f}{m['total_return_pct']:>10.2f}"
                  f"{m['max_drawdown_pct']:>10.2f}{m['total_fees']:>10.2f}{m['avg_bars_held']:>8.1f}")
    print()
    print("published costs, by exit reason (move % = both legs open to open, before costs)")
    for sample_name in ("in_sample", "out_of_sample"):
        for reason, g in runs["published"][sample_name]["by_exit_reason"].items():
            print(f"{sample_name:<15}{reason:<8}{g['trades']:>6}{g['avg_price_move_pct']:>10.4f}{g['avg_return_pct']:>10.4f}"
                  f"{g['price_move_negative']:>6} with a negative move{g['avg_bars_held']:>9.1f} bars")
    print()
    print("stationarity (descriptive, no formal test)")
    print(json.dumps(stationarity, indent=1))
    print()
    print("HINDSIGHT sensitivity, not used to choose anything (IS = in-sample, OOS = out-of-sample)")
    print(f"{'window':>7}{'entry':>7}{'IS n':>7}{'IS %':>9}{'IS t':>8}{'IS 0-cost %':>13}{'OOS n':>7}{'OOS %':>9}{'OOS t':>8}{'OOS 0-cost %':>14}{'OOS 0-cost t':>14}")
    for row in hindsight:
        i, o = row["in_sample_published"], row["out_of_sample_published"]
        iz, oz = row["in_sample_zero_cost"], row["out_of_sample_zero_cost"]
        print(f"{row['window']:>7}{row['entry_z']:>7}{i['trades']:>7}{i['total_return_pct']:>9.2f}{i['t_stat']:>8.2f}"
              f"{iz['total_return_pct']:>13.2f}{o['trades']:>7}{o['total_return_pct']:>9.2f}{o['t_stat']:>8.2f}"
              f"{oz['total_return_pct']:>14.2f}{oz['t_stat']:>14.2f}")
    print()
    print("wrote research/pairs-trading/pairs_summary.json and pairs_trades.json")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
