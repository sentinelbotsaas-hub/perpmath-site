import sys, io; sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')  # noqa: E401,E702
"""Article en/3commas-alternative: what perpmath's start-up key check does with four
kinds of API key.

No key is used and nothing is sent anywhere. Each case is a dict shaped like the
`result` of Bybit's GET /v5/user/query-api as documented at
https://bybit-exchange.github.io/docs/v5/user/apikey-info (readOnly, permissions, ips,
type), made up by hand, and handed to perpmath.live.executor.check_api_key, the function
the runner calls with the real response before it places an order.

So this shows what the code decides for a given description of a key. It does not show
that Bybit's real response has this shape for a real key: the signed endpoints have only
been tested against a fake server.

Usage: <engine>/.venv/Scripts/python research/3commas-alternative/key_check_demo.py
Output: printed, and key_check_demo.json next to this file.
"""
import json
from pathlib import Path

import perpmath
from perpmath.live.executor import KeyPermissionError, check_api_key

CASES = [
    ("trade only, bound to an IP",
     {"readOnly": 0, "type": 1, "ips": ["203.0.113.7"],
      "permissions": {"ContractTrade": ["Order", "Position"], "Spot": [], "Wallet": []}}),
    ("trade only, no IP bound",
     {"readOnly": 0, "type": 1, "ips": [],
      "permissions": {"ContractTrade": ["Order", "Position"], "Spot": [], "Wallet": []}}),
    ("trade plus withdrawal",
     {"readOnly": 0, "type": 1, "ips": ["203.0.113.7"],
      "permissions": {"ContractTrade": ["Order", "Position"], "Wallet": ["AccountTransfer", "Withdraw"]}}),
    ("trade plus transfer between accounts",
     {"readOnly": 0, "type": 1, "ips": ["203.0.113.7"],
      "permissions": {"ContractTrade": ["Order", "Position"], "Wallet": ["AccountTransfer"]}}),
    ("read-only",
     {"readOnly": 1, "type": 1, "ips": ["203.0.113.7"],
      "permissions": {"ContractTrade": ["Order", "Position"], "Wallet": []}}),
    ("spot trading only",
     {"readOnly": 0, "type": 1, "ips": ["203.0.113.7"],
      "permissions": {"ContractTrade": [], "Spot": ["SpotTrade"], "Wallet": []}}),
]


def main():
    rows = []
    for label, info in CASES:
        try:
            warnings = check_api_key(info)
            row = {"key": label, "accepted": True, "warnings": warnings, "refusal": None}
            print(f"{label:38} ACCEPTED" + ("" if not warnings else "  warning: " + "; ".join(warnings)))
        except KeyPermissionError as exc:
            row = {"key": label, "accepted": False, "warnings": [], "refusal": str(exc)}
            print(f"{label:38} REFUSED   {exc}")
        row["permissions"] = info["permissions"]
        row["readOnly"] = info["readOnly"]
        row["ips"] = info["ips"]
        rows.append(row)
    out = {"article": "en/3commas-alternative", "engine_version": perpmath.__version__,
           "note": "hand-made key descriptions in the documented shape; no real key, no request sent",
           "cases": rows}
    with open(Path(__file__).resolve().parent / "key_check_demo.json", "w", encoding="utf-8", newline=chr(10)) as handle:
        json.dump(out, handle, indent=2)
        handle.write(chr(10))


if __name__ == "__main__":
    main()
