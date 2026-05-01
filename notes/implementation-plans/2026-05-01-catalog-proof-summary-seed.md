# Catalog Proof Summary Seed

**Date:** 2026-05-01  
**Planning mode:** Planning only, no code changes in this PR  
**Selected program:** Seed the Purveyors Proof Layer with deterministic catalog proof summaries, public trust badges, and an API/CLI path that stays evidence-safe.  
**Recommended shape:** Multi-stage implementation program with independently mergeable atomic PRs.  
**Repo ownership:** coffee-app first, then purveyors-cli, then coffee-app reporting and conversion polish.

## Feature or program

Build the first concrete slice of the Purveyors Proof Layer: a deterministic proof summary for each catalog coffee that explains whether Purveyors has usable evidence for processing, provenance, freshness, and pricing claims.

The program deliberately avoids legal or compliance overclaiming. This is not certification, supplier verification, or EUDR due diligence. It is a product-safe trust layer that turns existing catalog fields into an explicit evidence and disclosure summary.

Ordered slices:

1. `coffee-app`: add a reusable proof summary helper, an optional `/v1/catalog` proof include, docs, tests, and compact public CoffeeCard trust badges.
2. `purveyors-cli`: add `--include-proof` to catalog read/search output and exported catalog helpers after the web/API contract exists.
3. `coffee-app`: add a proof coverage pilot report that measures proof family coverage across a bounded sample and identifies the highest-value data gaps for scraper follow-up.

## Why now

- `notes/PRODUCT_VISION.md` says Purveyors is a coffee intelligence platform, not just a marketplace or roast logger. Trustworthy coffee data, API-first surfaces, CLI/agent consistency, public value legibility, and access-ladder clarity are all named strategy tests.
- ADR-004 created structured processing fields and provenance-safe process summaries. ADR-005 established that catalog data visibility and search leverage are different products.
- PR #302 has shipped process transparency visibility and access-tier corrections. The next strategic move is not another public filter. It is making the trust signal behind those fields explicit.
- The newest moonshot, `brain/moonshots/2026-04-30-purveyors-proof-layer.md`, identifies disclosure passports as the highest-upside trust primitive. A full passport product is too large, but a deterministic proof summary is a cheap, shippable proving slice.
- Open PR #312 already implements the first Parchment Intelligence price-index API slice, with passing checks. Planning another price-index endpoint now would duplicate work in flight.
- `notes/MARKET_ANALYSIS.md` is not present on current `origin/main`; the legacy market analysis at `notes/archive/legacy-product/MARKET_ANALYSIS.md` still reinforces the same market gap: fragmented supplier data, inconsistent disclosure, and developer/API demand for normalized coffee intelligence.

## Strategy Alignment Audit

- **Canonical direction:** This directly supports `notes/PRODUCT_VISION.md` by strengthening truthful coffee data, the data moat, public value legibility, API-first behavior, and agent/CLI trust.
- **Product principle supported:** Truthful coffee data beats marketing copy. The data moat matters more than feature sprawl. Public surfaces should prove value before the paywall. Search leverage belongs behind membership or API tiers.
- **Cross-surface effect:** High. The proof summary starts in the canonical catalog resource, appears on CoffeeCards, becomes an optional API include, then feeds CLI and agent output.
- **Public value legibility:** High. Public trust badges make Purveyors' data work visible without giving anonymous users premium filtering, exports, saved searches, or proof-quality search leverage.
- **Moonshot check:** Informed by `2026-04-30-purveyors-proof-layer.md`. The selected proving slice is the smallest safe version of proof passports: claim-family proof summaries derived from existing fields, without raw evidence quotes, supplier verification claims, or compliance language.
- **Scope check:** This excludes supplier claim flows, direct-feed publishing, legal/compliance claims, raw `processing_evidence` exposure, paid proof filters, saved searches, alerts, migrations, and scraper backgeneration. Those remain later slices after the first proof summary contract proves useful.

## Candidate scoring

Scores use the Product Leverage Index from the planner skill: vision alignment 0-5, data moat / decision quality 0-5, cross-surface leverage 0-4, public value / access ladder 0-3, foundation unlock 0-3.

| Candidate | Vision | Data moat | Cross-surface | Public/access | Foundation | Total | Feasibility gate | Decision |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- |
| Catalog Proof Summary Seed | 5 | 5 | 4 | 3 | 3 | 20 | Medium. No migration required if computed from existing fields; careful wording needed. | Selected |
| Parchment Intelligence CLI follow-up | 5 | 4 | 4 | 2 | 2 | 17 | Depends on PR #312 merging or at least stabilizing. Existing plan already covers it. | Defer until endpoint lands |
| Process transparency backgeneration | 5 | 5 | 2 | 1 | 3 | 16 | Belongs mostly in coffee-scraper and already has a plan. Higher data-write risk. | Defer to scraper builder |
| CLI API-key catalog parity | 5 | 3 | 4 | 2 | 2 | 16 | Strong, but already planned on 2026-04-29 and less tied to the new moonshot. | Defer |
| V1 Catalog Summary Projection | 4 | 3 | 4 | 2 | 2 | 15 | Strong API hygiene, already planned on 2026-04-28. | Defer |
| Runtime dependency preflight | 4 | 4 | 2 | 0 | 3 | 13 | Protects data freshness but is operational hygiene, not today's best product bet. | Defer |

