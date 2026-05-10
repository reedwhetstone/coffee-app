# Red-team: Analytics Intelligence Reframe Program

**Date:** 2026-05-09
**Target plan:** `notes/implementation-plans/2026-05-08-analytics-intelligence-reframe.md`
**Mode:** strategy / implementation-plan red team
**Verdict:** ready with fixes before execution beyond PR 01

## 1. Executive verdict

The reframe is directionally right: Purveyors should read as a coffee intelligence platform, not a bundle of roaster CRUD screens. The plan correctly identifies that analytics, catalog, API, CLI, and chat need to feel like one decision system, and it correctly demotes Mallard Studio from umbrella-product status.

But the plan is carrying too much conceptual weight in a no-backend frontend wave. It mixes product positioning, navigation taxonomy, analytics redesign, chat/GenUI strategy, inventory semantics, capture workflows, and future procurement primitives into one strategy object. That creates three serious risks:

1. **Fake capture theater.** “Watch,” “save,” “compare,” and “shortlist” are not just UI words. Per ADR-005 they are paid workflow leverage. If they do not persist, route to a real existing workflow, or declare themselves as previews, they will degrade trust.
2. **Terminology multiplication.** The plan tries to reduce product blur but introduces more names: Market Intelligence, Coffee Intelligence, Parchment Intelligence, Personal Studio, Mallard Studio, Studio-focused chat, Intelligence Chat, GenUI, Decision Workflows, operating catalog. That is not a taxonomy yet; it is a naming cloud.
3. **Frontend-as-strategy drift.** The canonical product vision says API-first is product strategy. A UI-only reframe is acceptable as a first slice, but only if it explicitly does not invent product semantics that the API/CLI/chat substrate cannot honor.

The recommended first PR, **PR 01: Intelligence-first navigation taxonomy**, is still the right first implementation slice if it stays brutally narrow. It should not rename the whole product, invent new Studio branding, add nonfunctional CTAs, or imply chat/tool capabilities that do not exist. Before PR 02 or PR 03, patch the plan to add a naming map, an entitlement/capability matrix, and an analytics-to-chat state contract.

## 2. Alignment with product vision and ADRs

### Strong alignment

- **Product vision:** The plan supports the canonical thesis that Purveyors is a coffee intelligence platform, not a marketplace and not a roast logger. Elevating analytics/catalog over inventory/roast/profit is directionally aligned with “the data moat matters more than feature sprawl” and “intelligence should replace navigation where possible.”
- **ADR-002:** The plan’s insistence that CLI/API-backed actions should not drift from web chat is correct. The shared machine contract under `/v1/*` is the right center of gravity.
- **ADR-003:** Making analytics legible as the top-of-funnel proof surface is aligned with the public analytics decision.
- **ADR-005:** The plan understands that saved searches, alerts, comparisons, exports, semantic search, and workflow automation are member/API leverage. The problem is that the plan does not yet enforce that distinction tightly enough in the proposed UI scaffolding.
- **GenUI transition plan:** Shared chat as an intelligent surface is aligned with the Chat + Canvas direction. The May 9 add-on correctly says chat should not be trapped inside Mallard Studio.

### Tensions to fix

- **Primary user overcorrection:** `notes/PRODUCT_VISION.md` still names serious home roasters, micro-roasters, commercial roasters, developers, and agents as primary users. The reframe risks implying that supply-chain buyers are primary and roaster-side workflows are merely optional. Better framing: market intelligence is the product center; roaster-owned context is a strategic personalization layer for the same intelligence product, not a demoted afterthought.
- **ADR-003 public gate tension:** The analytics command-center pass could accidentally expand anonymous public tooling beyond the accepted “three free charts / gate deeper analytics” model. Public users can see proof; member users get leverage. Do not add public scoped workflows, advanced filters, comparison rails, watch/save CTAs, or chat-driven analysis unless the access level is explicit.
- **ADR-005 server enforcement:** The plan says no backend changes through PR 03.5, but capture verbs imply capabilities that eventually require server enforcement. UI hiding and disabled previews are fine; actual save/watch/compare behavior must not be implemented without route-level entitlement checks.
- **March Parchment platform decisions:** Existing product-surface decisions already name Parchment API, Parchment CLI, Parchment Console, Parchment Intelligence, and Mallard Studio. The new plan should not casually add “Personal Studio” or “Roaster Studio” unless it explicitly supersedes those decisions. It should instead define whether Mallard Studio remains the personal workspace label or gets retired.

