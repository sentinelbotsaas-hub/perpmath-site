"""Article en/how-to-backtest-a-trading-strategy: the two peeking strategies, run again on a newer engine.

lookahead_demo.py recorded what engine 0.2.1 did with them (lookahead_demo.json):
the centred average was blocked, the one-bar-early version passed. This script
calls the same command-line entry point with the same two strategies on
whatever engine version is installed, and writes
lookahead_recheck.json. It does not touch lookahead_demo.json or any result
file: the engine's output goes to a temporary folder.

Usage, from the site's root folder, with the engine's own Python:
    <engine>/.venv/Scripts/python research/how-to-backtest/lookahead_recheck.py [data-dir]
"""
import json
import sys
import tempfile
import types
from pathlib import Path

import perpmath
from perpmath.strategies import STRATEGIES, ma_cross

sys.path.insert(0, str(Path(__file__).resolve().parent))
from lookahead_demo import CONFIG, HERE, PEEKERS, run_cli  # noqa: E402


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    engine_root = Path(perpmath.__file__).resolve().parents[2]
    data_dir = Path(args[0]).resolve() if args else engine_root / "data"
    with open(CONFIG, encoding="utf-8") as handle:
        raw = json.load(handle)
    for name, generate in PEEKERS.items():
        STRATEGIES[name] = types.SimpleNamespace(DEFAULTS=dict(ma_cross.DEFAULTS), generate=generate)

    out = {"article": "en/how-to-backtest-a-trading-strategy", "engine_version": perpmath.__version__, "runs": {}}
    with tempfile.TemporaryDirectory() as tmp:
        for name in PEEKERS:
            result_path = Path(tmp) / (name.replace("_", "-") + "-btcusdt.json")
            run = run_cli(name, data_dir, result_path, raw)
            run["result_file_written"] = result_path.exists()
            if result_path.exists():
                with open(result_path, encoding="utf-8") as handle:
                    run["lookahead_check_in_result"] = json.load(handle)["timing"]["lookahead_check"]
            run["stdout"] = run["stdout"].splitlines()[:3]
            out["runs"][name] = run
            print(name, "exit", run["exit_code"], "|", run["stderr"].splitlines()[-1] if run["stderr"] else "")

    with open(HERE / "lookahead_recheck.json", "w", encoding="utf-8", newline=chr(10)) as handle:
        json.dump(out, handle, indent=2)
        handle.write(chr(10))


if __name__ == "__main__":
    main()
