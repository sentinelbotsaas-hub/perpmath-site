#!/usr/bin/env bash
# Article en/3commas-alternative: install perpmath from the public repository
# into an empty folder and take it as far as a keyless dry run.
#
# Usage:  bash research/3commas-alternative/install_and_dryrun.sh <empty-work-folder>
#
# Nothing here needs an account or an API key. The work folder is outside the
# site repository and is not committed; the transcript is written next to this
# script by the caller (stdout and stderr redirected to
# install_and_dryrun_output.txt, with the work folder's path replaced by
# "<work>").
set -u
WORK="$1"
mkdir -p "$WORK"
cd "$WORK" || exit 1

step() { echo; echo "\$ $*"; }
stamp() { date -u +"%Y-%m-%dT%H:%M:%SZ"; }

echo "start $(stamp)"

step "git clone https://github.com/sentinelbotsaas-hub/perpmath.git"
git clone --quiet https://github.com/sentinelbotsaas-hub/perpmath.git; echo "exit=$?"
cd perpmath || exit 1
step "git log -1 --format='%h %s'"
git log -1 --format='%h %s'

step "python --version"
python --version
step "python -m venv .venv"
python -m venv .venv; echo "exit=$?"
PY=.venv/Scripts/python
[ -x "$PY" ] || PY=.venv/bin/python

step "pip install -e ."
"$PY" -m pip install --quiet --disable-pip-version-check -e .; echo "exit=$?"
step "pip list"
"$PY" -m pip list --disable-pip-version-check --format=freeze | grep -v '^pip=='
echo "installed $(stamp)"

step "perpmath --version"
"$PY" -m perpmath --version; echo "exit=$?"

step "perpmath live ma_cross --symbol BTCUSDT --interval 15m --config configs/live/ma_cross.json --dry-run --once"
"$PY" -m perpmath live ma_cross --symbol BTCUSDT --interval 15m --config configs/live/ma_cross.json --dry-run --once; echo "exit=$?"

step "perpmath live ma_cross --symbol BTCUSDT --interval 15m --config configs/live/ma_cross.json   (no --dry-run, no key in the environment)"
env -u BYBIT_TESTNET_API_KEY -u BYBIT_TESTNET_API_SECRET "$PY" -m perpmath live ma_cross --symbol BTCUSDT --interval 15m --config configs/live/ma_cross.json; echo "exit=$?"

step "perpmath live ma_cross --symbol BTCUSDT --interval 15m --config configs/live/ma_cross.json --dry-run --once --mainnet"
"$PY" -m perpmath live ma_cross --symbol BTCUSDT --interval 15m --config configs/live/ma_cross.json --dry-run --once --mainnet; echo "exit=$?"

step "sed 's/\"testnet\"/\"mainnet\"/' configs/live/ma_cross.json > mainnet-attempt.json; perpmath live ... --config mainnet-attempt.json --dry-run --once"
sed 's/"testnet"/"mainnet"/' configs/live/ma_cross.json > mainnet-attempt.json
"$PY" -m perpmath live ma_cross --symbol BTCUSDT --interval 15m --config mainnet-attempt.json --dry-run --once; echo "exit=$?"

echo
echo "end $(stamp)"
