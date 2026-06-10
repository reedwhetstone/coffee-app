# AI Integration Plan: Chat Overlay, Agent Tool Expansion, Chat UX Overhaul

**Date:** 2026-06-10
**Status:** Proposed
**Scope decisions from Reed (2026-06-10):**

- Chat overlay with page-context injection: approved, plan it.
- Agent tool expansion (CLI/tool gap): approved, Reed already started; this doc red-teams his P0/P1/P2 tool list and locks an MVP set.
- Proactive dashboard briefs: **on hold** (inference cost creep concern). Parked with cheap future variants noted at the end.
- Chat UX overhaul (composer, genUI, mobile): approved, fleshed out here.

---

## 0. Ground truth (verified in code, 2026-06-10)

These facts anchor the red-teaming below:

- `coffee_catalog` already has `purveyor_score`, `purveyor_score_confidence`, `purveyor_score_factors` (JSON breakdown), `purveyor_score_tier`, `purveyor_score_updated_at`, `purveyor_score_version` (`src/lib/types/database.types.ts:339`).
- The CLI's `CatalogItem` does **not** expose any purveyor_score field (`@purveyors/cli/dist/lib/catalog.d.ts`) — the gap is real.
- `/v1/price-index` exists and reads `price_index_snapshots`: dated snapshots with `price_min/max/avg/median/p25/p75/stdev`, `supplier_count`, `sample_size`, per origin/process/grade/wholesale tier (`src/lib/server/priceIndexResource.ts`).
- **No lot-level price history exists.** `coffee_catalog` has only current `price_per_lb` + `last_updated`. Any "price changes" capability must come from aggregate snapshots, not per-lot deltas.
- `/v1/procurement/briefs` (+ `[id]`, `[id]/matches`) exists with deterministic `matchReasons` (`src/lib/server/procurement/sourcingBriefs.ts`).
- `/v1/catalog/proof-coverage` exists.
- Chat loop today: OpenRouter preset `@preset/test-workhorse-agent`, temperature 0.4, 4096 max output tokens, `stopWhen: stepCountIs(4)`, max ~7 tool calls, 11 tools registered per tier (`src/routes/api/chat/+server.ts`, `src/lib/services/tools.ts`).
- Price-index and briefs logic lives in **coffee-app server libs**, not in `@purveyors/cli`. Chat tools can call these libs in-process; CLI parity requires either moving logic into the CLI package or having the CLI call `/v1` over HTTP with an API key.
- The only existing cross-surface chat integration is the analytics seed (`src/lib/analytics/actionContext.ts` → `/chat?source=analytics&prompt=...`).

---

## Workstream B — Agent tool expansion (first: Reed already started it)

### B.1 Red-team feedback on the proposed tool list

**The biggest risk is tool sprawl, not missing tools.** The proposed list adds ~20 tools to the existing 11. Every tool schema ships with every request (~100–200 tokens each), so 30+ tools adds roughly 3–5k fixed tokens per message — directly against the inference-cost-creep concern — and tool-selection accuracy measurably degrades as the catalog grows, especially on a mid-tier workhorse model with a 4-step loop. Most of the proposed tools are the same primitive ("ranked/filtered retrieval with an objective") wearing different names. Consolidate aggressively; the model differentiates intent via parameters better than via near-duplicate tool names.

**Tool-by-tool:**

