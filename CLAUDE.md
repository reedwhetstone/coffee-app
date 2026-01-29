# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> **Note**: This documentation focuses on stable architectural patterns and development guidelines. Avoid including implementation details that may change over time (specific database queries, current bugs, temporary workarounds, etc.). Keep guidance general and architectural.

## CRITICAL REQUIREMENTS

### SvelteKit 5 Syntax Enforcement

**MANDATORY**: This project uses SvelteKit 5 with runes. The following patterns are REQUIRED and violations will cause runtime errors:

**✅ REQUIRED SvelteKit 5 Patterns:**

```typescript
// Props definition - MANDATORY for all components
let { propName, optionalProp = defaultValue } = $props<{ propName: Type; optionalProp?: Type }>();

// Bindable props for two-way binding
let { value = $bindable() } = $props<{ value: number }>();

// Reactive state - MANDATORY for mutable variables
let reactiveVar = $state(initialValue);
let objectState = $state({ key: 'value' });
let arrayState = $state<Type[]>([]);

// Computed values - MANDATORY for derived calculations
let computedValue = $derived(reactiveVar * 2);
let derivedFromMultiple = $derived(() => {
	return complexCalculation(reactiveVar, otherState);
});

// Side effects - MANDATORY for reactive side effects
$effect(() => {
	// Side effect logic that runs when dependencies change
	console.log('reactiveVar changed:', reactiveVar);
});

// Cleanup in effects
$effect(() => {
	const timer = setInterval(() => {}, 1000);
	return () => clearInterval(timer); // Cleanup function
});
```

**❌ FORBIDDEN SvelteKit 4 Patterns:**

```typescript
// NEVER use export let - will cause runtime errors
export let propName; // ❌ CAUSES RUNTIME ERROR

// NEVER use $: reactive statements - will cause runtime errors
$: computedValue = reactiveVar * 2; // ❌ CAUSES RUNTIME ERROR
$: console.log(reactiveVar); // ❌ CAUSES RUNTIME ERROR

// NEVER use old store patterns
import { page } from '$app/stores'; // ❌ USE $app/state instead
console.log($page.url); // ❌ CAUSES RUNTIME ERROR

// NEVER mutate non-$state variables expecting reactivity
let count = 0;
count++; // ❌ Won't trigger updates - use $state instead
```

**IMMEDIATE VERIFICATION**: Before writing ANY Svelte component:

1. **Props**: Use `$props<{}>()` pattern exclusively
2. **State**: Use `$state()` for any variable that changes
3. **Computed**: Use `$derived()` instead of `$:` reactive statements
4. **Effects**: Use `$effect()` instead of `$:` side effects

### Database Schema Validation Requirements

**MANDATORY**: Before any database operation, you must:

1. **Verify Column Existence**: Confirm all referenced columns exist in the target table
2. **Validate Foreign Key Syntax**: Use explicit foreign key syntax: `related_table!foreign_key_column`
3. **Filter API Data**: Only send columns that exist in the target table to update/insert operations
4. **Test Query Structure**: Ensure joins work with actual data before implementation

**Required Data Filtering Pattern:**

```typescript
// ✅ Always filter data for API operations
const validColumns = ['column1', 'column2', 'column3']; // Define valid table columns
const updateData = Object.fromEntries(
	Object.entries(rawData).filter(([key]) => validColumns.includes(key))
);
```

## Development Commands

### Core Development

- `pnpm dev` - Start development server
- `pnpm build` - Build for production (runs sync + vite build)
- `pnpm preview` - Preview production build
- `pnpm sync` - Sync SvelteKit types

### Code Quality

- `pnpm lint` - Run prettier check and eslint
- `pnpm format` - Format code with prettier
- `pnpm check` - Run svelte-check for type checking
- `pnpm check:watch` - Run svelte-check in watch mode

### Testing

- `pnpm test` - Run all tests once
- `pnpm test:unit` - Run tests in watch mode

### Known Pre-Existing Issues

