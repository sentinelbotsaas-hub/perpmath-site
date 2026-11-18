import sys, io; sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')  # noqa: E401,E702
"""Article 2 (zh-hant/what-is-funding-rate): what funding cost on BTCUSDT over 365 days.

Window: every funding settlement stamped on UTC days 2025-11-18 .. 2026-11-17
(00:00, 08:00 and 16:00 UTC each day).

Two ways to hold "1,000 USDT" are computed, because Bybit charges
funding on position value (quantity x mark price), not on what you paid:

  fixed notional  the position is always worth 1,000 USDT at settlement:
                  cost = 1000 x sum(rate)
  fixed quantity  1000 / (mark price at the first settlement) BTC, never resized:
                  cost = quantity x sum(mark price at settlement x rate)

A positive total is paid by the long and received by the short.

Usage:
    python research/funding_btcusdt.py            fetch from Bybit, save raw CSVs, compute
    python research/funding_btcusdt.py --offline  recompute from the saved CSVs

Output: research/data/btcusdt-funding-history.csv, research/data/btcusdt-240m-mark-price.csv,
research/data/btcusdt-instrument.json and research/funding_btcusdt.json.
"""
import statistics
import time

from bybit_public import HERE, HOUR_MS, RAW, get, iso, klines, ms, now_iso, read_csv, read_json, write_csv, write_json

SYMBOL = "BTCUSDT"
START = "2025-11-18"          # first settlement counted: 2025-11-18 00:00 UTC
END = "2026-11-18"            # exclusive: last settlement counted is 2026-11-17 16:00 UTC
NOTIONAL = 1000.0
OUT = HERE / "funding_btcusdt.json"
F_FUNDING = RAW / "btcusdt-funding-history.csv"
F_MARK = RAW / "btcusdt-240m-mark-price.csv"
F_INSTRUMENT = RAW / "btcusdt-instrument.json"


def fetch():
    start_ms, end_ms = ms(START), ms(END)
    rows = {}
    cursor_end = end_ms - 1
    while cursor_end >= start_ms:
        result = get("funding/history", category="linear", symbol=SYMBOL,
                     startTime=start_ms, endTime=cursor_end, limit=200)
        batch = result.get("list") or []
        if not batch:
            break
        for row in batch:
            rows[int(row["fundingRateTimestamp"])] = row["fundingRate"]
        oldest = min(int(row["fundingRateTimestamp"]) for row in batch)
        if len(batch) < 200:
            break
        cursor_end = oldest - 1
        time.sleep(0.25)
    ordered = sorted(rows.items())
    write_csv(F_FUNDING, ["timestamp_ms", "time_utc", "funding_rate"],
              [[ts, iso(ts), rate] for ts, rate in ordered])

    mark = klines("mark-price-kline", SYMBOL, "240", start_ms, end_ms)
    write_csv(F_MARK, ["open_time_ms", "time_utc", "open", "high", "low", "close"],
              [[r[0], iso(int(r[0]))] + r[1:5] for r in mark])

    info = get("instruments-info", category="linear", symbol=SYMBOL)
    instrument = next(row for row in info["list"] if row["symbol"] == SYMBOL)
    write_json(F_INSTRUMENT, {
        "source": "https://api.bybit.com/v5/market/instruments-info?category=linear&symbol=" + SYMBOL,
        "fetched_at": now_iso(),
        "fundingInterval_minutes": instrument["fundingInterval"],
        "upperFundingRate": instrument["upperFundingRate"],
        "lowerFundingRate": instrument["lowerFundingRate"],
    })


def pct(x, digits=6):
    return round(x * 100, digits)