## 3. Conceptual inconsistencies / terminology collisions

### Intelligence vs Parchment Intelligence

The plan uses “intelligence” both as the whole product frame and as the paid analytics package. That can work only if the copy distinguishes:

- **Purveyors / Coffee Intelligence:** the broad platform promise.
- **Parchment Intelligence:** the paid analytics and market-intelligence package.
- **Parchment API / CLI / Console:** machine and developer surfaces.

Without this map, “Start Intelligence,” “Intelligence Home,” “Market Intelligence,” and “Parchment Intelligence” will blur together.

### Mallard Studio vs Personal Studio vs Roaster Studio

The plan says Mallard Studio should not be the umbrella product. Correct. But then it floats Personal Studio, Roaster Studio, My Studio, and Mallard Studio as open options. That is too much brand churn for a navigation PR.

Recommendation: PR 01 should use plain category labels, not product-brand invention:

- **Market Intelligence** or **Intelligence** for analytics/catalog/chat/API-facing surfaces.
- **Studio** or **Roaster Workspace** for inventory/roast/profit if needed.

If Mallard Studio is retained, it should mean the personal roaster workspace only. If it is retired, retire it deliberately in a naming decision, not through incidental sidebar copy.

### Chat vs Ask vs GenUI vs Decision Workflows

The plan correctly says chat is shared, but it does not distinguish:

- the route (`/chat`),
- the assistant entry label (“Ask Purveyors” or “Chat”),
- the GenUI rendering substrate,
- and the actual tool/action capabilities.

That matters because the existing chat implementation already has workspaces, canvas state, tools, action cards, and workspace focus types. Renaming the nav item is easy; making analytics state available to chat is a separate product and engineering contract.

### Inventory as “operating catalog”

This is the most dangerous concept in the plan. Existing green coffee inventory is owned-stock inventory. The plan wants it to include owned, researched, tracked, and compared coffees. That is a different object model. Do not relabel `/beans` as if it already supports researched/tracked/compared coffees. Use “inventory enriches intelligence” now; save “operating catalog” for a backend-backed model or a named future plan.

## 4. Fall-throughs and missing connective tissue

### Analytics-to-chat state is not specified

The plan says AI/chat should be embedded beside analytics and tied to visible analytics state: “explain this movement,” “find comparable lots,” “draft a sourcing brief,” and “watch this segment.” That is not a copy problem. It needs a state contract.

Before implementing embedded analytics chat, define:

- what analytics state is serializable into chat context;
- which filters, chart selections, origin/process scopes, and entitlement state are included;
- which existing tools can answer the prompt;
- what happens when the user asks for a backend-backed action like watch/save;
- how the route avoids making chat a decorative text box with no actual authority.

### Capture scaffolding lacks a capability matrix

The plan lists “watch,” “compare,” “save,” “shortlist,” “export/API,” and “analyze against my inventory” together. These are not equivalent.

- **Ask about this:** can be non-persistent and may route to chat if state is passed honestly.
- **Compare suppliers:** may be backed by existing Parchment Intelligence supplier comparison data for members.
- **Export/API:** should route to docs/API/CLI, not pretend to generate export files unless implemented.
- **Watch / save / shortlist:** require persistence or must be disabled previews.
- **Analyze against my inventory:** requires member auth and real inventory context.

Add a matrix with columns: verb, current backend support, access level, route/action, no-backend behavior, future backend plan.

### Current analytics page is already more advanced than the plan implies

The current `/analytics` page already contains:

- “Green coffee market intelligence” framing;
- supplier/origin/stocked stat strip;
- retail/wholesale/all scope control;
- price trends, processing mix, origin price ranges;
- Parchment Intelligence gating;
- supplier comparison, supplier health, arrivals, delistings, origin benchmarks, price spread, longer-term trends.