- **`pnpm check`** reports ~291 errors, mostly from outdated Supabase generated types (`database.types.ts` has `never` types for tables). These are pre-existing and unrelated to feature work.
- **`pnpm build`** fails without environment variables (`PUBLIC_SUPABASE_URL`, etc.). Build verification requires a properly configured `.env` file.
- **When verifying changes**, filter `pnpm check` output to only your modified files to confirm no new errors were introduced:
  ```bash
  pnpm check 2>&1 | grep "Error:" | grep "YourModifiedFile"
  ```

## Architecture Overview

This is a **SvelteKit 5** coffee tracking and roasting application with the following key components:

### Tech Stack

- **Frontend**: SvelteKit 5, TypeScript, TailwindCSS, D3.js (charts)
- **Backend**: SvelteKit API routes, Supabase (PostgreSQL + Auth)
- **Deployment**: Vercel (adapter-vercel)
- **AI/ML**: OpenAI embeddings for semantic search/RAG
- **Payments**: Stripe integration

### Authentication & Authorization

- **Supabase Auth** with Google OAuth integration
- **Role-based access**: `viewer`, `member` roles
- **Protected routes**: Some routes require `member` role
- **Session management**: JWT validation in `hooks.server.ts`
- **Auth flow**: OAuth callback handling

### Database Structure (Supabase)

**Core Entity Relationships:**

- **coffee_catalog**: Master coffee data (name, description, processing details)
- **green_coffee_inv**: User's personal inventory → `catalog_id` FK to `coffee_catalog`
- **roast_profiles**: Roasting sessions → `coffee_id` FK to `green_coffee_inv`
- **roast_temperatures**: Normalized temperature/time data → `roast_id` FK to `roast_profiles`
- **roast_events**: Normalized roast event markers → `roast_id` FK to `roast_profiles`
- **artisan_import_log**: Artisan file import records → `roast_id` FK to `roast_profiles`
- **sales**: Sale transactions → `green_coffee_inv_id` FK to `green_coffee_inv`
- **user_roles**: User auth/permissions → Referenced by all user-owned tables

> **Note**: `profile_log` is a legacy table — the normalized schema uses `roast_temperatures` and `roast_events` instead.

**Key Foreign Key Patterns:**

- Use explicit syntax: `coffee_catalog!catalog_id` for joins
- All user data tables reference `user_roles.id`
- Roast profiles link to inventory (not directly to catalog)
- Vector embeddings stored in `coffee_catalog` for semantic search

**Cascade Delete Order (green_coffee_inv):**

When deleting a bean from `green_coffee_inv`, delete dependents in this order:
1. `sales` (FK: `green_coffee_inv_id`)
2. `artisan_import_log` (FK: `roast_id` via `roast_profiles`)
3. `roast_temperatures` (FK: `roast_id` via `roast_profiles`)
4. `roast_events` (FK: `roast_id` via `roast_profiles`)
5. `roast_profiles` (FK: `coffee_id`)
6. `green_coffee_inv` (the record itself)
7. `coffee_catalog` (only if user-owned private coffee with no other references)

When adding new FK-dependent tables, always update all cascade delete handlers in `/api/beans/+server.ts` and `/api/clear-roast/+server.ts`.

### Key Services

- **RAGService**: Semantic search using OpenAI embeddings
- **EmbeddingService**: OpenAI embedding generation
- **Stripe integration**: Full payment flow with webhooks

### Route Structure

- **Home**: Coffee catalog with RAG-powered search
- **Beans**: Personal coffee inventory management
- **Roast**: Roasting profiles with D3.js charts (member-only)
- **Profit**: Sales tracking (member-only)
- **Subscription**: Stripe payment flow

### Important Implementation Details

- **Semantic Search**: Uses vector embeddings for coffee recommendations
- **Role Guards**: Route protection handled in hooks
- **Stripe Webhooks**: Handle subscription state changes
- **D3.js Integration**: Custom roasting profile charts
- **Cookie Management**: Custom middleware for cookie consent

### Environment Setup

- Requires `OPENAI_API_KEY` for embeddings
- Supabase keys: `PUBLIC_SUPABASE_URL`, `PUBLIC_SUPABASE_ANON_KEY`
- Stripe keys for payment processing

### Common Patterns

