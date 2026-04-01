# PR Verification Report

## Metadata

- **Repo:** reedwhetstone/coffee-app
- **Base:** origin/main (4808f17)
- **Head:** fix/catalog-api-serve-not-redirect (5a4bc05)
- **PR:** #212
- **Reviewer model:** anthropic/claude-opus-4-6
- **Confidence:** High
- **Scope note:** 2 files changed, 85 insertions, 31 deletions. Small, focused change to a single legacy API endpoint and its tests.

## Executive Verdict

- **Merge readiness:** Ready with fixes
- **Intent coverage:** Full
- **Priority summary:** P0: 0, P1: 1, P2: 2, P3: 1

## Intent Verification

- **Stated intent:** Fix `/api/catalog-api` returning HTTP 200 with empty body in production. Replace the broken 308 redirect (silently converted by adapter-vercel) with a delegation to `buildCanonicalCatalogResponse`, adding RFC-standard deprecation headers.
- **What was implemented:** Exactly that. The handler now calls `buildCanonicalCatalogResponse(event, { requestPath: '/v1/catalog' })`, clones the response, injects `Deprecation`, `Link`, and `Sunset` headers, and returns real catalog data.
- **Coverage gaps:** One gap in the `requestPath` value obscures API usage tracking for this deprecated endpoint (see P1 finding below).

## Findings by Severity

### P0 (must fix before merge)

None.

### P1 (should fix before merge)

- **Title:** `requestPath: '/v1/catalog'` makes legacy traffic invisible in API usage logs
- **Evidence:** In `+server.ts:14`, the handler passes `{ requestPath: '/v1/catalog' }`. Inside `catalogResource.ts`, `requestPath` flows into `CatalogAccessContext.requestPath` (line 255/278) and is used by `logCatalogApiUsage` (line 204) to record the `endpoint` column in the `api_usage` table. This means all API-key-authenticated requests to `/api/catalog-api` are logged as if they hit `/v1/catalog`.
- **Impact:** You cannot distinguish legacy from canonical API traffic in usage analytics. This is the exact metric needed to decide when it's safe to remove the deprecated endpoint. With the Sunset header set to Dec 31 2026, you need visibility into who's still calling the old URL.
- **Correction:** Pass `requestPath: '/api/catalog-api'` instead. The `meta.namespace` in the response body is hardcoded to `/v1/catalog` in `catalogResource.ts` (lines 313, 384), so callers still learn the canonical URL from the response. Only the usage logging changes. This also correctly aligns with how `/api/catalog` passes `requestPath: '/api/catalog'` (its own path).

  ```diff
  -	const response = await buildCanonicalCatalogResponse(event, { requestPath: '/v1/catalog' });
  +	const response = await buildCanonicalCatalogResponse(event, { requestPath: '/api/catalog-api' });
  ```

### P2 (important improvements)

- **Title:** Sunset header has incorrect day-of-week
- **Evidence:** `+server.ts:20` sets `Sunset: Sat, 31 Dec 2026 23:59:59 GMT`. December 31, 2026 is a **Thursday**, not Saturday. Per RFC 7231 Section 7.1.1.1, the HTTP-date `day-name` must match the actual day.
- **Impact:** Strictly non-conforming HTTP header. Most clients parse the date portion and ignore the day name, so functional impact is minimal. But RFC-aware tooling, linters, or pedantic HTTP libraries could reject or warn on the mismatch. For a PR that explicitly claims "RFC-standard deprecation headers," this undermines that claim.
- **Correction:**
  ```diff
  -	headers.set('Sunset', 'Sat, 31 Dec 2026 23:59:59 GMT');
  +	headers.set('Sunset', 'Thu, 31 Dec 2026 23:59:59 GMT');
  ```

- **Title:** No test for error status passthrough with deprecation headers
- **Evidence:** All four tests mock `buildCanonicalCatalogResponse` returning a 200. No test verifies behavior when the upstream returns 401, 403, 429, or 500. The implementation does pass through `response.status` (line 22), so these errors will inherit the original status. But the deprecation headers are also appended to error responses.
- **Impact:** Missing coverage for a realistic edge case. An expired/invalid API key would produce a 401 from the upstream handler, and the legacy endpoint would return a 401 with `Deprecation: true` headers. This is arguably correct behavior (even the error response should signal deprecation), but it's an untested assumption. If the behavior ever regresses, nothing will catch it.
- **Correction:** Add a test:
  ```typescript
  it('preserves error status from upstream and still adds deprecation headers', async () => {
      const mockResponse = new Response(JSON.stringify({ error: 'Authentication required' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
      });
      vi.mocked(buildCanonicalCatalogResponse).mockResolvedValue(mockResponse);

      const response = await GET({
          url: new URL('https://app.test/api/catalog-api'),
          request: new Request('https://app.test/api/catalog-api'),
          locals: {}
      } as Parameters<NonNullable<typeof GET>>[0]);

      expect(response.status).toBe(401);
      expect(response.headers.get('Deprecation')).toBe('true');
  });
  ```

### P3 (nice to have)

