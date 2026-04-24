# Computed Field Leak & Wrong Supabase Client Audit

**Date:** 2026-03-29
**Triggered by:** PR #193 fix for `RoastProfileDisplay.svelte` sending `is_wholesale` to PostgREST
**Scope:** Full codebase audit of `origin/main` (commit 8dabd4e)

---

## Pattern 1: Sending Computed/Joined Fields Back to the Database

### How the data flows

The app has a consistent pattern: server loads fetch with joins/computed fields, then client-side edit forms spread the full object and send it back via PUT/POST. Whether this causes a 400 depends on whether the server-side route handler filters the incoming body before passing it to Supabase.

### Findings

#### 1. `src/routes/roast/RoastProfileDisplay.svelte:38-56` — FIXED (PR #193) — safe

The `saveChanges()` function now explicitly strips `is_wholesale`, `green_coffee_inv`, `roast_temperatures`, `roast_events`, and `coffee_catalog` before sending the PUT. This was the original bug.

**Status:** Fixed. The hardcoded `NON_COLUMN_FIELDS` array is brittle (must be updated if new joins are added to the query), but functional.

---

#### 2. `src/routes/beans/BeanProfileTabs.svelte:163-181` — Client sends joined data, server strips — medium

**`saveChanges()` function (line 163):**

```typescript
const dataForAPI = {
	...selectedBean, // includes coffee_catalog, roast_profiles, name, etc.
	...Object.fromEntries(Object.entries(editedBean).filter(([key]) => editableFields.includes(key))),
	purchase_date: prepareDateForAPI(editedBean.purchase_date ?? ''),
	last_updated: new Date().toISOString()
};
```

The `...selectedBean` spread includes all joined fields from `buildGreenCoffeeQuery()`:

- `coffee_catalog` (entire nested object with 30+ fields)
- `roast_profiles` (array of profile objects)
- `name` (if present at inventory level)

**Server-side protection:** The `PUT /api/beans` handler (line 185-196) has a `validColumns` allowlist that filters before update:

```typescript
const validColumns = [
	'rank',
	'notes',
	'purchase_date',
	'purchased_qty_lbs',
	'bean_cost',
	'tax_ship_cost',
	'last_updated',
	'user',
	'catalog_id',
	'stocked',
	'cupping_notes'
];
const updateData = Object.fromEntries(
	Object.entries(rawUpdateData).filter(([key]) => validColumns.includes(key))
);
```

**Verdict:** Not exploitable due to server-side filtering. But the client unnecessarily sends ~50KB of joined data per save. The server-side allowlist is the correct defense, but the client should also send only what's needed (bandwidth waste, defense in depth).

**Severity:** low (server protected, but client sends unnecessary data)

---

#### 3. `src/routes/beans/BeanProfileTabs.svelte:218-236` — Client sends joined data, server strips — medium

**`handleCuppingSave()` function (line 218):**

```typescript
const dataForAPI = {
	...selectedBean, // includes coffee_catalog, roast_profiles
	cupping_notes: JSON.stringify(notes),
	rank: rating,
	last_updated: new Date().toISOString()
};
```

Same pattern as #2 — spreads the full `selectedBean` (with all joins) into the PUT body. Same server-side `validColumns` protection applies.

**Severity:** low (server protected)

---

#### 4. `src/routes/profit/SaleForm.svelte:44-50` — Sends all formData fields including computed — medium

**`handleSubmit()` function:**

```typescript
const cleanedSale = Object.fromEntries(
	Object.entries(formData).map(([key, value]) => [
		key,
		value === '' || value === undefined ? null : value
	])
);
```

When editing an existing sale (`sale?.id` is truthy), `formData` is initialized with `{ ...sale }` (line 33). The `sale` object comes from `listSales()` which enriches each sale with:

- `coffee_name` (joined from coffee_catalog)
- `wholesale` (joined from coffee_catalog)
- `green_coffee_inv` (nested join object)

All these fields flow into `cleanedSale` and are sent in the PUT body.

**Server-side protection:** The `PUT /api/profit` handler (line 53) only strips `coffee_name`:

```typescript
const { coffee_name: _, ...updateData } = updates;
```

