# Outline: Why Should an AI Agent Stop at the Write Boundary?

**Pillar:** ai-first-product
**Target:** 1,500-2,000 words (HARD CEILING)
**Status:** outlined
**Source material:** repos/coffee-app/notes/genui-platform-transition-plan.md; repos/coffee-app/src/lib/services/tools.ts; repos/coffee-app/src/routes/api/chat/execute-action/+server.ts; repos/coffee-app/src/lib/components/genui/blocks/ActionCardBlock.svelte; repos/coffee-app/src/lib/types/genui.ts

## Thesis
The most important design decision in agentic software is not tool calling. It is separating proposal from execution. An agent should get maximally useful right up until the write boundary, then stop, show its work, and hand control back. That pause is not anti-agentic friction; it is the mechanism that preserves trust, reduces automation bias, and makes AI safe enough to operate around real user data.

## Voice Constraints
- Short and punchy. 1,500-2,000 words max.
- Gladwell/Freakonomics framing: creative angle, see ideas from unexpected places
- No salesmanship, no narrative arc. Get to the insight immediately.
- Data and analysis over narrative. Cite numbers and concrete evidence.
- 1-2 research citations that directly reinforce specific claims
- Every section earns its place. If it doesn't deliver new insight, cut it.

## Verification Checklist
- [ ] Confirm `src/lib/services/tools.ts` still documents write tools as proposal-only and returns `action_card` payloads instead of executing writes directly.
- [ ] Confirm `src/routes/api/chat/execute-action/+server.ts` still whitelists exactly five action types and performs ownership checks before writes.
- [ ] Confirm `ActionCardBlock.svelte` still exposes editable fields plus `Execute`, `Edit`, and `Cancel` before mutation.
- [ ] Confirm current action-card states are still `proposed`, `executing`, `success`, and `failed`.
- [ ] Confirm the chat flow still routes write confirmation through the app-owned executor boundary, not direct model-owned database writes.
- [ ] Verify whether the article should describe this pattern as already shipped in chat, partially shipped, or still mid-transition in any specific surfaces.

## External References
- **Goddard et al., 2011, _Automation bias - a hidden issue for clinical decision support system use_**  
  URL: https://pubmed.ncbi.nlm.nih.gov/21335682/  
  Key quote: "Automation bias - the tendency to over-rely on automation - has been studied in a variety of academic fields."  
  Use: anchors the claim that over-trusting machine recommendations is a known systems problem, not an AI-app novelty.

- **Goddard et al., 2012, _Automation bias: a systematic review of frequency, effect mediators, and mitigators_**  
  URL: https://pmc.ncbi.nlm.nih.gov/articles/PMC3240751/  
  Key quotes: "Of 13,821 retrieved papers, 74 met the inclusion criteria." "Mitigators of AB included ... emphasizing user accountability ... and the provision of information versus recommendation." "In 6% of cases, clinicians over-rode their own correct decisions in favor of erroneous advice from the DSS."  
  Use: supplies concrete numbers and the key design move. Show information, preserve accountability, do not let the system silently cross the boundary from suggestion to action.

## Structure
### 1. The smartest thing an agent can do is stop (300 words)
Open with the counterintuitive claim: most demos optimize for eliminating clicks, but the highest-value click in an agentic product is often the last one before mutation. The post should define the "write boundary" as the moment a system goes from describing an action to changing state. Establish the core tension: autonomy feels magical in a demo, but operational trust is won or lost at the write boundary.

Key points:
- The industry keeps treating friction as the enemy.
- In agentic products, the wrong kind of friction is bad; boundary friction is essential.
- The product question is not "can the model call tools?" It is "who owns the final side effect?"

Source material:
- genui-platform-transition-plan.md, Phase 3 execution model
- tools.ts proposal-pattern comments

### 2. Proposal and execution should be different systems (400 words)
Explain the architectural split. In Purveyors, write tools generate structured proposals, not mutations. The app-owned executor performs the actual write only after user confirmation. This is the deeper pattern: the model assembles intent, the application enforces policy, and the user remains the author of the side effect.

Key points:
- `tools.ts` explicitly labels write tools as proposal-only.
- The tool returns an `action_card` with summary, reasoning, editable fields, and `proposed` status.
- `/api/chat/execute-action/+server.ts` is the real boundary: whitelist, auth, ownership verification, then mutation.
- This separation is not just for safety. It also makes the system testable, auditable, and easier to reason about.
- Concrete product number: current executor whitelists five action types, which shows how narrow the mutation surface can stay even when the chat surface feels flexible.

Source material:
- tools.ts lines documenting proposal-only writes
- execute-action/+server.ts allowed actions and ownership checks
- genui.ts action-card shape

### 3. Action cards are not safety theater; they are the interface (400 words)
Make the stronger claim: once you separate proposal from execution, the confirmation UI stops being an annoying modal and becomes the product surface. The action card is where agentic confidence becomes legible. It shows what will happen, why the agent recommends it, and what the user can still correct.

Key points:
- `ActionCardBlock.svelte` exposes editable fields before execution.
- The state machine matters: `proposed -> executing -> success|failed` makes side effects observable.
- Good agent UX is not invisible automation. It is visible, editable intent.
- The card is where the user can catch wrong quantities, stale prices, misidentified targets, or hallucinated fields without losing the usefulness of the recommendation.
- This is what "teaching AI to never touch your data" actually means in product terms: the AI can prepare the mutation, but it cannot self-ratify it.

Source material:
- ActionCardBlock.svelte field rendering and buttons
- genui.ts action state types
- Phase 3 design imperative in genui-platform-transition-plan.md

### 4. The literature says this pause is doing real work (300 words)
Bring in the external evidence. Over-reliance on automated recommendations is a documented failure mode. The post should not overstate the analogy to AI agents, but it should argue that the pattern generalizes: if humans defer to decision support in medicine and aviation, they will also defer to fluent AI apps unless the product is designed to keep accountability visible.

Key points:
- Automation bias is a cross-domain phenomenon, not a niche UI complaint.
- The systematic review found 13,821 papers screened, 74 included, and identified mitigators such as emphasizing user accountability and presenting information rather than naked recommendation.
- One cited study found clinicians reversed correct decisions in 6% of cases because the system suggested the wrong thing.
- Therefore, a proposal-first pattern is not paranoia. It is a direct product response to a known human-factors problem.

Source material:
- External references only

### 5. The broader lesson: agentic products need controlled autonomy, not maximum autonomy (350 words)
Close by generalizing the pattern beyond coffee. This applies to CRMs, finance tools, developer platforms, internal dashboards, anywhere an AI can mutate state. The winning products will not be the ones that let the model do the most. They will be the ones that decide exactly where the model should stop.

Key points:
- Read tools can be highly autonomous; write tools need an explicit boundary.
- The best pattern is not "human in the loop" everywhere. It is "human at the irreversible boundary."
- This creates a sharper mental model for builders: let the model search, rank, summarize, prefill, and recommend aggressively; make execution explicit, narrow, and app-owned.
- One sentence on Purveyors as illustration, not pitch: the action-card/executor split is useful because coffee data has lots of low-stakes analysis and a small number of high-stakes writes.
- End on the reframing: stopping is not the failure of agentic software. It is the feature that makes agency survivable.

Source material:
- All internal sources above
- External references as supporting frame
