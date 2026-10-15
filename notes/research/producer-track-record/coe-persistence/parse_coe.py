"""Parse Alliance for Coffee Excellence (CoE) competition pages into one lot-level CSV.

Input: raw/pages/<slug>.html, downloaded by fetch_pages.py from the URLs in sources.csv
Output: coe_lots.csv (one row per placed lot), parse_log.csv (per-page diagnostics)
"""
import difflib
import glob
import os
import re
import unicodedata

import pandas as pd
from bs4 import BeautifulSoup

# ACE page whose results table is corrupt (all scores 0.00; farm list does not match the auction list).
AUCTION_ONLY_PAGES = {"nicaragua-2002"}

HERE = os.path.dirname(os.path.abspath(__file__))

FIELD_PATTERNS = [
    # order matters: first match wins for each header cell
    ("buyer", r"bidder|company|winner|buyer|business"),
    ("bid", r"bid|price per|\$/lb"),
    ("total", r"total"),
    ("commission", r"commission|comission"),
    ("farmer", r"farmer|representative|producer|nome"),
    ("farm", r"farm|cws"),
    ("rank", r"^rank|^ranking|^lot|^#$|^n°"),
    ("score", r"score"),
    ("region", r"region"),
    ("process_variety", r"process,\s*variety"),
    ("variety", r"variet"),
    ("process", r"process"),
    ("weight", r"weight|size|pounds|boxes"),
    ("origin", r"origin|location|country"),
    ("altitude", r"altitude"),
]


def norm_header(h):
    h = h.replace("\xa0", " ").strip().lower()
    for field, pat in FIELD_PATTERNS:
        if re.search(pat, h):
            return field
    return None


def clean(s):
    return re.sub(r"\s+", " ", (s or "").replace("\xa0", " ")).strip()


def parse_num(s):
    s = clean(s)
    if re.search(r"\d,\d{1,2}(?!\d)", s) and not re.search(r"\d\.\d{1,2}(?!\d)", s):
        s = s.replace(".", "").replace(",", ".")  # European decimal comma (Brazil 2023)
    s = s.replace(",", "")
    m = re.search(r"\d+(?:\.\d+)?", s)
    return float(m.group()) if m else None


def nearest_heading(table):
    for el in table.find_all_previous(["h1", "h2", "h3", "h4", "h5", "h6"]):
        tx = clean(el.get_text(" ", strip=True))
        if tx:
            return tx
    return ""


def category_heading(table):
    """Sub-category label (e.g. 'Washed + Honey', 'Natural', 'Experimental') used on 2024+ pages."""
    for el in table.find_all_previous(["h1", "h2", "h3", "h4", "h5", "h6", "strong", "p"], limit=3):
        tx = clean(el.get_text(" ", strip=True))
        if re.fullmatch(r"(washed|natural|honey|experimental|washed \+ honey|anaerobic|[a-z +/&-]{3,30})", tx, re.I) and not re.search(
            r"result|jury|auction|commission", tx, re.I
        ):
            return tx
    return ""


def slug_meta(slug):
    m = re.match(r"(.+?)-(?:coe-)?(\d{4})(?:-(.+))?$", slug)
    base, year, suffix = m.group(1), int(m.group(2)), m.group(3)
    if slug == "costa-rica-coe-2017":
        base = "costa-rica"
    country = None
    for c in ["el-salvador", "costa-rica", "colombia", "brazil", "guatemala", "honduras", "nicaragua"]:
        if slug.startswith(c):
            country = c
    competition = base if not suffix else f"{base}-{suffix}"
    return country, year, competition


def parse_page(path):
    slug = os.path.basename(path)[:-5]
    country, year, competition = slug_meta(slug)
    soup = BeautifulSoup(open(path, encoding="utf-8").read(), "lxml")
    results, auctions = [], []
    for ti, t in enumerate(soup.find_all("table")):
        rows = t.find_all("tr")
        if not rows:
            continue
        hdr = [clean(c.get_text(" ", strip=True)) for c in rows[0].find_all(["td", "th"])]
        fields = [norm_header(h) for h in hdr]
        fs = set(fields)
        heading = nearest_heading(t)
        if "farm" not in fs or ("commission" in fs and "bid" not in fs):
            continue
        is_auction = "bid" in fs
        is_result = (not is_auction) and ({"farmer", "region", "variety", "process"} & fs)
        if not (is_auction or is_result):
            continue
        tier_hint = "NW" if re.search(r"\bNW\b|national winner", heading, re.I) else "CoE"
        cat = category_heading(t)
        for r in rows[1:]:
            cells = [clean(c.get_text(" ", strip=True)) for c in r.find_all(["td", "th"])]
            if len(cells) < len(fields) - 1 or not any(cells):
                continue
            rec = {}
            for f, v in zip(fields, cells):
                if f and f not in rec:
                    rec[f] = v
            if not rec.get("farm"):
                continue
            rank_raw = rec.get("rank", "")
            tier = "NW" if (tier_hint == "NW" or rank_raw.upper().startswith("NW")) else "CoE"
            rec.update(
                slug=slug, country=country, year=year, competition=competition, tier=tier,
                category=cat, table_index=ti, row_order=len(results if is_result else auctions),
            )
            (auctions if is_auction else results).append(rec)
    return slug, results, auctions


