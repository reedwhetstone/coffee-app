# Automatic large-canvas saves

## Outcome

Successor to [coffee-app #614](https://github.com/reedwhetstone/coffee-app/pull/614). Large evidence canvases save automatically after the normal merge/deploy cycle. There is no release flag, capability metadata, or manual activation step. This corrects the earlier handoff, which left the reported size failure unresolved by default.

## Scope and compatibility

- Remove the private deployment switch, the workspace capability field, and both browser opt-in checks.
- Keep small canvases in ordinary JSON; compress larger canvases losslessly within the existing storage limits.
- Use the same codec on normal saves, conflict retries, and unload POSTs. Keep authorization, reset epochs, canvas versions, terminal-error recovery, and action receipts unchanged.
- Keep unload canvas requests inside the browser's 64 KiB beacon budget when possible; if the beacon is oversized or rejected because the remaining quota is exhausted, retain the exact request in same-origin storage and replay it on the next workspace initialization.
- Continue decoding reads and save responses before rendering, including older browser bundles talking to the current application server.
- No upstream API/SDK change or migration. #614 introduced the reader, and its merge commit `a0c7c4954634b779e01bf7fc00cfaba33581c5df` is verified as successful Production deployment `6411315337`, updated `2026-09-12T15:34:29Z`. This is deployment metadata, not authenticated production save/reload proof.
- Immutable servers predating #614 cannot read the encoded storage format. Historical preview support is not expanded here; rolling back to such a reader is not supported after encoded states exist. Adding another activation flag would not fix that old code.

## Inherited knowledge

| Invariant                                                          | Origin                                                                                      | Current proof / disposition                                                                                                                                                                                                                                     |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Preserve complete choices, pinned old evidence and action receipts | #614 reported 413 and codec fixture                                                         | Existing exact JSON round trip, old pinned read, real component autosave/unload coverage, and quota-rejection replay coverage retained without capability metadata.                                                                                             |
| Keep legacy cutoff in serialized characters                        | [Codex review](https://github.com/reedwhetstone/coffee-app/pull/614#discussion_r3996604135) | Unicode regression retained; decoded compressed data remains byte-bounded.                                                                                                                                                                                      |
| Stop inflation at the decoded limit                                | [Codex review](https://github.com/reedwhetstone/coffee-app/pull/614#discussion_r3996604140) | Forged gzip trailer and bounded streaming decode coverage retained.                                                                                                                                                                                             |
| Repeated conflicts stay retryable                                  | [Codex review](https://github.com/reedwhetstone/coffee-app/pull/614#discussion_r3996604143) | Conflict classification and store refresh/retry coverage retained.                                                                                                                                                                                              |
| Current readers never mistake envelopes for missing evidence       | #614 mixed-version review                                                                   | Decoder and corrupt-state fail-closed tests retained. Production reader is merged with successful deployment metadata. Historical immutable pre-#614 BFF compatibility is outside this correction; current server continues returning plain blocks to browsers. |
| Feature works after merge and normal deploy                        | Reed's September 12 direction                                                               | Workspace store and actual component fixtures omit capability metadata; route tests have no deployment-env mock.                                                                                                                                                |

## Validation

- `VALIDATION_PASS`: 87 focused tests across 9 files, covering exact lossless round trips, corrupt and oversized compressed inputs, Unicode, conflict retry, historical pinned evidence, terminal-save errors, actual ChatWorkspace autosave/unload, quota-rejected beacon replay, stale-record handling, and canonical action outcomes. The initial run passed 81/82; after correcting a new test's no-error expectation from `null` to the store's actual `undefined`, the affected 15-test file passed. The correction adds five focused replay tests.
- `VALIDATION_PASS`: `pnpm check --fail-on-warnings`, zero errors and warnings.
- `VALIDATION_PASS`: `pnpm lint` and `git diff --check`.
- `VALIDATION_PASS`: the current correction closes the live P2 unload-quota finding with focused rejection, replay, stale-record, and normal-save cleanup coverage. Final review remains separate; merge remains Reed's decision.
- Tests and static validation use repository example environment values and local Node 24.19.0 (repo declares Node 22). No production user data is changed by validation. Authenticated production behavior is unverified; unload tests prove the constructed body, not the browser's delivery after closure.
