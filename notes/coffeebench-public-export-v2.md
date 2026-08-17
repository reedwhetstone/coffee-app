# CoffeeBench public export v2 reader contract

**Status:** Static downstream reader contract

**Owner of values:** Cherry

**Consumer:** coffee-app `/benchmarks/coffeebench-v0`

Coffee-app consumes Cherry's sanitized fixture byte-for-byte at
`static/benchmarks/coffeebench-public-export-v2.json`. The current fixture is 30,568 bytes with
SHA-256 `58d167a58e20c5fed17e6c299c6c872f19fcba39ccbf6c3893c5bc45b833416f`.
It is also the exact public download; there is no second serialization path.

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
- `identities`: `result_id`, `generation_id`, `public_contract_sha256`,
  `methodology_sha256`, and `subject_cards_sha256`.
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
  per-family agreement counts/rates, and all three jury families exactly once.
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

## Null and identity semantics

- Rank, score, and both interval bounds are jointly populated or jointly null.
- Each token class's total/per-attempted-task pair is jointly populated or jointly null.
- Each cost total/per-attempted-task pair is jointly populated or jointly null. Decimal strings
  preserve source precision. A missing cost is `null`, never numeric or string zero.
- Each latency p50/p95 pair is jointly populated or jointly null, and p50 cannot exceed p95.
- `frontier` and `unavailable` have no `dominated_by` IDs; `dominated` has at least one valid,
  non-self subject from the same published comparison track.
- Digests are exactly 64 lowercase hexadecimal characters and cover sanitized public structures
  only. Private graph, source, calibration-record, and provider-payload digests are forbidden.
- Case IDs, prompts, evidence, source locators/targets, evaluator guardrails/atoms, raw judge
  output, and private provider payloads are rejected recursively before schema parsing.

The initial fixture publishes one matched `system` comparison track for all four treatments.
The controlled raw subject retains `evaluator_track: model`; the three tool-using harnesses use
`evaluator_track: system`. This distinction is deliberate and must not be flattened or converted
into a cross-track leaderboard.
