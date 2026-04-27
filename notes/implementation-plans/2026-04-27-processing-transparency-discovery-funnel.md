# Processing Transparency Discovery Funnel

**Date:** 2026-04-27
**Selected backlog target:** Priority 0, Public Catalog Access + Conversion Funnel
**Recommended shape:** Two-PR implementation program with an independently mergeable first PR
**Recommended first PR:** PR 01, public catalog process-transparency facets and card badges

## Feature or program

Turn the newly shipped processing transparency API contract into a visible discovery and conversion surface:

1. **PR 01, coffee-app:** expose structured process transparency on the public catalog through filters, URL state, and CoffeeCard metadata.
2. **PR 02, purveyors-cli:** add structured process filters/output parity to `purvey catalog search` so the same queryable contract is available to agent and terminal consumers.

The core target is not generic catalog polish. It is making co-ferment, anaerobic, disclosure quality, and confidence metadata legible where buyers and agents actually make decisions.

## Why now

- PR #289 shipped the backend/schema/API layer for processing transparency, including structured fields and `/v1/catalog` response/filter support.
- ADR-004 explicitly frames this metadata as a buyer-trust and disclosure-quality contract, not a private implementation detail.
- The public catalog currently still mostly presents the legacy `processing` label, so the strategic value is hidden from users even though the machine contract exists.
- Recent blog and outline strategy is converging on schema-as-market, disclosure quality, agent-readable contracts, and public product proof. This is the smallest shippable product slice that makes those ideas concrete.

## Live platform evidence, 2026-04-27

Live checks against `https://www.purveyors.io` confirm the backend/API contract is already ahead of the public and CLI discovery surfaces:

- `GET /v1/catalog` with the live API key returned `HTTP 200`, `x-ratelimit-limit: 10000`, and 100 default rows in the canonical `{ data, pagination, meta }` envelope. Each full row includes both legacy top-level process fields and a nested `process` object.
- `GET /v1/catalog?processing_confidence_min=0.8&limit=3` returned rows whose nested process data included values such as `base_method: "Washed"`, `fermentation_duration_hours: 24`, `disclosure_level: "high_detail"`, `confidence: 0.8`, and `evidence_available: true`.
- `GET /v1/catalog?fermentation_type=Anaerobic&processing_disclosure_level=high_detail&limit=5` returned `HTTP 200` with zero rows, which is still useful evidence: the canonical query params are accepted and preserve a typed empty result instead of failing or silently dropping the filters.
- `GET /api/catalog-api?limit=3` still delegates successfully and returns `Deprecation: true`, `Link: </v1/catalog>; rel="successor-version"`, and `Sunset: Thu, 31 Dec 2026 23:59:59 GMT`, matching ADR-002's compatibility strategy.
- Anonymous `GET /v1/catalog?limit=1` returned `HTTP 200` with public catalog data, so any public UI changes must preserve the teaser/public-access contract rather than assuming API-key-only access.
- `purvey catalog search --help` only exposes legacy `--process` and `--drying-method` process-adjacent options. `purvey catalog search --fermentation-type Anaerobic --limit 3 --pretty` fails with `INVALID_ARGUMENT` and `Unknown option '--fermentation-type'`.
- The cron environment currently lacks `~/.config/purvey/credentials.json`, so authenticated CLI data calls fail with `AUTH_ERROR`. That does not invalidate the CLI parity finding; it makes the help/argument contract the reliable evidence source for this planning run.

Representative verification commands for implementation:

```bash
API_KEY=$(grep '^PURVEYORS_API_KEY=' ~/.env | cut -d= -f2-)
curl -i 'https://www.purveyors.io/v1/catalog?processing_confidence_min=0.8&limit=3' \
  -H "Authorization: Bearer $API_KEY"
curl -i 'https://www.purveyors.io/api/catalog-api?limit=3' \
  -H "Authorization: Bearer $API_KEY"
purvey catalog search --help
purvey catalog search --fermentation-type Anaerobic --limit 3 --pretty
```

## Root cause analysis

The backend contract and product narrative have moved faster than the consumer surfaces. PR #289 and ADR-004 established structured process transparency as a canonical data contract, but the public catalog UI and CLI still largely expose the older single-string `processing` mental model. That creates a strategic mismatch: the data layer can now distinguish base method, fermentation type, additives, disclosure level, confidence, and evidence availability, but buyers and agents cannot discover or query most of that value through the surfaces where they make decisions.