The command-center PR must start from an audit of what exists, not a fresh dashboard fantasy. Otherwise PR 03.5 will become a broad visual rearrangement that reimplements existing Parchment Intelligence modules with more chrome and less substance.

### “Market read” and “insight cards” need truth rules

The plan asks the UI to answer “what changed?”, “why does it matter?”, and “what can I do next?” Good north star, but those are claims. They need thresholds and provenance.

Examples of missing rules:

- minimum sample size before calling a movement meaningful;
- minimum history length before claiming trend direction;
- whether price movement uses median, average, p25/p75, or supplier-count-weighted values;
- how to display sparse data and null process/grade fields;
- whether “why it matters” is rule-based, generated, or hand-authored.

No ornamental insight cards. If the data cannot support a claim, the UI should say “not enough signal yet.”

### PR ordering has a hidden dependency

PR 03 adds capture scaffolding; PR 03.5 redesigns analytics hierarchy. That order is backwards if the action rail depends on the command-center layout. Either:

1. make PR 03 only add a small reusable CTA component in current analytics modules, then PR 03.5 repositions it, or
2. swap them: layout skeleton first, action/capture after.

Do not let PR 03 become a scattered set of buttons that PR 03.5 immediately moves.

### Dashboard “Intelligence Home” can become another launcher

PR 02 risks replacing one quick-start grid with another, more branded quick-start grid. A useful Intelligence Home must have a decision loop, not just renamed cards. If no new backend data is allowed, reuse current existing data honestly:

- latest update/freshness;
- top public market movement if supported;
- recent arrivals preview;
- direct path into catalog/analytics/chat;
- Studio context only as enrichment.

If those data points are not available on dashboard server load, keep PR 02 copy/layout-only and do not fake a KPI cockpit.

## 5. Warnings and no-nos

- **No dashboard decoration.** Do not add KPI strips, cards, rails, badges, empty charts, or glassy panels unless each has a decision purpose and real data.
- **No nonfunctional capture theater.** “Saved,” “watching,” “shortlisted,” or “brief created” must never appear unless server state exists.
- **No backend-disguised-as-frontend.** If a feature’s value is persistence, alerting, comparison state, entitlement, API export, or inventory matching, it is not a frontend-only feature.
- **No brand proliferation.** Do not simultaneously use Mallard Studio, Personal Studio, Roaster Studio, Intelligence Chat, Ask Purveyors, Parchment Intelligence, and Purveyors Intelligence without a naming decision.
- **No chat as a gimmick.** Embedded chat must receive visible analytics state and call real tools. A floating “ask AI” box with generic prompts is worse than no chat.
- **No overclaiming market truth.** Always show sample sizes, supplier counts, freshness, sparse-data caveats, and null/unknown handling.
- **No anonymous power-tool leakage.** Public analytics proves value. Member/API tiers deliver leverage. Keep ADR-003 and ADR-005 intact.
- **No demotion copy that insults roaster workflows.** Inventory, roast, tasting, and profit are not legacy clutter. They are personalization inputs for better intelligence.
- **No route renames in PR 01.** Keep URL paths stable. This is taxonomy, not migration.
- **No one-off web logic.** Any real intelligence action should be grounded in shared `/v1`, CLI-exported, or chat tool contracts where possible.

## 6. Recommendations, prioritized P0/P1/P2/P3

### P0

None. The plan is not fundamentally wrong. PR 01 can proceed if narrowed to taxonomy only.

### P1

1. **Add a canonical naming map before implementation.** Decide how “Purveyors Intelligence,” “Parchment Intelligence,” “Parchment API/CLI/Console,” and “Mallard Studio” relate. Do not let every PR invent copy locally.
2. **Add a capture/action capability matrix.** For every verb, declare backend support, entitlement, route/action, no-backend behavior, and future plan. This is mandatory before PR 03.
3. **Define the analytics-to-chat state contract.** Embedded analytics chat is not mergeable as “copy and a button.” It needs scoped state, tool mapping, entitlement behavior, and honest fallbacks.
4. **Protect ADR-003/ADR-005 gates.** Any analytics command-center work must explicitly separate anonymous, viewer, member, API, and admin behavior.
5. **Patch inventory language.** Do not call current inventory an operating catalog of owned/researched/tracked/compared coffees until the object model exists.

