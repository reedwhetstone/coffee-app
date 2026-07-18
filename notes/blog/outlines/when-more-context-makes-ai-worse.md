# When Does More Context Make an AI Worse?

## Pillar

- Agentic Stack

## Thesis

Persistent memory solves forgetting, but it creates contextual inertia. The problem is not storage capacity; it is deciding which parts of history retain semantic authority after the user's intent changes. Long-running agents need an intent-aware context compiler that preserves immutable history while producing a disposable, task-specific working set.

## Argument-role map

- **Central thesis:** More context can make an AI worse when stale conversational history retains authority after the task changes.
- **Mechanism:** A context compiler cold-reads the new turn, classifies its relationship to prior work, preserves durable residue, retrieves newly relevant evidence, and constructs the active working set before execution.
- **Coequal benefits:** Continuous conversation remains convenient for the person; selective activation reduces task interference for the model; immutable history and provenance make the projection auditable.
- **Examples:** A shift from deployment debugging to product strategy; OpenClaw workflow state remaining operationally relevant during a conversational pivot.
- **AI-specific application:** Separating intent interpretation from task execution can reduce trajectory-preserving agreement and task-switch interference.
- **Limitation:** The compiler becomes a hidden editor that can suppress evidence or promote tentative claims before the main model reasons.
- **Excluded branches:** Model training, a detailed RAG implementation, cognitive-science claims about human memory, and a broad theory of AI governance.
- **Novelty posture:** Synthesis and application. Context editing, compaction, task-interference research, and mediator architectures already exist; the post connects them through semantic authority and provenance during intent transitions.

## Target

- Under 1,200 body words
- First-person, technical, HN-friendly
- OpenClaw as one illustration, not a product pitch

## Argument

1. Long context looks like intelligence until the conversation pivots.
2. Task-switch research grounds contextual inertia as a measurable failure, not merely an anecdote.
3. Context editing and compaction manage volume; mediator architectures get closer to intent interpretation.
4. The synthesis is an intent-aware compiler that changes activation without deleting history.
5. A cold-read comparison helps detect when continuity is distorting the latest request.
6. Immutable history and provenance constrain the compiler's power as a hidden editor.
7. The practical target is continuous conversational UX with disposable, provenance-preserving context projections.

## Sources

- Gupta et al., EMNLP 2024, task-switch interference: https://aclanthology.org/2024.emnlp-main.811/
- Liu et al., 2026, intent mismatch and Mediator-Assistant architecture: https://arxiv.org/abs/2602.07338
- Anthropic context editing: https://platform.claude.com/docs/en/build-with-claude/context-editing
- OpenAI compaction: https://developers.openai.com/api/docs/guides/compaction

## Verification

- [x] Confirm all four external links resolve and support the adjacent claims.
- [x] Calibrate the proposal as a synthesis of task-interference research, mediator architectures, context editing, and compaction.
- [x] Keep history, working context, storage, compression, and intent interpretation conceptually distinct.
- [x] Explain why garbage collection is only a partial analogy rather than the proposed architecture.
- [x] Do not claim OpenClaw currently implements the complete architecture.
- [x] Verify body word count is below 1,200, excluding frontmatter.
- [x] Verify `draft: false`, valid pillar, reading time, and date.
- [x] Verify no em dashes appear.
- [x] Verify every named source has an inline Markdown link.
- [x] Verify the immutable-history and provenance requirements are explicit.
- [x] Include one AI-specific mechanism and one limitation.
- [x] Verify the conclusion does not turn into a product pitch or manifesto.
