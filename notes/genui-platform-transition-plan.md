# GenUI Platform Transition Plan

## Vision

The coffee-app currently has a traditional page-based architecture: `/beans`, `/roast`, `/profit`, `/catalog`, and a `/chat` page with streaming AI powered by LangChain + GPT-5-mini. The vision is to transform `/chat` into an **AI-first workspace platform** that progressively replaces page-based navigation. Instead of clicking through pages, the AI orchestrates the user's experience — rendering the right UI components, proposing structured actions, and maintaining persistent memory of what the user has been working on across sessions.

**The north star**: if you squint, using the app should feel like reading a really thoughtful, personalized article that happens to have interactive elements — not like using a chatbot that sometimes shows widgets.

---

## Design Philosophy

These principles govern every phase. They aren't aspirational — they're acceptance criteria. If a feature ships and violates one of these, it's a bug.

### 1. The AI is the interface, not a layer on top of one.

The conversation *is* the product surface. The moment users feel like they're talking to a chatbot that then triggers a separate UI system, the illusion breaks. Rich elements should feel like the AI is rendering its thinking through them, not "calling" them. There is no distinction between "chat" and "app."

### 2. Progressive disclosure through conversation, not menus.

Instead of frontloading options or dumping a dashboard, the AI reveals complexity as the user needs it. You start with a natural exchange, and depth emerges organically. This is the opposite of traditional UI where you design for the "power user layout" and hope beginners figure it out. Workspaces provide structure, but within a workspace, the AI unfolds the experience.

### 3. Structured output should feel like expression, not insertion.

When a card, chart, or interactive element appears, it should feel like the AI *chose* to show you something — the way a knowledgeable friend might pull out their phone to show you a photo mid-conversation. Not like a template got populated. The AI editorializes in natural language woven around and into the blocks, not via UI badges or labels.

### 4. Agentic confidence with transparent reasoning.

The AI makes opinionated choices — filtering, ranking, highlighting — while showing why. Users don't want "here are 47 results." They want "here's what I'd pick and here's my reasoning" with the ability to challenge or drill deeper. Action cards show exactly what function will be called + human-readable summary, but the AI's *framing* of those actions is what builds trust.

### 5. Multimodal output lives on one plane — but at two altitudes.

Text, visuals, interactive elements, and actions all belong to the same experience. But they operate at two altitudes: the **chat** is the flowing conversation — rich text, narration, inline references. The **canvas** is the persistent distillate — where the conversation's current state crystallizes into structured, actionable reference material. The chat scrolls; the canvas stays. Together they *are* the interface.

### 6. Dynamic presentation adapts to the conversational moment.

The AI dynamically chooses presentation patterns based on context — it doesn't always render information the same way:

| Moment | Chat behavior | Canvas behavior |
|--------|--------------|-----------------|
| **Discovery/exploration** | Inline narration with embedded references: "I'd start with this one because..." with a linked preview | Canvas populates with the coffee card(s) for persistent comparison |
| **Comparison/decision** | Synthesized take in prose: "Here are the three that make sense..." | Canvas arranges cards side-by-side, maybe adds a comparison table |
| **Confirmation/action** | "This is the one. Here's the action card." | Canvas focuses on the single action card with editable fields |
| **Analysis/deep dive** | AI narrates trends and insights | Canvas holds the roast chart or profit summary while discussion continues |

This mirrors how a great human advisor works — they read the room. The chat is the conversation; the canvas is the whiteboard they're drawing on while they talk.

---

## The Two-Surface Architecture: Chat + Canvas

The core UX is a **Chat+** layout — conversation in one pane, a persistent visual workspace in the other. This isn't a sidepanel bolted onto chat. It's two complementary surfaces that together form a single intelligent interface.

### The Canvas

The canvas is a **sandbox for the LLM and human to collaborate visually**. It is the distillate layer — where the raw conversation gets refined into persistent, structured, actionable material.

**Core properties:**
- **Doesn't scroll.** It maintains useful reference data — real information, charts, cards, comparisons — that stays visible while the conversation continues. Content is arranged spatially, not chronologically.
- **Evolves with the conversation.** The AI adds, removes, and rearranges canvas content as the conversation's focus shifts. If you stop talking about Ethiopian coffees and start discussing roast profiles, the canvas transitions accordingly.
- **Holds structured components.** Coffee cards, roast charts, inventory tables, action cards, profit summaries — the full UIBlock catalog renders here. These are the "real" interactive versions with full detail.
- **Supports rendered code.** The AI can produce code snippets (charts via D3, data visualizations, custom layouts) that render live in the canvas sandbox. This makes it a space for the AI to *show* concepts visually.
- **Resizable and pop-out capable.** The canvas can be adjusted from a side pane to expanded/fullscreen. On mobile, it pops out as a full-screen overlay with a gesture or tap to return to chat.
- **Acts as a compaction/summary layer.** As conversation grows, the canvas represents the *current state* — what matters right now. It's the distilled, useful output of potentially long exchanges. You don't need to scroll back through chat to find that roast chart; it's on the canvas.

**What goes on the canvas:**
- Coffee cards being actively discussed or compared
- Roast temperature charts for reference during analysis
- Inventory tables when managing beans
- Action cards awaiting user confirmation
- Profit summaries and trend visualizations
- AI-generated code renders (charts, diagrams, custom visualizations)
- Any structured data the user wants to "pin" for reference

**What the canvas is NOT:**
- A second chat stream or message list
- A static dashboard with fixed layout
- An iframe or separate app — it's part of the same reactive state

### The Chat

The chat is the **conversation component** — the scrolling, persistent record of the dialogue between user and AI.

