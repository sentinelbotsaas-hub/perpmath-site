import sys, io; sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')  # noqa: E401,E702
"""Article en/3commas-alternative: licence, language and last push of each repository,
read from GitHub's public REST API (no token). Writes github_licenses.json next to this file.

Usage: python research/3commas-alternative/github_licenses.py
"""
import datetime
import json
import urllib.request
from pathlib import Path

REPOS = ["freqtrade/freqtrade", "hummingbot/hummingbot", "jesse-ai/jesse", "Drakkar-Software/OctoBot",
         "sentinelbotsaas-hub/perpmath"]
KEEP = ["full_name", "html_url", "description", "homepage", "language", "pushed_at", "archived"]


def main():
    out = {"source": "https://api.github.com/repos/<owner>/<repo>",
           "fetched_at": datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"), "repos": []}
    for repo in REPOS:
        request = urllib.request.Request("https://api.github.com/repos/" + repo,
                                         headers={"User-Agent": "research-script", "Accept": "application/vnd.github+json"})
        with urllib.request.urlopen(request, timeout=30) as response:
            doc = json.load(response)
        row = {key: doc.get(key) for key in KEEP}
        row["license_spdx_id"] = (doc.get("license") or {}).get("spdx_id")
        row["license_name"] = (doc.get("license") or {}).get("name")
        out["repos"].append(row)
        print(f"{row['full_name']:32} {row['license_spdx_id']:12} {row['language']:8} pushed {row['pushed_at']}")
    path = Path(__file__).resolve().parent / "github_licenses.json"
    with open(path, "w", encoding="utf-8", newline=chr(10)) as handle:
        json.dump(out, handle, indent=2)
        handle.write(chr(10))


if __name__ == "__main__":
    main()
