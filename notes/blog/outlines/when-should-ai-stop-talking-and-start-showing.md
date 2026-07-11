# Outline: When Should AI Stop Talking and Start Showing?

**Pillar:** ai-first-product
**Target:** 1,100-1,200 words (standard post ceiling)
**Status:** outlined
**Source material:**

- `repos/coffee-app/notes/PRODUCT_VISION.md`
- `repos/coffee-app/notes/BLOG_STRATEGY.md`
- `repos/coffee-app/notes/genui-platform-transition-plan.md`

## Thesis

The hard part of generative UI is not getting an AI model to produce cards, charts, or forms. It is deciding when those components should feel like the model's natural expression rather than a templated insert. The useful test is simple: text carries judgment; UI carries state.

## Voice Constraints

- Short and punchy. Keep the final post under 1,200 words.
- Gladwell/Freakonomics framing: the counterintuitive point is that richer UI can make an AI feel less intelligent if it appears at the wrong moment.
- No salesmanship, no narrative arc. Start with the insight immediately.
- Data and analysis over narrative. Use the industry movement toward declarative agent UI as proof that the interface layer is becoming a protocol surface.
- 1-2 research citations that directly reinforce specific claims.
- Every section earns its place. If a section only says "AI should show widgets," cut it.

## Verification Checklist

- [ ] Confirm the GenUI plan still treats UIBlocks as planned architecture, not shipped product behavior.
- [ ] Confirm the plan's design principle says structured output should feel like expression, not insertion.
- [ ] Confirm tools are expected to produce UIBlocks directly, with chat narration referencing canvas blocks through block tokens.
- [ ] Confirm the post does not claim Purveyors already ships the full two-surface canvas experience.
- [ ] Confirm no section uses Purveyors as a pitch. It should be one concrete implementation example.

## External References

1. **Google A2UI repository**: https://github.com/google/A2UI

   - Key support: A2UI frames agent-generated UI as declarative JSON rendered by the client with trusted native components. The important citation is not the protocol detail; it is the separation between agent intent and host rendering. That supports the post's claim that generative UI is becoming a contract, not a loose design flourish.

2. **Vercel, "Introducing AI SDK 3.0 with Generative UI support"**: https://vercel.com/blog/ai-sdk-3-generative-ui
   - Key support: Vercel explicitly positions component-based LLM interfaces as a move beyond plain text and markdown chatbots. Use this to ground the market shift without pretending components alone solve the product problem.

## Structure

### 1. The UI Is Not the Intelligence (~220 words)

Open with the inversion: the obvious mistake is thinking generative UI means "AI that makes components." That is the shallow version. If every tool result becomes a card, the product does not feel intelligent; it feels like a chatbot with better formatting.

The real product question is editorial: when does a user need prose, when do they need state, and when does the AI need to stop explaining and show the thing?

Use one concrete coffee example:

- Bad: "Here are 12 coffees" plus a giant grid.
- Better: "I'd start with these two because they match your roast history" while the canvas holds two persistent coffee cards.

The insight: prose should carry judgment, prioritization, and reasoning. Structured UI should carry objects the user needs to inspect, compare, edit, or keep visible. Mixing those jobs creates either walls of text or dashboards with no opinion.

### 2. Components Become Expression When They Have Timing (~260 words)

Define the key distinction from the GenUI plan: expression vs insertion.

Insertion is mechanical. A model calls `coffee_catalog_search`, the frontend detects coffee results, and a card appears because a template rule fired. Useful, but emotionally dead.

Expression is contextual. The AI says why two coffees matter, refers to them inline, and places the full cards where the user can compare them. The component appears because the conversation reached a moment where text alone would be worse.

This gives the post its most transferable rule:

- Use text for judgment.
- Use components for state.
- Use the canvas for state that should survive the next message.

Tie to Purveyors architecture: UIBlocks, block reference tokens, and canvas mutations are not cosmetic. They are the grammar that lets the assistant move between talking, showing, and preserving state without making the user manage the interface manually.

The HN-friendly angle: the next interface primitive is not the chat bubble or the dashboard. It is a sentence with handles into live objects.

### 3. Declarative UI Is the Safety Valve (~250 words)

Bring in the external reference stack.

A2UI's important move is separating intent from execution. The agent describes a UI in structured data. The host application renders it with known components. That is the right trust model: the AI can express interface intent without shipping arbitrary code into the client.

This also explains why pure "AI generated frontend" demos are the wrong mental model for product software. Letting a model invent arbitrary UI is impressive in a sandbox; it is scary in a production workflow where permissions, styling, accessibility, and data boundaries matter.

The better pattern is narrower and more durable:

- The app owns the component catalog.
- The AI owns timing, selection, and framing.
- The schema owns the boundary between them.

Use Vercel AI SDK 3.0 as ecosystem evidence that the industry is moving beyond markdown responses toward component-rendering patterns. Then sharpen the point: component rendering is necessary, but not sufficient. Without editorial rules, generative UI becomes prettier log output.

### 4. The Canvas Solves the Scroll Problem (~230 words)

Shift from inline rich UI to the two-surface architecture.

Inline cards help a single answer. They do not solve the deeper problem: chat scroll is a bad place to keep working memory. If the user is comparing coffees, reviewing a roast curve, or editing an action card, those objects should remain visible while the conversation continues.

That is why the Purveyors plan treats the canvas as persistent distillate. The chat is the record. The canvas is the current working state.

Use the whiteboard analogy carefully, since there is already an outlined post on this theme. This section should not duplicate that post. Keep it focused on expression: a knowledgeable person does not narrate every datapoint. They say the important thing while pointing at the board.

Concrete product claim to verify before drafting: the canvas should not be a sidebar with widgets. It should be what the AI is currently pointing at.

### 5. The Product Test: Did the Component Reduce Cognitive Load? (~210 words)

Close with a practical rubric instead of a manifesto.

Before adding a generative UI component, ask four questions:

1. Does this object need to persist beyond the current paragraph?
2. Does the user need to compare, edit, sort, confirm, or inspect it?
3. Would prose hide the important structure?
4. Can the AI explain why this object appears right now?

If the answer is no, keep it in text. If the answer is yes, render the component and let prose do the editorial work around it.

Final takeaway: the future of AI interfaces is not less text. It is better division of labor. The model should speak when judgment matters, show when structure matters, and preserve state when the user's attention would otherwise leak into the scrollback.
