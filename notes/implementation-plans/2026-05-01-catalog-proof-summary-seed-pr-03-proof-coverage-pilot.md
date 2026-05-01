# PR 3: Proof coverage pilot report

**Date:** 2026-05-01  
**Repo:** coffee-app  
**Branch suggestion:** `feat/proof-coverage-pilot`  
**Purpose:** Measure proof-family coverage and identify the highest-value data gaps for future scraper and product work.

## PR goal

Use the proof summary helper from PR 1 to generate a bounded proof coverage report across current catalog data. The report should show whether proof summaries reveal real decision-grade differences that ordinary catalog browsing hides.

## Why this slice comes now

The Proof Layer moonshot's cheapest experiment is a 100-coffee pilot across varied suppliers. After the helper exists, Purveyors can run that experiment without writing production data or building supplier workflows.

## In scope

- Build a read-only report path or static generated markdown output using the PR 1 helper.
- Sample a bounded catalog set, ideally across several supplier styles.
- Report coverage by proof family: process, provenance, freshness, pricing.
- List common missing signals and risky overconfidence patterns.
- Recommend concrete scraper follow-ups, for example producer extraction, arrival-date freshness, drying-method normalization, or process evidence backgeneration.
- Include tests for helper aggregation logic if code is added.

## Out of scope

- Production data writes.
- Supplier-facing pages.
- Verification badges.
- Compliance claims.
- Paid proof filters.
- New scraper extraction logic.

## Files to change

- A new report component, admin route, or static report generator depending on the chosen implementation path.
- `notes/proof-layer/` or `notes/pr-audits/` for generated pilot output if static markdown is selected.
- Tests for any new aggregation helper.

## Acceptance criteria

- The report measures proof-family coverage on a bounded, reproducible sample.
- The report identifies top data gaps by field family and explains which gaps matter commercially.
- The report clearly distinguishes missing data from negative proof.
- No production catalog rows are modified.
- The output gives a specific follow-up queue for coffee-scraper and catalog/API work.

## Test plan

```bash
cd /root/.openclaw/workspace/repos/coffee-app
pnpm check --fail-on-warnings
pnpm exec vitest run <new proof report tests>
```

If the implementation is static markdown only, run:

```bash
git diff --check
```

## Risks

- A report-only slice could become shelfware if it is not tied to scraper follow-ups. Mitigate by requiring specific next actions and stop points.
- Sampling can mislead if the supplier mix is too narrow. Mitigate by selecting suppliers with different metadata styles.

## Exact follow-on dependency

Future proof filters, watchlists, supplier claim pilots, and scraper backgeneration should use this report to choose the highest-value next slice instead of guessing.