**Core properties:**
- **Scrolls and persists.** The conversation builds chronologically. You can always scroll up and see where you were before. It's the record keeper.
- **Primarily text-based with rich text support.** The AI's output is markdown-rendered prose — narration, reasoning, opinions, follow-up questions. This is where the AI's "voice" lives.
- **Inline references to canvas content.** When the AI places a coffee card or chart on the canvas, the chat text contains an inline reference link — a small preview thumbnail or a styled text link that highlights/focuses the corresponding canvas item on click.
- **Supports lightweight inline renders.** The AI can render small visuals inline (a mini chart, a sparkline, a small image) using markdown extensions. But anything requiring full interaction (sorting a table, editing action card fields, exploring a roast curve) lives on the canvas.
- **Drives the canvas.** Chat is cause; canvas is effect. The conversation generates the structured artifacts that populate the canvas. The user can also interact with canvas items, and those interactions feed back into the chat as context.

### The Relationship Between Surfaces

```
User types in chat: "Show me Ethiopian naturals under $9/lb"
  |
  v
AI responds in CHAT with rich text:
  "Found 4 Ethiopian naturals in your price range. I'd focus on
   these two — [☕ Yirgacheffe Kochere →] has the fruit-forward
   profile you liked last time, and [☕ Sidamo Guji →] is a sleeper
   pick at $7.80/lb with similar cupping scores."
  |
  v
Simultaneously, CANVAS populates:
  Two coffee cards rendered with full detail, tasting radar,
  pricing — positioned side by side for comparison.
  The other 2 results are available as collapsed/minimized cards.
  |
  v
User clicks [☕ Yirgacheffe Kochere →] in chat
  → Canvas highlights/focuses that card
  |
  v
User types: "Add the Kochere to my inventory, 5 lbs"
  |
  v
AI responds in CHAT:
  "Got it — here's the inventory entry. I used $8.50/lb based on
   your last Ethiopian purchase. [📋 Action: add_bean →]"
  |
  v
CANVAS transitions:
  Comparison cards slide away. Action card for add_bean_to_inventory
  takes focus with editable fields.
```

### The Rendering Model: Markdown + Block References

The AI outputs **enhanced markdown** in chat messages. Standard markdown renders as rich text. Embedded **block reference tokens** resolve to either:
- An **inline preview** in the chat (small, non-interactive — a thumbnail, a one-line summary, a link)
- A **full component** on the canvas (interactive, detailed, persistent)

This means a single assistant message might produce both chat text and canvas mutations simultaneously.

**Block reference token format in AI output:**
```
Here's a great option — {@coffee-card:1234 | Yirgacheffe Kochere}
compared to {@coffee-card:5678 | Sidamo Guji}. The Kochere has
a more complex acidity profile.

{@roast-chart:42 | Your last Ethiopian roast for reference}
```

The renderer parses these tokens and:
1. Renders an inline preview/link in the chat message
2. Sends a canvas mutation to place/update the referenced component on the canvas
3. Maintains a bidirectional link — clicking the chat reference focuses the canvas item; interacting with the canvas item can trigger chat context

### Canvas Layout Strategy

The canvas manages its own layout without scrolling. Strategies:
- **Focus + context**: One primary item in full detail, related items at reduced size around it
- **Comparison**: 2-3 items side-by-side at equal size
- **Action**: Single action card centered with supporting reference data
- **Dashboard**: Multiple KPI blocks arranged in a grid (profit summary mode)

The AI signals layout intent via a `canvasLayout` hint in its response, but the canvas component handles the actual spatial arrangement and transitions.

---

## Core Execution Principles

- The AI **proposes** actions; the **app** executes them; the **user** is the gatekeeper
- Conversations are organized as **workspaces** (not a flat chat history) — each workspace is a persistent, task-oriented environment
- The AI maintains **long-term memory** per workspace via managed context documents
- Full transparency: action cards show what function will be called + human-readable summary
- Canvas items are **interactive reference points** — users can ask follow-ups about any canvas component and the AI responds contextually
- The chat is the record; the canvas is the state

---

## Phase 0: Vercel AI SDK Migration + Type Foundation

**Goal**: Replace manual LangChain/SSE plumbing with Vercel AI SDK. Establish the GenUI type system and the rendering architecture for Chat + Canvas.

### 0.1 Install Vercel AI SDK

**File**: `coffee-app/package.json`

Add:
- `ai` (core SDK - `streamText`, tool definitions, tool execution approval)
- `@ai-sdk/svelte` (SvelteKit hooks)
- `@ai-sdk/openai` (OpenAI provider for GPT-5-mini)

Remove after migration:
- `@langchain/openai`, `langchain`

Note: AI SDK 6 includes native **tool execution approval** — the exact pattern needed for write tools in Phase 3.

### 0.2 Rewrite the chat API endpoint

**File**: `src/routes/api/chat/+server.ts` (currently 290 lines of manual SSE)

Replace the `TransformStream` + `safeWrite` + heartbeat implementation with:
```
streamText({ model, tools, messages, system }) -> result.toDataStreamResponse()
```

This eliminates ~155 lines of streaming plumbing. Auth check (`requireMemberRole`) stays as-is. The `/api/tools/*` endpoints remain unchanged — tools call them internally.

### 0.3 Rewrite the chat page client

**File**: `src/routes/chat/+page.svelte` (currently 838 lines)

Replace manual SSE parsing (lines 254-375) and `processSSEDataItem` (lines 145-233) with `useChat` from `@ai-sdk/svelte`. Eliminates ~200 lines of client streaming code.