- **Title:** Query param passthrough test assertion is shallow
- **Evidence:** The test "passes query parameters through to the underlying handler" (`catalog-api.test.ts` lines ~68-82) only asserts `expect(buildCanonicalCatalogResponse).toHaveBeenCalled()`. It does not verify that the event passed to the mock actually contains the expected URL with query params.
- **Impact:** The test would pass even if the handler stripped query params before calling `buildCanonicalCatalogResponse`. The delegation model means the event object is passed through unchanged, so this is structurally unlikely to break, but the assertion doesn't actually verify the claim in the test name.
- **Correction:** Strengthen the assertion:
  ```typescript
  expect(buildCanonicalCatalogResponse).toHaveBeenCalledWith(
      expect.objectContaining({
          url: expect.objectContaining({
              searchParams: expect.any(URLSearchParams)
          })
      }),
      expect.any(Object)
  );
  const calledUrl = vi.mocked(buildCanonicalCatalogResponse).mock.calls[0][0].url;
  expect(calledUrl.searchParams.get('page')).toBe('2');
  expect(calledUrl.searchParams.get('source')).toBe('sweet_marias');
  ```

## Assumptions Review

| # | Assumption | Validity | Reasoning |
|---|-----------|----------|-----------|
| 1 | adapter-vercel silently converts 3xx to 200 with empty body | **Valid** | Documented in PR #207 audit, observed in production. The previous redirect approach failed for this exact reason. |
| 2 | `buildCanonicalCatalogResponse` accepts the legacy route's `event` object and works correctly | **Valid** | The function takes a generic `RequestEvent` and reads query params from `event.url`. The event object is structurally identical regardless of which route produces it. Confirmed by reading `catalogResource.ts` lines 411-420. |
| 3 | `new Response(response.body, ...)` correctly transfers the body stream | **Valid** | `Response.body` is a `ReadableStream`. Passing it to a new `Response` constructor is spec-compliant and does not consume or clone the stream prematurely. |
| 4 | Deprecation headers should appear on all responses including errors | **Weak** | Not explicitly addressed in the PR. The implementation adds deprecation headers regardless of upstream status. This is defensible (callers should know to migrate even when getting errors), but the RFC Deprecation header spec doesn't mandate this. Not a bug, but an undocumented design choice. |
| 5 | `requestPath: '/v1/catalog'` is intentional for canonical framing | **Invalid** | This causes API usage logging to conflate legacy and canonical traffic. The sibling route `/api/catalog` correctly passes its own path (`'/api/catalog'`). This appears to be a copy error from `/v1/catalog/+server.ts`. |

## Tech Debt Notes

- **Debt introduced:** Hardcoded Sunset date (`Dec 31 2026`) with no extraction to a constant or config. When this date approaches, someone will need to grep for it. Low severity since there's only one occurrence.
- **Debt worsened:** None. The change actually reduces debt by replacing a broken redirect with a working delegation, aligning the three catalog routes (`/v1/catalog`, `/api/catalog`, `/api/catalog-api`) on the same shared resource module.
- **Suggested follow-up tickets:**
  1. Extract sunset date to a shared constant if more endpoints get deprecation headers.
  2. Add an integration/E2E test that hits `/api/catalog-api` with a real API key and verifies the full response shape including deprecation headers. The unit tests mock the handler; nothing currently validates the end-to-end path.

## Product Alignment Notes

- **Alignment wins:** The fix directly addresses a production bug where callers get empty responses. The deprecation headers are a clean, standards-based signal for migration. Existing integrations will resume receiving real data immediately on deploy.
- **Misalignments:** The `requestPath` issue (P1) undermines the deprecation lifecycle; you can't make a data-driven sunset decision without knowing who's still calling the old URL.
- **Suggested product checks:** After deployment, verify with a real API key: `curl -H "Authorization: Bearer $KEY" https://www.purveyors.io/api/catalog-api` should return catalog JSON with `Deprecation: true` header.

## Test Coverage Assessment

- **Existing tests that validate changes:** 4 tests cover delegation, Deprecation header, Sunset header, and query param passthrough. All pass.
- **Missing tests:**
  1. Error status passthrough (401/429/500) with deprecation headers
  2. Stronger query param assertion
  3. Integration test with real handler (not mocked)
- **Suggested test additions:** Error passthrough test (P2 finding above) is the most valuable addition.

## Minimal Correction Plan

1. **P1 fix:** Change `requestPath: '/v1/catalog'` to `requestPath: '/api/catalog-api'` in `+server.ts:14`. This is a 1-line change.
2. **P2 fix:** Change `Sat` to `Thu` in the Sunset header value in `+server.ts:20`. This is a 1-line change.
3. **P2 (optional before merge):** Add error status passthrough test.

## Optional Patch Guidance

**`src/routes/api/catalog-api/+server.ts`:**
- Line 14: `{ requestPath: '/v1/catalog' }` → `{ requestPath: '/api/catalog-api' }`
- Line 20: `'Sat, 31 Dec 2026 23:59:59 GMT'` → `'Thu, 31 Dec 2026 23:59:59 GMT'`

**`src/routes/api/catalog-api/catalog-api.test.ts`:**
- After the existing Sunset test, add a new test verifying that a non-200 upstream response preserves status while still carrying deprecation headers.
- In the query param passthrough test, assert on the actual URL search params of the event passed to the mock.
