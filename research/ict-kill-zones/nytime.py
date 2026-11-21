"""New York and London wall-clock time from UTC milliseconds, without tzdata.

Shared by the three clock articles (en/ict-kill-zones, en/silver-bullet-strategy,
en/judas-swing). ICT windows are quoted in New York time, and New York moves
against UTC twice a year, so every script here converts bar open times with
these functions instead of hard-coding UTC hours.

Rules used (the ones in force for the whole data range, 2025-11-18 to 2026-11-18):

  United States (Energy Policy Act of 2005, in force since 2007)
      daylight time starts on the second Sunday of March at 02:00 local
      standard time (07:00 UTC) and ends on the first Sunday of November at
      02:00 local daylight time (06:00 UTC).
      New York is UTC-5 outside that period (EST) and UTC-4 inside it (EDT).
  United Kingdom
      summer time runs from 01:00 UTC on the last Sunday of March to 01:00 UTC
      on the last Sunday of October. London is UTC+0 outside it, UTC+1 inside.

The Python on the machine that produced the article numbers has no tz
database (`zoneinfo.ZoneInfo("America/New_York")` raises), which is why the
rule is written out. `self_test()` checks hand-worked instants on both sides
of each switch, one plain winter case and one plain summer case, and compares
every hour of 2025 to 2027 against `zoneinfo` when a tz database is present.

Run the tests alone:
    python research/ict-kill-zones/nytime.py
"""
import calendar
from datetime import datetime, timedelta, timezone

import numpy as np

HOUR_MS = 3_600_000
DAY_MS = 86_400_000


def _utc_ms(year, month, day, hour=0, minute=0):
    return int(datetime(year, month, day, hour, minute, tzinfo=timezone.utc).timestamp() * 1000)


def _nth_sunday(year, month, n):
    """Day of month of the n-th Sunday (n = 1, 2, ...) of the month."""
    first_weekday = calendar.weekday(year, month, 1)        # Monday = 0 ... Sunday = 6
    return 1 + (6 - first_weekday) % 7 + 7 * (n - 1)


def _last_sunday(year, month):
    last_day = calendar.monthrange(year, month)[1]
    return last_day - (calendar.weekday(year, month, last_day) - 6) % 7


def us_dst_bounds_ms(year):
    """(start, end) of US daylight time in `year`, as UTC milliseconds. Start inclusive, end exclusive."""
    start = _utc_ms(year, 3, _nth_sunday(year, 3, 2), 7)    # 02:00 EST = 07:00 UTC
    end = _utc_ms(year, 11, _nth_sunday(year, 11, 1), 6)    # 02:00 EDT = 06:00 UTC
    return start, end


def uk_dst_bounds_ms(year):
    """(start, end) of British Summer Time in `year`, as UTC milliseconds."""
    return _utc_ms(year, 3, _last_sunday(year, 3), 1), _utc_ms(year, 10, _last_sunday(year, 10), 1)


def _offset_hours(ts_ms, bounds, standard, daylight):
    ts = np.asarray(ts_ms, dtype=np.int64)
    out = np.full(ts.shape, standard, dtype=np.int64)
    if ts.size:
        first = datetime.fromtimestamp(int(ts.min()) / 1000, tz=timezone.utc).year
        last = datetime.fromtimestamp(int(ts.max()) / 1000, tz=timezone.utc).year
        for year in range(first, last + 1):
            start, end = bounds(year)
            out[(ts >= start) & (ts < end)] = daylight
    return out


def ny_offset_hours(ts_ms):
    """UTC offset of New York at each instant: -5 (EST) or -4 (EDT)."""
    return _offset_hours(ts_ms, us_dst_bounds_ms, -5, -4)


def london_offset_hours(ts_ms):
    """UTC offset of London at each instant: 0 (GMT) or 1 (BST)."""
    return _offset_hours(ts_ms, uk_dst_bounds_ms, 0, 1)


def ny_local_ms(ts_ms):
    """Milliseconds on the New York wall clock (UTC ms shifted by the offset in force)."""
    ts = np.asarray(ts_ms, dtype=np.int64)
    return ts + ny_offset_hours(ts) * HOUR_MS


def ny_minute_of_day(ts_ms):
    """Minutes after New York midnight, 0 to 1439."""
    return (ny_local_ms(ts_ms) % DAY_MS) // 60_000


def ny_day_number(ts_ms):
    """New York calendar day as days since 1970-01-01 (local)."""
    return ny_local_ms(ts_ms) // DAY_MS


def ny_weekday(ts_ms):
    """New York weekday, Monday = 0 ... Sunday = 6. (1970-01-01 was a Thursday.)"""
    return (ny_day_number(ts_ms) + 3) % 7


def ny_text(ts_ms):
    """'YYYY-MM-DD HH:MM EST' or '... EDT' for one instant."""
    offset = int(ny_offset_hours(np.array([ts_ms]))[0])
    local = datetime.fromtimestamp(int(ts_ms) / 1000, tz=timezone.utc) + timedelta(hours=offset)
    return local.strftime("%Y-%m-%d %H:%M ") + ("EDT" if offset == -4 else "EST")


def day_number_text(day_number):
    return (datetime(1970, 1, 1) + timedelta(days=int(day_number))).strftime("%Y-%m-%d")


def in_window(minute_of_day, start_minute, end_minute):
    """True where start <= minute < end. A window that crosses midnight is not supported; split it."""
    if not 0 <= start_minute < end_minute <= 1440:
        raise ValueError("window must satisfy 0 <= start < end <= 1440 minutes")
    minute = np.asarray(minute_of_day)
    return (minute >= start_minute) & (minute < end_minute)