`useChat` provides:
- `messages` - reactive message array (replaces `$state([])`)
- `input` - bound text input (replaces `inputMessage`)
- `isLoading` - loading state
- `append` - send message
- `onToolCall` - fires per tool completion (replaces `thinkingSteps` pattern)

Chain-of-thought visualization (`ChainOfThought.svelte`) is reimplemented using `onStepFinish` and `onToolCall` callbacks.

### 0.4 Refactor tool definitions

**New file**: `src/lib/services/tools.ts`

Extract the 4 tool definitions from `langchainService.ts` (lines 86-252) into Vercel AI SDK `tool()` format. Each tool:
- Keeps its Zod schema (already used)
- Keeps the HTTP calls to `/api/tools/*`
- **Returns a UIBlock** alongside raw data so the client knows how to render it
- **Includes a `canvasTarget` flag** indicating whether this block should render on the canvas

**Critical design change**: Currently the AI decides which coffee IDs to put in its `coffee_cards` JSON field, then the API fetches full data. With genUI, **tools produce UI blocks directly**. When `coffee_catalog_search` returns coffees, it produces a `coffee-cards` UIBlock targeted at the canvas. The AI narrates around it in the chat using block reference tokens.

### 0.5 Define GenUI type system

**New file**: `src/lib/types/genui.ts`

```typescript
// Where a block should render
type BlockTarget = 'canvas' | 'chat-inline' | 'both';

// Layout hint for canvas arrangement
type CanvasLayout = 'focus' | 'comparison' | 'action' | 'dashboard';

type UIBlock =
  | { type: 'coffee-cards'; version: 1; data: CoffeeCatalog[]; focusId?: number }
  | { type: 'inventory-table'; version: 1; data: GreenCoffeeInv[] }
  | { type: 'roast-chart'; version: 1; data: { roastId: number } }
  | { type: 'roast-comparison'; version: 1; data: { roastIds: number[] } }
  | { type: 'profit-summary'; version: 1; data: ProfitMetrics }
  | { type: 'tasting-radar'; version: 1; data: TastingData }
  | { type: 'data-table'; version: 1; data: { columns: Column[]; rows: unknown[] } }
  | { type: 'action-card'; version: 1; data: ActionCardPayload }
  | { type: 'bean-form'; version: 1; data: Partial<BeanFormData> }
  | { type: 'roast-form'; version: 1; data: Partial<RoastFormData> }
  | { type: 'sale-form'; version: 1; data: Partial<SaleFormData> }
  | { type: 'code-render'; version: 1; data: { code: string; language: string } }
  | { type: 'error'; version: 1; data: { message: string; retryable: boolean } }

// Action cards show function name + human-readable summary
interface ActionCardPayload {
  functionName: string;
  summary: string;
  parameters: Record<string, unknown>;
  status: 'proposed' | 'confirmed' | 'executing' | 'success' | 'failed';
}

// Canvas state management
interface CanvasState {
  blocks: CanvasBlock[];
  layout: CanvasLayout;
  focusBlockId?: string;
}

interface CanvasBlock {
  id: string;              // Unique ID for block reference tokens
  block: UIBlock;
  target: BlockTarget;
  position?: 'primary' | 'secondary' | 'minimized';
  addedAt: number;         // Timestamp for ordering
}

// Canvas mutation — what the AI sends to modify canvas state
type CanvasMutation =
  | { action: 'add'; block: CanvasBlock }
  | { action: 'remove'; blockId: string }
  | { action: 'focus'; blockId: string }
  | { action: 'clear' }
  | { action: 'layout'; layout: CanvasLayout };
```

All UIBlocks include a `version` field from day one for schema evolution on persisted data.

### 0.6 Block reference token parser

**New file**: `src/lib/utils/blockTokenParser.ts`

Parses the AI's markdown output for block reference tokens like `{@coffee-card:1234 | Yirgacheffe Kochere}` and resolves them into:
- An inline preview component in the chat (small card thumbnail, styled link)
- A canvas mutation to place/update the full component

The parser integrates with the existing markdown renderer (`@humanspeak/svelte-markdown`) as a custom token/plugin.

### 0.7 System prompt design

The system prompt is the primary lever for the design philosophy. It must instruct the AI to:
- **Narrate in chat, render on canvas.** The AI's text goes in the chat. Structured data goes on the canvas. The chat references canvas items using block tokens.
- **Editorialize in natural language.** "This is overpriced for what you get" hits differently than a 🏷️ "Budget Alert" pill. Opinions and annotations belong in the AI's prose, not in UI badges.
- **Manage the canvas as a whiteboard.** When the conversation focus shifts, the AI should update the canvas — add relevant items, remove stale ones, change the layout. The canvas reflects the *current* state of the discussion, not its history.
- **Use block references naturally.** Wrong: "I've placed some cards on the canvas." Right: "The [☕ Yirgacheffe Kochere →] has the profile you're looking for — compare it against the [☕ Sidamo Guji →] on price alone and it's a no-brainer."
- **Signal layout intent.** When comparing coffees, hint `comparison` layout. When an action card is ready, hint `action` layout. The canvas handles the visual arrangement.

### Phase 0 risks & challenges
- Verify `gpt-5-mini-2025-08-07` compatibility with `@ai-sdk/openai` provider
- The system prompt (65 lines in langchainService.ts) needs significant revision: remove rigid JSON format, add canvas awareness, instruct the AI to narrate in chat and render on canvas
- `BufferMemory` is replaced by passing `messages` array directly. Simpler but loses auto-summarization (addressed in Phase 2 with workspace memory)
- **Block reference token design** needs iteration — the format must be intuitive for the LLM to generate reliably and parseable without ambiguity
- **Canvas state synchronization** between AI responses and client-side canvas is a new reactive challenge

