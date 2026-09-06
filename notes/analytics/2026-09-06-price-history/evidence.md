# Origin price evidence audit — 2026-09-06 UTC

All production reads used `BEGIN TRANSACTION READ ONLY`; verified `current_user=openclaw_readonly` and `transaction_read_only=on`. No production data or schema was modified. Evidence below is live, not inherited June incident assumptions.

## Conclusions

1. The chart's exact endpoint numbers are medians despite its “Average” subtitle: Sep5 Colombia median11.62 vs mean14.15; Indonesia median10.98 vs mean16.29. A semantic display bug exists separately from collection issues.
2. July22–August31 is a real 41-day absence of price-index aggregates. July21 and September1 are adjacent available dates; any continuous curve between them invents a trend. Raw evidence exists during the gap but is often grossly incomplete.
3. July11–15 spike is collection/cohort collapse. Raw snapshot rows/source counts: July10 1254/38; July11 576/14; July15 484/12; July16 1323/39. Indonesia median10.39/n67 July10 becomes16.00/n16 July11, then10.48/n74 July16. Guatemala goes10.49/n70 to16.00/n20 July15; Colombia11.49/n124 to13.36/n50. These are non-synthetic rows; malformed tier1 count is zero in the July–September period.
4. Earlier spike belongs to synthetic history. Entire Sep20 2025–Mar14 2026 series is819 synthetic weekly rows, not daily observations. Actual daily series startsMar22. Guatemala synthetic median12.99 Feb28,13.02 Mar7,8.76 Mar14; sample44→101. Brazil9.50→8.38 (28→72); Colombia11.69→9.65 (102→188). Repository `coffee-app/scripts/backfill-supply-index.ts` reconstructs past cohorts using stocked/unstocked dates and then uses catalog cost_lb fetched at reconstruction time. These are not historically observed prices. Exclude synthetic prices by default or display in a explicitly distinct reconstructed-history mode.
5. Current publication has resumed: September1–5 have daily aggregates; Sep5 has346 rows, no malformed tier1. Health is substantially recovered but not perfect.

## Current run, measured and inferred separately

Latest production run ID66e0b4cd-2d32-49a8-8c38-24e0e0b30237, startedSep5 02:34UTC, ended04:10UTC, revisionf470b67728bada3a5b295158d1ae9b6d6a32fc7e, statusdegraded, selected46/46 sources.

Measured supplier seals:43 complete; Showroom partial33/36; Atlas and Aida failed0. Latest sealed ledger has2028 rows across43 sources, including739 metadata-only rows (Ally127,CafeImports415,Covoya197) and1289 positive-stocked price rows. Legacy coffee_price_snapshots has1322 rows from41 priced sources; difference is33 Showroom rows absent from the fully sealed ledger. These layers have different completeness semantics, so this is not alone proof of invalid prices.

Deployed revision gate is>=95% source execution success and>=80% applied authoritative price coverage. Code allows partial supplier observations.44 successful outcomes/46=95.65% is consistent with43 complete+Showroom partial and2 failures, but source `success` is not persisted separately in the seal table. Exact runtime authoritative applied/expected price denominator also is not persisted in these tables. Do not claim that1289/2028 is coverage (it includes no-price suppliers), or that legacy1322/1325 is definitely the actual runtime authority ratio. Fresh aggregates prove publication occurred; exact gate receipt requires deployment logs.

## Recovery evidence and boundaries

The gap-only recommendations below describe the initial observed-publication assessment, not the subsequently accepted reconstructed-chart default. See [current implementation and method](README.md). Raw publication remains unchanged; explicitly labeled interpolation is now a separate presentation.

- July22–Aug31 legacy raw snapshots present on39/41 days. July29/30 lack priced snapshots entirely; ledger has only no-price observations those days.
- Raw counts:July22 504,July26 1335,July31 99,Aug1–3 96,Aug16 656,Aug29 1060,Aug31 1066. Ledger exists sinceJuly18; no sealed price evidence for July11–15.
- July26 ledger1841 priced rows comes from multiple observations/runs; cannot simply count rows as unique daily catalog coverage. Select canonical production run and source/version before any replay.
- Live compute_price_index(date) reads legacy snapshots and joins CURRENT coffee_catalog country/processing/grade/source. It does not consume frozen observation provenance. Calling it retroactively can reassign historical origin memberships. It has no internal coverage policy, only minimum2 samples per aggregate.
- Therefore no blanket recompute, no smoothing, no lowered floor to populate history. Build dry-run per-day manifest from canonical frozen observations where available; classify complete/recoverable vs incomplete/unrecoverable, verify historical price-unit and origin evidence, and publish only eligible dates after review. Keep true missing days missing. July11–15 should be marked low-coverage/unreliable pending stronger evidence, not cosmetically replaced with neighboring prices.
- A future historical cohort or matched-product index can reduce composition shifts but is a different metric; do not silently substitute for observed market medians.