## Scope in / out

### In scope

- Define deterministic proof families for current catalog data:
  - process proof: structured base method, disclosure level, confidence, evidence availability
  - provenance proof: country, region, producer/farm/cooperative hints where current fields support them
  - freshness proof: stocked date, arrival date, last seen or stocked state where available
  - pricing proof: price per pound, price tiers, wholesale classification
- Add a reusable helper such as `src/lib/catalog/proofSummary.ts` with unit tests.
- Add an optional `/v1/catalog` include, likely `include=proof`, that returns a nested `proof` object without raw supplier quotes.
- Preserve the default `/v1/catalog` response shape unless the implementation proves an additive default is safer.
- Add compact CoffeeCard trust badges for public proof: for example, `Process disclosed`, `Freshness dated`, `Price tiers`, `Provenance partial`.
- Update docs to state that proof summaries are evidence summaries, not certification.
- Add tests for response shape, evidence withholding, null semantics, and backwards compatibility.

### Out of scope

- Database migrations or new columns.
- Raw `processing_evidence` exposure.
- Claim-quality filters, saved searches, alerts, exports, or member-only proof search.
- Supplier claim, direct-feed, or verified-supplier flows.
- Any legal/compliance language implying certification or due diligence.
- Coffee-scraper backfills or write-mode evidence generation.
- Repricing membership or API tiers.

## Proposed UX or behavior

### API behavior

Callers can request proof summaries explicitly:

```bash
curl 'https://www.purveyors.io/v1/catalog?include=proof&limit=3' \
  -H 'Authorization: Bearer <api key>'
```

Suggested row shape:

```json
{
  "id": 123,
  "name": "Ethiopia Guji Natural",
  "process": {
    "base_method": "Natural",
    "disclosure_level": "structured",
    "confidence": 0.85,
    "evidence_available": true
  },
  "proof": {
    "version": "proof-summary-v1",
    "overall": {
      "label": "partial",
      "score": 0.64
    },
    "families": {
      "process": {
        "label": "disclosed",
        "confidence": 0.85,
        "signals": ["structured_process", "evidence_available"]
      },
      "provenance": {
        "label": "partial",
        "confidence": 0.5,
        "signals": ["country", "region"]
      },
      "freshness": {
        "label": "dated",
        "confidence": 0.7,
        "signals": ["stocked_date"]
      },
      "pricing": {
        "label": "tiered",
        "confidence": 0.9,
        "signals": ["price_per_lb", "price_tiers"]
      }
    },
    "limitations": ["not_certification", "raw_evidence_not_included"]
  }
}
```

The exact scoring rubric should stay simple and documented. Prefer transparent labels over a fake-precise magic score. `score` can be included only if tests and copy make clear that it is a disclosure completeness score, not a coffee quality score.

### Web behavior

CoffeeCards show compact trust badges when the proof helper finds reliable signals. Public users can see the existence of trust signals, which supports product proof. They cannot use proof as a paid search lever in the first slice.

Example badge copy:

- `Process disclosed`
- `Freshness dated`
- `Tiered pricing`
- `Limited provenance`

### CLI behavior

After the API contract exists, CLI catalog commands can opt into proof summaries:

```bash
purvey catalog search --origin Ethiopia --include-proof --json
purvey catalog get <id> --include-proof --json
```

The CLI should not invent proof logic. It should consume the canonical web/API summary.

## Files or systems likely to change

### PR 1, coffee-app

- `src/lib/catalog/proofSummary.ts`
- `src/lib/catalog/proofSummary.test.ts`
- `src/lib/catalog/catalogResourceItem.ts`
- `src/lib/server/catalogResource.ts`
- `src/lib/server/catalogResource.test.ts`
- `src/routes/v1/catalog/catalog.test.ts`
- `src/routes/api/catalog-api/catalog-api.test.ts` if alias behavior needs explicit coverage
- `src/lib/components/CoffeeCard.svelte`
- `src/lib/components/CoffeeCard.svelte.test.ts`
- `src/lib/docs/content.ts`

### PR 2, purveyors-cli

- `src/commands/catalog.ts`
- `src/lib/catalog.ts`
- `src/lib/manifest.ts`
- `src/lib/index.ts` or catalog subpath exports
- CLI catalog tests
- CLI docs

### PR 3, coffee-app

- `src/routes/admin` or a docs/report-only location if an admin page already exists
- `src/lib/server/catalogResource.ts` only if the report reuses the same query helper
- `notes/proof-layer/` or `notes/pr-audits/` for generated pilot output if a static report is chosen
- Docs or internal dashboard copy explaining proof coverage gaps

## API or data impact

- Uses only existing `coffee_catalog` fields and existing catalog resource mappings.
- Adds an optional proof summary projection or include.
- Does not expose raw supplier text or `processing_evidence` quotes.
- Does not require new tables.
- Keeps null semantics explicit: missing data is not the same as negative proof.
- Establishes a vocabulary that scraper backgeneration and future supplier feed work can improve later.