---

## Phase 1: Canvas Shell + GenUI Component Registry

**Goal**: Build the two-surface layout (chat + canvas), implement the component catalog, and get the first UIBlocks rendering. First visible genUI capability.

**Design imperative**: The canvas must feel like a natural extension of the conversation, not a bolted-on panel. The transition between chat reference and canvas component should be seamless.

### 1.1 Canvas component

**New file**: `src/lib/components/canvas/Canvas.svelte`

The canvas container component:
- **Non-scrolling layout** with spatial arrangement of blocks
- **Resizable** via drag handle between chat and canvas panes (desktop), with minimum/maximum width constraints
- **Pop-out / fullscreen mode** (especially critical for mobile — the canvas overlays the chat with a gesture/tap to return)
- **Empty state** — when no blocks are on the canvas, show a subtle prompt: "Start a conversation and I'll put useful reference material here."
- **Transition animations** — blocks appear, reposition, and fade out smoothly as the AI mutates the canvas

### 1.2 Canvas state store

**New file**: `src/lib/stores/canvasState.ts`

Svelte store managing:
- Current `CanvasBlock[]` — what's rendered on the canvas
- Current `CanvasLayout` — how blocks are spatially arranged
- `focusBlockId` — which block has primary focus
- Mutation handler that processes `CanvasMutation` events from AI responses
- Bidirectional link registry — maps block IDs to their chat message sources (so clicking a chat reference can focus a canvas block, and vice versa)

### 1.3 Canvas layout engine

**New file**: `src/lib/components/canvas/CanvasLayout.svelte`

Implements the four layout strategies:
- **Focus + context**: Primary block takes ~60% of canvas space, secondary blocks arranged as smaller tiles
- **Comparison**: 2-3 blocks at equal size, side-by-side (or stacked on narrow canvas)
- **Action**: Single action card centered, supporting reference blocks at reduced size
- **Dashboard**: Grid layout for multiple KPI blocks

Layout transitions are animated. The AI signals layout intent; the engine handles responsive sizing.

### 1.4 GenUI block renderer

**New file**: `src/lib/components/genui/GenUIBlockRenderer.svelte`

Dispatcher component mapping `UIBlock.type` to Svelte components. Used by both the canvas (full interactive version) and the chat (inline preview version):

```svelte
{#if block.type === 'coffee-cards'}
  {#if renderMode === 'canvas'}
    <CoffeeCardsBlock coffees={block.data} {onAction} />
  {:else}
    <CoffeeCardPreview coffee={block.data[0]} {onCanvasFocus} />
  {/if}
{:else if block.type === 'roast-chart'}
  ...
```

Every canvas block receives `onAction` callback for user interactions. Actions feed back into chat conversation context — the block becomes a **shared reference point** the user and AI can discuss.

### 1.5 Individual block components

**New files under `src/lib/components/genui/blocks/`**:

Each block has **two render modes**: full (canvas) and preview (chat inline).

| Component | Canvas render | Chat preview | Source |
|-----------|--------------|--------------|--------|
| `CoffeeCardsBlock.svelte` | Full card with image, tasting notes, pricing, actions | Small thumbnail + name + one-line summary | Extract from `ChatMessageRenderer.svelte` |
| `InventoryTableBlock.svelte` | Full sortable table with stocked indicators | Row count + highlight metric | New, inspired by `/beans` |
| `RoastChartBlock.svelte` | Full D3.js temperature curve, interactive | Mini sparkline or static thumbnail | Adapt from `/roast` |
| `TastingRadarBlock.svelte` | Full radar chart | Small inline radar | Wrap existing `TastingNotesRadar.svelte` |
| `ProfitSummaryBlock.svelte` | Revenue, costs, margin cards + trend chart | Single KPI number | Extract from `/profit` |
| `DataTableBlock.svelte` | Full sorted/filtered table | Row count summary | New generic component |
| `RoastComparisonBlock.svelte` | Side-by-side roast profiles | "Comparing N roasts" link | New |
| `CodeRenderBlock.svelte` | Live rendered code output (charts, visualizations) | Code snippet preview | New |
| `ActionCardBlock.svelte` | Full editable action card with execute/edit/cancel | Action summary badge with status | New (Phase 3 primary) |

### 1.6 Chat message renderer with block references

**File**: `src/lib/components/ChatMessageRenderer.svelte` (131 lines → rewrite)

Refactor to:
1. Parse AI markdown output through the block token parser (§0.6)
2. Render standard markdown via `@humanspeak/svelte-markdown`
3. Resolve `{@block-type:id | label}` tokens into inline preview components
4. Emit canvas mutations for referenced blocks

The renderer supports **interleaved content** — a message might be: text paragraph → inline coffee card preview → more text → inline chart sparkline → concluding paragraph. The chat text *is* rich, but the heavy interactive components live on the canvas.

### 1.7 Block visual language

**Critical to get right in Phase 1 — this sets the tone for everything.**

**Canvas blocks:**
- Clean, branded components with enough chrome to be clearly interactive
- Consistent visual language across block types (shared typography, spacing, color palette)
- Clear focus state for the primary block
- Minimized state for secondary blocks (collapse to a title bar + key metric)

**Chat inline previews:**
- **Minimal chrome.** Barely distinguishable from formatted text until hovered/tapped
- Styled as inline links/badges that feel like part of the AI's prose
- On click/tap, they focus the corresponding canvas block
- Subtle visual connection (color accent, icon) linking preview to its canvas counterpart

**The seamless connection:**
- When a chat preview is hovered, the canvas subtly highlights the corresponding block
- When a canvas block is clicked, the chat scrolls to (or highlights) the message that introduced it