- Server load functions use `locals.safeGetSession()` for auth
- API routes follow `/api/{feature}/+server.ts` pattern
- Components use stores for shared state
- Database operations go through Supabase client with proper type safety

### Component Architecture Guidelines

**Form Component Responsibilities:**

- Handle UI state and validation only
- Delegate all data operations to parent components
- Never make direct API calls - use callback props
- Return processed form data to parent via callbacks

**Data Flow Pattern:**

- Parent component handles API calls and data management
- Form component receives data via props, returns data via callbacks
- Use centralized stores/services for complex shared state
- Avoid dual submission flows (component + parent both calling APIs)

**Modal Component Pattern:**

Some form components (e.g., `RoastProfileForm`) are self-contained modals — they create their own `fixed inset-0` overlay, backdrop, and centering. When rendering these components:

```svelte
<!-- ✅ CORRECT: Render self-contained modal directly -->
{#if isFormVisible}
	<RoastProfileForm {selectedBean} onClose={hideForm} onSubmit={handleSubmit} />
{/if}

<!-- ❌ WRONG: Don't wrap self-contained modals in another modal -->
{#if isFormVisible}
	<div class="fixed inset-0 z-50 ...">
		<div class="max-w-2xl ...">
			<RoastProfileForm ... />  <!-- Creates its own fixed overlay! -->
		</div>
	</div>
{/if}
```

Double-wrapping causes layout overflow (inner modal breaks out of outer constraints) and doubled backdrops.

**Navigation Pattern:**

Always use SvelteKit's `goto()` for internal navigation instead of `window.location.href`:

```typescript
// ✅ Client-side navigation (fast, preserves app state)
import { goto } from '$app/navigation';
goto(`/roast?beanId=${id}&beanName=${encodeURIComponent(name)}`);

// ❌ Full page reload (slow, resets app state)
window.location.href = `/roast?beanId=${id}&beanName=${name}`;
```

When reading URL params with `URLSearchParams.get()`, values are already decoded — do not wrap with `decodeURIComponent()`.

## SvelteKit Development Guidelines

### Reactive State Management Patterns

**MANDATORY for SvelteKit 5 applications:**

### Circular Dependency Prevention

**CRITICAL - Prevent Infinite Loops:**

- **NEVER use `$effect()` to sync derived values back to `$state()` variables**
- **NEVER read `$filteredData` in effects that update state variables**
- **Use `$derived()` for computed values, call as functions in templates: `sortedData()`**
- **Separate concerns**: Filter store initialization vs data processing effects

### Reactive Primitive Selection

- **`$state()`**: Mutable data (user input, selections, loading states)
- **`$derived()`**: Computed values from reactive data (filtering, sorting, transformations)
- **`$effect()`**: Side effects only (API calls, DOM manipulation, logging)
- **Template Usage**: Call derived functions: `{#each sortedItems() as item}`

**State Variable Guidelines:**

- **Use `$state()` for ALL mutable variables** that need to trigger reactivity
- **Use `$derived()` for ALL computed values** that depend on reactive state
- **Use `$effect()` for ALL side effects** that should run when dependencies change
- **NEVER use `$:` reactive statements** - they will cause runtime errors

**Dependency Management for $derived() and $effect():**

```typescript
// ✅ CORRECT: Include dependencies that should trigger recalculation
let currentTime = $state(Date.now());
let isActive = $state(true);

// ✅ Dependencies automatically tracked
let displayTime = $derived(() => {
	if (!isActive) return '--:--';
	return formatTime(currentTime);
});

// ✅ Effect runs when currentTime or isActive changes
$effect(() => {
	if (isActive) {
		console.log('Time updated:', currentTime);
	}
});

// ✅ Manual dependency control with untrack()
import { untrack } from 'svelte';
let calculation = $derived(() => {
	const time = currentTime; // Tracked
	const config = untrack(() => expensiveConfig); // Not tracked
	return processTime(time, config);
});
```

**Timer and Interval Patterns:**

