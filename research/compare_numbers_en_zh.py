"""Compare every number in the English and Traditional Chinese versions of an article.

For each slug the script reads src/content/articles/en/<slug>.md and
src/content/articles/zh-hant/<slug>.md (title, description, tldr and body),
turns every date, clock time and number-with-unit into a canonical token and
lists the tokens that occur in only one language.

Two levels:
  strict    the pair (value, unit) is missing on the other side
  absent    the value itself is missing on the other side, with any unit

"strict but not absent" is a wording difference (for example "365 daily
candles" against the Chinese counter word for candles): the same figure is
there, the unit word around it differs. Every "absent" token must have a
hand-written reason in compare_numbers_en_zh.explanations.json; the script
exits 1 if one is missing, or if a reason is left over for a token that no
longer differs.

Run from the site's root folder:

    python research/compare_numbers_en_zh.py

Output: research/compare_numbers_en_zh.json and a short listing on stdout.

Limits: only digits are read. Numbers written as words ("three days",
"six tiers", and their Chinese equivalents) are not compared. A value that
occurs on both sides with two different meanings is reported at the strict
level only.
"""
import io
import sys

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

import json
import os
import re
from decimal import Decimal

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ARTICLES = os.path.join(ROOT, "src", "content", "articles")
HERE = os.path.dirname(os.path.abspath(__file__))
SLUGS = ["what-is-liquidation", "what-is-funding-rate", "bybit-card-cashback-fees"]

MONTHS = ["January", "February", "March", "April", "May", "June", "July",
          "August", "September", "October", "November", "December"]
MONTH_RE = "(" + "|".join(MONTHS) + ")"
MINUS = "−"


def month_no(name):
    return MONTHS.index(name) + 1


def load(locale, slug):
    """Title, description, tldr and body as one string, without URLs and comments."""
    path = os.path.join(ARTICLES, locale, slug + ".md")
    with io.open(path, encoding="utf-8") as f:
        raw = f.read().replace("\r\n", "\n")
    _, front, body = raw.split("---\n", 2)
    kept = []
    for key in ("title", "description", "tldr"):
        m = re.search(r'^%s: "(.*)"$' % key, front, flags=re.M)
        if not m:
            raise SystemExit("%s: frontmatter %s not found" % (path, key))
        kept.append(m.group(1))
    text = "\n".join(kept) + "\n" + body
    text = re.sub(r"<!--.*?-->", " ", text, flags=re.S)
    text = re.sub(r"\]\([^)]*\)", "] ", text)          # link targets
    text = re.sub(r"https?://[^\s`)]+", " ", text)      # bare URLs in code spans
    return text


def take(text, pattern, make, out, flags=0):
    """Record make(match) for every match and blank the match out of the text."""
    def repl(m):
        for token in make(m):
            out.append(token)
        return " "
    return re.sub(pattern, repl, text, flags=flags)


def canon_date(y, mo, d=None):
    if d is None:
        return ("date", "%04d-%02d" % (int(y), int(mo)))
    return ("date", "%04d-%02d-%02d" % (int(y), int(mo), int(d)))


def dates_and_times(text, lang):
    out = []
    text = take(text, r"(?<!\d)(20\d\d)-(\d\d)-(\d\d)(?!\d)", lambda m: [canon_date(*m.groups())], out)
    if lang == "zh":
        text = take(text, r"(20\d\d)\s*年\s*(\d{1,2})\s*月到\s*(\d{1,2})\s*月",
                    lambda m: [canon_date(m.group(1), m.group(2)), canon_date(m.group(1), m.group(3))], out)
        text = take(text, r"(20\d\d)\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日", lambda m: [canon_date(*m.groups())], out)
        text = take(text, r"(20\d\d)\s*年\s*(\d{1,2})\s*月", lambda m: [canon_date(*m.groups())], out)
        # Clock times given in Taiwan time, e.g. "8 o'clock in the morning".
        text = take(text, r"(早上|下午|半夜|晚上|凌晨)\s*(\d{1,2})\s*點",
                    lambda m: [("taiwan clock", m.group(1) + " " + m.group(2) + " 點")], out)
        text = take(text, r"(?<!\d)(\d{1,2})\s*月", lambda m: [("month", "%02d" % int(m.group(1)))], out)
        text = take(text, r"(?<!\d)(\d{1,2})\s*日(?!\s*K)", lambda m: [("day of month", "%02d" % int(m.group(1)))], out)
    else:
        text = take(text, r"\b%s to %s (20\d\d)\b" % (MONTH_RE, MONTH_RE),
                    lambda m: [canon_date(m.group(3), month_no(m.group(1))), canon_date(m.group(3), month_no(m.group(2)))], out)
        text = take(text, r"\b(\d{1,2}) %s (20\d\d)\b" % MONTH_RE,
                    lambda m: [canon_date(m.group(3), month_no(m.group(2)), m.group(1))], out)
        text = take(text, r"\b%s (20\d\d)\b" % MONTH_RE, lambda m: [canon_date(m.group(2), month_no(m.group(1)))], out)
        text = take(text, r"\b%s\b" % MONTH_RE, lambda m: [("month", "%02d" % month_no(m.group(1)))], out)
        text = take(text, r"\bthe (\d{1,2})(?:st|nd|rd|th)\b", lambda m: [("day of month", "%02d" % int(m.group(1)))], out)
    text = take(text, r"(?<!\d)(20\d\d)-(\d\d)(?!\d)", lambda m: [canon_date(*m.groups())], out)
    text = take(text, r"(?<![\d.])(\d{1,2}):(\d{2})(?![\d.])", lambda m: [("clock", "%02d:%s" % (int(m.group(1)), m.group(2)))], out)
    return text, out