## Outlier caution

Indonesia average maxima include$481 synthetic and$433.64 historical actual,$215.45 currently. These do NOT explain the displayed median spike and are not proven unit bugs: Sea Island carries very expensive specialty coffee. Source-level evidence is necessary before deleting or capping outliers.

## Read-only query shapes

```sql
SELECT snapshot_date,origin,price_avg,price_median,price_max,sample_size,supplier_count,synthetic
FROM price_index_snapshots
WHERE snapshot_date BETWEEN :from AND :to
 AND aggregation_tier=1 AND process IS NULL AND grade IS NULL
 AND wholesale_only=false AND origin IN ('Colombia','Guatemala','Indonesia','Brazil')
ORDER BY snapshot_date,origin;

SELECT snapshot_date,count(*) rows,
 count(*) FILTER (WHERE aggregation_tier=1 AND (process IS NOT NULL OR grade IS NOT NULL)) malformed
FROM price_index_snapshots WHERE snapshot_date>='2026-07-01'
GROUP BY snapshot_date ORDER BY snapshot_date;

SELECT s.snapshot_date,count(*) rows,count(DISTINCT c.source) sources
FROM coffee_price_snapshots s JOIN coffee_catalog c ON c.id=s.catalog_id
WHERE s.snapshot_date IN ('2026-07-10','2026-07-11','2026-07-15','2026-07-16','2026-09-05')
GROUP BY s.snapshot_date ORDER BY s.snapshot_date;

SELECT observed_at::date,count(*),count(*) FILTER(WHERE stocked AND price>0),count(DISTINCT source)
FROM coffee_price_observations WHERE observed_at BETWEEN '2026-07-21' AND '2026-09-02'
GROUP BY observed_at::date ORDER BY observed_at::date;

SELECT source,status,expected_item_count,observed_item_count,snapshot_item_count,is_complete
FROM supplier_observation_sets WHERE scrape_run_id=:run_id ORDER BY source;

SELECT regexp_replace(pg_get_functiondef(p.oid),'[[:space:]]+',' ','g')
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND p.proname='compute_price_index';
```

The saved origin-trends-fixture.json is sanitized aggregate-only data containing both retail and wholesale tier1, shape-valid rows fromSep5 2025 onward, with synthetic provenance. It contains no account information or credentials.

## Continuous reconstruction option (subsequent user steering)

The user prefers a continuous normalized reconstruction over a gap-only presentation and is open to discussing a policy change. This is achievable as a separately labelled estimate, preserving immutable observed series:

- Raw snapshots confirmed minimum2026-03-22 and166 unique snapshot dates throughSep5. Five-origin retail source-median fixture has165 dates for each origin, missingMay1/Jul29/Jul30. Remaining partial days contain some price evidence even while publication was suppressed.
- `source-origin-daily-fixture.json` exports date/source/origin/n/median from stocked positive retail cost_lb joined to current country. Suitable for an exploratory matched-source chain-link prototype. Some days have only1 supplier forColombia/Guatemala and2 for other selected origins, so source support must be visible and uncertainty wider.
- A daily chain-linked matched-source median return can remove much of abrupt supplier composition bias, but within-source coffee/lot churn still affects it. Matched catalog_id price relatives would control lot mix more strongly and can be investigated from same raw snapshots. A fixed basket over the entire period biases toward long-lived surviving products and may shrink severely; prefer chained overlap with minimum support and sensitivity comparison.
- Interpolating the3 entirely absent selected-origin days can produce continuous explicitly estimated history. For low-support partial days, cap influence through a disclosed robust estimator/model, not silent deletion of suspicious observations. Preserve estimated vs observed flags and allow inspection of support.
- BeforeMar22, genuine historical per-product price observations are unavailable in examined tables. Earlier series would be inferred reconstruction, not recovered history, and should be visually/metadatically distinguishable.
- This is a different index, not a silently corrected market median. Name it a normalized price trend estimate; define anchoring, weighting, uncertainty, versioning, and an observed-series toggle. User review should select the methodology before production retrospective writes.
