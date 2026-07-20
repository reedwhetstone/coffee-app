# Purveyors Intelligence-First Chat Layer

**Tags:** #idea #purveyors #coffee #product-strategy #chat #genui
**Related:** [[MOC-coffee-platform]]; [[moonshots/2026-04-16-purveyors-copilot-network]]; [[references/b2cc-agents-as-customers]]
**Created:** 2026-05-09

## Thesis

The Purveyors chat layer should be treated as a core intelligence surface, not as a Mallard Studio-only assistant. Mallard Studio can become an operational add-on for roast management, roast logs, and related execution workflows, while the broader intelligence product owns the primary chat, CLI, and GenUI direction.

## Product framing

Purveyors is better understood as an intelligence workspace for coffee decisions than as a roast-logging product with chat bolted on. Green coffee inventory should therefore be modeled first as a personal and research catalog: coffees currently owned, coffees being tracked, coffees under consideration, and coffees relevant to future sourcing decisions.

Mallard Studio then becomes a workflow pack layered on top of that inventory and intelligence foundation. It can manage roasts, update roast logs, and connect sourcing context to production execution, but it should not obscure the more general intelligence value of chat.

## Implications

- Chat should be available and useful for intelligence users even if they never use Mallard Studio.
- CLI tools should continue to prioritize intelligence workflows: catalog search, saved research, inventory context, recommendations, comparisons, alerts, and provenance-backed explanations.
- GenUI should start from intelligence workspaces: research boards, coffee comparison cards, sourcing briefs, watchlists, inventory timelines, and recommendation explanations.
- Roast-management actions should be exposed as one specialized capability family rather than defining the whole assistant.
- Product copy should avoid making chat feel like a studio feature hidden behind roast operations. It should read as the primary interface to Purveyors intelligence.

## Architectural consequence

The clean boundary is likely:

1. **Core intelligence layer:** catalog, inventory, watchlists, saved briefs, analytics, chat, CLI, API, GenUI components, provenance, and recommendations.
2. **Mallard Studio add-on:** roast plans, roast logs, cupping/tasting loops, production history, and links back into sourcing intelligence.

This preserves one shared action substrate while allowing two product emphases. The difficult part is not whether both users need chat; they do. The hard part is keeping chat grounded in the same primitives while changing the default tools, prompts, UI cards, and next actions by workspace context.

## Strategy test

Future chat, CLI, and GenUI work should ask:

- Does this strengthen the intelligence workspace for sourcing and coffee research, not only roast operations?
- Is the action reusable through CLI/API/shared functions rather than web-only assistant logic?
- Can Mallard Studio use this as an add-on capability without forcing non-studio users into roast-centric workflows?
- Does the UI make the intelligence product feel primary?
