# PR 4: In-App Shadow Procurement Recommendations

**Program:** Saved Sourcing Briefs and Procurement Recommendation Seed  
**Repo:** `coffee-app`  
**PR goal:** Generate and store explainable in-app recommendation runs for saved sourcing briefs without external notification delivery.

## Why this slice comes now

The moonshot question is whether Purveyors can move from matching rows to prioritizing decisions. That should be tested only after saved criteria, member UI, and CLI/API access are stable. The first recommendation slice should be in-app and inspectable, not emailed or automated externally.

## In scope

- Add a recommendation-run model or stored latest result for sourcing briefs.
- Rank matches using conservative, explainable factors already present in catalog or price-index data.
- Include reasons and limitations for every recommendation.
- Add a manual "generate recommendations" action in the web app.
- Add API support if needed by the web UI and future CLI.
- Add docs/copy that frames output as decision support, not automated buying advice.

Possible ranking factors:

- price under target or relative to origin median when available
- stocked now
- recent arrival or stocked date
- proof summary availability
- canonical/similarity confidence only if the matching contracts have shipped enough semantics
- supplier freshness/update recency only if the data is already available and safe to expose

## Out of scope

- Email, webhook, SMS, Discord, or cron delivery.
- Autonomous purchase/RFQ actions.
- Black-box AI recommendations without deterministic provenance.
- Legal/compliance claims or supplier quality rankings.
- New billing products.

## Specific files to change

Likely files:

- migration for recommendation run storage, if storing snapshots
- `src/lib/procurement/recommendations.ts`
- `src/lib/procurement/recommendations.test.ts`
- `src/lib/server/procurement/recommendationRuns.ts`
- route or form action files under `/procurement`
- tests for recommendation run generation and UI rendering

## Acceptance criteria

- A member can manually generate an in-app recommendation run for a saved sourcing brief.
- Every recommended coffee includes explicit reasons and limitations.
- The system does not send external messages or schedule recurring delivery.
- Results are repeatable enough for tests, with deterministic ranking or clearly bounded tie-breaking.
- Copy avoids certification, compliance, supplier ranking, and autonomous-purchase language.
- If price-index context is unavailable, recommendations degrade gracefully to catalog-only match explanations.

## Test plan

```bash
pnpm test -- src/lib/procurement/recommendations.test.ts src/routes/procurement/recommendations.test.ts
pnpm check --fail-on-warnings
pnpm lint
```

Add a live smoke only after PR 1 and PR 2 endpoints are deployed.

## Risks

- **Trust overclaim:** Keep recommendations explainable and conservative.
- **Data gaps:** If median price or freshness context is missing, show limitations rather than invented confidence.
- **Premature automation:** Do not add notifications or cron delivery in this PR.

## Exact follow-on dependency

External alerts, weekly procurement brief delivery, and design-partner reporting can be planned only after in-app recommendation runs prove useful and Reed approves external delivery scope.
