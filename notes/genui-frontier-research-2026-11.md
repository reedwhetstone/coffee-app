# GenUI Frontier Research and Cherry Build Recommendations (2026-11-15)

**Scope:** frontier scan of generative UI and agent-UI developments from roughly May to November 2026, grounded in the current Cherry and coffee-app state, ending in a prioritized build list.

**Evidence labels:** *Verified* means read from a primary source (spec, vendor blog, repo) on 2026-11-15. *Secondary* means a trade or aggregator write-up. *Unverified* means I could not reach a primary source (the search provider rate-limited several queries), so treat it as a lead. Items older than May 2026 are marked *older*.

---

## 1. Where we are

### What exists in coffee-app (read from `origin/main`)

- **Chat backend:** `src/routes/api/chat/+server.ts` uses Vercel AI SDK 6 (`ai ^6`, `@ai-sdk/svelte ^4`) `streamText` against OpenRouter (`CHERRY_RUNTIME_MODEL`), with `pruneMessages` and `stepCountIs`. The transition plan's LangChain references are stale.
- **Tool layer:** `src/lib/services/tools/` has catalog, inventory, market, presentation, roast, tasting and Parchment tools, plus `toolModelOutput` shaping, `schemaService`, `ragService`, `suggestionEngine` and `slashCommands`. Tool selection and Cherry identity already have eval tests (`toolSelection.eval.test.ts`, `cherryIdentity.eval.test.ts`).
- **GenUI block system:** `src/lib/types/genui.ts` defines a closed `UIBlock` union: coffee-cards, inventory-table, roast-chart, roast-comparison, roast-profiles, profit-summary, tasting-radar, data-table, action-card, bean/roast/sale forms, error. Components live under `src/lib/components/genui/{blocks,previews}`, with `GenUIBlockRenderer.svelte` and `blockExtractor.ts` / `blockDetail.ts`.
- **Canvas:** `CanvasLayout` (focus, comparison, dashboard, stack), `CanvasMutation` (add, remove, focus, clear, layout), a mobile overlay, and agent- or user-sourced layout.
- **Persistence and memory:** `chatPersistence.ts`, a workspace identity layer, `/api/memory` plus `MemoryPanel.svelte`, `/api/workspaces`, conversation export.
- **Writes:** `action-card` plus form blocks provide a human-confirm pattern. `grep needsApproval` finds no uses, so the AI SDK 6 native approval flow (which the transition plan itself names for Phase 3) is not adopted. Approvals run through our own action-card mechanism.

### What exists in `repos/cherry`

Cherry the repo is **not a runtime**. It is CoffeeBench, the evaluation harness: a frozen 20-case suite, model and system tracks, a four-treatment harness panel, a jury, and run artifacts. Its README says it contains no production inference. The in-app "Cherry Runtime" (PRODUCT_VISION item 10) lives in coffee-app. So "Cherry harness" improvements split into:

1. **Runtime** (coffee-app): tools, blocks, canvas, prompt, memory.
2. **Measurement** (cherry repo): CoffeeBench. No genUI-specific eval exists in either repo yet.

### Planned but not shipped (from `genui-platform-transition-plan.md` and `intelligence-first-chat-layer-idea.md`)

- Phase 2 and 3 items are partially done (workspaces, memory, action cards). Phase 4 items (context awareness, proactive suggestions, multi-step workflows, canvas pinning, Artisan import via chat, progressive page sunset) are mostly open.
- The intelligence-first note wants research boards, comparison cards, sourcing briefs, watchlists, inventory timelines and recommendation explanations, all reachable from CLI/API as well as the web.

### Gaps that matter

1. The block set is **closed and hand-rolled**: one TypeScript union, one Svelte component per block, no catalog schema the model can read, no JSON-schema validation of block props beyond TypeScript.
2. **No partial-render streaming contract** for blocks. Blocks are extracted from messages rather than streamed as incrementally valid UI.
3. **No bidirectional state:** block interactions can navigate or focus the canvas but cannot call back into the agent as typed functions.
4. **Canvas views are not first-class saved objects** (no versioning, sharing, or reopening as a living artifact).
5. **No genUI evals:** nothing checks that the model picks the right block, produces valid props, or keeps the interface correct across turns.
6. **Nothing is exposed over an open protocol**, so Purveyors intelligence is only reachable inside our own web app.

---

## 2. Frontier scan (May to November 2026)

