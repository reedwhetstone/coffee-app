# CoffeeBench public export v2 reader contract

**Status:** Static downstream reader contract

**Owner of values:** Cherry

**Consumer:** coffee-app `/benchmarks/coffeebench-v0`

Coffee-app consumes Cherry's sanitized fixture byte-for-byte at its immutable result-version and
content-addressed path:

`static/benchmarks/coffeebench-v0/results/1.0.0-dev.coffeebench-fixture-generation.fixture.757c6cb62911f854/757c6cb62911f85433e88a7352308355866ed848645d84b31f962a14b47df524.json`

The current fixture is 30,850 bytes with file SHA-256
`7f64b83927ddd8fba9fb04060373898eec608c7f4d8a9d13fedb2bfe0be554cf`. The compatibility alias at
`static/benchmarks/coffeebench-public-export-v2.json` is byte-identical, short-cached, and explicitly
noindex. The report links only to the immutable path.

Cherry owns every rank, Bradley-Terry score, interval, token value, cost, latency percentile,
rate, calibration value, and Pareto classification. Coffee-app validates the export and formats
those values for display. It must not sort subjects into a new rank, calculate an interval,
reprice tokens, fill a missing cost, aggregate a slice, or reclassify a Pareto frontier.

## Exact object shape

All objects are strict: an extra field at any depth is invalid. `schema_version` is exactly `2`;
an unsupported version fails the build/loader rather than falling back.

- `result_version`: immutable semantic result version.
- `benchmark`: `name`, semantic `version`, and `suite_id`.
- `status`: `fixture` or `provisional`.
- `identities`: content-addressed `result_id`, `generation_id`, `result_content_sha256`,
  `public_contract_sha256`, `methodology_sha256`, and `subject_cards_sha256`.
- `methodology`: positive counts for cases, trials, jury families, absolute evaluations, and
  pairwise ballots; quality, uncertainty, unacceptable-response, critical-error,
  confidence-calibration, Pareto, and null-semantics rules; plus the `[0,1]` tie value.
- `tracks`: one or two unique published comparison tracks (`model` or `system`), each with a
  label and description. Every slice must contain exactly these tracks.
- `subjects`: stable ID and display name, published `track`, effective `evaluator_track`, harness
  family (`controlled_raw`, `pi`, or `purveyors`), declared capabilities, pinned model identity,
  optional quantization, and `card_sha256`.
- `slices`: exactly `overall`, `historical_control`, and `live_web`. Each slice contains a label
  and the complete subject results for every published track.
- `jury`: exactly one `openai`, `google`, and `anthropic` row with call counts, p50/p95 latency,
  and nullable provider-billed and normalized cost totals.
- `calibration`: the 40-pair sample, decision source (`reed` or `deterministic_fixture`), total and
  per-family agreement counts/rates, resolved and unresolved agent-majority counts, and all three
  jury families exactly once. Majority agreement is nullable only when no majority decision exists.
- `limitations`: one or more public limitation statements.

Each slice subject result contains:

- `subject_id`, nullable `rank`, nullable `quality_score`, nullable 95% lower/upper interval, and
  non-negative `trial_count`;
- input, cached-input, reasoning, output, and total token objects, each with nullable `total` and
  `per_attempted_task`, plus provenance (`exact`, `provider_derived`, `estimated`, or `mixed`);
- provider-billed and normalized USD objects with nullable decimal-string `total` and
  `per_attempted_task`;
- end-to-end and tool latency objects with nullable integer `p50` and `p95` milliseconds;
- `[0,1]` terminal-failure, unacceptable-response, critical-error, and
  confidence-calibration-pass rates;
- Pareto classification (`frontier`, `dominated`, or `unavailable`) and same-track
  `dominated_by` subject IDs.

## Inherited knowledge

- Artifact authority | Jury workload, matched-panel arithmetic, and cohort reconciliation are
  reader-enforced before rendering | Proven on the current head by the CoffeeBench reader tests.
- Publication identity | Corrected fixture values update the content-addressed result version, both
  byte-identical public copies, and their replayed digests | Proven by the identity and byte-equality
  tests.
- Status-derived presentation | The benchmark index loads its status and counts from the shared
  validated artifact, and report-route edge indexing is not unconditionally fixture-only | Proven by
  the index loader and discovery tests.

## Null and identity semantics

- Rank, score, and both interval bounds are jointly populated or jointly null.
- Dense ranks must agree with the declared quality scores; this is a consistency check, not a
  replacement aggregation path.
- Each token class's total/per-attempted-task pair is jointly populated or jointly null.
- Canonical total tokens equal input plus output, cached input is a subset of input, reasoning is a
  subset of output, and every available total/per-task pair reconciles with attempted trials.
- Each cost total/per-attempted-task pair is jointly populated or jointly null. Decimal strings
  preserve source precision. A missing cost is `null`, never numeric or string zero.
- Each latency p50/p95 pair is jointly populated or jointly null, and p50 cannot exceed p95.
- Each operational rate represents a whole count over the slice's attempted trials; the reader
  rejects fractional event counts.
- Pareto availability, classification, and the complete ordered `dominated_by` set must agree with
  the already-published same-track quality, normalized-cost, and p50 end-to-end latency values.
- Digests are exactly 64 lowercase hexadecimal characters and cover sanitized public structures
  only. The reader replays the public contract, methodology, subject collection, every subject
  card, and result-content digest with Cherry's sorted UTF-8 canonical JSON plus trailing newline.
  Float spelling follows Cherry's Python canonical JSON, including exponent padding and notation
  thresholds. Result-content material excludes only `result_version`, `identities.result_id`, and
  `identities.result_content_sha256`. Private graph, source, calibration-record, and
  provider-payload digests are forbidden even when hidden in an otherwise allowed string field;
  the content digest suffix in the identity-bound `result_id` is the sole embedded exception.
- Case IDs, prompts, evidence, source locators/targets, evaluator guardrails/atoms, raw judge
  output, private provider payloads, value-level HTTP(S) URLs, and undeclared 64-hex digests are
  rejected recursively before schema parsing.

Fixture status requires deterministic-fixture calibration, zero provider jury calls, no claimed
provider-billed execution cost, and content-bound result version/ID fields. Provisional status
requires Reed calibration and live provider-call provenance. The v0 route additionally pins the
CoffeeBench name, benchmark version, suite, jury, result version, and content identity.

## Publication and presentation

The current fixture page is a contract preview, not measured performance. It emits `noindex`, has
no Dataset JSON-LD, is excluded from the sitemap, and is labeled as non-citable fixture data in
`llms.txt`. JSON fixture paths also receive `X-Robots-Tag: noindex`. The benchmark index keeps an
immutable `2026-08-17` sitemap `lastmod`; it does not regenerate a false modification date on each
request.

Coffee-app renders the required quality forest and quality-versus-token, normalized-cost, and p50
latency views directly from Cherry's values. Mobile cards and desktop tables both expose token
provenance, token totals/per-task values, and cost totals/per-task values.

The initial fixture publishes one matched `system` comparison track for all four treatments.
The controlled raw subject retains `evaluator_track: model`; the three tool-using harnesses use
`evaluator_track: system`. This distinction is deliberate and must not be flattened or converted
into a cross-track leaderboard.