| Proposed                                                                 | Verdict                                                                | Reasoning                                                                                                                                                                                                                                                                                                                                                                |
| ------------------------------------------------------------------------ | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `catalog_rank_premium`                                                   | **Merge → `catalog_rank`**                                             | "Premium" is one objective, not a tool. An `objective` enum (`premium \| value \| fresh_arrival \| rare_origin`) absorbs this, `catalog_find_outliers`, and most of `catalog_recommend`.                                                                                                                                                                                 |
| Custom blended ranking (score + cup + sensory + provenance + freshness…) | **Reject the blend; rank on Purveyor Score + objective-specific sort** | That blend is what `purveyor_score_factors` already encodes. A second composite creates two competing "quality" numbers and the first hard question will be "why does rank order disagree with Purveyor Score order?" Keep ranking deterministic, server-side, versioned. Return the factor breakdown so the chat model narrates; never let the LLM invent the ordering. |
| `include_explanation`                                                    | **Cut the flag**                                                       | If the explanation is precomputed, it's `purveyor_score_factors`; if LLM-generated inside the tool, it's hidden inference cost. The chat model is already in the loop — return factors, let it narrate.                                                                                                                                                                  |
| `supplier_list`                                                          | **Keep, P0**                                                           | With `catalog_facets`, this kills the worst current failure mode: the agent guessing supplier names. Cap output (top N by listing count + total), include aggregates.                                                                                                                                                                                                    |
| `supplier_detail`                                                        | **Keep as `supplier_profile`, P1**                                     | Real, but it's mostly `supplier_list` filtered + a scoped catalog search. Thin composition, low risk.                                                                                                                                                                                                                                                                    |
| `supplier_rank`                                                          | **Keep, P2, with guardrails**                                          | Six objectives each need a defensible metric. Small suppliers make rankings unstable — require `min_listings`, return sample counts and caveats (consistent with the locked "no claim theater" doctrine). `transparency` objective folds in `supplier_disclosure_rank` (don't ship two supplier ranking tools).                                                          |
| Purveyor Score in CLI catalog output                                     | **Keep, P0 — it's the prerequisite**                                   | Confirmed missing from `CatalogItem`. Everything above narrates from these fields.                                                                                                                                                                                                                                                                                       |
| `market_movement_summary` / `recent_arrivals` / `recent_delistings`      | **Merge → one `market_movement` tool**                                 | Three tools, one query family: `event: arrivals \| delistings \| restocks \| all` + `days` + filters. **Drop "price changes if available" at lot level** — the data does not exist (verified). Aggregate price movement belongs to `price_index_read`.                                                                                                                   |
| `price_index_read`                                                       | **Keep, P0 (promoted)**                                                | Endpoint and snapshot table exist; wiring a tool to the existing server lib is nearly free and it's the single biggest "chat can finally answer Market Index questions" unlock.                                                                                                                                                                                          |
| `origin_market_summary`                                                  | **Keep, P1, as server-side composition**                               | Normally I'd cut composed tools, but the 4-step loop is a hard budget: one tool that internally does facets + index + movement + top lots saves the model 3 steps. Implement as parallel queries in one tool execution.                                                                                                                                                  |
| `procurement_brief_*`                                                    | **Keep, P1; writes go through action cards**                           | Genuinely agent-native; matches are deterministic with `matchReasons`. `create` must follow the existing propose→confirm action-card pattern, not direct execution. Red-team: briefs need a visible non-chat surface (a list on /analytics or /beans) or they become invisible state users forget exists.                                                                |
| `catalog_compare`                                                        | **Keep, P1 — highest genUI payoff**                                    | Pairs directly with the existing `comparison` canvas layout. Cap at 4 ids. Supplier-vs-supplier comparison should reuse supplier tools, not overload this one.                                                                                                                                                                                                           |
| `catalog_explain_quality`                                                | **Cut**                                                                | Fully redundant once rank/search return `purveyor_score_factors`.                                                                                                                                                                                                                                                                                                        |
| `catalog_facets`                                                         | **Promote P2 → P0**                                                    | Strongest disagreement with the proposed priority. It's the cheapest tool, prevents hallucinated filter values (failed tool calls are wasted steps in a 4-step budget), and later powers @-mention typeahead. Cache it server-side daily — user-independent.                                                                                                             |
| `proof_coverage`                                                         | **Keep, P2**                                                           | Endpoint exists; thin wrap. Feeds `supplier_rank objective=transparency`.                                                                                                                                                                                                                                                                                                |
| `supplier_disclosure_rank`                                               | **Merge into `supplier_rank`**                                         | One supplier ranking tool with objectives, not two.                                                                                                                                                                                                                                                                                                                      |
| `catalog_find_outliers`                                                  | **Merge into `catalog_rank`**                                          | Outlier dimensions are objectives.                                                                                                                                                                                                                                                                                                                                       |
| `catalog_recommend`                                                      | **Cut**                                                                | Mapping `use_case: espresso \| adventurous \| …` → filters is judgment, which is exactly the chat model's job. A deterministic version hardcodes weak heuristics; an LLM-backed version hides inference cost. Put use-case → parameter guidance in the system prompt instead (a few hundred tokens, once).                                                               |

**Cross-cutting red-team items:**

1. **Step budget.** `facets → rank → present_results` is already 3 of 4 steps. Raise to `stepCountIs(5)` when the new read tools land, and state in the prompt that `catalog_facets`/`supplier_list` results should be reused within a conversation, not re-fetched.
2. **Tier + workspace scoping of schemas.** Tools are already tier-gated; additionally gate by workspace type (a roasting workspace doesn't need supplier_rank; a sourcing workspace doesn't need roast tools). Fewer schemas per request = lower cost + better selection.
3. **Caching.** `catalog_facets`, `supplier_list`, `price_index_read` are user-independent. Cache in-process with a daily TTL. Zero inference cost, faster tool rounds.
4. **CLI-first split.** Chat tools should call coffee-app server libs in-process (no HTTP hop). CLI binary parity (`purv catalog rank`, `purv market index`, …) calls `/v1` with an API key. Don't block chat tools on CLI publishing; do keep schemas/params identical so the CLI lands as a thin client later. Note: briefs + price-index logic currently lives only in coffee-app — moving it into `@purveyors/cli` is a bigger refactor; defer.
5. **Eval harness.** Before/after adding tools, run a fixed set of ~15 canned questions ("best Ethiopia under $7", "which supplier discloses the most?", "what landed this week?", "compare X and Y") and snapshot which tools get called. A simple script + manual review is enough; the failure mode to catch is the model picking `coffee_catalog_search` when `catalog_rank` is right, or chaining redundant calls.
6. **Naming.** Keep the existing snake*case domain-first family (`coffee_catalog_search` precedent): `catalog_rank`, `catalog_facets`, `catalog_compare`, `supplier_list`, `supplier_profile`, `supplier_rank`, `market_movement`, `price_index_read`, `origin_market_summary`, `sourcing_brief*\*`.

### B.2 Locked MVP tool set

**P0 — ship first (net +4 schemas):**

1. **CLI/catalog plumbing:** add `purveyor_score`, `purveyor_score_confidence`, `purveyor_score_tier`, `purveyor_score_factors`, `purveyor_score_version`, `purveyor_score_updated_at` to `CatalogItem`, `searchCatalog`, catalog get, and agent imports.
2. **`catalog_facets`** — `field: supplier | country | processing_base_method | fermentation_type | drying_method | grade | wholesale`, `stocked_only`; counts per value; cached daily.
3. **`supplier_list`** — `stocked_only`, `non_wholesale_only`, `country`, `limit`; names + listing/stocked counts, price range, avg purveyor score, top countries; cached daily.
4. **`catalog_rank`** — `objective: premium | value | fresh_arrival | rare_origin`, plus `stocked_only`, `wholesale`, `supplier`, `country`, `max_price`, `min_purveyor_score`, `limit`; deterministic server-side ordering keyed on Purveyor Score + objective sort; returns score breakdown + sample caveats.
5. **`price_index_read`** — `origin`, `processing`, `days`, `limit`; aggregate snapshots only (reuses `priceIndexResource`).

**P1:**

6. **`market_movement`** — `event: arrivals | delistings | restocks | all`, `days`, `supplier`, `country`, `min_purveyor_score`, `non_wholesale_only`. No lot-level price deltas.
7. **`catalog_compare`** — `ids` (≤4); normalized comparison across price, score/factors, transparency, freshness, sensory; renders via comparison canvas layout (needs a `comparison-table` genUI block or a `data-table` preset).
8. **`supplier_profile`** — one supplier: profile, top lots, price range, quality signals, recent arrivals, wholesale mix.
9. **`origin_market_summary`** — composed tool (facets + index + movement + top lots in one execution).
10. **`sourcing_brief_list` / `sourcing_brief_matches`** (read) + **`sourcing_brief_create`** (write, action card).

**P2:**

11. **`supplier_rank`** — `objective: premium | value | transparency | freshness | rare_origins | non_wholesale_access`, `min_listings`; score breakdown + caveats.
12. **`proof_coverage`** — thin wrap of the existing endpoint.

**Cut/merged:** `catalog_rank_premium`, `recent_arrivals`, `recent_delistings` (merged), `catalog_explain_quality`, `catalog_recommend`, `catalog_find_outliers`, `supplier_disclosure_rank` (merged), lot-level price changes (no data).

### B.3 PR breakdown (Workstream B)

- **B-PR1:** CLI catalog purveyor-score fields + `catalog_facets` + `supplier_list` (+ caching helper) + prompt updates + step budget to 5.
- **B-PR2:** `catalog_rank` + `price_index_read` + eval script with ~15 fixture questions.
- **B-PR3:** `market_movement` + `supplier_profile` + `origin_market_summary`.
- **B-PR4:** `catalog_compare` + comparison genUI presentation.
- **B-PR5:** sourcing brief tools + brief action card + a visible briefs list surface.
- **B-PR6 (P2):** `supplier_rank` + `proof_coverage`.

---

## Workstream A — Chat overlay + page context contract

### A.1 Red-team of the concept

- **Biggest technical risk:** `src/routes/chat/+page.svelte` is ~1300 lines holding all chat logic. Mounting a drawer without decomposing it first means forking that logic; the refactor must be PR #1 and behavior-identical.
- **Workspace sprawl:** auto-creating a workspace per page/visit would pollute the sidebar within a week. Decision: the overlay binds to the **last-active workspace** (with a switcher in the drawer header); page context attaches to **messages**, never to workspace identity.
- **Context staleness + cost:** snapshot page context at **message-send time** (not drawer-open time), cap it (~300 tokens), and include it only when its hash changed since the last message. Bounded, no extra model calls.
- **Trust boundary:** page context is client-supplied. It is descriptive only — the server must never use it to bypass tool-level access checks (tools already enforce tier/RLS; keep it that way). Validate shape and length server-side.
- **Gating:** overlay follows the existing `canUseChat` gate (`ppiAccess || member`). For locked users the Ask affordance shows the existing locked state, not a broken drawer.

### A.2 Design

**`PageChatContext` contract** (new `src/lib/chat/pageContext.ts`):

```ts
interface PageChatContext {
	surface: 'catalog' | 'analytics' | 'dashboard' | 'beans' | 'roast' | 'profit';
	summary: string; // human-readable scope, e.g. "Catalog filtered to Ethiopia, washed, stocked, $5–8/lb (23 results)"
	entities?: Array<{
		type: 'coffee' | 'inventory_bean' | 'roast' | 'supplier';
		id: number | string;
		label: string;
	}>;
}
```

Each route publishes via a small store setter (`setPageChatContext(...)`) in an `$effect` keyed on its filter state; cleared on navigation. This generalizes the analytics seed pattern (`actionContext.ts`), which migrates to the new contract.

**Drawer:** new `ChatDrawer.svelte` mounted in `+layout.svelte` for authenticated non-public-shell pages, using the existing right-sidebar margin mechanism (`rightSidebarOpen` / `md:mr-[32rem]`). Opens via (a) a persistent "Ask" button in the sidebar rail + mobile header, (b) `Cmd+K`/`Ctrl+K`, (c) entity-level "Ask about this" actions. Mobile: full-screen sheet via the existing `MobileOverlayShell`. `/chat` remains the full workbench (canvas, workspace management); the drawer is chat-pane-only with a "open full workspace" link.

**Server:** `/api/chat` accepts optional `pageContext`; validated, truncated, injected as a short system block ("USER'S CURRENT VIEW: …"). Entities listed by type/id/label so tools can be called with exact ids.

**Entity-level "Ask about this":** actions on catalog cards, bean rows, and roast profiles open the drawer with (a) the entity in `pageContext.entities`, (b) the matching genUI block seeded to canvas client-side (reusing `blockExtractor` builders), and (c) entity-type suggestion chips ("Find similar in stock", "Compare with my inventory", "How is this priced vs the index?" — the last one requires B-PR2, a nice forcing function for sequencing).

### A.3 PR breakdown (Workstream A)

- **A-PR1 (refactor, no behavior change):** extract `ChatPane.svelte`, `ChatComposer.svelte`, `MessageList.svelte` from `/chat/+page.svelte`; page becomes a thin shell. Existing chat behavior verified manually + existing tests.
- **A-PR2:** `PageChatContext` contract + store; migrate analytics seed; publish context from catalog + analytics + dashboard.
- **A-PR3:** `ChatDrawer` (desktop right panel + mobile sheet), Ask button + `Cmd+K`, server `pageContext` handling.
- **A-PR4:** entity-level "Ask about this" on catalog cards, inventory rows, roast profiles, with canvas seeding + entity chips.

---

## Workstream C — Chat UX overhaul (composer, genUI, mobile)

### C.1 Red-team

- **Follow-up suggestions must not add model calls.** Generate them heuristically from the last tool calls + workspace type (extend `suggestionEngine.ts`). A near-free upgrade later: instruct the model (in the existing system prompt) to end responses with up to 3 short follow-ups in a parseable line — same request, ~30 extra output tokens. Do not add a separate suggestion request.
- **@-mentions must not stuff full records into the prompt.** Resolve mentions to compact context lines (name, id, 2–3 key fields). Typeahead reads the user's own inventory/roasts plus cached catalog names — scoped by auth, no embedding search needed for v1.
- **Mobile is the clunkiest surface today:** full blocks hide behind a floating canvas overlay button. Render canvas-grade blocks inline in the message stream on mobile; keep the overlay only for pinned-canvas review. (The iOS input-zoom fix already shipped 2026-06-10.)

### C.2 Scope

1. **C-PR1 — Composer + context chips:** chips row above the composer showing what the model will see (workspace memory ✓, canvas summary ✓, page context ✓, mentions) with per-chip toggle; "+" button exposing slash commands; better send/streaming states. Depends on A-PR1.
2. **C-PR2 — Tool timeline:** upgrade `InlineStatusLine` to a collapsible per-message timeline (tool name, key params, result counts, errors with retry). Pure presentation of data already streamed.
3. **C-PR3 — Follow-up chips:** heuristic follow-ups after each assistant message via `suggestionEngine`.
4. **C-PR4 — Mobile inline blocks:** on small screens render full blocks inline under the message (instead of preview + overlay), keep pin-to-canvas, sticky composer with safe-area padding.
5. **C-PR5 — @-mentions:** `/api/chat/mention-search` (auth-scoped prefix search over inventory, roasts, catalog names; reuses facets/supplier caches), composer typeahead, structured token (`@[coffee:123]`), server-side resolution into compact context lines.

---

## Held: proactive dashboard briefs (inference cost)

Parked per Reed. Two cheap variants to revisit later, in cost order:

1. **Rule-based signal cards (zero inference):** "3 new Ethiopia arrivals this week", "2 tracked lots delisted", "stock below 30 days at current roast cadence" — computed from the same queries as `market_movement`/inventory, each with an "open in chat" handoff. No LLM at all.
2. **On-demand cached brief:** generate only when the user opens the dashboard, at most once/day, cached in Supabase (~1 model call/user/day, bounded).

---

## Sequencing

```
Now:        B-PR1 → B-PR2            (tools: facets, supplier_list, rank, price index, eval)
Parallel:   A-PR1                    (chat page decomposition — unblocks everything UI)
Then:       A-PR2 → A-PR3            (context contract → drawer)
            C-PR1 → C-PR2 → C-PR3    (composer chips, timeline, follow-ups)
Then:       A-PR4 + B-PR3/B-PR4      (entity ask + movement/compare — they feed each other)
Later:      B-PR5, C-PR4, C-PR5, B-PR6
```

Rationale: B-PR1/2 deliver visible capability immediately and are independent of UI work; A-PR1 is the gating refactor for both the overlay and the UX overhaul; entity-level "Ask about this" lands after rank/compare exist so its suggestion chips have real answers.

## Open questions

1. `catalog_rank` objectives v1: is `premium | value | fresh_arrival | rare_origin` the right four, or should `value` wait for a defensible price-vs-quality metric?
2. Should drawer access mirror `canUseChat` exactly, or show a teaser/locked drawer to viewers as an upgrade surface?
3. Where should sourcing briefs surface outside chat (analytics action rail vs. portfolio page)?
4. CLI binary parity for the new tools (`purv catalog rank`, `purv market index`): same release or follow-on?
