# ADR-008: Market Index direction — actionable insight, value signals, and the metadata index

**Status:** Accepted (product direction; implementation phased)

**Date:** 2026-07-05

## Context

The July 2026 UI/brand rework (see `notes/marketing-audits/2026-07-05-ui-brand-gtm-rework-proposal.md`) restructured the Market Index page into named chapters and calmed its presentation, but the deeper critique from the owner stands: the page presents data at roughly equal weight. It shows _that_ the market moved; it is weaker at saying _what that movement means_ and _what to do about it_.

The owner's articulation of why people follow the green coffee supply-chain market, which this ADR codifies:

1. **Action over observation.** The Market Index exists to provide actionable insight: what it means when the market moves, and separating signal from noise. Different stakeholders act on different things — which is also why the platform leans toward GenUI interfaces and LLM agents that let users mutate the UI toward their own use case (ADR-006/007 territory: shared CLI/agent tools power those workflows).
2. **Value detection is the anchor use case for roasters.** The single most compelling moment is "an amazing coffee at a price discount" — a buy opportunity on a coffee you're looking for or would want, surfaced the moment it appears. Price-below-origin-benchmark, price drops on tracked or high-scoring lots, and unusually good price-for-quality are the signals that matter.
3. **Arbitrage is a segment.** Cross-supplier spreads on comparable lots, retail/wholesale gaps, and origin-level dislocations are actionable for commercial buyers and analysts.
4. **Purveyors is a metadata broker, not just a price broker.** Market indexes are conventionally price indexes, but the platform's moat (PRODUCT_VISION: supply-chain data moat) is equally the normalized metadata layer — process transparency, cultivar, grade, drying method, scores, Purveyor Score completeness. A **metadata view** of the market — trends in what is being offered, disclosed, and how listings are structured over time — is a differentiated product story no price index tells: e.g. anaerobic share rising within an origin, disclosure levels improving, cultivar mix shifting, score distributions moving.

## Decision

The Market Index evolves from a dashboard of market data toward a **decision surface** organized around three insight families:

| Family              | Question it answers                        | Example modules                                                                                                                                    |
| ------------------- | ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Value signals**   | "What should I consider buying right now?" | Buy-opportunity feed (price below origin benchmark, drops on high-Purveyor-Score or tracked lots), value-lot screening, price-for-quality outliers |
| **Market movement** | "What changed, and is it signal or noise?" | The daily market read (exists), movement significance framing (vs. normal variance), arrivals/delistings context                                   |
| **Metadata trends** | "How is the market itself changing?"       | Process-mix trends over time, disclosure-level trends, cultivar/score distribution shifts, origin metadata composition — the "metadata index"      |

Principles that govern implementation:

1. **Every module must answer a stakeholder question, not display a dataset.** A module that cannot be titled as a question a roaster, analyst, or buyer would ask gets cut or demoted.
2. **Signal over noise is a product feature.** Movement should be framed against baseline variance ("down 4.9% — largest weekly move this quarter") rather than reported raw.
3. **Personalization arrives through GenUI/agents, not more dashboards.** The static page carries the shared, defensible reads; stakeholder-specific mutation (a roaster's watchlist-driven value feed vs. an analyst's origin dislocation view) is the job of the chat/GenUI layer consuming the same tools as the CLI (ADR-006, ADR-007).
4. **Access levels follow ADR-005/ADR-010.** Value-signal feeds, arbitrage views, and deep metadata trends are member/Intelligence leverage; the public surface keeps proof-level reads. Anonymous surfaces do not grow new signal feeds.
5. **The metadata index is a first-class roadmap item.** Positioning language may say "the market index for coffee's metadata, not just its prices" once a first metadata-trend module ships. Per the no-vaporware copy rule, do not market it before it exists.

## Consequences

- Analytics roadmap work gets a stable prioritization frame: value signals first (anchor persona: roaster with a buy opportunity), movement significance second, metadata trends third — each shipped as a member/Intelligence module with a public teaser consistent with ADR-005.
- Data prerequisites become explicit workstreams: origin benchmark baselines and variance bands (exists partially via price snapshots), lot-level price history for drop detection, and normalized metadata coverage (ADR-004 process fields; drying-method/cultivar taxonomies flagged in ADR-005) for the metadata index.
- The GenUI/agent layer is confirmed as the personalization strategy; the static Market Index page should stay focused rather than sprouting per-persona tabs.
- UI work follows the July 2026 brand system: insight modules present as "artifact" cards (AccentSpine), titled as stakeholder questions, grouped under the existing chapter headers.

## References

- `notes/PRODUCT_VISION.md` — data moat, intelligence-replaces-navigation, public-proof principles
- ADR-010 — public Market Index proof surface
- ADR-004 — processing transparency schema
- ADR-005 — catalog access levels (visibility vs. leverage)
- ADR-006 / ADR-007 — CLI-owned agent tools, API-first extraction (the GenUI substrate)
- `notes/marketing-audits/2026-07-05-ui-brand-gtm-rework-proposal.md` — July 2026 rework