```typescript
// ✅ CORRECT: Timer state updates trigger reactive recalculations
let seconds = $state(0);
let minutes = $derived(Math.floor(seconds / 60));

// ✅ Include timer values as dependencies for live updates
let milestoneCalc = $derived(() => {
	const currentSeconds = seconds; // Dependency for live updates
	return calculateMilestones(data, currentSeconds * 1000);
});

// ✅ Proper timer cleanup
$effect(() => {
	if (isRunning) {
		const timer = setInterval(() => {
			seconds++;
		}, 1000);
		return () => clearInterval(timer);
	}
});
```

**Common Reactive Patterns:**

```typescript
// ✅ Loading states
let loading = $state(false);
let data = $state(null);
let error = $state(null);

// ✅ Form validation
let formData = $state({ name: '', email: '' });
let isValid = $derived(formData.name.length > 0 && formData.email.includes('@'));

// ✅ Conditional rendering data
let showAdvanced = $state(false);
let visibleItems = $derived(() => {
	return showAdvanced ? allItems : basicItems;
});

// ✅ API calls triggered by state changes
$effect(() => {
	if (selectedId) {
		loadDetails(selectedId);
	}
});
```

**Page Store Migration (SvelteKit 2+):**

- Replace `import { page } from '$app/stores'` with `import { page } from '$app/state'`
- Remove `$` prefix from page references: `$page.url` becomes `page.url`
- Update all reactive statements that depend on page to use `$effect()` or `$derived()`

**Component Lifecycle:**

- Use `onMount()` for initialization that needs DOM access
- Use `$effect()` for reactive side effects
- Use cleanup functions returned from `onMount()` or `$effect()` for teardown

### Data Loading Patterns

**Server Load vs API Endpoints:**

Use **Server Load Functions** (`+page.server.ts`) when:

- Initial page data loading
- SEO/SSR requirements
- Simple, static data that doesn't change frequently
- Data needed for page rendering

Use **API Endpoints** (`/api/*/+server.ts`) when:

- Dynamic data updates
- CRUD operations
- Data shared across multiple pages
- Complex data transformations
- Better error handling needed

### TypeScript Best Practices

**Common TypeScript Patterns:**

- Always provide type annotations for reduce() accumulators
- Use proper typing for Object.entries() when destructuring
- Add null checks for optional chaining operations
- Define interfaces for complex objects passed between components

**Safe Property Access:**

```typescript
// ✅ Handle both direct and nested property access
const displayName = item.nested_object?.name || item.name || 'Unknown';
```

**Defensive Programming Requirements:**

```typescript
// ✅ MANDATORY array validation before operations
const safeArray = Array.isArray(data) ? data : [];
const results = safeArray.map((item) => processItem(item));

// ✅ MANDATORY API response validation
const responseData = response.data || [];
const validatedResponse = Array.isArray(responseData) ? responseData : [];

// ✅ MANDATORY fallback for undefined/null arrays
availableItems = data?.items?.filter((item) => item.active) || [];
```

## Database Development Guidelines

### Schema Validation Requirements

**MANDATORY Pre-Operation Checklist:**

Before any database query or API operation:

1. **Column Verification**: Confirm all referenced columns exist in target table
2. **Foreign Key Validation**: Use explicit syntax: `table!foreign_key_column`
3. **Data Structure Validation**: Ensure data matches table schema
4. **Join Testing**: Test complex joins with actual data before implementation

### API Data Filtering Patterns

**Required for Update/Insert Operations:**

```typescript
// ✅ Define valid columns for each table
const greenCoffeeInvColumns = [
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

// ✅ Filter incoming data to prevent schema cache errors
const updateData = Object.fromEntries(
	Object.entries(rawUpdateData).filter(([key]) => validColumns.includes(key))
);

// ✅ Separate update and select operations
// First: Update without joins
const { error: updateError } = await supabase.from('table_name').update(filteredData).eq('id', id);

// Then: Select with joins
const { data: updatedData } = await supabase
	.from('table_name')
	.select('*, related_table!foreign_key(*)')
	.eq('id', id);
```

### Schema Cache Error Prevention

**Common Causes and Solutions:**

1. **Joined Data in Updates**: Never send complete objects with joined data to update endpoints
2. **Invalid Column References**: Always validate column names against actual table schema
3. **Foreign Key Syntax**: Use explicit syntax for relationships