## Program rationale

The real opportunity is broader than one UI badge. The Proof Layer becomes strategically useful only if the same proof primitive flows through app, API, CLI, and agent surfaces. Splitting the work keeps the first slice small enough to merge while preserving the cross-surface destination.

## PR sequence, dependencies, and stop points

1. **PR 1: Catalog proof summary contract in coffee-app.**  
   Dependency: existing catalog resource, process summary fields, docs/test structure.  
   Stop point: mergeable even if CLI never ships because API and public CoffeeCards become more trustworthy.

2. **PR 2: CLI proof output.**  
   Dependency: PR 1 merged and deployed, or a stable contract fixture.  
   Stop point: mergeable as a CLI feature because it consumes a stable catalog proof include.

3. **PR 3: Proof coverage pilot report.**  
   Dependency: PR 1 helper exists.  
   Stop point: mergeable as an internal product/data-quality report that directs scraper work without changing catalog behavior.

Recommended first PR: PR 1. It creates the shared contract and trust vocabulary.

## Acceptance criteria

### Program-level

- Catalog rows can expose proof summaries derived from existing, source-backed fields.
- Public UI can show trust signals without turning proof into an anonymous search lever.
- API and CLI consumers can opt into proof output through a consistent contract.
- The docs explicitly say proof summaries are informational disclosure signals, not certification, legal compliance, or supplier verification.
- Raw supplier evidence is not exposed by default.

### PR 1

- A deterministic proof helper returns stable labels and signal lists for process, provenance, freshness, and pricing.
- `GET /v1/catalog?include=proof` returns a nested proof object in the canonical envelope.
- `include=proof` does not alter pagination, filters, rate-limit behavior, or default response shape.
- Missing, unknown, and not-disclosed values remain distinct where the current data allows that distinction.
- Raw `processing_evidence` is withheld.
- CoffeeCards render compact proof badges when reliable signals exist and avoid badges when claims are too thin.
- Public docs explain the feature and its limitations.

### PR 2

- `purvey catalog search --include-proof --json` and `purvey catalog get <id> --include-proof --json` surface the canonical proof summary.
- Existing catalog output remains unchanged when `--include-proof` is omitted.
- CLI docs and manifest metadata expose the option clearly for agents.

### PR 3

- The pilot report measures proof-family coverage across a bounded sample or current catalog snapshot.
- It lists top gaps by field family and recommends specific scraper/data follow-ups.
- It does not write to production data.

## Test plan

### PR 1

```bash
pnpm check --fail-on-warnings
pnpm exec vitest run \
  src/lib/catalog/proofSummary.test.ts \
  src/lib/server/catalogResource.test.ts \
  src/routes/v1/catalog/catalog.test.ts \
  src/lib/components/CoffeeCard.svelte.test.ts
```

Live smoke after deploy:

```bash
API_KEY=$(grep '^PURVEYORS_API_KEY=' ~/.env | cut -d= -f2-)

curl -sS 'https://www.purveyors.io/v1/catalog?include=proof&limit=5' \
  -H "Authorization: Bearer $API_KEY" | jq -e '.data[0] | has("proof")'

curl -sS 'https://www.purveyors.io/v1/catalog?limit=5' \
  -H "Authorization: Bearer $API_KEY" | jq -e '(.data | length > 0) and all(.data[]; has("proof") | not)'
```

### PR 2

```bash
cd /root/.openclaw/workspace/repos/purveyors-cli
pnpm check
pnpm test
PARCHMENT_API_KEY="$PURVEYORS_API_KEY" pnpm exec tsx src/index.ts catalog search --origin Ethiopia --include-proof --limit 5 --json
```

### PR 3

```bash
cd /root/.openclaw/workspace/repos/coffee-app
pnpm check --fail-on-warnings
pnpm exec vitest run <new proof report tests>
```

## Risks and rollback

- **Risk: Proof score feels like an opaque quality rating.** Mitigation: prefer family labels and explicit signal lists; if a numeric score ships, name it disclosure completeness and document the formula.
- **Risk: Public badges overstate certainty.** Mitigation: use cautious labels, include limitations, and avoid words like verified unless a supplier or evidence workflow truly verifies the claim.
- **Risk: API contract churn.** Mitigation: make proof opt-in through `include=proof` in PR 1 and preserve default responses.
- **Risk: Legal or compliance overclaiming.** Mitigation: state that proof summaries are informational and not certification, regulatory assurance, or due diligence.
- **Rollback:** Disable the CoffeeCard badges and stop documenting `include=proof`; because the first API slice is additive and opt-in, rollback should not break default callers.

## Open questions for Reed

1. Should the first public badge vocabulary use plain buyer language like `Process disclosed`, or more technical language like `Process proof: structured`?
2. Should `include=proof` be available anonymously as public proof-of-value, or require API-key/session auth while CoffeeCards show only compact public badges?
3. Is a numeric disclosure score useful, or should v1 stay label-only to avoid fake precision?
4. Should PR 3 be an internal admin/report page, or a static generated markdown report reviewed before any UI investment?