### 2.1 The big structural change: two layers are standardizing

The field converged on a split: a **transport/sandbox layer** (MCP Apps) and a **declarative component layer** (A2UI, json-render, AG-UI as the pipe between agent and frontend). This is the most important thing to understand before picking work.

**MCP Apps (SEP-1865).**
- Became MCP's first official extension in January 2026 (*older*, before the window), co-authored by OpenAI and Anthropic maintainers and folding in MCP-UI and OpenAI's Apps SDK ideas. Sources: [MCP blog 2026-01-26](https://blog.modelcontextprotocol.io/posts/2026-01-26-mcp-apps/) (*Verified*), WorkOS write-up 2026-01-27 (*Secondary*).
- **New in the window:** the 2026-07-28 spec release candidate (final published 2026-07-28 per the RC post and secondary coverage) made MCP stateless at the protocol layer (no `initialize` handshake, no `Mcp-Session-Id`) and carried MCP Apps in the same release. Per the RC post, servers declare UI templates ahead of time so hosts can prefetch, cache and security-review them before anything runs, and render them in a sandboxed iframe. Tasks (long-running work) graduated to an extension in the same release. Source: [MCP RC post, 2026-07-24](https://blog.modelcontextprotocol.io/posts/2026-07-28-release-candidate/) (*Verified*). Note it contains breaking changes.
- Implication: any MCP server we expose can now return real UI into Claude, ChatGPT-style hosts and Gemini, per Google's A2UI post naming Claude and Gemini as MCP Apps hosts (*Verified*, 2026-11-11). I did not independently verify each host's current MCP Apps support level (*Unverified* per host).

**A2UI 1.0 (Google, 2026-11-11, four days ago).** Source: [Google Developers Blog](https://developers.googleblog.com/a2ui-10-build-delightful-fast-reliable-agentic-experiences/) (*Verified*); CopilotKit's [A2UI 1.0 write-up](https://www.copilotkit.ai/blog/introducing-a2ui-1-0) (*Verified* as vendor post).
- First stable release of the declarative protocol. UI is **data, never code**: the agent can only reference component names and functions allowlisted in the app's catalog; anything outside the catalog is rejected before render.
- **New in 1.0:** bidirectional function calls (UI can call agent functions and the reverse, with typed validation), multiple catalogs on one screen, accessibility support, extensions metadata.
- **Server-side data binding** so sensitive values never reach the model. This maps directly to our "private roast and inventory data" posture.
- **A2UI Express:** compact format claimed at up to 3x fewer tokens and 3x lower latency, writable by any model without tool calling (CopilotKit post; vendor claim, not independently measured).
- Renderers: React, Angular, Lit, Flutter, SwiftUI, Compose (Compose at v0.9.1). **No official Svelte renderer**; the CopilotKit post mentions community renderers for Vue and the terminal only. The web renderers also run inside MCP Apps, so one A2UI surface can show up in Claude or Gemini.
- Named adopters: Atlassian (Jira cards for agent follow-ups), Alation (metric cards and charts, each showing its SQL and data), Bloomberg, ByteDance (Lynx renderer, June 2026). The Alation pattern, a chart that can show the query behind it, is the closest analogue to Purveyors provenance.
- Caveat: the A2UI repo README contains a reference to a "Jev" decision-model product; ignore it, it is unrelated to our stack.

**AG-UI (CopilotKit).** Event-based protocol between agent backends and frontends. A2UI 1.0 travels natively over AG-UI, so any AG-UI agent gets A2UI without custom integration (*Verified*, CopilotKit 2026-11-11). CopilotKit's new Generative UI product ships a 70-component standard catalog. AG-UI is React-centric in tooling; I did not verify a Svelte client (*Unverified*). Useful as a spec for event shapes (state snapshots and deltas, tool lifecycle), less so as a dependency.

**Vercel AI SDK and json-render.**
- AI SDK 6 has native tool-execution approval via `useChat` tool states (`approval-requested`, `approval-responded`, `output-denied`) (*Verified*, vercel.com/blog/ai-sdk-6; release itself is *older*).
- **json-render** (vercel-labs): define a catalog with Zod prop schemas, pass `catalog.prompt()` to `streamText`, stream and render progressively. Guardrailed to catalog components. **Has an `@json-render/svelte` package**, plus React, Vue, Solid, React Native, PDF, HTML email, and terminal targets (*Verified*, GitHub README, repo active 2026-11-13). Vercel's docs (page dated 2026-10-05) now present it as the way to "let the model compose the interface." The Chat SDK adapter (2026-11-06) streams json-render to bots such as Slack. A critical secondary note (iMasters, 2026-11-08) points out that silent degradation across surfaces is risky when a card carries an action button.
- Vercel positions this as experimental; the New Stack piece is from 2026-01-23 (*older*).

**Why this matters for us:** we already use AI SDK 6 and Svelte 5. json-render is the only mainstream genUI framework with a Svelte renderer that I could verify, and its catalog concept is almost exactly our `UIBlock` union with a schema and a prompt generator attached.

### 2.2 Declarative catalogs beat code generation for production (consensus)

- A2UI, json-render and MCP Apps all push the same safety story: constrain the agent to a registered vocabulary or a sandboxed iframe with pre-declared templates, not arbitrary generated code.
- Counter-signal: benchmarks of free-form generation tools (Design Theater, arXiv 2607.22928, 2026-07-24, evaluating ChatGPT, Claude, Firebase Studio, v0, Bolt; *Verified* via search snippet only) discuss design homogenization. Free-form generation is strong for one-off artifacts, weak for a branded product surface.
- My read: code-gen is right for *artifacts* a user asks for ("build me a sourcing worksheet"), catalog-driven is right for *the product's own surface*. We should do the second, and consider the first only as a sandboxed MCP-Apps-style artifact later.

### 2.3 Evals for genUI are finally appearing

- **EvoGenUI-Bench** (arXiv 2608.29387, 2026-08-29): 150 five-turn tasks, 750 turns, across information presentation, executable interaction and tool-grounded external state. Tests whether a model can *maintain* an interface as requirements change over turns (*Verified* via abstract snippets; I did not read the full paper).
- **Design Theater** (2026-07-24) benchmarks generative UI tools on design quality metrics.
- A third-party vendor benchmark (gendesigns.ai, 2026-08-08) compares models on HTML generation speed and size; low rigor, mention only as market noise.
- Takeaway: multi-turn **interface maintenance** and **tool-grounded state** are the realistic eval axes for us. Cherry's CoffeeBench harness (frozen cases, jury, run artifacts) is better infrastructure for this than anything off the shelf.

### 2.4 State sync, approvals, persistence

- Bidirectional agent-UI state is now in a stable spec (A2UI 1.0 function calls) and in AG-UI's event model. This is the shift from "agent renders, user reads" to "user edits, agent reacts."
- Human-in-the-loop is mainstream: AI SDK 6 approval states, and A2UI's own examples hold side effects until the user confirms ("nothing is sent until you confirm", Google post).
- Persistence of generated views: I found no primary-source standard for saving generated UI as durable artifacts. Alation's feeds (same feed in Claude and in-product) are the best shipping example of "a generated view that is also a product object." This is an open lane, and it is where Cherry's canvas can differentiate. (*My inference, not a sourced trend.*)

### 2.5 Safety and sandboxing

- MCP Apps: sandboxed iframes, templates declared before execution so hosts can review them (*Verified*, RC post).
- A2UI: data-only messages, allowlisted catalog and functions, server-side binding to keep sensitive values out of the model (*Verified*).
- Risk flagged by commentary: surface-dependent degradation of interactive elements (iMasters on json-render and Chat SDK, *Secondary*).

### 2.6 Not verified (do not rely on)

- OpenAI Apps SDK current status, ChatGPT app directory changes, Gemini "dynamic view" and Anthropic artifacts/interactive-output specifics in May to November: searches were rate-limited. Only the MCP Apps unification and the A2UI post's statement that Claude and Gemini host MCP apps are verified.
- Thesys/C1 and other startups: not researched. Rerun before any build decision that depends on them.

### 2.7 New vs old, quick view

New in window: A2UI 1.0 (Nov 11), MCP 2026-07-28 spec with stateless core and MCP Apps carried in it, json-render's Svelte target and Chat SDK streaming (Nov 6), A2UI over AG-UI, EvoGenUI-Bench and Design Theater, Tasks extension.
Older context: MCP Apps extension itself (Jan 2026), AI SDK 6 approvals, MCP-UI and Apps SDK origins (2025).

---

## 3. Recommendations

Ordered by leverage per effort. "Depends on" names existing code.

### 1. Turn the block union into a catalog with schemas and a generated prompt
- **What:** define each block (coffee-cards, inventory-table, roast-chart, etc.) as a Zod schema plus description, in one registry. Generate the system-prompt block docs and runtime validation from it. Evaluate adopting `@json-render/core` + `@json-render/svelte` versus a thin in-house version that emits an A2UI-compatible shape.
- **Why now:** json-render shipped a Svelte renderer and Vercel now documents catalog-driven composition (docs 2026-10-05); A2UI 1.0 (2026-11-11) makes "catalog.json of allowlisted components" the standard. Doing this once makes both formats reachable later.
- **User value:** fewer malformed or wrong blocks, and the model can compose richer layouts (a comparison with an annotation row) without a new TypeScript type each time.
- **Effort:** medium (1 to 2 weeks). **Depends on:** `src/lib/types/genui.ts`, `GenUIBlockRenderer.svelte`, `blockExtractor.ts`, `presentationTools.ts`.
- **Opinion:** prototype json-render behind a flag first; keep our block components as the registry implementations. Do not adopt it wholesale before checking Svelte 5 runes compatibility and bundle cost.

### 2. GenUI evals in the cherry repo (CoffeeBench-GenUI)
- **What:** a small frozen suite measuring block selection, prop validity, grounding (every number traces to a tool result), and multi-turn canvas maintenance, scored deterministically where possible and by the existing jury otherwise. Start with 30 to 40 cases drawn from real chat transcripts.
- **Why now:** EvoGenUI-Bench (2026-08-29) frames multi-turn interface maintenance as the real failure mode, and nobody has a coffee-domain version. We already own the harness, freeze process and jury.
- **User value:** every prompt or model change stops being a vibe check; protects roasters from wrong numbers rendered confidently in a chart.
- **Effort:** medium. **Depends on:** cherry `eval/` and `adapters/`, existing `toolSelection.eval.test.ts` as seed cases.
- **Opinion:** this is Cherry's actual moat. Ship it before more block types.

### 3. Provenance on every block ("show the query and data behind this")
- **What:** a standard provenance affordance on blocks: source tool, snapshot date, supplier, and the underlying rows or query, expandable in place and exportable.
- **Why now:** Alation's A2UI feeds show the SQL and data behind each chart (Google post, 2026-11-11); A2UI's server-side binding keeps raw values out of the model. Trust is the differentiator in a market where a bad price comparison costs real money.
- **User value:** buyers can defend a purchase decision; roasters can audit a claim.
- **Effort:** small to medium. **Depends on:** tool output shaping (`toolModelOutput.ts`, `tastingEnvelope.ts`), block detail views (`blockDetail.ts`).

### 4. Saved, versioned canvas views (living artifacts)
- **What:** let a canvas state be saved as a named view (sourcing brief, watchlist board, comparison) with version history, re-run ("refresh with today's prices"), and a shareable read-only link. Blocks store tool-call references plus params, not frozen data.
- **Why now:** no standard exists for persisting generated UI; Alation's "same feed in the assistant and in the product" shows demand. It also directly delivers the intelligence-first note's research boards, watchlists and sourcing briefs.
- **User value:** the highest in this list for buyers: a recurring sourcing brief that stays fresh without re-asking.
- **Effort:** medium to large. **Depends on:** workspaces API and schema, `CanvasBlock` and `CanvasMutation`, existing `/api/share`, chat persistence.

### 5. Typed UI-to-agent actions (bidirectional blocks)
- **What:** let blocks invoke named, schema-validated functions ("compare these two", "add to watchlist", "rerun with this ratio") that go through the same tool layer and approval path, instead of only navigate or focus.
- **Why now:** A2UI 1.0's headline feature is function calls in both directions (2026-11-11); this is the step from display to workspace.
- **User value:** removes the type-a-follow-up loop for common moves.
- **Effort:** medium. **Depends on:** `BlockAction` in `genui.ts`, `action-card` flow, tool registry.
- **Risk:** keep every side effect behind the existing confirm step (see item 7).

### 6. Expose Purveyors intelligence as an MCP server with MCP Apps UI
- **What:** a remote MCP server (stateless, per the 2026-07-28 spec) offering catalog search, comparison and market tools, returning a small set of MCP Apps views (coffee cards, comparison). Start read-only and public-tier, authenticated per the existing API key and tier model.
- **Why now:** MCP Apps is final in the 2026-07-28 spec; the A2UI post names Claude and Gemini as MCP Apps hosts. Purveyors becomes discoverable where buyers already ask questions, and it matches "agents as customers" and the CLI/API-first principle in the intelligence-first note.
- **User value:** reach, not in-app UX. Strategic more than operational.
- **Effort:** medium to large. **Depends on:** `purveyors-cli` and parchment-api (tools already shared), tier and quota model, block components rendered as static HTML views.
- **Opinion:** do this after items 1 to 3, because the catalog, provenance and evals are what make it trustworthy and cheap to ship. Verify per-host MCP Apps support before committing.

### 7. Adopt AI SDK 6 native tool approval for write tools
- **What:** move write tools to `needsApproval` with `addToolApprovalResponse`, rendering the existing action-card as the approval UI, rather than a parallel custom mechanism.
- **Why now:** it is the framework's supported path and what A2UI examples assume (nothing happens until the user confirms). It reduces custom code in the highest-risk area (writes to inventory, roasts, sales).
- **Effort:** small to medium. **Depends on:** `ActionCardBlock`, write tools in `roastTools.ts` and `inventoryTools.ts`, `chatPersistence.ts` (approval states must survive reload).

### 8. Proactive "what changed" cards (lower priority)
- **What:** on open, the agent surfaces watchlist price moves, stock changes and new arrivals as a short card set, using the saved views from item 4.
- **Why now:** Atlassian's Jira cards show agents asking for follow-ups in place (2026-11-11). Our Phase 4 plan already calls for proactive suggestions.
- **Effort:** medium. **Depends on:** items 4 and 3, `suggestionEngine.ts`.

### Deliberately do NOT do

1. **Do not let the model generate arbitrary HTML/JS or free-form components for the product surface.** Design Theater (2026-07-24) discusses homogenization in free-form tools, and A2UI's whole safety case is data-only. Sandboxed free-form artifacts, if ever wanted, belong in an MCP Apps-style iframe, not in the Cherry canvas.
2. **Do not build a custom wire protocol or adopt a heavyweight React-first stack (AG-UI/CopilotKit) as a dependency.** We already have AI SDK 6 streaming and a Svelte 5 app. Borrow event and catalog shapes, keep the transport we have. Revisit only if a verified Svelte client appears and we need cross-framework rendering. Also do not chase every new protocol this quarter; A2UI is four days past 1.0 and renderer support for Svelte is absent.

### Suggested sequence

Weeks 1 to 2: items 1 and 7 (catalog, approvals), plus a flagged json-render spike. Weeks 2 to 4: items 2 and 3 (evals, provenance). Month 2: items 4 and 5. Month 3: item 6, then 8.

### Open questions for Reed

- Is the cherry repo meant to stay evaluation-only, or should a runtime package eventually live there? The recommendations assume runtime stays in coffee-app and evals live in cherry.
- Appetite for a public MCP server (item 6): it is outward-facing and touches tier/quota policy.

---

## Sources

- MCP blog, MCP Apps (2026-01-26): https://blog.modelcontextprotocol.io/posts/2026-01-26-mcp-apps/
- MCP 2026-07-28 spec release candidate: https://blog.modelcontextprotocol.io/posts/2026-07-28-release-candidate/
- Google Developers Blog, A2UI 1.0 (2026-11-11): https://developers.googleblog.com/a2ui-10-build-delightful-fast-reliable-agentic-experiences/
- A2UI repo and site: https://github.com/a2ui-project/a2ui , https://a2ui.org
- CopilotKit, A2UI 1.0 and AG-UI: https://www.copilotkit.ai/blog/introducing-a2ui-1-0 , https://github.com/ag-ui-protocol/ag-ui
- Vercel json-render: https://github.com/vercel-labs/json-render ; Chat SDK changelog (2026-11-06): https://vercel.com/changelog/json-render-and-chat-sdk-agents ; AI SDK docs: https://vercel.com/docs/ai-sdk ; AI SDK 6: https://vercel.com/blog/ai-sdk-6
- EvoGenUI-Bench: https://arxiv.org/abs/2608.29387 ; Design Theater: https://arxiv.org/html/2607.22928v1
- Secondary: iMasters on Chat SDK and json-render (2026-11-08); WorkOS MCP Apps (2026-01-27); gendesigns.ai benchmark (2026-08-08).
