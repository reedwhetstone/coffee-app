# Page Loading Optimization Plan

## Overview

This plan addresses the page loading performance issue where `/catalog`, `/beans`, and `/roast` routes have delayed transitions due to blocking server-side data loading, while `/profit` has immediate transitions with proper skeleton loading.

## Root Cause Analysis

### Current Behavior

- **✅ /profit**: No `+page.server.ts` → Immediate page render → Client-side API calls → Skeleton → Data loaded
- **❌ /catalog**: `+page.server.ts` loads 15 records + schema → Blocks transition until complete
- **❌ /beans**: `+page.server.ts` loads inventory + catalog with joins → Blocks transition until complete
- **❌ /roast**: `+page.server.ts` loads roast profiles → Blocks transition until complete

### Skeleton Display Issues

- All routes have skeleton components but they're only shown when `!data || !data.data`
- Since server load functions provide data, skeleton conditions never trigger
- Pages wait for backend response before showing any content

## Strategic Revisions

Based on analysis of the strategic questions raised, this plan incorporates the following key insights:

### 1. Hybrid Loading Strategy

- **`/catalog`**: Keep progressive hydration (SEO benefits outweigh performance cost)
- **`/beans` & `/roast`**: Full client-side loading (optimal for private user data)
- **`/profit`**: Already optimized (reference implementation)

### 2. Enhanced Cache Strategy

- Implement stale-while-revalidate respecting existing 1-hour TTL
- Add hover preloading for navigation links
- Leverage existing FilterStore caching infrastructure

### 3. Unified Loading States

- Create consistent skeleton/error/retry patterns across routes
- Fix current skeleton logic that never triggers with server loads
- Ensure robust browser navigation (back/forward) handling

## Solution Strategy

Convert blocking server-side data loading to non-blocking client-side loading while leveraging 100% existing infrastructure and maintaining SEO benefits where critical.

---

## Phase 1: Convert Server Loads to Client-Side Loading

### Route-Specific Changes

#### 1. /catalog Route Optimization _(Modified Approach)_

**Progressive Hydration Strategy:**

```typescript
// MODIFY: src/routes/catalog/+page.server.ts
// Keep minimal SSR for SEO - first 5-10 items only
const { data: stockedData } = await locals.supabase
	.from('coffee_catalog')
	.select('*')
	.eq('stocked', true)
	.order('arrival_date', { ascending: false })
	.limit(5); // Reduced for faster initial load

// Add skeleton placeholders for remaining items
```

**✅ Leverage Existing Infrastructure:**

- `/api/catalog` endpoint for lazy-loading remaining items
- 1-hour TTL caching + stale-while-revalidate pattern
- FilterStore server-side mode for client-side pagination

**Update Page Component:**

```typescript
// src/routes/catalog/+page.svelte
// Render SSR data immediately
// Show skeletons for remaining items
// Use FilterStore for lazy-loading and filtering
// Maintain SEO benefits while improving perceived performance
```

#### 2. /beans Route Optimization

**Remove Server Load:**

```typescript
// DELETE: src/routes/beans/+page.server.ts (lines 65-93)
const { data: greenCoffeeData, error } = await buildGreenCoffeeQuery(supabase)
	.eq('user', user.id)
	.order('purchase_date', { ascending: false });

// DELETE: Catalog data fetch (lines 77-85)
const { data: catalogData, error: catalogError } = await supabase
	.from('coffee_catalog')
	.select('*')
	.eq('stocked', true)
	.order('name');
```

**✅ Leverage Existing Infrastructure:**

- `/api/beans` endpoint with complete CRUD operations
- `buildGreenCoffeeQuery()` and `processGreenCoffeeData()` utilities
- Share token support for public links
- Auto stocked status updates

**Update Page Component:**

```typescript
// src/routes/beans/+page.svelte
// Change skeleton condition from !data to isLoading state
// Use client-side API calls via FilterStore or direct fetch
// Maintain all existing functionality (forms, share links, etc.)
```

#### 3. /roast Route Optimization

**Remove Server Load:**

```typescript
// DELETE: src/routes/roast/+page.server.ts (lines 17-37)
const { data: roastProfiles, error } = await locals.supabase
	.from('roast_profiles')
	.select('*')
	.eq('user', user.id)
	.order('roast_date', { ascending: false });
```

**✅ Leverage Existing Infrastructure:**

- **CREATE**: `/api/roast` endpoint (currently missing - roast route needs API endpoint)
- Weight loss percentage calculations
- Batch operations and coffee validation
- Automatic stocked status updates

**Update Page Component:**

```typescript
// src/routes/roast/+page.svelte
// Change skeleton condition to use loading state
// Initialize via client-side API calls
// Maintain FilterStore integration for grouping/filtering
```

---

## Phase 2: Fix Skeleton Loading Logic

### Current Issues

```typescript
// PROBLEM: This condition never triggers with server load data
{#if !data || !data.data}
  <BeansPageSkeleton />
{:else}
  <!-- Page content -->
{/if}
```

### Solution Pattern

```typescript
// SOLUTION: Use loading state instead of data presence
let isLoading = $state(true);
let pageData = $state([]);

{#if isLoading}
  <BeansPageSkeleton />
{:else if pageData.length === 0}
  <!-- Empty state -->
{:else}
  <!-- Page content with data -->
{/if}
```