### 1.8 Mobile-responsive layout

- **Desktop**: Side-by-side panes, resizable divider
- **Tablet**: Side-by-side with smaller canvas, or toggle between views
- **Mobile**: Chat is default view. Canvas pops out as a fullscreen overlay. A persistent "canvas indicator" bar at the top shows how many items are on the canvas and opens it on tap.

### Phase 1 risks & challenges
- D3.js roast chart from `/roast` likely has page-level dependencies. GenUI version must be self-contained.
- **Canvas layout engine** is real engineering work — spatial arrangement, responsive sizing, animated transitions. Don't underestimate this.
- **Block reference token reliability**: The LLM needs to generate `{@...}` tokens consistently. Prompt engineering + output validation required.
- **Two render modes per component** doubles the component surface area. Use shared data/logic layers with separate presentation components to manage this.
- Streaming blocks: tool results arrive progressively. Canvas shows loading skeletons; chat shows preview placeholders.
- **Mobile canvas UX** needs careful attention — the pop-out overlay must feel smooth and not disorienting.

---

## Phase 2: Workspace Model + Persistent Memory

**Goal**: Replace throwaway chat history with persistent workspaces. Each workspace maintains AI memory across sessions and persists its canvas state.

### 2.1 Workspace concept

Instead of a flat list of past conversations, the app has **pre-defined workspace categories**:

| Workspace | Focus | Default tools | Default canvas layout |
|-----------|-------|---------------|----------------------|
| **Sourcing** | Browse catalog, compare coffees, track availability | coffee_catalog_search, bean_tasting_notes | comparison |
| **Roasting** | Roast profiles, temperature analysis, comparisons | roast_profiles, green_coffee_inventory | focus |
| **Inventory** | Bean management, costs, stock levels | green_coffee_inventory, coffee_catalog_search | dashboard |
| **Analysis** | Profit tracking, trends, tasting notes | roast_profiles, bean_tasting_notes, profit tools | dashboard |

Each workspace:
- Has its own conversation thread (messages persist in chat)
- Maintains a **context document** (the "WORKSPACE.md" equivalent) that summarizes key insights, decisions, and patterns across all sessions
- **Restores its canvas state** when the user returns — the canvas shows what was relevant at the end of the last session
- Knows which tools are most relevant (passed as priority hints in the system prompt)

Workspaces are structure *for* progressive disclosure (Design Philosophy §2) — they scope the AI's focus so it can go deeper faster. But within a workspace, the AI unfolds complexity organically through conversation, crystallizing results onto the canvas.

### 2.2 Database schema

**Supabase migration**:

```sql
CREATE TABLE workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES user_roles(id),
  type TEXT NOT NULL CHECK (type IN ('sourcing', 'roasting', 'inventory', 'analysis')),
  context_summary TEXT DEFAULT '',       -- The "WORKSPACE.md" - AI-maintained summary
  canvas_state JSONB DEFAULT '{}',       -- Persisted canvas blocks + layout
  last_accessed_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE workspace_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system', 'tool')),
  content TEXT NOT NULL,
  canvas_mutations JSONB DEFAULT '[]',   -- Canvas mutations this message triggered
  tool_calls JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Global user context - the "AGENT.md" equivalent
CREATE TABLE user_ai_context (
  user_id TEXT PRIMARY KEY REFERENCES user_roles(id),
  global_summary TEXT DEFAULT '',        -- Cross-workspace preferences & patterns
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

With RLS policies scoping to authenticated user.

**Key change from original plan**: `canvas_state` replaces `workspace_state` and `ui_blocks` on messages becomes `canvas_mutations`. The canvas state is the "current snapshot" persisted at workspace level; mutations on messages are the history of how it got there.

### 2.3 Memory architecture

**System prompt composition per request:**
```
[base system prompt + design philosophy + canvas instructions]
[global user context from user_ai_context.global_summary]
[workspace context from workspaces.context_summary]
[current canvas state summary — what blocks are currently on the canvas]
[last N full messages from workspace_messages]
```

The canvas state summary is critical — it tells the AI what the user is currently *looking at*, enabling contextual awareness without re-scanning the full message history.

Memory is what enables the AI to be a genuine advisor rather than a stateless chatbot. With workspace memory, the AI can say "last time you roasted this Ethiopian, you dropped at 405°F and liked the result" — that's the kind of contextual intelligence that makes the interface feel like a knowledgeable colleague.

**Context compaction strategy:**
- After each conversation session (user leaves workspace or after N exchanges), run a summarization pass using the AI itself
- The summarization prompt: "Given these recent messages and the existing workspace summary, update the summary with new key facts, decisions, and insights. Keep it concise."
- The updated summary replaces `workspaces.context_summary`
- Older messages beyond N stay in the database but aren't sent to the model
- N starts at ~20 message pairs; adjust based on model context limits
- The global `user_ai_context.global_summary` updates less frequently (weekly or when cross-workspace patterns emerge)
- **Canvas state is also persisted** — when the user returns to a workspace, the canvas is restored to its last state

This is intentionally simple — no external memory services, no vector retrieval. Just managed text documents in Supabase that the AI reads and updates. Can upgrade to [Letta](https://github.com/letta-ai/vercel-ai-sdk-provider) or [Mem0](https://docs.mem0.ai/integrations/vercel-ai-sdk) later if needed.

### 2.4 Workspace management API

**New files**:
- `src/routes/api/workspaces/+server.ts` - List/create workspaces
- `src/routes/api/workspaces/[id]/+server.ts` - Get workspace + recent messages + canvas state
- `src/routes/api/workspaces/[id]/messages/+server.ts` - Append messages
- `src/routes/api/workspaces/[id]/canvas/+server.ts` - Persist canvas state
- `src/routes/api/workspaces/[id]/summarize/+server.ts` - Trigger context compaction

### 2.5 Workspace UI

**File**: Update `src/routes/chat/+page.svelte`

Replace the current single-conversation view with a workspace selector:
- Workspace tabs or cards at the top (Sourcing, Roasting, Inventory, Analysis)
- Each workspace restores its chat history AND canvas state when selected
- The chat scrolls within the workspace; the canvas repopulates
- The workspace context summary is visible (collapsible) so the user can see what the AI "remembers"

### Phase 2 risks & challenges
- **Canvas state serialization**: Persisted canvas blocks may reference stale data (e.g., coffee prices changed). Include a "refresh" action on canvas blocks and a staleness indicator.
- **Canvas state size**: A complex canvas with many blocks could produce large JSONB. Keep canvas state lean — store block IDs and fetch data on render, rather than persisting full data payloads.
- **Summarization quality**: The AI summarizing its own conversations can lose important details. Let users edit the workspace summary manually as a safety valve.
- **Context window math**: Global summary (~500 tok) + workspace summary (~1000 tok) + canvas state summary (~500 tok) + 20 messages (~8k tok) + system prompt (~2.5k tok) = ~12.5k tokens. Still plenty of room.

---

## Phase 3: Write Tools + Action Cards

**Goal**: The AI can propose data mutations. The user reviews, optionally edits, and executes. The AI never touches the database directly.

**Design imperative**: Action cards render on the **canvas** in `action` layout — they're the primary focus when a write operation is proposed. The chat contains the AI's narration and a reference link to the action card. This separation is important: the conversation explains *why*; the canvas shows *what* and lets you *act*.

### 3.1 The execution model

```
User types in chat: "Add that Ethiopia Natural to my inventory, 5 pounds at $8.50/lb"
  |
  v