### P2

1. **Re-scope PR 03 and PR 03.5.** Either swap the order or make PR 03 a tiny reusable CTA primitive with no broad placement churn.
2. **Add data-truth thresholds for insight cards.** Include sample-size, history-length, and sparse-data rules before writing “what changed” copy.
3. **Audit existing analytics modules before redesign.** Start PR 03.5 with a current-state map so the redesign consolidates, not duplicates.
4. **Clarify dashboard data constraints.** PR 02 should state exactly which existing server data powers the Intelligence Home. If none, keep it layout/copy-only.
5. **Add cross-surface acceptance criteria.** For any real action, acceptance should mention web, API, CLI, or chat tool parity, even if a later PR fulfills it.
6. **Make chat label/access explicit.** If chat remains member-only, navigation should not imply viewers can use shared intelligence chat unless there is a viewer-safe path.

### P3

1. **Normalize category labels in tests.** Tests should assert strategic grouping intent, not brittle marketing copy.
2. **Add rollback language for naming.** Navigation labels are reversible; product brand decisions should not be casually encoded across many components.
3. **Update the plan’s open questions.** Collapse overlapping naming questions into one naming decision and add questions about capture behavior and chat-state integration.

## 7. Suggested plan edits, phrased as actionable bullets

- Add a **“Canonical naming map”** section near the top:
  - Purveyors = platform / company surface.
  - Coffee or Market Intelligence = broad product promise.
  - Parchment Intelligence = paid analytics package.
  - Parchment API / CLI / Console = developer and machine surfaces.
  - Mallard Studio = personal roaster workspace only, or explicitly retired.
- Add a **“Capability matrix for action verbs”** section covering ask, compare, watch, save, shortlist, export/API, analyze against inventory, and draft sourcing brief.
- Replace “native capture primitives” with “decision/action affordances,” then reserve “capture” for actions that actually persist state.
- Add a hard rule: **non-persistent CTAs must never claim saved state** and must either route to an existing surface, open chat with scoped context, or show a disabled preview with clear future-language.
- Add an **access-level row** to each PR acceptance criteria: anonymous, viewer, member, Parchment Intelligence, API, admin.
- In PR 01, specify that this is **navigation taxonomy only**: no new routes, no route renames, no product rebrand, no CTA scaffolding.
- In PR 02, state exactly which existing data powers the Intelligence Home. If new data would be needed, defer that widget.
- Before PR 03, add a **backend support inventory** for compare/watch/save/shortlist/export/analyze actions.
- Either swap PR 03 and PR 03.5, or rename PR 03 to “Action CTA primitive” and keep placements minimal until the command-center layout exists.
- Add an **analytics-to-chat state contract** before implementing embedded analytics chat: scope filters, chart selection, visible module, entitlement state, and tool mapping.
- Replace “green coffee inventory as the user's operating catalog” with “green coffee inventory is the owned-stock context layer today; researched/tracked/compared coffees require a future saved-object model.”
- Add a **truthfulness guardrail for insight cards**: no trend/why-it-matters claim without sample count, supplier count, freshness, and minimum history rules.
- Add a **current analytics baseline** subsection listing what `/analytics` already has so PR 03.5 is a targeted consolidation, not a decorative rebuild.
- Add a no-no bullet: **do not add empty or fake KPI cards to satisfy the reference design.**
- Add a no-no bullet: **do not make chat a floating generic prompt; it must use visible analytics context or stay a normal route link.**

## Operator summary

VERDICT: ready_with_fixes
P0: 0
P1: 5
P2: 6
P3: 3
NEXT_ACTION: patch_plan
REPORT: `notes/implementation-plans/2026-05-09-analytics-intelligence-red-team.md`
