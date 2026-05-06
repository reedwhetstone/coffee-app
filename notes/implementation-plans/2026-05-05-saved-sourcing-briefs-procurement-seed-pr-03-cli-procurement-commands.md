# PR 3: CLI Procurement Brief Commands

**Program:** Saved Sourcing Briefs and Procurement Recommendation Seed  
**Repo:** `purveyors-cli`  
**PR goal:** Add agent-friendly CLI commands for listing, creating, and running sourcing briefs through the canonical `coffee-app` `/v1` API.

## Why this slice comes now

The CLI is a first-class product surface, but it should consume a stable HTTP contract rather than inventing local saved state. After PR 1 establishes the API and PR 2 validates the member workflow, CLI commands make the same procurement primitive available to agents and operators.

## In scope

- Add a procurement or sourcing command group.
- Add list/create/matches commands.
- Preserve canonical API response envelopes in `--json` mode.
- Add dense human-readable output for manual use.
- Add manifest metadata with auth requirements, examples, options, and output modes.
- Support API-key auth via existing CLI auth mechanisms.

## Out of scope

- Local-only brief storage.
- Browser/session-auth-only workflows.
- Email, webhooks, cron, or notifications.
- Recommendation generation if PR 4 has not shipped.
- Publishing docs in `coffee-app` before the CLI version is released or clearly versioned.

## Specific files to change

Likely files in `repos/purveyors-cli`:

- command-group files following current repo convention
- API client module for procurement endpoints
- manifest/help metadata
- README or docs if command docs are repo-local
- command and client tests
- package version bump if this ships as a feature release

## Acceptance criteria

- `purvey procurement briefs list --json` returns saved briefs for the authenticated API key.
- `purvey procurement briefs create ... --json` creates a brief using the same criteria vocabulary as PR 1.
- `purvey procurement briefs matches <id> --json` returns criteria, matches, pagination, reasons, and limitations.
- Auth, entitlement, invalid criteria, and not-found errors preserve machine-readable envelopes.
- The command appears in the CLI manifest with examples and auth notes.
- Human output is readable but does not drop critical limitation metadata.

## Test plan

```bash
cd /root/.openclaw/workspace/repos/purveyors-cli
pnpm test -- procurement
pnpm build
node dist/index.js procurement briefs list --json
```

If no live API key is available, report `VALIDATION_BLOCKED_ENV` for the smoke command and rely on mocked client tests plus CI.

## Risks

- **CLI docs race:** Do not update public coffee-app docs to claim availability until the CLI version is merged and released or the docs name the unreleased version explicitly.
- **Envelope flattening:** JSON output should not discard pagination, criteria, or limitations.
- **Auth ambiguity:** Make API-key requirements explicit in help and manifest metadata.

## Exact follow-on dependency

PR 4 can add shadow recommendation runs once web and CLI can both exercise saved criteria and matches.