AI responds in CHAT:
  "Got it — here's the inventory entry ready to go. The catalog
   match is the Yirgacheffe Natural from Sweet Maria's. I used
   $8.50/lb since that's what you paid last time for their
   Ethiopians. [📋 Action: add_bean →]
   Hit execute when it looks right, or tweak anything that's off."
  |
  v
CANVAS transitions to action layout:
  Action card for add_bean_to_inventory takes focus.
  Previous coffee card(s) stay visible as secondary context.
  |
  v
User clicks Execute on the CANVAS action card
  → App calls POST /api/chat/execute-action (NOT the AI)
  → Canvas action card status updates: proposed → executing → success
  |
  v
AI follows up in CHAT:
  "Done — 5 lbs added. You've got enough for about 4 roast sessions
   at your usual batch size. Want to set up a roast profile for it?"
  |
  v
CANVAS transitions:
  Action card shows success state, then fades to secondary.
  If user continues, next relevant blocks take focus.
```

**The AI has zero write access.** It only produces structured proposals. The `execute-action` endpoint is the single security boundary.

### 3.2 Write tool definitions

Added to `src/lib/services/tools.ts`:

| Tool | Description | Existing API |
|------|-------------|-------------|
| `add_bean_to_inventory` | Propose adding coffee to user's inventory | `POST /api/beans` |
| `update_bean` | Propose updating bean details | `PUT /api/beans?id=X` |
| `create_roast_session` | Propose creating a roast profile | `POST /api/roast-profiles` |
| `update_roast_notes` | Propose updating roast notes | `PUT /api/roast-profiles?id=X` |
| `record_sale` | Propose recording a sale | `POST /api/profit` |

Each tool returns an `action-card` UIBlock targeted at the canvas. It does NOT execute the write.

### 3.3 Action Card component

**New file**: `src/lib/components/genui/blocks/ActionCardBlock.svelte`

**Canvas render** (primary):
- Function name (small, de-emphasized — transparency without visual noise)
- Human-readable summary (the headline)
- Editable parameter fields (using existing form type schemas from `component.types.ts` lines 40-75)
- Execute / Edit / Cancel buttons
- State machine: `proposed -> confirmed -> executing -> success | failed`
- On failure: show error inline with retry option

**Chat preview**:
- Action summary badge with status indicator
- One-line description
- Click to focus the canvas action card

**Visual design**: The action card is the one block type that *should* have more chrome than others — it represents a consequential action and the user needs to clearly see the boundary of what they're approving. But it should still feel like the AI's confident recommendation, not a modal dialog.

### 3.4 Action execution endpoint

**New file**: `src/routes/api/chat/execute-action/+server.ts`

Security-critical chokepoint:
1. Validates session + role (`requireMemberRole`)
2. Validates action against whitelist of allowed function names
3. Verifies resource ownership (same patterns as existing PUT/DELETE endpoints)
4. Executes via Supabase client directly
5. Triggers side effects (e.g., `updateStockedStatus` when adding beans)
6. Returns result for canvas action card status update

### 3.5 System prompt for write tools

Add constraints:
- Always propose changes, never execute directly
- Show all relevant details in the proposal
- Don't change fields the user didn't mention
- No bulk deletes (one record at a time)
- Always verify target record exists before proposing changes
- **Place action cards on the canvas** with supporting context; narrate the reasoning in chat
- After successful execution, suggest logical next steps

### Phase 3 risks & challenges
- **Existing form types are ready**: `SalesFormData`, `RoastFormData`, `CoffeeFormData` in `component.types.ts` lines 40-75 are the schemas for action card editable fields. Reuse them directly.
- **Stocked status cascade**: When adding/removing beans, `updateStockedStatus` from `stockedStatusUtils.ts` must run. The execute-action endpoint must trigger the same side effects as existing API endpoints.
- **Canvas state during writes**: The action card lifecycle (proposed → executing → success) must update canvas state reactively. Handle optimistic updates and rollbacks.
- **AI hallucination**: The AI might propose adding a coffee with incorrect details. The editable fields in the canvas action card are the safety net.
- **Vercel AI SDK 6 tool approval**: Evaluate if the built-in approval flow can complement the custom action card pattern.

---

## Phase 4: Context Awareness + AI-First Navigation

**Goal**: The genUI page becomes the primary app. The AI proactively surfaces relevant content and progressively replaces standalone pages.

This is where the Chat + Canvas architecture fully pays off. The canvas becomes the user's primary workspace; the chat becomes the way they drive it. Old page-based navigation becomes a fallback.

### 4.1 Canvas context awareness

**New file**: `src/lib/stores/canvasContext.ts`

Reactive store tracking:
- Currently rendered canvas blocks and their data
- User's recent interactions with canvas items (clicked a card, expanded a row, hovered a data point)
- Active filters/search parameters
- Canvas layout mode

This context is included in every AI request so the AI knows what the user is *looking at* on the canvas. This enables responses like "why did you rank this higher?" or "what about the second one?" — the AI knows what "this" and "second one" refer to because it can see the canvas state.

### 4.2 Proactive suggestions

Based on canvas + conversation context, the AI surfaces suggestion chips:
- Just added a bean to canvas → "Create a roast profile?"
- Roast comparison on canvas → "Compare tasting notes?"
- Haven't roasted a bean in inventory → "You have 3 lbs of Ethiopia Natural unroasted"
- Canvas is empty → Subtle workspace-appropriate suggestion

These are subtle prompts that feel like the AI *noticing* something, not push notifications.

### 4.3 Quick commands

Slash commands for common actions (syntactic sugar over tool calls):
- `/beans` → render inventory table on canvas
- `/roast [name]` → show matching roast profiles on canvas
- `/add [coffee]` → start add-bean flow (action card on canvas)
- `/compare [roast1] [roast2]` → side-by-side comparison on canvas
- `/profit` → show profit summary dashboard on canvas
- `/clear` → clear canvas
- `/pin` → pin current canvas state (prevent auto-transitions)

### 4.4 Progressive page sunset

As genUI blocks mature, make the chat+canvas page the default for members:
- `/catalog` → Sourcing workspace with coffee-cards + data-table on canvas
- `/beans` → Inventory workspace with inventory-table on canvas, CRUD via action cards
- `/roast` → Roasting workspace with roast-chart on canvas
- `/profit` → Analysis workspace with profit-summary dashboard on canvas

Old pages can remain as fallback/read-only views but the primary workflow moves to Chat + Canvas.

### 4.5 Multi-step workflows

The AI orchestrates chained operations — the canvas evolves through each step:

"I just received my Sweet Maria's order — 5 lbs Ethiopia Natural for $42"

1. **AI searches catalog** → Chat: "Found it — this is the Yirgacheffe Natural, same one you roasted last month." with inline reference → Canvas: coffee card appears in focus layout
2. **AI proposes inventory entry** → Chat: "At $8.40/lb that's right in line with your last Ethiopian purchase." with action reference → Canvas: transitions to action layout, action card takes focus, coffee card stays as secondary reference
3. **User confirms** → Canvas: action card shows success → Chat: "Done — 5 lbs added."
4. **AI follows up** → Chat: "You liked your last light roast of this at 405°F first crack. Want to set up a similar roast session?" → Canvas: coffee card updated with inventory status, subtle suggestion chip
5. **User says yes** → Chat: narration about roast profile → Canvas: transitions to roast-form action card pre-populated with preferred parameters

### 4.6 Canvas pinning and manual curation

Users can:
- **Pin canvas items** to prevent auto-removal when conversation shifts
- **Manually remove** items from the canvas
- **Rearrange** items (drag to reorder/resize)
- **Minimize** items to title-bar state
- These manual overrides persist and the AI respects them (if the user pinned a coffee card, the AI doesn't remove it)

### 4.7 Artisan import through chat

The existing `/api/artisan-import` endpoint can be exposed as a tool: "Import my latest Artisan roast" triggers file upload + parsing + roast profile creation, with the resulting roast chart rendered on the canvas.

---

## Opportunities & Things to Watch

1. **D3.js roast charts on the canvas is the killer feature**. No coffee app renders interactive temperature curves in a collaborative workspace. Ship this in Phase 1 for maximum impact.

2. **The `/api/tools/*` endpoints are already perfectly structured for genUI**. They return clean JSON with metadata. Minimal changes needed to produce UIBlocks.

3. **`@google/generative-ai` is installed but unused**. Gemini could serve as a fast/cheap model for simple queries (status lookups, quick calculations) while GPT-5-mini handles complex multi-tool orchestration. Dual-model routing reduces latency and cost.

4. **The `shared_links` table** already supports sharing beans. Extend to share workspace snapshots — canvas state + context summary — so users can share roast advice with each other.

5. **The `detectStructuredFields` function** (lines 410-446 of `+page.svelte`) is a proto-UIBlock system. Delete it entirely once explicit UIBlock typing is in place.

6. **Workspace memory is the moat**. Any chat app can render cards. An AI that remembers "last time you roasted this Ethiopian, you dropped at 405°F and liked the result" AND restores the canvas with relevant context across sessions — that's genuinely useful and builds lock-in.

7. **The canvas as "persistent distillate" is a competitive differentiator.** Most AI chat apps lose structured content as you scroll. The canvas means your current working state is always visible. This is the Chat+ pattern done right — not a sidepanel bolted on, but a collaborative whiteboard driven by conversation.

8. **Code render blocks on canvas** open up creative possibilities — the AI can generate custom D3 visualizations, comparison tables with custom formatting, or even mini-apps for specific analysis tasks. The canvas is a sandbox.

9. **A2UI / declarative UI compatibility**. The block reference token system and canvas mutations align conceptually with Google's A2UI pattern (declarative JSON, client-owned rendering). If A2UI matures to v1.0, the architecture could adopt it as the wire format without changing the canvas rendering layer.

---

## Key Challenges to Address

1. **Vercel serverless timeout** (4.5 min): Multi-tool chains are constrained. Vercel AI SDK streaming keeps connections alive better. For multi-step write workflows, break into separate request cycles.

2. **UIBlock schema evolution**: Persisted blocks (in canvas state and messages) need the `version` field. Build a migration/render-fallback system so old blocks still render after schema changes.

3. **Context window management**: Global summary (~500 tok) + workspace summary (~1k tok) + canvas state (~500 tok) + 20 messages (~8k tok) + system prompt (~2.5k tok) = ~12.5k tokens. Plenty of room, but monitor as conversations grow.

4. **Mobile performance**: D3.js charts and large tables are heavy. Lazy-render canvas blocks. The pop-out canvas overlay must feel smooth.

5. **Authorization boundary**: Write tools via action cards must enforce the same ownership checks as existing API endpoints. The `execute-action` endpoint is the single chokepoint — audit it carefully.

6. **Canvas layout engine complexity**: Spatial arrangement, responsive sizing, animated transitions, minimize/maximize states, pinning, manual rearrangement — this is a real engineering investment. Consider building on a layout library rather than from scratch.

7. **Block reference token reliability**: The LLM must generate `{@type:id | label}` tokens consistently. Test extensively with real queries. Have a graceful fallback if the token is malformed (render as plain text).

8. **Canvas-chat synchronization**: The canvas and chat must stay in sync reactively. If the user scrolls back in chat and clicks an old reference, the canvas should handle the case where that block no longer exists (show a "this item has been replaced" message, or offer to restore it).

9. **System prompt complexity**: The prompt now needs to teach the AI about two surfaces, canvas management, block reference tokens, and layout hints — in addition to all the existing tool and domain instructions. Keep it structured and testable.

---

## Build Order

```
Phase 0  (Vercel AI SDK + types + rendering arch)    -- foundation, no user-visible changes
   |
Phase 1  (canvas shell + block components)            -- first visible genUI
   |                                                     DESIGN CHECKPOINT: does the canvas
   |                                                     feel like a whiteboard or a sidebar?
   |
Phase 2  (workspaces + persistent memory + canvas)    -- makes it feel like an app, not a chat
   |
Phase 3  (write tools + action cards on canvas)       -- full CRUD through AI proposals
   |
Phase 4  (context awareness + navigation)             -- AI-first platform, sunset pages
```

Each phase is independently shippable. Phase 0+1 together is the minimum viable genUI.

**Phase 1 design checkpoint**: After Phase 1 ships, do a gut-check. Show it to someone who hasn't seen the plan. If they say "oh cool, your chatbot has a sidebar" — the canvas isn't working. If they say "whoa, the AI is building a workspace while we talk" — you've nailed it.

---

## Verification Plan

After each phase:
1. `pnpm check` - TypeScript compilation
2. `pnpm build` - Production build
3. `pnpm test` - Existing tests pass
4. Manual testing: 5-10 representative chat queries, verify streaming, canvas blocks render, chat references link correctly
5. Mobile testing: canvas pop-out behavior, responsive layouts, touch targets
6. **Design philosophy check**: Does the canvas feel like a distillate or a dump? Does chat narrate or announce? Do references connect the surfaces seamlessly?
7. For Phase 3: test confirm/cancel/edit flows on canvas, verify data integrity, test error recovery
8. For Phase 2: test workspace switching, verify canvas state persists across page refresh, test summarization
9. **Canvas stress test**: What happens with 8+ blocks? Does layout degrade gracefully? Does the AI manage canvas clutter or let it grow indefinitely?

---

## Critical Files Reference

| File | Current | Role in plan |
|------|---------|-------------|
| `src/routes/api/chat/+server.ts` | 290 lines, manual SSE | Rewrite with Vercel AI SDK (Phase 0) |
| `src/lib/services/langchainService.ts` | 833 lines, LangChain agent | Extract tools, replace with AI SDK (Phase 0) |
| `src/routes/chat/+page.svelte` | 838 lines, manual SSE parsing | Simplify with `useChat`, add Chat+Canvas layout (Phase 0+1) |
| `src/lib/components/ChatMessageRenderer.svelte` | 131 lines | Refactor for markdown + block reference tokens (Phase 1) |
| `src/lib/types/component.types.ts` | 307 lines, form types | Reuse form schemas for action cards (Phase 3) |
| `src/lib/components/ChainOfThought.svelte` | 191 lines | Reimplement with AI SDK callbacks (Phase 0) |
| `src/lib/services/ragService.ts` | 418 lines, disabled | Keep disabled until embedding data has unique value |
| **New**: `src/lib/components/canvas/Canvas.svelte` | — | Canvas container + resize + pop-out (Phase 1) |
| **New**: `src/lib/stores/canvasState.ts` | — | Canvas state management + mutations (Phase 1) |
| **New**: `src/lib/types/genui.ts` | — | UIBlock + CanvasState + CanvasMutation types (Phase 0) |
| **New**: `src/lib/utils/blockTokenParser.ts` | — | Block reference token parser (Phase 0) |