It does NOT strip `wholesale` or `green_coffee_inv`. These are passed directly to `updateSale()` which calls:

```typescript
.update(data as Database['public']['Tables']['sales']['Update'])
```

PostgREST will reject fields not in the `sales` table schema. If `wholesale` or `green_coffee_inv` leak through, the update will fail with a 400.

**Severity:** medium — `wholesale` and `green_coffee_inv` will cause PostgREST 400 errors when editing sales. The `formData` initialization spreads the enriched sale object, and the server doesn't filter them out.

**Note:** The `POST /api/profit` handler (line 80) also only strips `coffee_name` and `id`, so the same issue applies to any scenario where enriched fields are present in the POST body.

---

#### 5. `src/routes/profit/+page.svelte:64-76` — Double-submit with enriched data — medium

**`handleFormSubmit()` function:**

```typescript
const response = await fetch(
	`/api/profit${isUpdate && selectedSale ? `?id=${selectedSale.id}` : ''}`,
	{
		method: isUpdate ? 'PUT' : 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(saleData)
	}
);
```

This sends a SECOND request after `SaleForm` already sent its own. The `data` parameter is whatever `SaleForm.onSubmit()` passed back — which is the API response from the first request. The API response from `listSales()` includes `coffee_name`, `wholesale`, `green_coffee_inv` — all computed fields.

Additionally, this is a **double-submit bug**: the sale gets created/updated twice. The second request sends enriched API response data (including `wholesale`) back to the server.

**Severity:** medium (double-submit + computed fields sent to PostgREST, likely causes intermittent 400s)

---

#### 6. `src/routes/roast/RoastProfileDisplay.svelte` — Hardcoded allowlist is brittle — low

The fix from PR #193 uses a hardcoded `NON_COLUMN_FIELDS` array:

```typescript
const NON_COLUMN_FIELDS = [
	'is_wholesale',
	'green_coffee_inv',
	'roast_temperatures',
	'roast_events',
	'coffee_catalog'
];
```

If a new join or computed field is added to the `listRoasts()` query, this list must be manually updated. A missed field will cause the same 400 error.

**Severity:** low (works today, maintenance risk)

---

#### 7. `src/routes/api/beans/+server.ts` POST handler (line 67-111) — Explicit field extraction — safe

The POST handler for creating beans explicitly picks known catalog fields from the request body using an `optionalCatalogFields` array. The inventory insert uses `addToInventory()` which takes explicit parameters. No computed field leakage.

**Severity:** safe

---

#### 8. `src/routes/api/chat/execute-action/+server.ts` — Explicit allowlists throughout — safe

All action handlers (update_bean, update_roast_notes, record_sale, etc.) use explicit `validFields` arrays or construct update objects field-by-field. No spread of untrusted input.

**Severity:** safe

---

#### 9. `src/routes/roast/+page.svelte:624` — PUT with explicit fields — safe

The roast page's save-to-database PUT sends only `temperatureEntries`, `eventEntries`, and `last_updated` — all explicitly constructed. No spread of the profile object.

**Severity:** safe

---

#### 10. `src/routes/roast/RoastProfileForm.svelte:181-192` — Explicit field construction — safe

Creates new roast profiles with explicitly constructed `dataForAPI` object. Each field is individually mapped. No spread of fetched data.

**Severity:** safe

---

## Pattern 2: Using Wrong Supabase Client (anon vs session)

### Background

The correct pattern for server routes is to use `locals.supabase` — the session-scoped client created in `hooks.server.ts` that respects RLS. Using `createClient()` from `$lib/supabase` creates a browser client with the anon key, which on the server side has no session context and bypasses user-scoped RLS.

### Findings

#### 1. `src/routes/api/roast-chart-settings/+server.ts` — FIXED — safe

Previously created its own client with `createClient()`. Now correctly uses `locals.supabase`. Fixed prior to this audit.

**Severity:** safe (fixed)

---

#### 2. `src/routes/subscription/success/+page.server.ts:2,10` — Uses anon client in server context — critical

```typescript
import { createClient } from '$lib/supabase';
// ...
const supabase = createClient();
const { data: customerData } = await supabase
	.from('stripe_customers')
	.select('customer_id')
	.eq('user_id', user.id)
	.maybeSingle();
```

