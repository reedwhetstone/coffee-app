# Producer track record research (October 2026)

Research behind the blog post [Why Can't Coffee Remember Its Best Farms?](../../../src/content/blog/why-cant-coffee-remember-its-best-farms.svx). It is retained as the evidence base for a later producer identity and track-record feature.

## Thesis

Reputation is the stored history of quality. Wine built persistent identity first, and its prices then accumulated against that identity. Green coffee listings carry plenty of narrative, but they rarely carry a durable producer identity, so the narrative disappears when a lot sells out and no track record forms.

## Contents

- `research-report.md`: synthesized research report covering wine, Buffett and soft information, the coffee evidence, the counter-case, identity infrastructure and product implications. It is written to Reed and cites its sources.
- `topic-notes/`: the five source research notes the report draws on. Each claim lists a source URL and states its confidence.
- `catalog-redteam/`: an analysis of the Purveyors catalog that tests Reed's notes on the draft. `findings.md` holds the numbers; `a1.py` through `a4.py` hold the analyses. `pull.py` exports a read-only catalog snapshot, using the production read-only access procedure in openclaw-ops. The snapshot is not committed because it contains supplier copy.
- `coe-persistence/`: an original Cup of Excellence persistence study covering 4,927 lots in 7 countries from 1999 to 2026. `results.md` holds the methods, numbers and caveats. `results_tables/` holds aggregate outputs. `fetch_pages.py`, `parse_coe.py` and `analyze.py` reproduce the study from the result pages listed in `sources.csv`.

The lot-level Cup of Excellence dataset (`coe_lots.csv`, `coe_entities.csv`) is not in this public repository; rights to republish it are unresolved. A private copy is kept in the second-brain repository under `brain/references/coe-results-dataset/`.

## Headline findings

- Of 2,674 stocked listings from 45 suppliers, 61% carry a substantial farm narrative but only 17.8% carry any structured producer identity. After name normalization, 17 of about 406 farms link across suppliers. No farm spans more than about 300 days of catalog history yet.
- Among retail listings that publish a score, the score explains about 0.5% of price variance and country of origin explains 43%. Within the same supplier and country, structured producer identity carries a 14.5% price premium, while narrative length adds nothing measurable. These results are correlational.
- In Cup of Excellence results, quality persists weakly. Adjusted scores correlate about 0.2 between a farm's appearances. About a quarter of first-time placers place again within five years, and about a third place again at some point. The auction price premium for a track record is thin (about 6% for a prior top-10 finish, against a farm with no prior placement). The same buyer wins the same farm again at 2.4 times chance.

## Feature directions to evaluate

1. Persistent producer, site and lot entities, with listings attached to them. Delisted offers would go inactive instead of disappearing.
2. Cross-supplier and cross-harvest entity resolution, with an alias table that records provenance and match confidence.
3. Claims about producers stored with source, observed date and corroboration count, extending the ADR-004 disclosure model.
4. Ingestion of Cup of Excellence results as a track-record backbone, with a producer endpoint and a track-record summary on listings. Rights and access tier need to be settled first (ADR-005).
5. A published persistence index and buyer-relationship tenure as paid analytics.