def main():
    if "--offline" not in sys.argv:
        fetch()
    funding = read_csv(F_FUNDING)
    mark = {int(r["open_time_ms"]): float(r["open"]) for r in read_csv(F_MARK)}
    instrument = read_json(F_INSTRUMENT)

    stamps = [int(r["timestamp_ms"]) for r in funding]
    rates = [float(r["funding_rate"]) for r in funding]
    n = len(rates)

    gaps = sorted({(b - a) // HOUR_MS for a, b in zip(stamps, stamps[1:])})
    hours = sorted({(ts // HOUR_MS) % 24 for ts in stamps})
    missing_mark = [iso(ts) for ts in stamps if ts not in mark]
    if missing_mark:
        raise RuntimeError(f"no mark-price candle at settlement time for {missing_mark[:3]}")

    positive = [r for r in rates if r > 0]
    negative = [r for r in rates if r < 0]
    total = sum(rates)
    hi = max(range(n), key=lambda i: rates[i])
    lo = min(range(n), key=lambda i: rates[i])

    # fixed quantity: sized to 1,000 USDT at the first settlement's mark price
    quantity = NOTIONAL / mark[stamps[0]]
    fixed_qty_cost = sum(quantity * mark[ts] * rate for ts, rate in zip(stamps, rates))

    # by calendar month (UTC)
    months = {}
    for ts, rate in zip(stamps, rates):
        months.setdefault(iso(ts, False)[:7], []).append(rate)
    by_month = [{
        "month": month,
        "settlements": len(values),
        "positive": sum(v > 0 for v in values),
        "negative": sum(v < 0 for v in values),
        "sum_rate_pct": pct(sum(values), 4),
        "cost_long_usdt_per_1000": round(sum(values) * NOTIONAL, 4),
    } for month, values in sorted(months.items())]

    # longest run of consecutive negative settlements
    best_run, run, run_start, best_span = 0, 0, None, None
    for ts, rate in zip(stamps, rates):
        if rate < 0:
            if run == 0:
                run_start = ts
            run += 1
            if run > best_run:
                best_run, best_span = run, (iso(run_start), iso(ts))
        else:
            run = 0

    base = 0.0001  # 0.01% per 8 hours: the rate when premium is inside the interest-rate clamp
    at_base_stamps = [ts for ts, r in zip(stamps, rates) if abs(r - base) < 1e-12]
    at_base = len(at_base_stamps)
    ordered = sorted(rates)
    document = {
        "question": "What did funding cost on the BTCUSDT perpetual over 365 days?",
        "symbol": SYMBOL,
        "range_utc": {"first_settlement": iso(stamps[0]), "last_settlement": iso(stamps[-1])},
        "fetched_at": instrument["fetched_at"],
        "sources": {
            "funding_history": "https://api.bybit.com/v5/market/funding/history?category=linear&symbol=BTCUSDT",
            "mark_price_240m": "https://api.bybit.com/v5/market/mark-price-kline?category=linear&symbol=BTCUSDT&interval=240",
            "instrument": instrument["source"],
        },
        "instrument": {k: instrument[k] for k in ("fundingInterval_minutes", "upperFundingRate", "lowerFundingRate")},
        "settlements": n,
        "hours_between_settlements_seen": gaps,
        "utc_hours_seen": hours,
        "positive": len(positive), "negative": len(negative), "zero": n - len(positive) - len(negative),
        "positive_share_pct": round(len(positive) / n * 100, 2),
        "negative_share_pct": round(len(negative) / n * 100, 2),
        "mean_rate_pct": pct(statistics.fmean(rates)),
        "median_rate_pct": pct(statistics.median(rates)),
        "p10_rate_pct": pct(ordered[int(0.1 * n)]),
        "p90_rate_pct": pct(ordered[int(0.9 * n)]),
        "sum_rate_pct": pct(total, 4),
        "mean_rate_annualised_pct": pct(statistics.fmean(rates) * 3 * 365, 3),
        "settlements_at_exactly_0.01pct": at_base,
        "settlements_at_exactly_0.01pct_share_pct": round(at_base / n * 100, 2),
        "first_settlement_at_0.01pct": iso(at_base_stamps[0]) if at_base else None,
        "last_settlement_at_0.01pct": iso(at_base_stamps[-1]) if at_base else None,
        "settlements_tied_for_largest_positive": sum(abs(r - rates[hi]) < 1e-12 for r in rates),
        "settlements_below_0.01pct": sum(r < base - 1e-12 for r in rates),
        "settlements_above_0.01pct": sum(r > base + 1e-12 for r in rates),
        "largest_positive": {"rate_pct": pct(rates[hi]), "time_utc": iso(stamps[hi]),
                             "cost_long_usdt_per_1000": round(rates[hi] * NOTIONAL, 4)},
        "largest_negative": {"rate_pct": pct(rates[lo]), "time_utc": iso(stamps[lo]),
                             "cost_long_usdt_per_1000": round(rates[lo] * NOTIONAL, 4)},
        "long_1000_usdt": {
            "fixed_notional_cost_usdt": round(total * NOTIONAL, 4),
            "paid_on_positive_settlements_usdt": round(sum(positive) * NOTIONAL, 4),
            "received_on_negative_settlements_usdt": round(-sum(negative) * NOTIONAL, 4),
            "fixed_quantity_btc": round(quantity, 8),
            "fixed_quantity_entry_mark_price": mark[stamps[0]],
            "fixed_quantity_last_mark_price": mark[stamps[-1]],
            "fixed_quantity_cost_usdt": round(fixed_qty_cost, 4),
            "if_every_settlement_were_0.01pct_usdt": round(base * n * NOTIONAL, 4),
        },
        "leverage_view": [{
            "leverage": lev,
            "margin_usdt": round(NOTIONAL / lev, 2),
            "funding_as_pct_of_margin": round(total * lev * 100, 3),
        } for lev in (1, 5, 10, 20, 50)],
        "longest_negative_run": {"settlements": best_run, "from": best_span[0] if best_span else None,
                                 "to": best_span[1] if best_span else None},
        "by_month": by_month,
        # 2026-02-05 is the day with the largest drop from the daily open in the
        # same 365 days (see liquidation_btcusdt.json): what did funding do then?
        "settlements_on_2026-02-05_and_06": [
            {"time_utc": iso(ts), "rate_pct": pct(rate)}
            for ts, rate in zip(stamps, rates) if iso(ts, False) in ("2026-02-05", "2026-02-06")
        ],
        "mark_price_change_pct": round((mark[stamps[-1]] / mark[stamps[0]] - 1) * 100, 2),
    }
    write_json(OUT, document)

    print(f"{SYMBOL} funding {document['range_utc']['first_settlement']} to "
          f"{document['range_utc']['last_settlement']}: {n} settlements, gaps {gaps} h, hours {hours}")
    for key in ("positive", "negative", "zero", "positive_share_pct", "mean_rate_pct", "median_rate_pct",
                "sum_rate_pct", "mean_rate_annualised_pct", "settlements_at_exactly_0.01pct",
                "first_settlement_at_0.01pct", "last_settlement_at_0.01pct",
                "settlements_tied_for_largest_positive", "settlements_below_0.01pct",
                "settlements_above_0.01pct", "p10_rate_pct", "p90_rate_pct", "leverage_view", "instrument",
                "largest_positive", "largest_negative", "long_1000_usdt", "longest_negative_run"):
        print(f"{key}: {document[key]}")
    for row in by_month:
        print(row)
    print(f"wrote {OUT}")


if __name__ == "__main__":
    main()
