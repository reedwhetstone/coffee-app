# CoffeeBench public export v3 preview contract

Coffee-app publishes Cherry's first measured CoffeeBench v0 result as an immutable, sanitized
schema-v3 preview. It intentionally preserves the run's limitations instead of converting missing
quality evidence into a leaderboard.

## Bound artifact

- Result version: `1.0.0-dev.coffeebench-v0-deepseek-v4-initial-official.preview.fe3927ea498ccdcf`
- Result content SHA-256: `fe3927ea498ccdcf3998f08943dddf51a60ccf7e993b5744b8bf868db87565ba`
- Public file SHA-256: `518f231d1f0adfb7cef9fc262a251fd264f8f427d56f166e8bafd839f42b78f1`
- Immutable path: `/benchmarks/coffeebench-v0/results/1.0.0-dev.coffeebench-v0-deepseek-v4-initial-official.preview.fe3927ea498ccdcf/fe3927ea498ccdcf3998f08943dddf51a60ccf7e993b5744b8bf868db87565ba.json`
- Short-lived alias: `/benchmarks/coffeebench-public-export-v3.json`

Both public files are byte-identical to the merged Cherry export. The strict reader replays the
public-contract, methodology, subject-card, individual card, and result-content digests before the
page can render. Schema v2 remains accepted for the historical fixture regression tests, but the
CoffeeBench v0 route is pinned to this exact schema-v3 identity.

## Preview semantics

The export contains 400 subject trials, 400 absolute evaluations, and 600 pairwise ballot artifacts
from one Luna/OpenAI judge family. Human calibration was not run. The preview must disclose both its
single-judge, uncalibrated status and the bounded generation salvage recorded by Cherry.

Bradley–Terry scores are unavailable by design. Every pairwise comparison contained at least one
response the absolute judge marked unacceptable. Cherry resolved those comparisons deterministically
without a pairwise model call, and its quality fitter excludes deterministic or unacceptable-terminal
ballots. The resulting preference set is empty, so rank, quality score, interval, and Pareto quality
views remain null rather than implying comparative quality.

The report may describe measured terminal-failure, unacceptable-response, critical-error,
confidence-calibration, latency, token, and available normalized-cost values. It must not turn the
raw treatment's lower observed failure and critical-error rates into a claim of quality superiority.

## Discovery

Unlike the old fixture page, the measured preview is indexed, included in the sitemap, described in
`llms.txt`, and carries Dataset JSON-LD. The HTML and machine-readable copy keep the limitations
prominent. JSON artifact paths remain `noindex` so search engines point to the explanatory report.