def hhmm(text):
    """'08:30' -> 510 minutes. '24:00' is allowed as an end."""
    hours, minutes = text.split(":")
    return int(hours) * 60 + int(minutes)


# --------------------------------------------------------------------------- #
# Tests
# --------------------------------------------------------------------------- #

# (UTC instant, expected New York wall clock). Worked by hand from the rules above.
HAND_CASES = [
    # winter (EST, UTC-5)
    ("2026-01-15T15:00", "2026-01-15 10:00 EST"),      # the 10:00 silver bullet hour in January
    ("2025-11-18T11:30", "2025-11-18 06:30 EST"),      # first bar of the data set
    # summer (EDT, UTC-4)
    ("2026-07-15T14:00", "2026-07-15 10:00 EDT"),      # the same clock hour in July is one UTC hour earlier
    ("2026-07-15T04:00", "2026-07-15 00:00 EDT"),      # New York midnight in summer
    # spring switch, Sunday 8 March 2026: 01:59 EST is followed by 03:00 EDT
    ("2026-03-08T06:59", "2026-03-08 01:59 EST"),
    ("2026-03-08T07:00", "2026-03-08 03:00 EDT"),
    # autumn switch, Sunday 1 November 2026: 01:59 EDT is followed by 01:00 EST
    ("2026-11-01T05:59", "2026-11-01 01:59 EDT"),
    ("2026-11-01T06:00", "2026-11-01 01:00 EST"),
    # the switch before the data set starts, Sunday 2 November 2025
    ("2025-11-02T05:59", "2025-11-02 01:59 EDT"),
    ("2025-11-02T06:00", "2025-11-02 01:00 EST"),
]


def self_test():
    """Raise AssertionError on any mismatch. Returns a small report for the summary JSON."""
    for utc_text, expected in HAND_CASES:
        ts = int(datetime.strptime(utc_text, "%Y-%m-%dT%H:%M").replace(tzinfo=timezone.utc).timestamp() * 1000)
        assert ny_text(ts) == expected, (utc_text, ny_text(ts), expected)

    assert us_dst_bounds_ms(2026) == (_utc_ms(2026, 3, 8, 7), _utc_ms(2026, 11, 1, 6))
    assert us_dst_bounds_ms(2025) == (_utc_ms(2025, 3, 9, 7), _utc_ms(2025, 11, 2, 6))
    assert uk_dst_bounds_ms(2026) == (_utc_ms(2026, 3, 29, 1), _utc_ms(2026, 10, 25, 1))

    # 10:00 New York is 15:00 UTC in winter and 14:00 UTC in summer.
    winter = _utc_ms(2026, 1, 15, 15)
    summer = _utc_ms(2026, 7, 15, 14)
    assert int(ny_minute_of_day(np.array([winter]))[0]) == 600
    assert int(ny_minute_of_day(np.array([summer]))[0]) == 600
    assert int(ny_weekday(np.array([winter]))[0]) == 3          # 15 January 2026 was a Thursday
    assert int(ny_weekday(np.array([summer]))[0]) == 2          # 15 July 2026 was a Wednesday
    # A Sunday evening in New York is already Monday in UTC.
    sunday_evening = _utc_ms(2026, 1, 12, 1)                    # Monday 01:00 UTC = Sunday 20:00 EST
    assert ny_text(sunday_evening) == "2026-01-11 20:00 EST"
    assert int(ny_weekday(np.array([sunday_evening]))[0]) == 6
    assert day_number_text(int(ny_day_number(np.array([sunday_evening]))[0])) == "2026-01-11"

    # Length of the New York day on the two switch days and on an ordinary day.
    def day_hours(year, month, day):
        hours = np.arange(_utc_ms(year, month, day) - 12 * HOUR_MS, _utc_ms(year, month, day) + 48 * HOUR_MS, HOUR_MS)
        target = (datetime(year, month, day) - datetime(1970, 1, 1)).days
        return int(np.count_nonzero(ny_day_number(hours) == target))
    assert day_hours(2026, 3, 8) == 23
    assert day_hours(2026, 11, 1) == 25
    assert day_hours(2026, 6, 1) == 24

    assert hhmm("08:30") == 510 and hhmm("24:00") == 1440
    assert in_window(np.array([119, 120, 299, 300]), 120, 300).tolist() == [False, True, True, False]

    report = {"hand_cases": len(HAND_CASES), "zoneinfo_cross_check": "not run: no tz database on this Python"}
    try:
        from zoneinfo import ZoneInfo
        zone = ZoneInfo("America/New_York")
        london = ZoneInfo("Europe/London")
    except Exception:                                           # no tz database: the hand cases stand alone
        return report
    hours = np.arange(_utc_ms(2025, 1, 1), _utc_ms(2027, 1, 1), HOUR_MS)
    ours = ny_offset_hours(hours)
    ours_london = london_offset_hours(hours)
    for ts, ny_off, uk_off in zip(hours.tolist(), ours.tolist(), ours_london.tolist()):
        moment = datetime.fromtimestamp(ts / 1000, tz=timezone.utc)
        assert moment.astimezone(zone).utcoffset() == timedelta(hours=ny_off), moment
        assert moment.astimezone(london).utcoffset() == timedelta(hours=uk_off), moment
    report["zoneinfo_cross_check"] = f"passed: {len(hours)} hourly instants, 2025-01-01 to 2026-12-31, New York and London"
    return report


if __name__ == "__main__":
    print(self_test())