## Strategy Alignment Audit

- **Canonical direction:** Aligns tightly with `notes/PRODUCT_VISION.md`: strengthens the coffee data moat, makes public value legible before the paywall, and improves consistency across web / API / CLI / agent surfaces.
- **Product principle supported:** Truthful coffee data beats marketing copy. The work distinguishes disclosed structured process claims from vague processing labels and avoids implying precision where metadata is missing.
- **Cross-surface effect:** `/v1/catalog` already exposes the contract. PR 01 makes it visible in the web catalog; PR 02 extends the same contract to the CLI and agent workflow surface.
- **Public value legibility:** Strong. A public visitor can understand why Purveyors is more than a scraped listing grid: it reveals process detail, disclosure level, and confidence in a comparable format.
- **Scope check:** Excludes scraper extraction improvements, raw evidence exposure, paid entitlement changes, supplier verification badges, and AI ranking changes. Those are later stages.

## Candidate scoring summary

Selected candidate: **Processing Transparency Discovery Funnel**

- Backlog anchor: P0 Public Catalog Access + Conversion Funnel
- Priority score: 10
- Complexity score: 6, medium
- Risk penalty: 0, low risk because schema/API already landed additively
- Dependency penalty: 0, no blocker after PR #289
- Strategic leverage bonus: 4
- Total: 20

Rejected near-term alternatives:

- **API key limits per tier:** good easy win, score 17, but lower backlog priority and less public proof of the data moat.
- **Mobile navigation redesign:** score 15, useful UX, but does not compound the API/data strategy.
- **Bean delete dependency handling:** important P1 bug, but riskier data-dependency work and less connected to current public/API strategy.
- **Catalog loading/Core Web Vitals:** useful but broad, likely needs measurement-first prep before a clean PR.

## Scope in / out

### In scope

- Add structured process filter keys to catalog URL/state handling where missing:
  - `processing_base_method`
  - `fermentation_type`
  - `process_additive`
  - `processing_disclosure_level`
  - `processing_confidence_min`
- Add public catalog filter controls for the highest-signal fields.
- Preserve shareable URLs for new filters.
- Render process transparency badges or compact metadata on `CoffeeCard` when present.
- Keep null/unknown metadata visually distinct from explicit claims.
- Add tests for URL serialization/parsing, server query plumbing, and catalog page behavior.
- Add CLI structured process filter support in a follow-up PR if the first PR lands cleanly.

### Out of scope

- Database migrations or scraper schema changes.
- Raw `processing_evidence` exposure.
- Supplier verification badges or direct-feed publishing.
- New paid entitlements or checkout changes.
- AI semantic ranking changes.
- Full redesign of catalog cards or navigation.

## Proposed UX or behavior

Public catalog visitors should be able to filter and compare coffees by structured process attributes without understanding the underlying schema.

Recommended PR 01 UI:

- Add an advanced process section near the existing Process dropdown.
- Start with compact controls rather than a large redesign:
  - Base method
  - Fermentation type
  - Additives present/type
  - Disclosure level
  - Minimum confidence, likely simple presets such as `0.6+`, `0.8+`, `0.9+`
- On CoffeeCard, keep the standard processing detail as the anchor and add a natural-language analysis subcomponent when `coffee.process` exists:
  - summarize base method + fermentation type in buyer-readable language
  - mention additive detail when present without making it the whole framing
  - discuss disclosure quality and confidence as analysis, not as a fake precision score
  - prefer plain-language confidence cues over exposed decimals in the web UI
- If structured fields are absent, continue showing the legacy `processing` label with no alarming placeholder.
- Keep CLI and API surfaces opinion-free: expose the clean raw structured process fields and canonical filters so users and agents can decide how to interpret them.

## Files or systems likely to change

### coffee-app PR 01

- `src/lib/catalog/urlState.ts`
- `src/lib/stores/filterStore.ts`
- `src/routes/catalog/+page.svelte`
- `src/routes/catalog/+page.server.ts`, only if metadata or parsing needs explicit pass-through
- `src/lib/components/CoffeeCard.svelte`
- `src/routes/catalog/page.server.test.ts`
- `src/lib/catalog/urlState.test.ts`, if present, or add focused coverage beside existing URL-state tests
- `src/lib/stores/filterStore.test.ts`

