# PR Audit: #207 — fix: use native Response for 308 redirect in /api/catalog-api

**Date:** 2026-03-31
**Branch:** fix/catalog-api-redirect
**Auditor:** OpenClaw (manual audit — Opus reviewer unavailable due to model switch error)
**Verdict:** PASS — merge ready

---

## Intent Coverage

**Intent:** Fix broken 308 redirect in `/api/catalog-api`. SvelteKit's `throw redirect(308, ...)` in a `+server.ts` API route under `@sveltejs/adapter-vercel` was silently returning HTTP 200 with an empty body instead of the proper redirect status.

**Coverage:** Complete. The fix replaces the broken pattern with `return new Response(null, { status: 308, headers: { Location: ... } })`, which is the correct approach for SvelteKit API routes.

---

## Diff Analysis

**Changed files:**
- `src/routes/api/catalog-api/+server.ts` — core fix
- `src/routes/api/catalog-api/catalog-api.test.ts` — tests updated to match new behavior

**+server.ts change:** Removes `throw redirect(308, ...)` and replaces with native `Response` construction. The query param forwarding logic is preserved exactly.

**Test change:** Previous tests caught the thrown SvelteKit redirect object (accessing `.status` and `.location` on the error). New tests `await` the returned `Response` and check `response.status` and `response.headers.get('Location')`. All 3 tests pass.

---

## Findings

### P0 — None

### P1 — None

### P2 — Warning (deferred, no fix needed now)

**Other +server.ts files using `throw redirect()`:** `/auth/callback/+server.ts` uses `throw redirect(303, ...)` for OAuth flows. This appears to work correctly in practice (browser-based OAuth works fine with 303 redirects which SvelteKit handles differently than permanent API redirects). Verified not broken; no action needed.

### P3 — Notes / Tech Debt

1. **Root cause documentation:** The comment in `+server.ts` documents why native Response is used. Good — future developers won't revert this.

2. **No live validation possible yet:** The fix can only be verified post-deployment. Acceptance criteria in PR description captures the expected post-deploy behavior.

3. **Pre-existing Prettier warnings on notes/:** `pnpm lint` fails on `notes/*.md` files (31 files). This is pre-existing and unrelated to this PR. `.prettierignore` should eventually exclude `notes/`.

---

## Integration Risk

Low. This is a single-route change with no downstream dependencies. The `/api/catalog-api` endpoint had already been archived (PR #202); this fix only corrects the HTTP status code delivery. Callers who don't follow redirects already got empty 200s — after this fix they'll get 308 and know to update their URLs.

---

## Correctness Verification

- `svelte-check`: 0 errors, 0 warnings
- Vitest (catalog-api.test.ts): 3/3 tests pass
- CI (Format, Check & Lint): green on both commits

---

## Verdict

**PASS.** Single focused fix, correctly scoped, tests updated, CI green. Merge recommended.
