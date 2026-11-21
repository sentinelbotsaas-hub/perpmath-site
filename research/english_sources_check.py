"""Check that the Bybit help-center articles cited by the English articles exist in English.

For every article slug it requests the /en/ and the /zh-TW/ page, reads the
title and the last_updated field from the data embedded in the page, and
writes both to research/english_sources_help_center_2026-11-22.json. No
account and no API key: these are public pages.

    python research/english_sources_check.py

The pages that need a browser (the rewards program page, the card landing
page, the Asia Pacific cardholder terms) and the sources outside Bybit are
recorded by hand in research/english_sources_other_2026-11-22.json.
"""
import io
import sys

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

import html
import json
import os
import re
import time
import urllib.request
from datetime import datetime, timezone

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "english_sources_help_center_2026-11-22.json")
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36"
URL = "https://www.bybit.com/{lang}/help-center/article/{slug}"

# slug -> the English articles that cite it
SLUGS = {
    "UTA-Trading-Rules-Liquidation-Process": ["what-is-liquidation"],
    "Maintenance-Margin-USDT-Contract": ["what-is-liquidation"],
    "Mark-Price-Calculation-Perpetual-Expiry-Contracts": ["what-is-liquidation"],
    "Funding-fee-calculation": ["what-is-funding-rate"],
    "Introduction-to-Funding-Rate": ["what-is-funding-rate"],
    "Introduction-to-Bybit-Card-Rewards": ["bybit-card-cashback-fees"],
    "FAQ-Bybit-Card-Rewards": ["bybit-card-cashback-fees"],
    "Introduction-to-Bybit-VIP-Program": ["bybit-card-cashback-fees"],
    "Fees-and-Spending-Limits-Bybit-Card": ["bybit-card-cashback-fees"],
    "FAQ-Bybit-Card-General-Inquiries": ["bybit-card-cashback-fees"],
    "How-Bybit-Card-Transactions-Work": ["bybit-card-cashback-fees"],
    "Introduction-to-Bybit-Card": ["bybit-card-cashback-fees"],
    "How-to-Apply-for-Bybit-Card": ["bybit-card-cashback-fees"],
}


def read_page(lang, slug):
    url = URL.format(lang=lang, slug=slug)
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=40) as r:
        status, final, text = r.status, r.geturl(), r.read().decode("utf-8", "replace")
    title = re.search(r"<title>([^<]*)", text)
    data = re.search(r'<script id="__NEXT_DATA__"[^>]*>(.*?)</script>', text, flags=re.S)
    updated, body_chars = None, 0
    if data:
        article = json.loads(data.group(1)).get("props", {}).get("pageProps", {}).get("article", {})
        if isinstance(article, dict):
            for tab in article.get("tabs") or []:
                body_chars += len(re.sub(r"<[^>]+>", "", tab.get("tab_content", "")))
            # last_updated sits in a nested object; take the first one that holds a timestamp.
            stack = [article]
            while stack and updated is None:
                node = stack.pop()
                if isinstance(node, dict):
                    value = node.get("last_updated")
                    if isinstance(value, str) and re.match(r"\d{4}-\d{2}-\d{2}", value):
                        updated = value
                    stack.extend(node.values())
                elif isinstance(node, list):
                    stack.extend(node)
    return {
        "url": url,
        "http_status": status,
        "final_url": final,
        "title": html.unescape(title.group(1)) if title else None,
        "page_last_updated": updated,
        "body_characters": body_chars,
    }


def main():
    pages = []
    for slug, cited_by in SLUGS.items():
        row = {"slug": slug, "cited_by": cited_by}
        for lang in ("en", "zh-TW"):
            row[lang] = read_page(lang, slug)
            time.sleep(1.5)
        row["english_page_exists"] = (
            row["en"]["http_status"] == 200
            and row["en"]["final_url"].endswith("/en/help-center/article/" + slug)
            and row["en"]["body_characters"] > 500
        )
        row["same_last_updated"] = row["en"]["page_last_updated"] == row["zh-TW"]["page_last_updated"]
        pages.append(row)
        print("%-52s en=%s zh-TW=%s exists=%s" % (
            slug, row["en"]["page_last_updated"], row["zh-TW"]["page_last_updated"], row["english_page_exists"]))
    out = {
        "what": "Bybit help-center articles cited by the English articles: does the /en/ page exist, and what date does it carry.",
        "fetched_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "pages": pages,
    }
    with io.open(OUT, "w", encoding="utf-8", newline="\n") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)
        f.write("\n")
    return 0 if all(p["english_page_exists"] for p in pages) else 1


if __name__ == "__main__":
    sys.exit(main())