**Database Schema Error Debugging Workflow:**

When encountering "column does not exist" errors:

1. **Verify Table Schema**: Check actual table columns vs code references
2. **Fix API Endpoint**: Update database queries to use correct schema relationships
3. **Update Frontend**: Modify forms/components to match new data structure
4. **Test Integration**: Verify end-to-end data flow works

**API vs Frontend Modification Decision Tree:**

- **Fix API When**: Column references are incorrect, joins are malformed, schema has changed
- **Fix Frontend When**: API is correct but component expects old data structure
- **Fix Both When**: Schema migration requires coordinated changes

**Submission Flow Conflict Resolution:**
When components and parents both handle data operations:

1. **Identify Conflict**: Look for dual API calls (component + parent)
2. **Choose Single Responsibility**: Form components delegate to parents
3. **Update Data Flow**: Remove component API calls, use callback props
4. **Validate Response Handling**: Ensure parent handles all response formats

**Debugging Approach:**

```typescript
// ✅ Add comprehensive logging for schema issues
console.log('Update data keys:', Object.keys(updateData));
console.log('Filtered update data:', JSON.stringify(updateData, null, 2));

// ✅ Implement fallback queries
if (error) {
	console.warn('Join query failed, falling back to basic select:', error);
	// Fallback to simple query without joins
}
```

### Query Troubleshooting Approach

When database queries aren't working as expected:

1. **Start Simple**: Test basic queries without joins first
2. **Add Complexity Incrementally**: Add one join at a time
3. **Use Manual Joins for Complex Cases**: JavaScript joins can be more reliable than complex SQL joins
4. **Add Logging**: Use comprehensive logging to identify where queries fail
5. **Handle Serialization**: Ensure complex objects can be serialized for client transmission

### Common Patterns

```typescript
// ✅ Basic query pattern
const { data } = await supabase.from('main_table').select('*').eq('user', user.id);

// ✅ Simple join pattern with explicit foreign key
const { data } = await supabase
	.from('main_table')
	.select(
		`
    *,
    related_table!foreign_key_column (field1, field2)
  `
	)
	.eq('user', user.id);

// ✅ Manual join for complex cases
const { data: mainData } = await supabase.from('main_table').select('*');
const { data: relatedData } = await supabase.from('related_table').select('*');
const combined = mainData?.map((item) => ({
	...item,
	related: relatedData?.filter((rel) => rel.main_id === item.id) || []
}));
```

## Todo List Usage Guidelines

### Mandatory TodoWrite Usage

**REQUIRED - Use TodoWrite IMMEDIATELY when:**

- Feature requests affecting multiple files or components
- Any task requiring more than 2 distinct implementation steps
- Complex refactoring or architectural changes
- User provides multiple requirements (even if mentioned casually)
- Framework migrations or version updates
- Database schema modifications or API restructuring
- System-wide updates impacting multiple features/routes
- Non-trivial and complex tasks requiring careful planning

**Enhanced Trigger Recognition:**

- **Keywords**: "add feature", "implement", "create", "update", "refactor", "improve"
- **Multiple Actions**: Any sentence containing "and" linking different actions
- **Scope Indicators**: "across", "throughout", "all", "multiple"
- **Quality Gates**: "make sure", "ensure", "test", "validate"

### Proactive Todo Management

**IMMEDIATE Action Required:**

```typescript
// Example recognition patterns:
"Add dark mode and make sure tests pass" → CREATE TODOS IMMEDIATELY
"Implement user authentication with role-based access" → CREATE TODOS IMMEDIATELY
"Update the design to be more consistent" → CREATE TODOS IMMEDIATELY
"Create a new dashboard with charts and data" → CREATE TODOS IMMEDIATELY
```

**NEVER use TodoWrite when:**

- Single file edits or simple bug fixes
- Straightforward operations (single API call, simple component update)
- Immediate tasks completed in 1-2 steps
- Pure research or informational requests
- Reading files or understanding codebase
- Only one trivial task to complete
- Purely conversational or informational requests

### Todo Management Best Practices

