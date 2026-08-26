# CoffeeBench V1 public export

Coffee-app publishes Cherry's CoffeeBench V1 findings as a validated, immutable schema-v5
artifact. The schema adds the complete aggregate pairwise matchup matrix for the overall,
historical-control, and live-web slices, including counts and jury-family splits.

- Status: `published`
- Benchmark version: `1.0.0`
- Result version: `1.0.0.coffeebench-v0-deepseek-v4-reliable-official.published.50ca8fbd22a8523e`
- Result content SHA-256: `50ca8fbd22a8523eacb13bc21c5eb890a2fd60f3e55db8a386a00bc8b94bb087`
- Public file SHA-256: `13caa9283d1fa071450caa4c41a20b2cd7a52d924d84dc79b43dc2fa7ea6dfe5`
- Immutable path: `/benchmarks/coffeebench-v1/results/1.0.0.coffeebench-v0-deepseek-v4-reliable-official.published.50ca8fbd22a8523e/50ca8fbd22a8523eacb13bc21c5eb890a2fd60f3e55db8a386a00bc8b94bb087.json`
- Convenience alias: `/benchmarks/coffeebench-public-export-v5.json`

The canonical report is `/benchmarks/coffeebench-v1`. The former
`/benchmarks/coffeebench-v0` route redirects to V1. Historical schema-v2 through schema-v4
artifacts remain available at their immutable paths and aliases.

The report dispositions the original product hypotheses directly:

- the harnessed treatments beat Raw, but the comparison does not isolate retrieval because Raw
  also removes orchestration, extra turns, tools, and added context;
- Purveyors Search did not separate clearly from Pi Search; and
- Parchment + Search did not improve pairwise quality over Purveyors Search in V1.

The immutable export supplies the complete aggregate evidence for those conclusions. A future
benchmark may explain why a hypothesis missed, but that explanation must not replace the observed
V1 disposition.

The public artifact contains aggregate evaluation results and declared identities only. It does
not contain sealed case content, evaluator prompts, source URLs, provider payloads, or private
archives. Null measurements remain null and never imply zero.
