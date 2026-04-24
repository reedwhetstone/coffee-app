# PR Audit: fix/catalog-api-docs-accuracy (PR #201)

**Date:** 2026-03-30  
**PR:** https://github.com/reedwhetstone/coffee-app/pull/201  
**Auditor:** Parchment API Builder cron (direct audit — trivial scope)  
**Intent:** Fix three documentation inaccuracies in `/api/catalog-api` docs, validated against the live API.

---

## Verdict: PASS — Merge Ready

**P0:** 0  
**P1:** 0  
**P2:** 0  
**P3:** 1 (noted below)

---

## Findings

### Changes Made

| Fix                     | Before                | After              | Evidence                                                                               |
| ----------------------- | --------------------- | ------------------ | -------------------------------------------------------------------------------------- |
| curl domain             | `purveyors.io`        | `www.purveyors.io` | 308 redirect strips `Authorization` header on non-www domain; validated live with curl |
| Price field name        | `price_per_lb`        | `cost_lb`          | 0/1000 live items have `price_per_lb`; all 1000 have `cost_lb`                         |
| Phantom `limit` field   | `"limit": 25` present | Removed            | Live API top-level response has no `limit` field                                       |
| total_available example | `814`                 | `1000`             | Current live catalog has 1000 rows (reflects real data)                                |
| source example          | `sweet_marias`        | `sweet_maria`      | Minor typo correction (actual source slug is `sweet_maria`)                            |

### Correctness Assessment

- **Domain fix:** Confirmed working via curl. `https://purveyors.io/api/catalog-api` → 308 to `www.purveyors.io` → `Authorization` header dropped → auth error body in 200 response. `https://www.purveyors.io/api/catalog-api` → 200 with authenticated data. Fix is correct.
- **Field name fix:** `cost_lb` confirmed as the actual field on all 1000 items returned. `price_per_lb` does not exist in the `/api/catalog-api` response (note: `/v1/catalog` canonical endpoint includes `price_per_lb` as a computed field, but this is not the legacy endpoint's output).
- **Limit field removal:** Confirmed correct — live response has keys: `data, total, total_available, limited, tier, cached, cache_timestamp, api_version`. No `limit` field.
- **CI:** All 50 tests pass, lint clean, svelte-check 0 errors/warnings.

### P3 Observation (Non-blocking)

The `/v1/catalog` canonical endpoint and the `/api/catalog-api` legacy endpoint have different response shapes. The v1 endpoint includes `price_per_lb` as a computed field; the legacy endpoint uses `cost_lb` as the raw field. The docs currently only cover `/api/catalog-api`, which is correct for external integrations. But the docs don't mention that the canonical `/v1/catalog` has richer fields. This is a future documentation enhancement, not a defect.

---

## Summary

Mechanical doc fix with zero logic changes. Two string literals corrected in `content.ts`. CI passed. No regressions possible — this file is pure static content. Merge recommended.
