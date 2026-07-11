# Why the Context Window Needs a Garbage Collector

## Pillar

- Agentic Stack

## Thesis

Persistent memory solves forgetting, but it creates contextual inertia. A continuous project conversation should not mean that every prior task remains equally active. The missing layer is an intent-aware, bidirectional context compiler: preserve immutable history, promote durable residue into memory, evict displaced context, retrieve newly relevant evidence, and compile a task-specific working set for the main model.

## Target

- Under 1,200 body words
- First-person, technical, HN-friendly
- OpenClaw as one illustration, not a product pitch

## Argument

1. Long context looks like intelligence until the conversation pivots.
2. The failure is contextual inertia: continuity of conversation is mistaken for continuity of intent.
3. Summarization, RAG, and trimming each solve only part of the problem.
4. The needed system behaves like a semantic garbage collector and bidirectional context compiler.
5. Intent transitions change the active root set: continue, modify, challenge, branch, replace, resume, or discuss at the meta level.
6. History must remain immutable because the compiler is a hidden editor capable of laundering mistakes into apparent coherence.
7. The practical target is continuous conversational UX with disposable, provenance-preserving context projections.

## Sources

- MemGPT, virtual context management: https://arxiv.org/abs/2310.08560
- Letta archival memory: https://docs.letta.com/guides/core-concepts/memory/archival-memory
- Anthropic context editing: https://platform.claude.com/docs/en/build-with-claude/context-editing
- OpenAI compaction: https://developers.openai.com/api/docs/guides/compaction

## Verification

- [x] Confirm all four external links resolve and support the adjacent claims.
- [x] Keep ordinary summarization, RAG, trimming, and the proposed compiler conceptually distinct.
- [x] Do not claim OpenClaw currently implements the complete architecture.
- [x] Verify body word count is below 1,200, excluding frontmatter.
- [x] Verify `draft: false`, valid pillar, reading time, and date.
- [x] Verify no em dashes appear.
- [x] Verify every named source has an inline Markdown link.
- [x] Verify the immutable-history and provenance requirements are explicit.
- [x] Verify the conclusion does not turn into a product pitch or manifesto.