This creates a browser client (`createBrowserClient` from `@supabase/ssr`) in a `+page.server.ts` context. This client uses the anon key with no session context, meaning:

- It bypasses RLS policies on `stripe_customers`
- It can potentially read any user's Stripe customer ID (if RLS is enforced, it may read nothing; if the anon role has SELECT on `stripe_customers`, it reads everything)

**The fix:** Use `locals.supabase` which is available in the load function:

```typescript
const supabase = locals.supabase;
```

**Severity:** critical — auth bypass on sensitive financial data. Even if RLS currently blocks anon reads of `stripe_customers`, this is a ticking time bomb if RLS policies change.

---

#### 3. `src/lib/server/principal.ts:14` — Module-level anon client for bearer token resolution — medium

```typescript
const bearerSupabase = createClient();
```

This creates a module-level browser client used by `resolveBearerSessionPrincipal()` to call `bearerSupabase.auth.getUser(token)`. This is specifically for validating Bearer tokens in API requests (not cookie sessions).

**Analysis:** The `auth.getUser()` call validates JWT tokens against the Supabase auth service — it doesn't query user data tables. The anon key is sufficient for token validation. However:

- Using `createBrowserClient` (browser SSR client) in a server module is architecturally wrong
- The client persists auth state in the module scope, which could leak between requests in a server environment
- Better pattern: use `createClient` from `@supabase/supabase-js` directly (like `supabase-admin.ts` does) with the anon key for auth-only operations

**Severity:** medium — functional but architecturally wrong. The browser client's session persistence could theoretically cause cross-request state leakage in a serverless or long-running server context.

---

#### 4. `src/lib/services/stripe-webhook.ts:4,80` — Intentional admin client — safe (excluded)

Uses `createClient` from `@supabase/supabase-js` with `SUPABASE_SERVICE_ROLE_KEY`. This is the intentional admin client pattern for webhook processing where no user session exists.

**Severity:** safe (intentional, excluded per audit scope)

---

#### 5. `src/lib/supabase-admin.ts` — Intentional admin client — safe (excluded)

Standard admin client creation. Excluded per audit scope.

---

## Pattern 3: Consolidation Recommendations

### 3A: Client-side field stripping utility

**Problem:** Multiple components spread fetched objects (with joins) into PUT bodies. Some rely on server-side allowlists (beans), some have client-side hardcoded denylist (roast profiles), and some have no protection (sales).

**Proposed utility:** `src/lib/utils/supabase-fields.ts`

```typescript
/**
 * Strip fields that aren't actual database columns before sending to API.
 * Use the allowlist pattern (safer than denylist — new joins are automatically excluded).
 */

// Column definitions per table
export const GREEN_COFFEE_INV_COLUMNS = [
	'id',
	'rank',
	'notes',
	'purchase_date',
	'purchased_qty_lbs',
	'bean_cost',
	'tax_ship_cost',
	'last_updated',
	'user',
	'catalog_id',
	'stocked',
	'cupping_notes'
] as const;

export const ROAST_PROFILES_COLUMNS = [
	'roast_id',
	'user',
	'coffee_id',
	'coffee_name',
	'batch_name',
	'roast_date',
	'last_updated',
	'oz_in',
	'oz_out',
	'weight_loss_percent',
	'roast_notes',
	'roast_targets',
	'title',
	'roaster_type',
	'roaster_size',
	'roast_uuid',
	'temperature_unit',
	'charge_time',
	'dry_end_time',
	'fc_start_time',
	'fc_end_time',
	'sc_start_time',
	'drop_time',
	'cool_time',
	'charge_temp',
	'dry_end_temp',
	'fc_start_temp',
	'fc_end_temp',
	'sc_start_temp',
	'drop_temp',
	'cool_temp',
	'dry_percent',
	'maillard_percent',
	'development_percent',
	'total_roast_time',
	'chart_x_min',
	'chart_x_max',
	'chart_y_min',
	'chart_y_max',
	'chart_z_min',
	'chart_z_max',
	'data_source'
] as const;

export const SALES_COLUMNS = [
	'id',
	'user',
	'green_coffee_inv_id',
	'oz_sold',
	'price',
	'buyer',
	'batch_name',
	'sell_date',
	'purchase_date'
] as const;

type ColumnName = string;

/**
 * Pick only fields that are actual database columns.
 * Prefer this over denylist (NON_COLUMN_FIELDS) — it's forward-safe.
 */
export function pickColumns<T extends Record<string, unknown>>(
	obj: T,
	columns: readonly ColumnName[]
): Partial<T> {
	const columnSet = new Set(columns);
	return Object.fromEntries(
		Object.entries(obj).filter(([key]) => columnSet.has(key))
	) as Partial<T>;
}
```

