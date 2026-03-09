# Fix User Rating Editing — Full Scope Assessment

**Date**: 2026-03-09
**Status**: PROPOSED
**Priority**: P1 (broken core feature, data strategy alignment)

---

## Full Audit Results

### Current State: Where ratings live

| Location                        | How rank is handled                                                       | Bug?                           |
| ------------------------------- | ------------------------------------------------------------------------- | ------------------------------ |
| **BeanForm** (create/edit)      | In data model (`rank: bean.rank \|\| null`), but **zero UI fields**       | Missing feature                |
| **BeanProfileTabs header**      | Displays arc meter when `rank !== undefined`                              | ✅ Bug: null passes this check |
| **BeanProfileTabs cupping tab** | Displays "Your Rating" when `rank !== undefined`                          | ✅ Same bug                    |
| **CuppingNotesForm**            | Has range slider for overall rating (1-10), saves via `handleCuppingSave` | ✅ Bug: validation broken      |
| **CuppingNotesForm**            | `overallRating` initialized to `null`, slider has no explicit default     | UX issue                       |
| **handleCuppingSave**           | PUTs `{ rank: rating }` to `/api/beans?id=X`                              | Works correctly                |

### Bug #1: Null vs undefined display check

**Files**: `BeanProfileTabs.svelte` lines 252, 627

```svelte
{#if selectedBean.rank !== undefined}
```

Supabase returns `null` for empty columns, not `undefined`. So `null !== undefined` is `true`, and the arc meter renders with a `null` value. You see "null" text and a broken arc.

**Fix**: `{#if selectedBean.rank != null}` (loose equality catches both null and undefined)

### Bug #2: Form validation is always truthy

**File**: `CuppingNotesForm.svelte` line 84

```js
let isValidForm = $derived(() => {
	return dimensions.some((dim) => formData[dim.key].tag.trim() !== '');
});
```

`$derived(() => ...)` creates a derived that holds a **function reference** (always truthy). Save button is never disabled because `!isValidForm` is always `false` (a function is truthy).

**Fix**: `$derived.by(() => ...)` to evaluate the function and return the boolean result.

### Bug #3: Rating slider starts at undefined position

**File**: `CuppingNotesForm.svelte` line 115

When `overallRating` is `null`, `bind:value={overallRating}` on a range input produces undefined behavior. The slider thumb renders at an arbitrary position. First interaction snaps to 1 (the min).

**Fix**: Default to 5 (midpoint) when no prior rating exists. Keep "Clear Rating" button to explicitly set back to null.

### Missing Feature: Rating in BeanForm

`rank` is stored in the data model for BeanForm's create/edit flow, but there is no UI input for it. On edit, `bean.rank` is loaded into the data but the user can never see or change it.

Currently the only way to set a rating is through the CuppingNotesForm in BeanProfileTabs. This creates a disconnected experience: you can create a bean but can't rate it, then you have to navigate to the bean detail view, go to the Cupping tab, and use a separate form.

**Assessment**: Adding a rating field to BeanForm is scope creep for this PR. The CuppingNotesForm is the right home for ratings (it's contextually grouped with tasting notes). The fix should ensure CuppingNotesForm works correctly for both setting and editing ratings. BeanForm's `rank` in the data model is fine as-is since the cupping save flow handles persistence.

---

## Slider UX Assessment

### Current implementation

- HTML `<input type="range">` with custom thumb styling
- 1-10 scale, step 1, with number labels below
- Current value shown as large amber text next to "/10"
- "Clear Rating" link below
- When null: shows "No rating" text instead of value

### UX problems

1. **No visual feedback on where the thumb is** when first opening with null value
2. **Range sliders are imprecise on mobile** (fat finger problem, especially 1-10 with 10 stops)
3. **No hover/active state feedback** on the track
4. **Slider alone doesn't communicate "this is a rating"** — feels like a generic setting

### Recommended UX: Segmented button row

Replace the range slider with a row of 10 tappable buttons (1-10), styled as a segmented control:

```
[ 1 ][ 2 ][ 3 ][ 4 ][ 5 ][ 6 ][ 7 ][ 8 ][ 9 ][10]
```

- Selected value gets filled background (amber/brown) + white text
- Unselected values are outlined/muted
- Tap to select, tap again to deselect (returns to null)
- Color shifts from red (1-2) → orange (3-4) → yellow (5-6) → green (7-8) → emerald (9-10)
- Mobile-friendly: each button is a clear tap target
- No ambiguous thumb position problem

This matches rating UX patterns from review sites and eliminates all three slider UX issues.

### Alternative considered: Star rating

Stars work well for 5-point scales but get cramped at 10-point. Half-stars could work but add complexity. The segmented approach is cleaner for a 1-10 integer scale.

---

## Implementation Plan

### Files to change

1. **`src/routes/beans/BeanProfileTabs.svelte`**

   - Fix `rank !== undefined` → `rank != null` (2 locations: header arc, cupping tab)
   - Fix `getScorePercentage` to handle null explicitly (return 0)
   - Fix `getRatingStrokeColor` to handle null

2. **`src/routes/beans/CuppingNotesForm.svelte`**
   - Fix `$derived(() => ...)` → `$derived.by(() => ...)`
   - Replace range slider with segmented button row (1-10)
   - Default `overallRating` to 5 when `initialRating` is null (midpoint per Reed)
   - Keep "Clear Rating" functionality (sets back to null)
   - Remove `.cupping-notes-form` CSS class (unused after FormShell migration if that lands, keep for now)

### Files NOT changed

- `BeanForm.svelte` — rank in data model is fine, cupping form is the right editing surface
- API endpoints — no changes needed, PUT already handles rank
- Database — no schema changes

### Acceptance criteria

- Null rank: no arc meter shown in header, "No rating yet" in cupping tab
- Set rating via cupping form: value appears immediately in header arc and cupping tab
- Edit existing rating: opens with current value pre-selected in button row
- Clear rating: reverts to null state cleanly
- Segmented buttons are tappable on mobile with clear visual feedback
- `pnpm lint`, `pnpm check`, `pnpm test:unit` all green

---

## Strategy Alignment

User ratings are first-party data signals. Per our "AI Moats Aren't Software" thesis, the real defensible asset is accumulated user interaction data, not the AI layer. Per the "13x Information Gap" outline, metadata completeness (including user ratings) is a measurable market advantage. A broken rating flow directly undermines data density.

This fix restores a core data capture mechanism with improved UX that encourages use.