# Unit words that follow a number. First match wins, so longer words come first.
UNITS_ZH = [
    (r"\s*%", "%"), (r"\s*個百分點", "percentage points"),
    (r"\s*USDT", "USDT"), (r"\s*USD", "USD"), (r"\s*TWD", "TWD"), (r"\s*EUR", "EUR"),
    (r"\s*倍", "x leverage"), (r"\s*天", "days"), (r"\s*小時", "hours"), (r"\s*分鐘", "minutes"),
    (r"\s*秒", "seconds"), (r"\s*顆", "BTC"), (r"\s*點", "points"),
    (r"\s*次", "count"), (r"\s*筆", "count"), (r"\s*個", "count"),
]
UNITS_EN = [
    (r"\s*%", "%"), (r"\s*percentage points\b", "percentage points"),
    (r"\s*USDT\b", "USDT"), (r"\s*USD\b", "USD"), (r"\s*TWD\b", "TWD"), (r"\s*EUR\b", "EUR"),
    (r"\s*BTC\b", "BTC"), (r"x\b", "x leverage"), (r"\s*days?\b", "days"),
    (r"[\s-]*hours?\b", "hours"), (r"\s*minutes?\b", "minutes"), (r"\s*seconds?\b", "seconds"),
    (r"\s*points\b", "points"),
    (r"\s*(?:settlements|records|entries|withdrawals)\b", "count"),
]
SCALE_ZH = [(r"\s*億", 100000000), (r"\s*萬", 10000)]
SCALE_EN = [(r"\s*million\b", 1000000)]

NUMBER = re.compile(r"(?<![\d.])(%s?)(\d[\d,]*(?:\.\d+)?)" % MINUS)


def numbers(text, lang):
    out = []
    units = UNITS_ZH if lang == "zh" else UNITS_EN
    scales = SCALE_ZH if lang == "zh" else SCALE_EN
    for m in NUMBER.finditer(text):
        digits = m.group(2).rstrip(",")
        value = Decimal(digits.replace(",", ""))
        rest = text[m.start(2) + len(digits):m.start(2) + len(digits) + 24]
        for pattern, factor in scales:
            s = re.match(pattern, rest)
            if s:
                value *= factor
                rest = rest[s.end():]
                break
        if m.group(1):
            value = -value
        unit = ""
        for pattern, name in units:
            if re.match(pattern, rest):
                unit = name
                break
        text_value = format(value.normalize(), "f")
        if text_value == "-0":
            text_value = "0"
        out.append((unit or "no unit", text_value))
    return out


def tokens(locale, slug):
    lang = "zh" if locale.startswith("zh") else "en"
    text = load(locale, slug)
    text, found = dates_and_times(text, lang)
    found += numbers(text, lang)
    return found


def key(token):
    return "%s | %s" % (token[1], token[0])


def compare(slug, reasons):
    en, zh = tokens("en", slug), tokens("zh-hant", slug)
    en_set, zh_set = set(en), set(zh)
    en_values = {v for u, v in en if u not in ("date", "clock", "month", "day of month", "taiwan clock")}
    zh_values = {v for u, v in zh if u not in ("date", "clock", "month", "day of month", "taiwan clock")}
    result = {"tokens_en": len(en), "tokens_zh": len(zh), "distinct_en": len(en_set), "distinct_zh": len(zh_set),
              "shared_distinct": len(en_set & zh_set)}
    missing_reason = []
    for side, mine, other_values in (("only_in_en", en_set - zh_set, zh_values), ("only_in_zh", zh_set - en_set, en_values)):
        absent, wording = [], []
        for token in sorted(mine, key=lambda t: (t[0], t[1])):
            special = token[0] in ("date", "clock", "month", "day of month", "taiwan clock")
            if not special and token[1] in other_values:
                wording.append(key(token))
                continue
            why = reasons.get(slug, {}).get(side, {}).get(key(token))
            if why is None:
                missing_reason.append("%s %s %s" % (slug, side, key(token)))
            absent.append({"token": key(token), "why": why})
        result[side] = {"value_absent_on_other_side": absent, "same_value_other_unit_wording": wording}
    used = {(side, item["token"]) for side in ("only_in_en", "only_in_zh")
            for item in result[side]["value_absent_on_other_side"]}
    stale = [(slug, side, t) for side, items in reasons.get(slug, {}).items() for t in items if (side, t) not in used]
    return result, missing_reason, stale


def main():
    with io.open(os.path.join(HERE, "compare_numbers_en_zh.explanations.json"), encoding="utf-8") as f:
        reasons = json.load(f)
    report = {
        "what": "Dates, clock times and numbers that occur in only one language version of an article.",
        "script": "research/compare_numbers_en_zh.py",
        "token_format": "value | unit",
        "articles": {},
    }
    missing, stale = [], []
    for slug in SLUGS:
        result, m, s = compare(slug, reasons)
        report["articles"][slug] = result
        missing += m
        stale += s
    with io.open(os.path.join(HERE, "compare_numbers_en_zh.json"), "w", encoding="utf-8", newline="\n") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
        f.write("\n")
    for slug, result in report["articles"].items():
        print("== %s: %d distinct tokens in en, %d in zh-hant, %d shared" % (
            slug, result["distinct_en"], result["distinct_zh"], result["shared_distinct"]))
        for side in ("only_in_en", "only_in_zh"):
            block = result[side]
            print("  %s: %d with the value absent on the other side, %d wording only" % (
                side, len(block["value_absent_on_other_side"]), len(block["same_value_other_unit_wording"])))
            for item in block["value_absent_on_other_side"]:
                print("    %-34s %s" % (item["token"], item["why"] or "NO REASON GIVEN"))
    if missing or stale:
        for line in missing:
            print("missing reason: " + line)
        for line in stale:
            print("stale reason: %s %s %s" % line)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
