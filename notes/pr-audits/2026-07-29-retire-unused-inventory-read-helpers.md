# Pre-submission audit: retire unused inventory read helpers

## Intent

Remove the unreferenced `listInventory`, `getInventoryItem`, and
`getInventoryWithRoastSummary` Supabase readers and their private types after
active inventory reads moved to Parchment. Preserve the remaining compatibility
mutations unchanged.

## Verdict

```text
VERDICT: ready
P0: 0
P1: 0
P2: 0
P3: 0
NEXT_ACTION: merge
CONFIDENCE: high
SCOPE_ASSESSMENT: mergeable
```

No findings.

Repository-wide source search found no consumers of the deleted helpers or
types. Standard inventory reads use the Parchment projection in
`src/routes/api/beans/+server.ts`, while the legacy GenUI route independently
uses Parchment SDK contracts. The deletion moves toward ADR-007 without
depending on a follow-up PR.

## Validation

- `pnpm check`: pass
- `pnpm test`: pass, 1,073 tests; 11 intentionally skipped
- `pnpm build`: pass
- `pnpm exec prettier --check src/lib/data/inventory.ts`: pass
- `git diff --check origin/main...HEAD`: pass
- `pnpm lint`: blocked by pre-existing formatting drift in 18 unrelated
  Markdown files; the changed TypeScript file passes Prettier
