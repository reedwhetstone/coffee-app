# Implementation Plan: Add Wholesale Markers to Green Coffee Inventory

**Date:** 2026-03-16  
**Feature:** Add wholesale markers/indicators to green coffee inventory page  
**DEVLOG Reference:** Priority 2 - UI/UX Issues

---

## Feature

Add visual wholesale indicators to the green coffee inventory (`/beans`) page, extending the wholesale visibility that already exists in the catalog to inventory views. This includes:

1. Wholesale badge on inventory list items
2. Wholesale indicator in bean profile detail view
3. Optional: Wholesale filter in inventory filters

---

## Why Now

**Scoring breakdown:**

- Priority score (P2): 6
- Complexity (easy): 10
- Risk penalty (low): 0
- Dependency penalty (none): 0
- **Total: 16**

This feature scored highest among safe, easy-win candidates. It builds on existing wholesale infrastructure (catalog already has `wholesale` boolean and displays badges) and requires only UI additions, no backend changes.

---

## Strategy Alignment Audit

### Active Strategy Themes (from recent blog posts and outlines)

1. **Public catalog access + conversion funnel** ("What is Purveyors?", Mar 13)

   - The public-facing catalog already shows wholesale badges; inventory visibility supports the same transparency principle for logged-in users

2. **Market intelligence / pricing transparency** ("Who Profits When Coffee Data Stays Scarce?", Mar 11; "Why Does the Same Coffee Cost $20/lb and $6.58/lb?" outline)

   - Wholesale markers make pricing structure explicit; helps users understand when they're buying from wholesale-classified suppliers

3. **Nonlinear pricing transparency** (pricing outline, Mar 15)
   - The wholesale boolean is a UI convenience for a continuous pricing curve; extending it to inventory reinforces that users should think in terms of price tiers, not binary categories

### Alignment Verdict: **ALIGNED**

This feature supports the platform's direction toward transparency about supplier pricing structures and helps users understand the wholesale/retail distinction as they manage their inventory.

### No Contradictions

The wholesale flag already exists in the data model and is displayed in the catalog. Extending it to inventory is consistent with existing UX patterns.

---

## Scope

### In Scope

- Add wholesale badge to inventory list items in `/beans` page
- Add wholesale indicator to bean profile detail (BeanProfileTabs component)
- Reuse existing wholesale badge styling from CoffeeCard component (indigo badge)
- Ensure `wholesale` field is available from the beans API response

### Out of Scope

- Backend schema changes (field already exists)
- New filter UI for wholesale (can be added later if requested)
- Roast profiles page wholesale markers (separate DEVLOG item)
- Sales page wholesale markers (separate DEVLOG item)

---

## Proposed UX Behavior

### Inventory List

- Each inventory item card shows a "Wholesale" badge (same styling as catalog: indigo-100 background, indigo-700 text, rounded-full, small text)
- Badge appears next to supplier name when `coffee_catalog.wholesale === true`
- Compact display to avoid cluttering the list view

### Bean Profile Detail

- In the Overview tab, display wholesale status prominently near supplier/origin info
- Same badge styling as catalog cards
- Shows the user's purchased coffee's wholesale classification from the linked catalog entry

---

## Files to Change

1. **`src/routes/beans/+page.svelte`** (~line 400-500 area)

   - Add wholesale badge to inventory list item rendering
   - Badge displays when `bean.coffee_catalog?.wholesale` is true

2. **`src/routes/beans/BeanProfileTabs.svelte`** (~line 250-350 area in Overview tab)

   - Add wholesale indicator to bean profile header/metadata section
   - Display alongside supplier name, origin, processing info

3. **`src/routes/api/beans/+server.ts`** (verify)
   - Confirm `coffee_catalog` join includes `wholesale` field
   - If missing, add to select/join query

---

## API/Data Impact

- No breaking changes
- May need to add `wholesale` to the beans API select if not already included in the coffee_catalog join
- Data already exists: `coffee_catalog.wholesale` boolean field

---

## Acceptance Criteria

- [ ] Inventory list items show "Wholesale" badge when linked catalog item is wholesale
- [ ] Bean profile detail shows wholesale indicator in Overview tab
- [ ] Badge styling matches existing catalog wholesale badges (indigo color scheme)
- [ ] No visual regression in inventory list layout
- [ ] Wholesale indicator updates correctly when switching between beans
- [ ] Mobile responsive: badge scales appropriately on small screens

---

## Test Plan

### Manual Testing

1. Navigate to `/beans` with inventory containing both wholesale and non-wholesale items
2. Verify wholesale badges appear only on wholesale-classified items
3. Click a wholesale item; verify badge appears in profile detail
4. Click a non-wholesale item; verify no badge appears
5. Test on mobile viewport (320px width)

### Automated Testing

- Run `npm run check` - TypeScript/svelte-check should pass
- Run `npm run lint` - no new lint errors
- Run `npm run test:unit` - existing tests should pass

### Visual Regression

- Screenshots before/after for beans page list view
- Screenshots before/after for bean profile detail view

---

## Risks and Rollback

**Risk: Low**

- Purely additive UI change
- No data mutations
- Uses existing field and styling patterns

**Rollback:**

- Single PR; revert if needed
- No migration or data changes required

---

## Open Questions for Reed

1. **Filter priority:** Should I add a wholesale filter toggle to the inventory filters, or keep this purely as visual indicators for now? The filter would let users show/hide wholesale items like the catalog does.

2. **Badge placement preference:** In the inventory list, should the wholesale badge appear:

   - A) Next to supplier name (consistent with catalog cards)
   - B) In a separate metadata row
   - C) Only in the detail view (cleaner list)

3. **Tooltip/clarification:** Should the wholesale badge have a tooltip explaining what "wholesale" means in our context (minimum order >5 lbs)? This relates to the pricing transparency themes in the blog.
