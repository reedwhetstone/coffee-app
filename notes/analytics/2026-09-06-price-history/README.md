# Origin price spike correction

## Accepted scope, September 6

Preserve the live chart and history. Correct only the two highlighted incidents. The broad supported-median/legacy-bridge reconstruction and chart redesign are removed.

- Retail Colombia, Ethiopia, Indonesia, Guatemala, and Brazil only, the cohorts covered by the supplied screenshots and audit.
- Synthetic February 21–March 14 points interpolate between February 14 and March 22.
- Recorded July 11–15 points interpolate between July 10 and July 16.
- Only existing affected points change; missing dates are not filled. Every other point, including earlier weekly history and current endpoints, remains identical.
- Require exactly one valid point at both boundaries. Missing/ambiguous boundaries, absent provenance, other origins, wholesale, and the combined all view remain untouched.
- Apply before range cropping, so all ranges share the same correction.
- Corrections are presentation estimates, marked `est.` in the existing hover card. Original API data is not mutated. No historical prices have been recovered.
- Restore the live monotone curves, 2.5px lines, endpoint dots/values, axis padding, range control, card and legend. Correct the existing average subtitle to median to match the displayed statistic.

## Evidence and review

The [earlier audit](evidence.md) identifies collection collapse in July and retrospectively priced synthetic cohorts in February–March. These justify excluding the affected excursions from the display, not treating the interpolated values as observed prices. Earlier synthetic history remains synthetic and should not be interpreted as recovered historical quotes.

Fixture regression: 45 points corrected, all inside the two incidents. All other row objects retained unchanged. Four tests cover boundary availability/ambiguity, provenance and cohort scope, ordering, and immutability.

[Corrected year](corrected-year.png) · [Corrected 90 days](corrected-90d.png). Local browser fixture replay using the actual chart component, not authenticated deployment proof.

## Validation

- `pnpm test`: VALIDATION_PASS, 1,427 passed, 3 skipped after syncing current main.
- `pnpm lint`: blocked by 17 pre-existing unrelated formatting failures.
- `pnpm check --fail-on-warnings`: VALIDATION_PASS with non-secret static placeholders, zero errors/warnings. Changed-file ESLint/Prettier and `git diff --check` pass.
- Production data, API contracts, publication thresholds, and missing-date behavior are unchanged. No merge or deployment authorized.