### Specific Fixes

#### /catalog Skeleton Fix

```typescript
// Use FilterStore loading state
{#if $filterStore.isLoading}
  <CatalogPageSkeleton />
{:else}
  <!-- Content -->
{/if}
```

#### /beans Skeleton Fix

```typescript
// Connect to client-side loading
let dataLoading = $state(true);

{#if dataLoading || !$filteredData}
  <BeansPageSkeleton />
{:else}
  <!-- Content with $filteredData -->
{/if}
```

#### /roast Skeleton Fix

```typescript
// Similar pattern for roast profiles
let profilesLoading = $state(true);

{#if profilesLoading}
  <RoastPageSkeleton />
{:else}
  <!-- Content -->
{/if}
```

---

## Phase 3: Optimize Data Flow

### FilterStore Integration

#### Client-Side Mode Configuration

```typescript
// FilterStore.initializeForRoute() handles both modes:
// - /catalog: Server-side mode with API pagination
// - /beans, /roast: Client-side mode with full data processing

// ✅ Already implemented in filterStore.ts lines 180-244
```

#### Loading State Management

```typescript
// ✅ Built-in loading states:
// - isLoading: Server-side requests
// - processing: Client-side data processing
// - initialized: Store ready state

// Connect these to skeleton display logic
```

#### Data Fetching Patterns

```typescript
// Client-side initialization pattern:
$effect(() => {
	const fetchData = async () => {
		setLoading(true);
		try {
			const response = await fetch('/api/endpoint');
			const data = await response.json();
			// Process and set data
		} catch (error) {
			// Handle error
		} finally {
			setLoading(false);
		}
	};

	fetchData();
});
```

### API Response Optimization

#### Consistent Data Format

```typescript
// ✅ All APIs return consistent formats:
// /api/beans: { data: ProcessedData[], searchState: {} }
// /api/roast-profiles: { data: RoastProfile[] }
// /api/catalog: { data: CoffeeItem[], pagination: {} }
```

#### Error Handling

```typescript
// ✅ All APIs have proper error responses:
// { error: string } with appropriate HTTP status codes
// Client components should handle these consistently
```

---

## Implementation Details

### Existing Infrastructure Utilization

#### API Endpoints (Mostly Ready)

- ✅ `/api/catalog` - Server-side filtering, pagination, caching
- ✅ `/api/beans` - CRUD with complex joins and processing
- 🔄 **NEED**: `/api/roast` endpoint (roast route currently only has server load)

#### Data Processing (100% Ready)

- ✅ `buildGreenCoffeeQuery()` - Complex database joins
- ✅ `processGreenCoffeeData()` - Data normalization
- ✅ FilterStore client/server mode handling

#### Authentication (100% Ready)

- ✅ `safeGetSession()` pattern in all APIs
- ✅ User ownership verification
- ✅ Role-based access control

#### Loading States (100% Ready)

- ✅ Skeleton components for all routes
- ✅ FilterStore loading management
- ✅ Error handling patterns

### Zero Data Debt Approach

**No New Infrastructure Required:**

- All required APIs are production-ready
- Data processing utilities are battle-tested
- Authentication patterns are consistent
- Error handling is comprehensive
- Loading states are implemented

**Maintains All Features:**

- Share tokens for beans
- Complex database relationships
- Auto stocked status updates
- Server-side pagination for catalog
- Client-side filtering for beans/roast
- Form submissions and CRUD operations

---

## Testing Strategy

### Performance Validation

1. **Page Transition Speed**: Measure time from navigation click to skeleton display
2. **Data Loading Time**: Measure API response times vs current server loads
3. **User Experience**: Ensure skeleton states display immediately

### Functional Testing

1. **All Existing Features**: Verify no functionality is lost
2. **Error Handling**: Test network failures and authentication issues
3. **Data Integrity**: Confirm processed data matches server load results

### Regression Testing

1. **Filter Store**: Ensure filtering/sorting still works
2. **Form Submissions**: Verify CRUD operations function properly
3. **Share Links**: Test public sharing functionality
4. **Authentication**: Confirm proper access control

---

## Expected Outcomes

### Performance Improvements

- **Immediate page transitions** like /profit route
- **Consistent skeleton loading** across all routes
- **Better perceived performance** with instant feedback
- **Maintained functionality** with zero feature loss

### User Experience

- **No navigation delays** - pages render immediately
- **Clear loading states** - users see progress immediately
- **Responsive feedback** - instant skeleton → loading → data flow
- **Consistent behavior** across all routes

### Technical Benefits

- **Reduced server load** - no blocking database queries on navigation
- **Better caching** - leverage existing API caching strategies
- **Improved scalability** - client-side processing reduces server bottlenecks
- **Code consistency** - all routes follow same loading pattern

---

## Success Metrics

1. **Page transition time**: < 50ms from click to skeleton display
2. **Skeleton visibility**: 100% of navigations show loading state
3. **Feature parity**: 0 functionality lost during conversion
4. **Error rate**: No increase in client-side errors
5. **User satisfaction**: Improved perceived performance

This plan leverages existing, production-ready infrastructure to solve the page loading issue without introducing any technical debt or new dependencies.
