# CoffeeBench public export v4 preview contract

Coffee-app publishes Cherry's complete CoffeeBench v0 agent-jury preview as an immutable,
sanitized schema-v4 export. The current route is pinned to this identity:

- Result version: `1.0.0-dev.coffeebench-v0-deepseek-v4-reliable-official.preview.c9302744f0cfd061`
- Result content SHA-256: `c9302744f0cfd061975870978fe3036851c05f606800cd605ffa953e8e117ac4`
- Public file SHA-256: `c297b2cb9091aaf6661171a9c455bf56b917395e8cd4f45ba0de0a28eafa4ac3`
- Immutable path: `/benchmarks/coffeebench-v0/results/1.0.0-dev.coffeebench-v0-deepseek-v4-reliable-official.preview.c9302744f0cfd061/c9302744f0cfd061975870978fe3036851c05f606800cd605ffa953e8e117ac4.json`
- Short-lived alias: `/benchmarks/coffeebench-public-export-v4.json`

Both public files are byte-identical to the Cherry export. The strict reader replays the public
contract, methodology, subject-card, individual card, and result-content digests before the page
can render. It also validates the evidence graph before accepting the artifact:

- the three judge-family call counts reconcile with the absolute and pairwise workloads, and
  provider-call and latency provenance are consistent;
- every reporting slice has matched same-track trials, design-derived pairwise coverage, ranks that
  agree with pairwise scores, and Pareto labels recomputed from published quality, cost, and latency;
- operational counts and rates, rubric rates, token totals and subsets, and cost totals reconcile
  with their trial counts;
- overall rows reconcile with the historical-control and live-web cohort rows for operational,
  rubric, pairwise, token, and cost evidence.

The preview reports three independent evidence tracks: pairwise quality, absolute-rubric outcomes,
and operational reliability. It contains 1,200 absolute evaluations and 1,800 of 1,800 pairwise
ballots across OpenAI, Google, and Anthropic judge families. Human agreement was not measured, so
the agent-jury ranks are not human ground truth or proof of broad superiority. No composite score
is published.

Schema v2 remains accepted for the historical fixture regression tests, and schema v3 remains
available at its immutable path as the historical single-family preview. Neither predecessor is
the current route identity.
