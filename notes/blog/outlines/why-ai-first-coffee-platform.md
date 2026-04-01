# Outline: Why I'm Building an AI-First Coffee Platform

**Pillar:** ai-first-product
**Target:** 2,000-2,500 words
**Status:** outlined
**Source material:** notes/genui-platform-transition-plan.md (Design Philosophy), brain/references/b2cc-agents-as-customers.md

## Thesis

"AI-first" has become meaningless marketing. Most products bolt a chat window onto an existing UI and call it AI-native. Purveyors is taking a fundamentally different approach: the conversation IS the interface. Not a chatbot that triggers UI components, but an AI that renders its thinking through them. Here's what that means concretely and why it matters for domain-specific tools.

## Verification Checklist
- [ ] Current chat implementation description matches src/routes/chat/
- [ ] LangChain/Vercel AI SDK status matches actual codebase (LangChain currently, migration planned)
- [ ] Canvas architecture is accurately described as planned/future, not shipped
- [ ] Design philosophy principles match genui-platform-transition-plan.md
- [ ] Competitive claims about Cropster, Artisan, etc. are accurate

## Structure

### Opening: What "AI-First" Usually Means (300 words)
Most "AI-first" products in 2026: take an existing SaaS dashboard. Add a chat sidebar. Wire it to GPT. Ship it. Call yourself AI-native on the landing page.

The problem: the chat is a layer on top of the real interface. Users still navigate through menus and pages to do real work. The AI is a search engine with personality, not an interface.

This is what purveyors looks like today: page-based navigation (/beans, /roast, /profit, /catalog) with a /chat page that can query coffee data. It works. It's also not AI-first. It's AI-adjacent.

### What AI-First Actually Means (500 words)
Six design principles, explained through concrete examples:

1. **The AI is the interface, not a layer on top of one.** When you ask "what should I roast next?", the AI doesn't link you to a page. It renders coffee cards inline with its reasoning. The conversation and the UI are the same thing.

2. **Progressive disclosure through conversation.** Instead of a dashboard with 47 controls, you start talking. Complexity emerges as you need it. "Show me my inventory" → inventory table. "Which of these am I running low on?" → filtered, annotated. "Set up a roast session for the Ethiopia" → roast form pre-populated.

3. **Structured output feels like expression.** When a coffee card appears, it should feel like the AI chose to show it to you; the way a knowledgeable friend might pull out their phone. Not like a template got triggered.

4. **Agentic confidence with transparent reasoning.** "Here's what I'd pick and why" beats "here are 47 results." Opinions backed by data. Challenge welcome.

5. **Two surfaces: chat + canvas.** The chat scrolls (conversation). The canvas stays (current state). Together they replace navigation.

6. **Dynamic presentation.** The AI chooses how to show information based on the moment: discovery gets narration + cards, comparison gets side-by-side, action gets a confirmation card.

### The Canvas Architecture (500 words)
The technical bet: a two-surface layout where the chat is cause and the canvas is effect.

- The canvas is a non-scrolling workspace that holds the current state: coffee cards being compared, a roast chart being analyzed, an action card awaiting confirmation.
- The chat contains the AI's narration, reasoning, and inline references to canvas items.
- When the conversation focus shifts, the canvas transitions. You don't navigate; the AI navigates for you based on what you're talking about.

Concrete example walkthrough: "I just got 5 lbs of Ethiopian Natural from Sweet Maria's" →
1. AI searches catalog, finds the match
2. Canvas shows the coffee card
3. AI proposes an inventory entry (action card on canvas)
4. User confirms on canvas
5. AI follows up: "Want to set up a roast session? Your last Ethiopian went well at 405°F first crack."
6. Canvas transitions to roast form

No page navigation. No menus. Just conversation driving a visual workspace.

### Why This Matters for Domain Tools (400 words)
Generic AI chat works for general knowledge. But for domain-specific work (coffee roasting, inventory management, sourcing decisions), the AI needs to render domain-specific UI. A coffee card is not a generic text block. A roast temperature chart is not a markdown table.

The insight: the value of AI-first is highest in vertical, domain-specific tools where:
- The data model is complex enough that navigation sucks
- The user's intent varies wildly session to session
- Expert knowledge can be embedded in the AI's responses
- Visual components (charts, cards, forms) are necessary for real work

Coffee roasting hits all four. And the architecture we're building is general enough to apply to any domain tool.

### Honest Assessment: What's Hard (300 words)
This isn't a solved problem. Challenges we're actively working through:
- LLM reliability: the AI needs to generate block reference tokens consistently. If it forgets to reference the canvas, the illusion breaks.
- Canvas layout: spatial arrangement, responsive sizing, animated transitions. Real engineering.
- Mobile: the canvas needs to work on a phone. Pop-out overlay, not a sidebar.
- Context window: workspace memory + canvas state + conversation history + system prompt. Token math matters.
- The system prompt is doing a LOT of work. Teaching the AI about two surfaces, canvas management, block tokens, layout hints, domain knowledge, AND personality. That's fragile.

### Closing: Where This Goes (200 words)
The end state: you open purveyors and start talking. The AI builds your workspace around the conversation. Pages become fallbacks. The distinction between "chat" and "app" disappears.

We're not there yet. But the architecture is designed, the phases are planned, and the blog will track every step honestly. Including the parts that don't work.