### purveyors-cli PR 02

Likely repo: `/root/.openclaw/workspace/repos/purveyors-cli`

- Catalog search command argument definitions
- API/client request param construction for catalog search
- Machine-readable output docs or manifest metadata
- Tests for structured process params and stable output behavior

## API or data impact

- No new database schema is planned.
- No breaking API changes are planned.
- PR 01 consumes existing `/v1/catalog` process fields and filters.
- PR 02 should use the same public query names rather than invent CLI-only aliases, with human-friendly option names mapped transparently where needed.
- Raw evidence remains unexposed by default, consistent with ADR-004.

## Mergeable-slice gate

- **PR 01 can pass verify and be mergeable even if PR 02 never ships.** It uses already-shipped API fields and improves the public catalog independently.
- **PR 02 can pass verify and be mergeable after PR 01 or independently.** It exposes the same backend contract through the CLI without depending on web UI changes.

## Acceptance criteria

### Program-level

- Public and machine consumers can query structured process transparency through visible, documented pathways.
- The UI never pretends missing process metadata is explicit `none`.
- Existing catalog URLs, legacy `processing` filters, pagination, and public access behavior remain compatible.
- The plan creates no DEVLOG changes and no code during planning mode.

### PR 01

- Catalog URL state parses and serializes the new process filter params.
- Public catalog controls can set and clear the new filters.
- Filtered catalog requests send the canonical `/v1/catalog` query param names.
- Coffee cards render structured process details when available and remain clean when absent.
- Anonymous 15-card preview and signup CTA still work.
- Existing process dropdown behavior remains intact.

### PR 02

- `purvey catalog search` can pass structured process filters to the API.
- Machine-readable outputs include process metadata when returned by the API.
- Help text and generated/manifest docs describe the new options accurately.
- Tests cover CLI param mapping and output stability.

## Test plan

### PR 01

- `pnpm check`
- Focused unit tests for catalog URL-state parsing/serialization.
- Existing catalog page server tests, plus a new case for structured process query params.
- Component-level or store tests for filter controls if the existing test stack supports it.
- Manual browser smoke, if feasible: load `/catalog?fermentation_type=Anaerobic&processing_disclosure_level=high_detail`, confirm filters populate, cards render, and clearing filters updates the URL.

### PR 02

- `pnpm test` or repo-equivalent CLI test suite.
- Focused tests for new command options and request-param mapping.
- Help/manifest snapshot tests if that contract exists.
- One dry-run or mocked API call showing canonical params are produced.

## Risks and rollback

- **Risk:** Filter UI becomes too dense. Mitigation: put structured process filters in an advanced/collapsible section and keep the default catalog scan simple.
- **Risk:** Confidence scores look more authoritative than they are. Mitigation: use plain-language labels and avoid over-prominent numeric ranking.
- **Risk:** Backend fields exist but sparse data makes the UI feel empty. Mitigation: render only present metadata and frame disclosure quality as the value.
- **Risk:** CLI option names drift from API names. Mitigation: map to canonical params and test the generated request.
- **Rollback:** PR 01 can be reverted without touching schema/API. PR 02 can be reverted independently if CLI ergonomics are wrong.

## Open questions for Reed

1. **Resolved:** lead the web UI with the standard processing detail, then add a natural-language analysis subcomponent that discusses structured process fields, disclosure quality, and confidence.
2. **Resolved:** avoid prominent numeric confidence in the web UI. Use plain-language confidence analysis. Keep raw confidence/filter values available through API and CLI.
3. **Resolved for now:** keep CLI and API output clean and raw rather than opinionated. CLI parity remains valuable, but it should expose data and filters, not analysis copy.
4. **Resolved for now:** focus on presenting the data cleanly across all access points. A macro transparency ranking or score can become a later feature once the underlying data surface is consistently visible.

## Deferred feature idea

- Add a data transparency ranking column or score based on the number, specificity, and source quality of data points provided for a coffee. This should be treated as a separate feature from the first presentation pass so the initial work does not blur raw disclosure data with opinionated ranking.

## Recommended next move

Start with **PR 01: Public catalog process-transparency facets**. It is the cleanest independently mergeable slice and converts the already-shipped backend contract into visible product value. If that lands cleanly, follow with the CLI parity PR so agents can use the same process contract directly.
