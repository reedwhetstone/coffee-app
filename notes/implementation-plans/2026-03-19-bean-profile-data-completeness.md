# Implementation Plan: Bean Profile Data Completeness

**Date:** 2026-03-19  
**Priority:** P1 (Critical Bug)  
**Complexity:** Easy  
**Score:** 18 (P1=8 + easy=10 + low risk=0 + no deps=0)  
**Target PR:** Single, focused PR to coffee-app

---

## Feature

The `/beans` profile page should display **all non-null data fields** from the `green_coffee_inv` table in an organized, readable layout. Currently, only a subset of fields is shown, leaving users unable to see complete bean metadata even when it exists in the database.

---

## Why Now

1. **Priority 1 bug** — marked as breaking core functionality (users can't access their own data)
2. **Data transparency gap** — we collect rich metadata but don't surface it; this contradicts our platform positioning
3. **Fits one clean PR** — pure UI/UX work, no backend changes, no schema migrations
4. **High user impact** — every bean profile view is currently incomplete

---

## Strategy Alignment Audit

### Active Strategy Themes (from recent blog posts and DEVLOG)

1. **Data completeness as competitive moat** — "Who Profits When Coffee Data Stays Scarce" (Mar 11) establishes that metadata transparency is our core value proposition
2. **AI-first workspace / GenUI transition** — beans page will eventually become part of the conversational workspace; fixing data display prepares the foundation
3. **Market intelligence foundation** — upcoming Price Index product depends on users trusting that we surface all available data
4. **Discovery vs reliability** — complete bean profiles help users make informed sourcing decisions

### Alignment Assessment: **STRONGLY ALIGNED**

This fix directly supports the thesis that "metadata transparency is our core value proposition." The blog post explicitly calls out that the industry has "solved price transparency" but left "product metadata" as relationship-gated. By showing all available fields, we demonstrate that our platform doesn't hide information.

### Contradictions: None

No conflicts with current direction. This is a pure bug fix that improves data surfacing without changing behavior.

---

## Scope

### In Scope

- Audit all fields in `green_coffee_inv` table schema
- Identify which fields are currently displayed vs. hidden
- Design organized layout sections (e.g., Origin Info, Physical Characteristics, Supplier Info, Metadata)
- Implement display for all non-null fields with appropriate formatting
- Handle edge cases: long text, missing data, array fields (price_tiers), dates

### Out of Scope

- Editing capability for new fields (display only)
- New data collection (work with existing schema)
- Schema changes or migrations
- Mobile-specific layout changes (responsive is fine, no mobile redesign)
- Related features like wholesale markers (separate item in DEVLOG)

---

## Proposed UX Behavior

### Current State

Bean profile shows a limited subset: name, origin, process, cost, maybe a few others. Many fields from `green_coffee_inv` are invisible.

### Target State

Organized sections with logical grouping:

**Section: Origin & Source**

- Origin, Region, Farm/Washing Station
- Cultivar/Variety, Process, Grade
- Arrival Date, Crop Year

**Section: Physical & Cupping**

- Altitude (formatted as MASL)
- Cup Score, Cupping Notes
- Roast Recommendation

**Section: Pricing & Availability**

- Price Tiers (formatted table)
- Stocked status, Quantity Available
- Bag Size

**Section: Supplier & Metadata**

- Supplier Name, External URL
- Added Date, Last Updated
- Scraper source info (if relevant)

**Formatting Rules:**

- Hide entire section if all fields are null
- Show "—" or omit for null individual fields
- Price tiers render as: "1 lb: $8.50 | 10 lb: $7.20 | 50 lb: $6.00"
- Dates formatted: "Mar 15, 2026"
- URLs as clickable external links

---

## Files to Change

1. **`src/routes/beans/BeanProfile.svelte`** (or equivalent profile component)

   - Add sections for missing field groups
   - Implement conditional rendering logic
   - Add formatting helpers for price_tiers, dates, MASL

2. **`src/lib/utils/formatters.ts`** (new or existing)

   - `formatPriceTiers(tiers)` → formatted string
   - `formatAltitude(altitude)` → "X MASL" or range
   - `formatDate(date)` → localized date string

3. **`src/lib/types/greenCoffee.ts`** (if not exists, check existing types)

   - Verify type definitions match actual DB schema

4. **Tests (optional but recommended)**
   - Unit tests for formatter utilities
   - Component test verifying all fields render when data present

---

## API/Data Impact

- **No new API endpoints**
- **No schema changes**
- **Data source:** Existing `+page.server.ts` load function (already fetches full row)
- **GraphQL/REST:** N/A — uses existing SvelteKit server load

Verify the current server load includes all columns:

```typescript
// In src/routes/beans/[id]/+page.server.ts or similar
const { data } = await supabase
	.from('green_coffee_inv')
	.select('*') // Should already be * or explicit list
	.eq('id', params.id)
	.single();
```

---

## Acceptance Criteria

- [ ] All non-null fields from `green_coffee_inv` display on bean profile
- [ ] Fields organized into logical sections (Origin, Physical, Pricing, Metadata)
- [ ] Empty sections hidden entirely (don't show "Origin" with no origin fields)
- [ ] Price tiers formatted as readable string with quantity breakpoints
- [ ] Altitude formatted with MASL suffix
- [ ] Dates formatted in readable format (no ISO strings)
- [ ] URLs rendered as clickable external links
- [ ] No TypeScript errors (strict null checks pass)
- [ ] Responsive layout maintained (no mobile regressions)
- [ ] No performance degradation (no new DB queries)

---

## Test Plan

### Local Validation

```bash
# Lint + type check
npm run lint
npm run check

# Unit tests for formatters
npm run test -- src/lib/utils/formatters.test.ts

# Manual verification
# 1. Navigate to /beans
# 2. Click a bean with rich metadata (Sweet Maria's beans usually have most fields)
# 3. Verify all populated fields display
# 4. Check a bean with minimal data — should show available fields, hide empty sections
```

### CI Expectations

- `code-quality` job: pass (lint + check)
- `test` job: pass (vitest)
- `playwright` job: pass (if bean profile E2E exists)

---

## Risks and Rollback

### Risks

| Risk                                    | Likelihood | Impact | Mitigation                                              |
| --------------------------------------- | ---------- | ------ | ------------------------------------------------------- |
| Layout breaks on very long text (notes) | Medium     | Low    | CSS `overflow-wrap: break-word`, max-height with expand |
| Null/undefined edge cases               | Low        | Medium | Defensive checks `value ?? null`, section hide logic    |
| Type mismatch between DB and UI         | Low        | High   | Run `npm run check`, verify against Supabase types      |

### Rollback

- Single PR, single commit → `git revert` if needed
- No DB changes → no data migration rollback needed
- Feature flag not required (this is a bug fix, not new behavior)

---

## Open Questions for Reed

1. **Field priority:** Should any specific fields be highlighted/promoted above others? (e.g., Cup Score prominent, Scraper metadata collapsed?)

2. **Empty state:** For fields that are null, prefer showing "—" or simply omitting the row entirely?

3. **Price tier display:** Table format, inline string, or something else? Current mock shows inline: "1 lb: $8.50 | 10 lb: $7.20"

4. **Edit scope:** Confirm we should NOT add edit capability for these fields in this PR — display only?

5. **Source attribution:** Should we show internal metadata like `scraped_at`, `source_id`? Or keep it user-facing only?

---

## CLI Cross-Cutting Assessment

**CLI relevance:** Low — this is a web UI display feature.

The `@purveyors/cli` already has `purvey beans list` and `purvey beans show <id>` commands that display bean data. After this web PR ships, we should create a follow-up issue to align CLI output with the new field organization. CLI users deserve the same data completeness.

**This PR:** coffee-app only  
**Future CLI issue:** Sync `purvey beans show` field display with web profile completeness

---

## Related DEVLOG Items

- P1: "Bean profile data collection incomplete" ← **this PR**
- P2: "Add wholesale markers/indicators to green coffee inventory page" — can reuse formatter utilities built here
- P2: "Clean up beans catalog profiles to remove exposed user reference fields" — complementary cleanup, could bundle or sequence

---

## Implementation Notes

### Schema Discovery Query

Run against dev database to see all columns:

```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'green_coffee_inv'
ORDER BY ordinal_position;
```

### Expected Fields to Surface

Based on catalog schema knowledge:

- `origin`, `region`, `farm`, `cultivar_variety`, `process`, `grade`
- `altitude`, `cup_score`, `cupping_notes`, `roast_recommendation`
- `price_tiers` (jsonb array), `cost_lb` (legacy), `wholesale`
- `bag_size`, `stocked`, `quantity_available`
- `supplier_name`, `supplier_url`, `arrival_date`, `crop_year`
- `scraped_at`, `created_at`, `updated_at` (decide if user-facing)

### Type Safety

Import types from `src/lib/types/database.ts` or Supabase generated types to ensure field access is type-safe.
