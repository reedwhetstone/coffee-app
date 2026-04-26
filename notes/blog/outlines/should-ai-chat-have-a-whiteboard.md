# Outline: Should AI Chat Have a Whiteboard?

**Pillar:** ai-first-product
**Target:** 1,500 to 2,000 words (HARD CEILING)
**Status:** outlined
**Source material:** notes/PRODUCT_VISION.md, notes/BLOG_STRATEGY.md, notes/genui-platform-transition-plan.md, src/routes/chat/+page.svelte, src/routes/api/chat/+server.ts

## Thesis

The biggest flaw in most AI chat products is not that they lack better models. It is that they force every problem into a timeline. A canvas is not a prettier sidebar; it is an external working memory layer that lets the AI and human arrange evidence, comparisons, and actions in space instead of making the user reconstruct state from a scrollback.

## Voice Constraints

- Short and punchy. 1,500 to 2,000 words max.
- Gladwell/Freakonomics framing: the strange claim is that the whiteboard, not the chat box, may be the real AI interface.
- No salesmanship, no narrative arc. Get to the insight immediately.
- Data and analysis over narrative. Use cognitive science and HCI evidence to ground the argument.
- 1 to 2 research citations that directly reinforce specific claims.
- Every section earns its place. If it does not deliver new insight, cut it.
- Purveyors appears as one concrete design example, not as a pitch.

## Verification Checklist

- [ ] Confirm `src/routes/chat/+page.svelte` is still the current primary chat UI and does not yet implement the full persistent canvas described in the GenUI plan.
- [ ] Confirm the GenUI plan positions chat as the scrolling record and canvas as persistent state, not a second chat stream.
- [ ] Confirm planned canvas artifacts include coffee cards, roast charts, inventory tables, action cards, profit summaries, and AI-generated code renders.
- [ ] Confirm block reference tokens and UIBlock/canvas mutation details are planned architecture, not shipped production behavior.
- [ ] Confirm the product vision still says intelligence should replace navigation where possible.
- [ ] Keep all implementation claims explicitly framed as planned or in progress unless verified in code before drafting.

## External References

1. **Kirsh and Maglio, "On Distinguishing Epistemic from Pragmatic Action" (Cognitive Science, 1994).**
   - URL: https://philpapers.org/rec/KIRODE
   - Key quote: "use the world to improve cognition"
   - Why it matters: The paper gives the post its cognitive anchor. People do not only act to change the world; they also act to simplify thinking. A canvas makes AI interaction partly epistemic: arrange the coffee cards, compare the roast curves, expose what the next decision actually is.

2. **Robertson et al., "Data Mountain: Using Spatial Memory for Document Management" (UIST 1998, Microsoft Research).**
   - URL: https://www.microsoft.com/en-us/research/publication/data-mountain-using-spatial-memory-for-document-management/
   - Key quote: "statistically reliable advantages"
   - Why it matters: The paper is old in the best possible way. It shows that spatial arrangement is not decoration; it can materially improve retrieval in information work. The caveat from later Cockburn and McKenzie work is important: more spatial freedom is not automatically better. The canvas should be disciplined 2D workspace, not gimmicky 3D clutter.

## Structure

### 1. The chat window has the wrong shape (~300 words)

Open with the core provocation: most AI products assume the conversation timeline is the interface. The model streams text, the user scrolls, and everything important is buried in chronological order. That is fine for answers. It is bad for decisions.

A decision has a shape. Three coffees side by side. A roast curve next to the inventory lot it came from. An action proposal next to the evidence that justifies it. A chat log has no stable place for any of that; it makes the user remember where the relevant object appeared five messages ago.

The counterintuitive claim: the next UI breakthrough in AI may look less like a better chatbot and more like a whiteboard. Not because whiteboards are nostalgic, but because they let people externalize thought. The GenUI plan says this directly: chat scrolls, canvas stays. That distinction is the whole post.

Use Purveyors only as the concrete problem domain: sourcing and roasting decisions involve comparisons, charts, forms, and provenance. A pure chat interface keeps flattening those objects into prose. A canvas can keep them visible while the conversation continues.

### 2. Whiteboards are cognitive tools, not presentation tools (~400 words)

Bring in Kirsh and Maglio. Their Tetris work showed that some actions are epistemic: people move things around not to execute a final plan, but to make the next thought easier. The key transfer: interface objects can do cognitive work.

Apply that to AI chat. When an assistant places three Ethiopian naturals on a canvas, the user is not just receiving a prettier answer. The visible arrangement reduces the cognitive cost of comparison. The canvas becomes shared working memory:

- The AI can point back to the same object without re-describing it.
- The human can challenge or refine a specific card instead of saying "the second one you mentioned earlier."
- The system can preserve current state without asking the user to scroll.
- The next action can be proposed in context, next to the evidence.

This is the real reason the sidebar pattern feels weak. A sidebar is usually a place to put output after the chat has already done the thinking. A whiteboard is where thinking happens. The difference is subtle in screenshots and enormous in use.

Tie to the GenUI plan language: canvas as distillate, chat as record, both together as the interface.

### 3. Spatial persistence beats chronological memory (~400 words)

Use the Data Mountain citation. Spatial interfaces have a long HCI history because people remember where things are. The lesson is not "make everything 3D." Cockburn and McKenzie found that increasing spatial freedom can make interfaces more cluttered and less efficient. The right lesson is narrower and more useful: stable 2D placement can become a retrieval cue.

That maps cleanly to AI workspaces. A roast chart should not disappear because the assistant answered a follow-up question. A comparison table should not be recomputed from conversation history every time. An inventory action card should stay where the user can inspect and edit it.

Make this practical. Chat is chronological memory: useful for audit trail, bad for active problem solving. Canvas is spatial memory: useful for current state, bad if overloaded. The architecture should assign each surface a job:

- Chat: reasoning, narration, questions, audit trail.
- Canvas: active objects, comparisons, charts, pending actions.
- Inline references: bridges between the two.

The punchline: the canvas is not "rich output." It is state management for human attention.

### 4. The hard part is editorial judgment, not rendering cards (~350 words)

Avoid the trap of making this sound easy. Rendering cards is straightforward. The hard part is teaching the AI when to place, replace, focus, collapse, and remove objects.

Use the GenUI plan details:

- Block reference tokens connect prose to canvas objects.
- UIBlocks can render as inline previews or full canvas components.
- Layout hints choose focus, comparison, action, or dashboard modes.
- Canvas state must persist at the workspace level.

The hidden product question: who edits the workspace? If the AI pins everything, the canvas becomes another junk drawer. If it pins too little, the user falls back to scrollback. The assistant needs taste. It has to understand the current decision, not just the available components.

This is where the post should challenge the common "AI UI" instinct. More generated UI is not better. The better interface may show fewer objects, held in more stable positions, with clearer relationships.

Purveyors example: for "what should I roast next?" the canvas should not dump every matching bean. It should hold the two or three candidates that matter, a prior roast curve if relevant, and a proposed action only after the decision narrows.

### 5. A canvas should replace navigation only when it improves judgment (~300 words)

Close with a product principle, not a hype claim. The goal is not to delete every page. The goal is to stop making users navigate when the system already understands the decision they are trying to make.

Tie back to PRODUCT_VISION.md: intelligence should replace navigation where possible, and professional depth should stay accessible. The canvas is one way to make that real. It lets the app reveal complexity progressively without hiding the underlying objects.

End with the sharper takeaway:

AI chat is good at language. Work is not only language. Work involves objects, evidence, comparisons, and reversible actions. The interface should let those things stay in the world long enough for the human and AI to think with them.

A sidebar answers. A whiteboard remembers.