**Consumers that should use it:**

1. `RoastProfileDisplay.svelte` — replace hardcoded `NON_COLUMN_FIELDS` denylist with `pickColumns(cleanedProfile, ROAST_PROFILES_COLUMNS)`
2. `BeanProfileTabs.svelte` `saveChanges()` — replace `...selectedBean` spread with `pickColumns(dataForAPI, GREEN_COFFEE_INV_COLUMNS)`
3. `BeanProfileTabs.svelte` `handleCuppingSave()` — same treatment
4. `SaleForm.svelte` — use `pickColumns(cleanedSale, SALES_COLUMNS)` before sending
5. `api/profit/+server.ts` PUT/POST handlers — add server-side column allowlist like `api/beans/+server.ts` already has

**Why allowlist over denylist:** The `NON_COLUMN_FIELDS` approach (denylist) in `RoastProfileDisplay.svelte` requires manual updates when new joins are added. An allowlist approach (only send known columns) is forward-safe — new joins are automatically excluded.

### 3B: Server-side column filtering for sales API

The `PUT /api/profit` handler should add a `validColumns` allowlist, matching the pattern already used by `PUT /api/beans`:

```typescript
const validColumns = [
	'green_coffee_inv_id',
	'oz_sold',
	'price',
	'buyer',
	'batch_name',
	'sell_date',
	'purchase_date'
];
const updateData = Object.fromEntries(
	Object.entries(rawUpdateData).filter(([key]) => validColumns.includes(key))
);
```

### 3C: Fix double-submit in profit page

`profit/+page.svelte` `handleFormSubmit()` sends a second PUT/POST after `SaleForm` already submitted. Either:

- Remove the duplicate fetch from `handleFormSubmit()` and only use it for data refresh
- OR remove the fetch from `SaleForm` and let the parent handle submission

### 3D: Fix wrong Supabase client in subscription success

Replace `createClient()` with `locals.supabase` in `subscription/success/+page.server.ts`.

### 3E: Fix browser client usage in principal.ts

Replace the module-level `createClient()` (browser client) with a proper server-side client:

```typescript
import { createClient } from '@supabase/supabase-js';
const bearerSupabase = createClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY);
```

This uses the raw Supabase JS client (no browser session persistence) which is appropriate for server-side JWT validation.

---

## Summary

| Pattern                  | Findings | Critical | Medium | Low   | Safe  |
| ------------------------ | -------- | -------- | ------ | ----- | ----- |
| 1: Computed field leaks  | 10       | 0        | 3      | 2     | 5     |
| 2: Wrong Supabase client | 5        | 1        | 1      | 0     | 3     |
| **Total**                | **15**   | **1**    | **4**  | **2** | **8** |

### Priority fixes (recommended PR order)

1. **Critical:** `subscription/success/+page.server.ts` — switch to `locals.supabase` (1 line change)
2. **Medium:** `api/profit/+server.ts` — add server-side `validColumns` allowlist for PUT/POST handlers
3. **Medium:** `profit/+page.svelte` — remove duplicate fetch in `handleFormSubmit()`
4. **Medium:** `profit/SaleForm.svelte` — strip non-column fields before sending (or rely on server fix from #2)
5. **Medium:** `lib/server/principal.ts` — replace browser client with raw Supabase client
6. **Low:** Extract shared `pickColumns()` utility and apply across all save paths
7. **Low:** Replace `RoastProfileDisplay.svelte` NON_COLUMN_FIELDS denylist with allowlist pattern
