"""Download the Cup of Excellence result pages listed in sources.csv into raw/pages/<slug>.html.

This is the first reproduction step; parse_coe.py reads raw/pages/ and analyze.py reads parse_coe.py's output.
The pages are live, so a fresh fetch can differ from the 2026-10-02 capture recorded in sources.csv.
Run: uv run --with requests python fetch_pages.py
"""
import csv
import os
import sys
import time

import requests

HERE = os.path.dirname(os.path.abspath(__file__))
PAGES = os.path.join(HERE, "raw", "pages")
DELAY_S = 1.5


def main():
    os.makedirs(PAGES, exist_ok=True)
    with open(os.path.join(HERE, "sources.csv"), newline="") as f:
        sources = list(csv.DictReader(f))
    failed = []
    for i, row in enumerate(sources):
        path = os.path.join(PAGES, f"{row['slug']}.html")
        if os.path.exists(path):
            continue
        if i:
            time.sleep(DELAY_S)
        r = requests.get(row["url"], timeout=60, headers={"User-Agent": "purveyors-research/1.0"})
        if r.status_code != 200:
            failed.append((row["slug"], r.status_code))
            continue
        with open(path, "w", encoding="utf-8") as out:
            out.write(r.text)
    print(f"{len(sources) - len(failed)}/{len(sources)} pages in {PAGES}")
    if failed:
        sys.exit(f"failed: {failed}")


if __name__ == "__main__":
    main()
