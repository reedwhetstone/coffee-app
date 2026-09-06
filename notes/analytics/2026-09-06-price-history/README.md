# Reconstructed origin price history

Status: implemented for review in [PR #582](https://github.com/reedwhetstone/coffee-app/pull/582). No production writes or deployment performed.

## Product outcome

The main chart is now a continuous **reconstructed price trend** over supported observed history. The **Recorded prices** view retains exact original dates, medians (average fallback explicitly named), supplier/listing counts, and optional legacy synthetic history. In the expanded view, switching between reconstructed and recorded prices retains date inspection. Retail and wholesale remain separate series.

This supersedes the earlier gap-only default and the experimental end-anchored matched-supplier formula. It is a reconstruction of published medians, **not a supplier-mix-normalized market index**. Counts can detect coverage collapse; they cannot identify which suppliers disappeared or recover market movement during an outage.

## Versioned method: supported-median-v1

Owner/lifetime: coffee-app owns this deterministic, derived **chart presentation**, computed from the existing entitled Parchment history response. No database table, observation, publication threshold, upstream API contract, or sibling pricing calculation changes. Method version and bracketing evidence accompany each derived point in memory; the recorded response remains the input of record. A future persisted/shared index belongs upstream and requires a separate contract.

For each origin and purchase cohort:

1. Accept only valid UTC dates, positive finite medians, and explicit `synthetic=false`. Never silently treat unknown provenance or an average as a median anchor. Conflicting duplicate daily records cannot anchor the series.
2. Require at least two listings, one supplier, and five usable observations within ±28 calendar days. Compute median listing and supplier counts over that local window. Each count must reach 60% of its local baseline. These are reconstruction-support heuristics, **not guarantees of representativeness**.
3. Preserve every accepted median exactly, even a sharp price change. There is no price-based clipping or rescaling.
4. Linearly interpolate elapsed UTC days between accepted anchors. Classify estimates as reduced-support or missing-date estimates, preserving original values/counts when present and both bounding dates plus interval length. No spline overshoot, invented sample counts, extrapolation, or carry-forward.
5. Compute on the full history available to the current entitlement before cropping the selected chart range. Changing range on that input cannot change the underlying reconstruction. Different entitlement history windows can change edge support.

A long straight interval is an estimate, not recovered movement. The methodology disclosure and dated inspection state this directly. Supported history currently starts March 22, 2026 for the five replayed retail origins. Earlier synthetic history remains accessible in Recorded prices, but is not used to manufacture earlier market movement. Thin histories can have no reconstructed series; Recorded prices remains the recovery view.

## Evidence and empirical validation

[Original read-only investigation](evidence.md) distinguishes observed database facts from hypotheses. The original matched-supplier image is retained as a rejected experiment, not current methodology.

Reproduce the current offline validation:

```sh
pnpm exec tsx notes/analytics/2026-09-06-price-history/validate-reconstruction.ts
```

Inputs: [published aggregate fixture](fixtures/published-medians.json), five retail origins, March 22–September 5, exported from the authorized production analytics browser on September 6 UTC. No account data, tokens, or supplier-private records. The deployed BFF omits the synthetic flag, so this fixture is deliberately restricted to the actual-daily era established in the earlier read-only audit and annotated `synthetic=false` on that basis. This is **not** a fresh row-by-row provenance audit. Production reconstruction uses upstream flags preserved by this PR, not a hard-coded date cutoff. The fixture is an offline test artifact, never bundled into the production chart.

[Machine-readable results](validation-results.jsonl) include 50/60/70% support sensitivity, July 10/11/15/16 values, deterministic individual-date holdouts (every seventh accepted observation), and a contiguous 41-observation holdout block with dates and worst errors. This is retrospective reconstruction testing against published medians, not forecasting or validation of true August prices, source-cohort withholding, or a confidence interval.

- The July 11–15 coverage-collapse points are excluded at all three support ratios for all five origins. Supported endpoints retain their exact values. Indonesia's $16 points become $10.405–$10.465 between July 10 ($10.39) and July 16 ($10.48).
- Individual-date holdout median relative error is 0–0.42% across five origins (17 dates each).
- Contiguous-block holdout median relative error is 0–1.31% (41 observations each). See results for worst errors; these medians do not bound individual-point errors.
- Full supplier identity correction, raw-observation recovery for unpublished August days, and reconstructed history before March 22 are **not implemented or claimed**.

Behavior tests cover dropout replacement, preservation of a count-supported price step, UTC gap interpolation, no extrapolation, missing provenance, sparse history, invalid records, cohort isolation, ambiguous duplicates, and view-switch date inspection.

## Visual review and progressive disclosure

The main dashboard stays compact: a 320px chart area, origin legend, and a short estimate label. Hover or tap opens a floating date/value card; estimates have a compact `est.` marker. There is no permanent bottom detail panel. Mouse leave dismisses hover inspection; touch pins the card until close, outside tap, or Escape. Keyboard inspection remains available through a focus-revealed date control.

The existing expanded panel adds the recorded/reconstructed switch, origin selection, methodology, visible date slider, and full sample/reconstruction evidence within the floating card. The dashboard is a summary, not the expanded inspector squeezed into the page.

Local fixture harnesses use the actual EvidenceChartsSection/ExpandablePanel and live chart component with the aggregate fixture above; not authenticated deployment proof:

- [Compact mobile dashboard](mobile-dashboard-compact.png)
- [Mobile floating inspection](mobile-floating-inspection.png)
- [Expanded mobile evidence](mobile-expanded-floating.png)
- [Desktop hover inspection](desktop-floating-inspection.png)

390px mobile and desktop replay: no horizontal overflow or browser errors. Dashboard tooltip fits all five values without scrolling. Verified tap pinning, close/outside dismissal, desktop hover/leave, expanded evidence, and keyboard/Escape behavior. Temporary fixture route removed before submission. Older screenshots show superseded iterations.

## Merge boundary

This PR is non-draft and intended for preview review as a complete, bounded interpolation-based chart improvement. It does not depend on accepting the rejected matched-supplier formula. Merge remains a separate user decision after CI/Codex review; no production historical data repair is performed by this change.

## Local validation receipt

- `pnpm test`: 201 files passed, 2 skipped; 1,447 tests passed, 14 skipped.
- `PUBLIC_SUPABASE_URL=https://example.supabase.co PUBLIC_SUPABASE_ANON_KEY=static-placeholder OPENROUTER_API_KEY=static-placeholder pnpm check --fail-on-warnings`: zero errors/warnings. Non-secret placeholders validate types only, not authenticated runtime.
- `pnpm lint`: blocked by 17 pre-existing unrelated Prettier files. Changed-file ESLint and Prettier checks pass.
- `git diff --check`: passes.
- Worst relative errors in the replay: 5.16% for individual-date holdouts, 3.47% for the held-out block. No statistical confidence bounds are asserted.
- Independent read-only implementation review found no substantive blocker. Current-head CI/Codex review remains the remote handoff gate.
