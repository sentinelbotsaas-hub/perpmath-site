"""Count the lines of the perpmath engine by what they are for.

Usage (from the site's root folder):

    python research/build-a-trading-bot-python/loc_count.py ../perpmath-engine

The engine folder is only read. Every tracked ``.py`` file under ``src/`` and
``tests/`` is put in exactly one group; the script stops if a file has no
group, so a new file cannot be left out silently.

For each file it reports:

* ``lines``      physical lines
* ``blank``      empty lines
* ``comment``    lines holding only a ``#`` comment
* ``docstring``  lines inside module, class and function docstrings
* ``code``       everything else (lines - blank - comment - docstring)

Standard library only. Output: ``loc_count_<tag>.json`` next to this file
(the tag is ``git describe`` of the checkout, for example ``v0.2.0``) and a
table on stdout. The checkout must be clean and at a tag.
"""

from __future__ import annotations

import ast
import io
import json
import subprocess
import sys
import tokenize
from pathlib import Path

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

# group -> files (paths relative to the engine root)
GROUPS = {
    "Strategies (examples + registry)": [
        "src/perpmath/strategies/__init__.py",
        "src/perpmath/strategies/fvg.py",
        "src/perpmath/strategies/liquidity_sweep.py",
        "src/perpmath/strategies/ma_cross.py",
    ],
    "Indicators": ["src/perpmath/indicators.py"],
    "Backtest engine (simulator, result file, metrics)": [
        "src/perpmath/engine.py",
        "src/perpmath/backtest.py",
        "src/perpmath/metrics.py",
    ],
    "Grid simulator": ["src/perpmath/grid.py", "src/perpmath/grid_backtest.py"],
    "Data download and cache (candles, funding)": ["src/perpmath/data.py", "src/perpmath/funding.py"],
    "Command line and package glue": [
        "src/perpmath/cli.py",
        "src/perpmath/__init__.py",
        "src/perpmath/__main__.py",
    ],
    "Live: exchange client (signing, errors, rate limits)": ["src/perpmath/live/bybit.py"],
    "Live: executor (orders, reconciliation, dry run)": ["src/perpmath/live/executor.py"],
    "Live: circuit breakers": ["src/perpmath/live/breaker.py"],
    "Live: state file": ["src/perpmath/live/state.py"],
    "Live: config and credentials": ["src/perpmath/live/config.py", "src/perpmath/live/__init__.py"],
    "Tests: backtest, grid, data": [
        "tests/conftest.py",
        "tests/test_cli_output.py",
        "tests/test_downloader.py",
        "tests/test_fees.py",
        "tests/test_funding.py",
        "tests/test_grid.py",
        "tests/test_grid_backtest.py",
        "tests/test_metrics.py",
        "tests/test_no_lookahead.py",
        "tests/test_strategies.py",
    ],
    "Tests: live runner (incl. fake exchange)": [
        "tests/live_fakes.py",
        "tests/test_live.py",
        "tests/test_live_testnet_smoke.py",
    ],
}

# Larger buckets used for the headline shares.
BUCKETS = {
    "strategies": ["Strategies (examples + registry)", "Indicators"],
    "backtesting": ["Backtest engine (simulator, result file, metrics)", "Grid simulator"],
    "data_and_cli": ["Data download and cache (candles, funding)", "Command line and package glue"],
    "live_order_handling": [
        "Live: exchange client (signing, errors, rate limits)",
        "Live: executor (orders, reconciliation, dry run)",
        "Live: circuit breakers",
        "Live: state file",
        "Live: config and credentials",
    ],
    "tests": ["Tests: backtest, grid, data", "Tests: live runner (incl. fake exchange)"],
}


def count_file(path: Path) -> dict:
    text = path.read_text(encoding="utf-8")
    lines = text.splitlines()
    total = len(lines)
    blank = {i for i, line in enumerate(lines, start=1) if not line.strip()}

    docstring = set()
    tree = ast.parse(text)
    for node in ast.walk(tree):
        if isinstance(node, (ast.Module, ast.ClassDef, ast.FunctionDef, ast.AsyncFunctionDef)):
            body = node.body
            if body and isinstance(body[0], ast.Expr) and isinstance(body[0].value, ast.Constant) \
                    and isinstance(body[0].value.value, str):
                first = body[0]
                docstring.update(range(first.lineno, first.end_lineno + 1))

    comment = set()
    code_lines = set()
    for tok in tokenize.generate_tokens(io.StringIO(text).readline):
        if tok.type == tokenize.COMMENT:
            comment.add(tok.start[0])
        elif tok.type not in (tokenize.NL, tokenize.NEWLINE, tokenize.INDENT, tokenize.DEDENT,
                              tokenize.ENDMARKER, tokenize.ENCODING):
            code_lines.update(range(tok.start[0], tok.end[0] + 1))
    # A comment-only line is one with a comment and no other token.
    comment_only = {n for n in comment if n not in code_lines}
    doc_only = docstring - blank
    code = total - len(blank) - len(comment_only - blank) - len(doc_only - comment_only)
    return {
        "lines": total,
        "blank": len(blank),
        "comment": len(comment_only - blank),
        "docstring": len(doc_only),
        "code": code,
    }


def add(a: dict, b: dict) -> dict:
    return {k: a.get(k, 0) + b[k] for k in b}


def git(root: Path, *args: str) -> str:
    return subprocess.run(["git", "-C", str(root), *args], check=True, capture_output=True,
                          text=True, encoding="utf-8").stdout.strip()


