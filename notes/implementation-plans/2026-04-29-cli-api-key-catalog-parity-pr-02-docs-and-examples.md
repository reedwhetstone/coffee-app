# PR 2 Plan: Docs for CLI API-Key Catalog Mode

**Date:** 2026-04-29
**Repo:** `repos/coffee-app`
**PR goal:** Update public Parchment API and CLI docs to describe released CLI API-key catalog reads accurately.

## Why this slice is next

Docs should follow the CLI release, not precede it. Once API-key catalog mode exists, coffee-app docs need to make the auth model legible for developers and agents.

## Mergeable-slice gate

This PR is mergeable only after PR 1 is released or the docs explicitly label the feature as requiring the next CLI version. If PR 1 never ships, do not merge this docs slice as written.

## In scope

- Update `src/lib/docs/content.ts` CLI and catalog docs.
- Explain three catalog access modes:
  - anonymous HTTP `/v1/catalog` for public discovery
  - API-key HTTP `/v1/catalog` for production integrations and rate headers
  - CLI API-key catalog mode for headless agent and script reads
- Keep member-only CLI commands documented as session-authenticated.
- Add examples using `PARCHMENT_API_KEY`.
- Mention `PURVEYORS_API_KEY` only as a compatibility alias if PR 1 supports it.
- Update troubleshooting guidance for `AUTH_ERROR` so catalog callers know when an API key is sufficient and when session login is still required.

## Out of scope

- Implementing CLI behavior.
- Changing API response shape.
- Changing API key generation UX.
- Publishing the CLI package.
- Updating coffee-app dependency versions unless a separate consumer path requires it.

## Specific files likely to change

- `src/lib/docs/content.ts`
- Possibly docs snapshots or route tests if they assert doc content
- Optional: `notes/API_notes/APITIER.md` only if current reference docs need a small auth-mode note

## Acceptance criteria

- `/docs/api/catalog` clearly states API-key catalog reads are available through both HTTP and the released CLI version.
- `/docs/cli/catalog` or equivalent CLI docs show `PARCHMENT_API_KEY=... purvey catalog search ...` examples.
- Docs still state that inventory, roast, sales, tasting, and write commands require a signed-in session.
- Troubleshooting docs distinguish missing session from missing API key.
- Docs do not imply API keys can access private inventory or member workflow data.
- The API-key env var name is consistent across examples.

## Verification commands

```bash
cd /root/.openclaw/workspace/repos/coffee-app
pnpm check --fail-on-warnings
rg -n "PARCHMENT_API_KEY|PURVEYORS_API_KEY|API-key catalog|catalog search" src/lib/docs/content.ts
```

Optional live check after deploy:

```bash
curl -s https://www.purveyors.io/docs/api/catalog | rg -i "PARCHMENT_API_KEY|purvey catalog search|API-key"
curl -s https://www.purveyors.io/docs/cli/catalog | rg -i "PARCHMENT_API_KEY|purvey catalog search|session"
```

## Risks

- Docs could get ahead of the published CLI. Avoid merging until the CLI release exists, or pin the wording to the future version.
- Users may assume API keys unlock member-only commands. Keep the boundary explicit and repeated.
- Too much auth-mode detail can make docs noisy. Use one short decision table and focused examples.