def fold(s):
    s = unicodedata.normalize("NFKD", s or "").encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", " ", s).strip()


def core_name(s):
    s = re.split(r"\s[–-]\s", s or "")[0]  # 2018 auction tables use 'Farm – Farmer'
    s = re.sub(r"\b(19|20)\d\d\b", "", s)
    return fold(s).replace("…", "").strip()


def name_sim(a, b):
    a, b = core_name(a), core_name(b)
    if not a or not b:
        return 0.0
    if a == b:
        return 1.0
    if a.startswith(b) or b.startswith(a):
        return 0.9
    return difflib.SequenceMatcher(None, a, b).ratio()


def merge(results, auctions, slug):
    """Attach auction price/buyer to result rows.

    Match within tier on farm-name similarity, requiring equal score when both tables carry one,
    and using rank equality as a tie-breaker / fallback for truncated or reformatted names.
    """
    if slug in AUCTION_ONLY_PAGES:
        results = []
    out = []
    used = set()
    result_tiers = {r["tier"] for r in results}
    for r in results:
        rs = parse_num(r.get("score", ""))
        ra = clean(r.get("rank", "")).lower()
        best, best_val = None, 0.0
        for j, a in enumerate(auctions):
            if j in used or a["tier"] != r["tier"]:
                continue
            as_ = parse_num(a.get("score", ""))
            if rs and as_ and abs(rs - as_) > 0.011:
                continue
            sim = name_sim(r["farm"], a["farm"])
            aa = clean(a.get("rank", "")).lower()
            val = sim + (0.5 if ra and aa and ra == aa else 0) + (0.3 if rs and as_ else 0)
            ok = sim >= 0.85 or (sim >= 0.5 and ra and ra == aa) or (rs and as_ and sim >= 0.5)
            if ok and val > best_val:
                best, best_val = j, val
        rec = dict(r)
        rec["result_source"] = "results_table"
        if best is not None:
            used.add(best)
            a = auctions[best]
            rec["bid"] = a.get("bid")
            rec["buyer"] = a.get("buyer")
            rec["auction_total"] = a.get("total")
            if not parse_num(rec.get("score", "")) and a.get("score"):
                rec["score"] = a.get("score")
            rec["matched_auction"] = True
        else:
            rec["matched_auction"] = False
        out.append(rec)
    # Tiers published only as an auction table (e.g. 2020 online-only competitions, Honduras 2018 NW)
    for j, a in enumerate(auctions):
        if j not in used and a["tier"] not in result_tiers:
            out.append({**a, "matched_auction": True, "result_source": "auction_table"})
    return out


def main():
    rows, log = [], []
    paths = sorted(glob.glob(os.path.join(HERE, "raw/pages/*.html")))
    if not paths:
        raise SystemExit("no pages in raw/pages/; run fetch_pages.py first")
    for path in paths:
        slug, results, auctions = parse_page(path)
        merged = merge(results, auctions, slug)
        rows.extend(merged)
        log.append(dict(
            slug=slug, n_result_rows=len(results), n_auction_rows=len(auctions), n_lots=len(merged),
            n_matched=sum(m.get("matched_auction", False) for m in merged),
            n_coe=sum(m["tier"] == "CoE" for m in merged), n_nw=sum(m["tier"] == "NW" for m in merged),
        ))
    df = pd.DataFrame(rows)
    if "process_variety" in df:
        pv = df["process_variety"].fillna("")
        df["process"] = df["process"].fillna(pv.str.split(",").str[0].str.strip().where(pv != ""))
        df["variety"] = df["variety"].fillna(pv.str.split(",", n=1).str[1].str.strip().where(pv != ""))
    df["score_num"] = df["score"].map(lambda s: parse_num(s) if isinstance(s, str) else None)
    # ACE uses 0.00 / -1.00 as "score not published" placeholders (Nicaragua 2002, Brazil 2002, Honduras 2009)
    df.loc[~(df["score_num"] > 50), "score_num"] = None
    stats_row = df["rank"].fillna("").str.match(r"^(stats|total)", case=False) | df["farm"].str.fullmatch(r"[\d.,$ ]+")
    df = df[~stats_row]
    df["price_usd_lb"] = df["bid"].map(lambda s: parse_num(s) if isinstance(s, str) else None)
    df["source_url"] = "https://allianceforcoffeeexcellence.org/" + df["slug"] + "/"
    cols = ["country", "year", "competition", "tier", "category", "rank", "score", "score_num", "farm", "farmer",
            "region", "variety", "process", "weight", "bid", "price_usd_lb", "buyer", "auction_total",
            "matched_auction", "result_source", "slug", "source_url"]
    for c in cols:
        if c not in df:
            df[c] = None
    df[cols].to_csv(os.path.join(HERE, "coe_lots.csv"), index=False)
    pd.DataFrame(log).to_csv(os.path.join(HERE, "parse_log.csv"), index=False)
    print(df[cols].groupby(["country", "tier"]).size())
    print(pd.DataFrame(log).to_string())


if __name__ == "__main__":
    main()