def main() -> int:
    if len(sys.argv) != 2:
        print(__doc__)
        return 2
    root = Path(sys.argv[1]).resolve()
    tracked = sorted(p for p in git(root, "ls-files", "src", "tests").splitlines() if p.endswith(".py"))
    # Example strategies added in 0.2.1. Counted when the checkout has them.
    for optional in ("break_of_structure", "breaker_block", "order_block"):
        path = f"src/perpmath/strategies/{optional}.py"
        if path in tracked:
            GROUPS["Strategies (examples + registry)"].append(path)
    grouped = [f for files in GROUPS.values() for f in files]
    missing = sorted(set(tracked) - set(grouped))
    extra = sorted(set(grouped) - set(tracked))
    if missing or extra or len(grouped) != len(set(grouped)):
        print(f"error: grouping does not match the repository. ungrouped={missing} unknown={extra}",
              file=sys.stderr)
        return 1
    dirty = git(root, "status", "--porcelain", "--", "src", "tests")
    if dirty:
        print("error: src/ or tests/ has uncommitted changes; the count would not match the commit",
              file=sys.stderr)
        return 1

    per_file = {f: count_file(root / f) for f in grouped}
    groups = {}
    for name, files in GROUPS.items():
        total: dict = {}
        for f in files:
            total = add(total, per_file[f])
        groups[name] = {"files": len(files), **total}
    grand: dict = {}
    for g in groups.values():
        grand = add(grand, {k: v for k, v in g.items()})
    buckets = {}
    for name, members in BUCKETS.items():
        total = {}
        for m in members:
            total = add(total, groups[m])
        buckets[name] = {**total,
                         "share_of_lines_pct": round(total["lines"] / grand["lines"] * 100, 2),
                         "share_of_code_pct": round(total["code"] / grand["code"] * 100, 2)}
    for g in groups.values():
        g["share_of_lines_pct"] = round(g["lines"] / grand["lines"] * 100, 2)
        g["share_of_code_pct"] = round(g["code"] / grand["code"] * 100, 2)

    strategy_files = [f for f in GROUPS["Strategies (examples + registry)"] if not f.endswith("__init__.py")]
    src_only = {}
    for name, g in groups.items():
        if not name.startswith("Tests"):
            src_only = add(src_only, {k: g[k] for k in ("lines", "blank", "comment", "docstring", "code")})
    live_src = buckets["live_order_handling"]
    live_tests = groups["Tests: live runner (incl. fake exchange)"]
    result = {
        "engine": {
            "repository": git(root, "remote", "get-url", "origin"),
            "commit": git(root, "rev-parse", "HEAD"),
            "commit_date": git(root, "log", "-1", "--format=%cI"),
            "describe": git(root, "describe", "--tags", "--always"),
        },
        "method": "git ls-files src tests, *.py only; lines = physical lines; code = lines - blank - "
                  "comment-only - docstring lines (ast for docstrings, tokenize for comments)",
        "files": per_file,
        "groups": groups,
        "buckets": buckets,
        "total": grand,
        "source_only_total": src_only,
        "tests_total": buckets["tests"],
        "derived": {
            "strategy_file_code_lines": {f.rsplit("/", 1)[1]: per_file[f]["code"] for f in strategy_files},
            "strategy_file_lines": {f.rsplit("/", 1)[1]: per_file[f]["lines"] for f in strategy_files},
            "strategy_files_code": sum(per_file[f]["code"] for f in strategy_files),
            "strategy_share_without_grid_pct": round(
                groups["Strategies (examples + registry)"]["code"]
                / (src_only["code"] - groups["Grid simulator"]["code"]) * 100, 2),
            "strategy_and_indicator_share_without_grid_pct": round(
                (groups["Strategies (examples + registry)"]["code"] + groups["Indicators"]["code"])
                / (src_only["code"] - groups["Grid simulator"]["code"]) * 100, 2),
            "live_source_plus_live_tests_share_of_code_pct": round(
                (live_src["code"] + live_tests["code"]) / grand["code"] * 100, 2),
            "live_source_plus_live_tests_lines": live_src["lines"] + live_tests["lines"],
            "live_source_plus_live_tests_code": live_src["code"] + live_tests["code"],
            "code_lines_per_strategy_code_line": round(
                grand["code"] / sum(per_file[f]["code"] for f in strategy_files), 1),
            "live_code_per_ma_cross_code_line": round(
                live_src["code"] / per_file["src/perpmath/strategies/ma_cross.py"]["code"], 1),
            "test_code_to_source_code_ratio": round(buckets["tests"]["code"] / src_only["code"], 2),
        },
    }
    out = Path(__file__).with_name(f"loc_count_{result['engine']['describe']}.json")
    out.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8", newline="\n")

    print(f"engine {result['engine']['repository']} @ {result['engine']['commit'][:7]} "
          f"({result['engine']['describe']})")
    head = f"{'group':56}{'files':>6}{'lines':>7}{'blank':>7}{'comment':>8}{'docstr':>7}{'code':>6}{'% code':>8}"
    print(head)
    for name, g in groups.items():
        print(f"{name:56}{g['files']:>6}{g['lines']:>7}{g['blank']:>7}{g['comment']:>8}"
              f"{g['docstring']:>7}{g['code']:>6}{g['share_of_code_pct']:>8.2f}")
    print(f"{'TOTAL':56}{len(grouped):>6}{grand['lines']:>7}{grand['blank']:>7}{grand['comment']:>8}"
          f"{grand['docstring']:>7}{grand['code']:>6}{100:>8.2f}")
    print()
    for name, b in buckets.items():
        print(f"bucket {name:22} lines {b['lines']:>5} ({b['share_of_lines_pct']:>5.2f}%)  "
              f"code {b['code']:>5} ({b['share_of_code_pct']:>5.2f}%)")
    print()
    for key, value in result["derived"].items():
        print(f"{key}: {value}")
    print(f"wrote {out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