**REQUIRED - Use TodoWrite for Reactive Debugging:**

- **Effect_update_depth_exceeded errors** (systematic debugging needed)
- **Multiple reactive effects coordination** (circular dependency risk)
- **Complex state transformations** affecting multiple components

**Task Creation and Organization:**

- Create specific, actionable items with clear deliverables
- Break complex tasks into smaller, manageable steps (3-5 subtasks max per main task)
- Use descriptive task names that clearly indicate the work required
- Include verification/testing steps as separate todos when applicable
- Set appropriate priority levels (high for critical path, medium for important, low for nice-to-have)

**Task Execution Workflow:**

- Mark todos as `in_progress` BEFORE starting work on them
- Complete todos IMMEDIATELY after finishing each step (don't batch completions)
- Only have ONE todo in `in_progress` at any given time
- Update todo status in real-time as work progresses

**Task Completion Criteria:**

- ONLY mark a task as completed when you have FULLY accomplished it
- If you encounter errors, blockers, or cannot finish, keep the task as `in_progress`
- When blocked, create a new task describing what needs to be resolved
- Never mark a task as completed if:
  - Tests are failing
  - Implementation is partial
  - You encountered unresolved errors
  - You couldn't find necessary files or dependencies

**Examples of Proper Todo Usage:**

_Complex Multi-Step Task (USE TodoWrite):_

```
User: "Add dark mode toggle to application settings and make sure tests pass"
✅ Creates todos:
1. Create dark mode toggle component
2. Add state management for theme
3. Update CSS for dark theme
4. Run tests and fix any failures
```

_Simple Single Task (DON'T use TodoWrite):_

```
User: "Add a comment to the calculateTotal function"
❌ Don't create todos - just do it directly
```

## API Design Patterns

### When to Create Different Components

**API Endpoints** (`/api/*/+server.ts`):

- External data operations (CRUD for database entities)
- Operations that require authentication/authorization
- Features that might be called from multiple places
- Complex business logic that belongs on the server

**Shared Utilities** (`src/lib/server/*.ts`):

- Reusable logic used by multiple API endpoints
- Database operation helpers
- Complex calculations or data transformations
- Authentication/validation functions

**Inline Functions**:

- Simple, endpoint-specific operations
- One-time transformations within a single file
- Basic data formatting or validation

## UI/Dashboard Component Guidelines

### Design System Consistency

When creating new UI components, especially dashboards:

**Color Scheme:**

- Primary backgrounds: `bg-background-primary-light`, `bg-background-secondary-light`
- Accent elements: `bg-background-tertiary-light`
- Text colors: `text-text-primary-light`, `text-text-secondary-light`
- KPI values: Use semantic colors (`text-green-500`, `text-blue-500`, etc.)

**Layout Patterns:**

- Page headers: Title + subtitle with consistent spacing
- Grid layouts: `grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4`
- Card components: `rounded-lg bg-background-secondary-light p-4`
- Responsive design: Mobile-first with sm/lg breakpoints

### KPI Card Guidelines

- **Header**: Descriptive name in small text
- **Value**: Large, bold text with semantic color
- **Context**: Small supplementary text below value
- **Calculations**: Handle edge cases (division by zero, null values)
- **Responsive**: Stack on mobile, grid on larger screens

## Component Design Pattern Guidelines

### Systematic Design Consistency

**MANDATORY Pattern Extraction Process:**

Before creating or modifying any UI component:

1. **Pattern Discovery Phase**:

   - Read 2-3 similar existing components to understand established patterns
   - Document repeated class combinations (e.g., `rounded-lg bg-background-secondary-light p-4 ring-1 ring-border-light`)
   - Identify consistent spacing, typography, and color usage
   - Note layout patterns (grid structures, responsive breakpoints)

2. **Design Language Analysis**:

   - Compare target component with reference pages (e.g., /(home), /beans, /profit)
   - Extract common elements: card styling, button designs, form layouts, typography hierarchy
   - Document spacing patterns (`mt-1`, `mb-4`, `p-4`, etc.)
   - Note semantic color usage (`text-green-500` for positive values, `text-red-500` for costs)

3. **Systematic Application**:
   - Apply discovered patterns consistently across all similar elements
   - Create component-specific pattern checklist
   - Verify final implementation matches established design language

### Applying Consistent Design Patterns

**Form Restructuring Workflow:**

1. **Read reference components** to understand established patterns
2. **Identify design inconsistencies** in the target component
3. **Extract reusable patterns** from well-designed components
4. **Apply systematically** across all similar components
5. **Verify consistency** by comparing final results

**Common Pattern Applications:**

_Card-Based Design:_

```svelte
<!-- ✅ Consistent card pattern -->
<div class="rounded-lg bg-background-secondary-light p-4 ring-1 ring-border-light">
	<h3 class="text-sm font-medium text-text-primary-light">Card Title</h3>
	<p class="mt-1 text-2xl font-bold text-green-500">$123.45</p>
	<p class="mt-1 text-xs text-text-secondary-light">Descriptive context</p>
</div>
```

_Form Section Organization:_

```svelte
<!-- ✅ Consistent form section pattern -->
<div class="rounded-lg bg-background-primary-light p-4 ring-1 ring-border-light">
	<h3 class="mb-4 text-lg font-semibold text-text-primary-light">Section Title</h3>
	<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
		<!-- Form fields -->
	</div>
</div>
```

_Button Consistency:_

```svelte
<!-- ✅ Primary action button -->
<button
	class="rounded-md bg-background-tertiary-light px-4 py-2 font-medium text-white transition-all duration-200 hover:bg-opacity-90"
>
	Primary Action
</button>

<!-- ✅ Secondary action button -->
<button
	class="rounded-md border border-background-tertiary-light px-4 py-2 text-background-tertiary-light transition-all duration-200 hover:bg-background-tertiary-light hover:text-white"
>
	Secondary Action
</button>
```

### Multi-Component Consistency Approach

**When updating multiple similar components:**

1. **Establish Reference Component**: Choose the best-designed component as the pattern source
2. **Create Checklist**: Document all design elements to be applied consistently
3. **Update Systematically**: Apply changes to each component following the same pattern
4. **Cross-Reference**: Ensure all components now follow the same design language

**Design Checklist for Form Components:**

- [ ] Card-based layout with `ring-1 ring-border-light`
- [ ] Consistent typography hierarchy (`text-sm font-medium`, `text-lg font-semibold`)
- [ ] Proper spacing patterns (`mt-1`, `mb-4`, `p-4`)
- [ ] Semantic color usage for different value types
- [ ] Responsive grid layouts (`grid grid-cols-1 gap-4 sm:grid-cols-2`)
- [ ] Consistent button styling and hover states
- [ ] Proper input field styling with focus states

### SvelteKit 5 Specific UI Patterns

**Modern Reactive Patterns for UI:**

```svelte
<!-- ✅ Use $derived for computed display values -->
let displayValue = $derived(
  data.reduce((sum, item) => sum + (item.value || 0), 0).toFixed(2)
);

<!-- ✅ Use $state for form data -->
let formData = $state({
  name: '',
  value: 0
});
```

**Component Integration Patterns:**

- Follow `$props<{}>()` pattern for prop definitions
- Use callback props instead of event dispatching for SvelteKit 5
- Maintain consistent prop naming across similar components

## Filter Store Integration

### Proper Integration with FilterStore

When creating components that work with filtered data:

**Required Imports:**

```typescript
import { filteredData, filterStore } from '$lib/stores/filterStore';
```

**Reactive Data Usage:**

```typescript
// ✅ Use $filteredData for reactive filtered data
{#if $filteredData && $filteredData.length > 0}
  <!-- Component content using filtered data -->
{/if}

// ✅ Calculations that react to filter changes
let totalValue = $derived(
  $filteredData.reduce((sum, item) => sum + (item.value || 0), 0)
);
```

**Safe Calculations:**

```typescript
// ✅ Handle null/undefined values in calculations
const totalCost = items.reduce((sum, item) => {
	return sum + ((item.cost1 || 0) + (item.cost2 || 0));
}, 0);

// ✅ Safe division with fallback
const avgCost = totalWeight > 0 ? (totalCost / totalWeight).toFixed(2) : '0.00';
```

## General Debugging Guidelines

### Infinite Loop Debugging

**When encountering `effect_update_depth_exceeded`:**

1. **Identify effects that read and write related reactive values**
2. **Replace state sync patterns with pure `$derived()` functions**
3. **Separate filter store initialization from data processing**
4. **Use `pnpm check` to verify TypeScript after reactive changes**

### Systematic Debugging Approach

When encountering complex issues:

1. **Add Comprehensive Logging**: Log at each step to identify where the issue occurs
2. **Start Simple**: Remove complexity and add it back incrementally
3. **Test Edge Cases**: Empty data, authentication failures, network errors
4. **Use Plan Mode**: For multi-step debugging scenarios requiring systematic investigation
5. **Document and Clean Up**: Remove debug code after resolution

### Debugging Code Management

When adding debug logging:

- Use clear, descriptive log messages that identify the context
- Remove debug code once the issue is resolved unless it provides ongoing value
- For complex debugging sessions, create a separate todo item for "Remove debug logging"
- Focus debug efforts on data structure validation and API response analysis

### Data Flow Issues

When data isn't reaching the frontend:

1. **Verify Server-Side**: Ensure data is properly generated and structured
2. **Check Serialization**: Complex objects may not serialize properly for client transmission
3. **Test Client Reception**: Verify data reaches the frontend correctly
4. **Consider Alternative Approaches**: Manual joins, API endpoints, simplified data structures

### Error Handling Strategy

**Route & Load Errors:**

- Use SvelteKit's `+error.svelte` for route and load function errors
- Implement proper error boundaries at page level

**Component-Level Errors:**

- Use local try-catch blocks with fallback UI inside components
- Always provide fallback states for failed operations
- Never let component errors crash the entire page

**Global Error Management:**

- Implement comprehensive error logging in `hooks.server.ts`
- Log client-side errors via API endpoints for monitoring
- Use consistent error message formatting across the application

### API Response Validation Patterns

**MANDATORY for all API responses:**

```typescript
// ✅ Always validate API response structure
const result = await response.json();
const profiles = result.profiles || result; // Handle format variations
const validatedData = Array.isArray(profiles) ? profiles : [];

// ✅ Handle both new and legacy response formats
const roastIds = result.roast_ids ? result.roast_ids : profiles.map((p: any) => p.roast_id);

// ✅ Provide meaningful fallbacks
if (!response.ok) {
	const errorData = await response.json();
	throw new Error(errorData.error || 'Operation failed');
}
```

### Performance Considerations

- Clean up debugging code after resolving issues
- Use efficient query patterns (avoid N+1 queries)
- Handle loading states and error conditions gracefully
- Test with realistic data volumes

## Common Pitfalls

Patterns learned from prior development sessions. Review before making changes.

1. **Double modal wrapping**: Some form components (e.g., `RoastProfileForm`) are self-contained modals with their own `fixed inset-0` overlay. Render them directly — never wrap in another modal container. See "Modal Component Pattern" above.

2. **Cascade delete completeness**: When deleting `green_coffee_inv` records, ALL FK-dependent tables must be cleaned up. See "Cascade Delete Order" in Database Structure. When new FK-dependent tables are added, update all cascade handlers in `/api/beans/+server.ts` and `/api/clear-roast/+server.ts`.

3. **Navigation**: Always use `goto()` from `$app/navigation` — never `window.location.href`. See "Navigation Pattern" above. Also, `URLSearchParams.get()` returns decoded values; never double-decode with `decodeURIComponent()`.

4. **Data display completeness**: When displaying entity data, show ALL non-null fields rather than hard-coding a limited subset. Use a filter pattern:
   ```typescript
   const availableFields = ['field1', 'field2', ...]; // comprehensive list
   const displayFields = availableFields.filter(f => data[f] != null && data[f] !== '');
   ```

5. **Pre-existing type errors**: ~291 pre-existing TypeScript errors exist from outdated `database.types.ts`. When verifying changes, filter `pnpm check` output to only your modified files. See "Known Pre-Existing Issues" above.
