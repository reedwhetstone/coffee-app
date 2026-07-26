# Pre-submission audit: Parchment chat similarity cutover

VERDICT: ready
P0: 0
P1: 0
P2: 0
P3: 0
NEXT_ACTION: merge
CONFIDENCE: high
SCOPE_ASSESSMENT: mergeable

## Result

No legitimate P0-P3 findings.

The chat route now injects its request-bound Parchment session client into the similarity adapter. The adapter calls the canonical SDK contract, preserves the existing agent-facing result shape and error normalization, and no longer uses a service-role Supabase RPC or duplicated local classifier.

The entitlement boundary is coherent at both layers:

- Coffee-app retains `find_similar_beans` for Mallard members and removes it from the PPI-only allowlist and prompts.
- Parchment independently enforces `canUseBeanMatching`; PPI access alone does not grant similarity access.
- The current session token, not a service-role credential, crosses the boundary.

The deleted classifier, calibration fixture/script, and direct similarity module have no remaining live source references. The slice is independently mergeable and conforms to PADR-0013.

## Validation

- `pnpm exec vitest run src/lib/server/agentSimilarity.test.ts src/lib/services/tools.test.ts src/routes/api/chat/route.test.ts`: `VALIDATION_PASS`
- `PUBLIC_SUPABASE_URL=https://example.supabase.co PUBLIC_SUPABASE_ANON_KEY=test SUPABASE_SERVICE_ROLE_KEY=test STRIPE_SECRET_KEY=sk_test_placeholder STRIPE_WEBHOOK_SECRET=whsec_placeholder pnpm check`: `VALIDATION_PASS`
- Changed-file Prettier and TypeScript ESLint: `VALIDATION_PASS`
- Parchment catalog similarity and authorization tests: `VALIDATION_PASS`
- SDK client tests: `VALIDATION_PASS`
- `git diff --check origin/main...HEAD`: `VALIDATION_PASS`

The full coffee-app suite also passed before the gate: 127 files passed, 1 skipped; 965 tests passed and 11 skipped. The production member API-key similarity canary returned 10 bounded-vector matches for catalog item 1182.

Global `pnpm lint` remains `VALIDATION_FAIL` only because 18 unrelated pre-existing Markdown files fail Prettier. The changed-file formatting and lint checks pass.
