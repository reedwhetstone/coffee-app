# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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
- **Protected routes**: `/roast`, `/profit` require `member` role
- **Session management**: JWT validation in `hooks.server.ts`
- **Auth flow**: OAuth callback handling in `/auth/callback`

### Database Structure (Supabase)

- **coffee_catalog**: Main coffee inventory with embeddings for semantic search
- **green_coffee_inv**: User's personal coffee inventory
- **roast_profiles**: Roasting session data with D3.js charting
- **Vector search**: Uses `match_coffee_current_inventory` RPC for embeddings

### Key Services

- **RAGService** (`src/lib/services/ragService.ts`): Semantic search using OpenAI embeddings
- **EmbeddingService** (`src/lib/services/enhancedEmbeddingService.ts`): OpenAI embedding generation
- **Stripe integration**: Full payment flow with webhooks

### Route Structure

- **Home** (`(home)`): Coffee catalog with RAG-powered search
- **Beans** (`/beans`): Personal coffee inventory management
- **Roast** (`/roast`): Roasting profiles with D3.js charts (member-only)
- **Profit** (`/profit`): Sales tracking (member-only)
- **Subscription** (`/subscription`): Stripe payment flow

### Important Implementation Details

- **Semantic Search**: Uses vector embeddings for coffee recommendations
- **Role Guards**: `hooks.server.ts` handles route protection
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
- Components use stores for shared state (`auth.ts`, `filterStore.ts`)
- Database operations go through Supabase client with proper type safety

## Database Schema Changes

When database structure changes (table splits, joins, field moves):
1. Identify all affected queries, components, and stores
2. Update server-side queries first (*.server.ts files)
3. Update client-side components that consume the data
4. Update filter/search logic to handle new data structure
5. Test that all CRUD operations work with new structure
6. Update TypeScript types if needed

## Joined Data Structure Patterns

When working with joined database queries (table relationships):
- Check if filter/search stores need updates for nested data access
- Update helper functions to handle both direct and nested field access
- Ensure sorting and filtering work with the new data structure
- Test that unique value extraction works with joined data

## Complex Task Management

For tasks involving multiple file changes or system-wide updates:
- ALWAYS use TodoWrite to break down the task into phases
- Mark todos as in_progress before starting work
- Complete todos immediately after finishing each step
- For data structure changes, create separate todos for: server queries, client components, stores/services, and testing

## TypeScript Diagnostics

- Address TypeScript errors immediately during development
- Clean up unused imports/variables when they're introduced by your changes
- For pre-existing warnings, only fix if they're in files you're actively modifying
- Run type checking after significant changes: `pnpm check`

## Database Schema Awareness

Before writing any database queries:
- ALWAYS verify column existence in the target table
- Understand foreign key relationships and their directions
- Use proper Supabase join syntax: `table!foreign_key_column (columns...)`
- Test queries with actual data to ensure joins work correctly
- When modifying existing APIs, check all related queries for consistency

### Key Relationships in This Project
- `green_coffee_inv.catalog_id` → `coffee_catalog.id` (coffee details)
- `roast_profiles.coffee_id` → `green_coffee_inv.id` (user's coffee inventory)
- `sales.green_coffee_inv_id` → `green_coffee_inv.id` (sales tracking)

### Systematic Query Validation Process
1. **Identify the base table** you're querying from
2. **Map the join path** - which foreign keys connect to related tables
3. **Verify field existence** in each table involved in the query
4. **Use correct Supabase syntax** for joins: `related_table!foreign_key (field1, field2)`
5. **Test with sample data** to ensure the join returns expected results
6. **Handle null relationships** gracefully in your application logic

### Common Query Patterns
```typescript
// ✅ Correct: Join from green_coffee_inv to coffee_catalog
const { data } = await supabase
  .from('green_coffee_inv')
  .select(`
    id,
    purchased_qty_lbs,
    coffee_catalog!catalog_id (
      name,
      source,
      score_value
    )
  `)
  .eq('user', user.id);

// ✅ Correct: Multiple joins for profit analysis
const { data } = await supabase
  .from('green_coffee_inv')
  .select(`
    id,
    purchased_qty_lbs,
    coffee_catalog!catalog_id (name, source),
    sales(price, oz_sold),
    roast_profiles(oz_in, oz_out)
  `)
  .eq('user', user.id);

// ❌ Incorrect: Wrong foreign key reference
// Don't use: coffee_catalog!coffee_id - this field doesn't exist
```

## SvelteKit Development Guidelines

### Framework-Specific Patterns

When working with SvelteKit 5 applications, follow these specific patterns:

**Reactive State Management:**
- Use `$state()` for component-local reactive variables
- Use `$derived()` for computed values that depend on reactive state
- Use `$effect()` for side effects that should run when dependencies change
- Avoid `$:` reactive statements (Svelte 4 pattern) in favor of `$derived()` and `$effect()`

**Page Store Migration (SvelteKit 2+):**
- Replace `import { page } from '$app/stores'` with `import { page } from '$app/state'`
- Remove `$` prefix from page references: `$page.url` becomes `page.url`
- Update all reactive statements that depend on page to use `$effect()` or `$derived()`

**Component Lifecycle:**
- Use `onMount()` for initialization that needs DOM access
- Use `$effect()` for reactive side effects
- Use cleanup functions returned from `onMount()` or `$effect()` for teardown

### Migration Workflows

When migrating deprecated SvelteKit features:

1. **Identify all usages** of the deprecated feature across the codebase
2. **Create a TodoWrite list** breaking down the migration into phases:
   - Search and catalog all usage locations
   - Update imports and syntax
   - Test functionality after each major change
   - Run TypeScript and build verification
3. **Update systematically** - one pattern at a time, not mixing multiple changes
4. **Verify after each step** with `pnpm check` and `pnpm build`

### SvelteKit-Specific Verification Steps

After making changes to SvelteKit components:
- Run `pnpm check` to verify TypeScript compliance
- Run `pnpm build` to ensure SSR compatibility
- Test reactive behavior in development mode
- Verify that `$effect()` dependencies are properly captured

## TypeScript Error Resolution

### Systematic Approach to Type Safety

When encountering TypeScript errors, follow this systematic approach:

1. **Identify the root cause**: Understand why TypeScript cannot infer the correct type
2. **Choose the appropriate solution**:
   - Add explicit type annotations for complex destructuring
   - Use type assertions when you know the type but TypeScript cannot infer it
   - Create proper interfaces for complex object structures
   - Use generic constraints for reusable functions

### Common TypeScript Patterns in SvelteKit

**Complex Destructuring with Type Safety:**
```typescript
// ❌ Problematic: TypeScript cannot infer stats type
{#each Object.entries(data) as [key, stats]}

// ✅ Correct: Explicit type annotation
{#each Object.entries(data) as entry}
  {@const [key, stats] = entry as [string, { count: number; weight: number }]}
```

**Reactive Computations with Proper Typing:**
```typescript
// ✅ Type-safe reactive computation
let totalValue = $derived(
  $filteredData.reduce((sum: number, item: Item) => sum + (item.value || 0), 0)
);
```

**Safe Property Access:**
```typescript
// ✅ Handle both direct and nested property access
const displayName = item.coffee_catalog?.name || item.name || 'Unknown';
```

### TypeScript Error Prevention

- Always provide type annotations for reduce() accumulators
- Use proper typing for Object.entries() when destructuring
- Add null checks for optional chaining operations
- Define interfaces for complex objects passed between components

## Todo List Usage Guidelines

### Enhanced Decision Tree for TodoWrite Usage

**ALWAYS use TodoWrite when:**
- Framework migrations or version updates (e.g., SvelteKit page store migration)
- Task involves 3+ distinct operations or phases
- Changes affect 3+ files across different directories
- System-wide updates impact multiple features/routes
- Database schema modifications or API restructuring
- User provides multiple requirements or a feature list
- Task requires planning implementation steps before coding
- TypeScript errors span multiple files or require systematic resolution

**NEVER use TodoWrite when:**
- Single file edits or simple bug fixes
- Straightforward operations (single API call, simple component update)
- Immediate tasks completed in 1-2 steps
- Pure research or informational requests
- Reading files or understanding codebase
- Simple TypeScript errors in a single location

### Examples of When to Use TodoWrite

**✅ USE TodoWrite:**
```
User: "Add a dark mode toggle with settings persistence and update all components"
Reason: Multi-step (UI, state management, component updates, persistence)

User: "Create a dashboard with KPI cards, charts, and data filtering"
Reason: Multiple components, data processing, UI layout

User: "Fix the profit calculation across all pages and update the database schema"
Reason: Multiple files, database changes, API updates
```

**❌ DON'T use TodoWrite:**
```
User: "Fix this TypeScript error in the component"
Reason: Single file fix

User: "Add a comment to this function"
Reason: Simple one-step task

User: "How does the authentication system work?"
Reason: Research/informational request
```

### Todo Management Best Practices
- Mark todos as `in_progress` BEFORE starting work
- Complete todos IMMEDIATELY after finishing each step
- Only have ONE todo in `in_progress` at a time
- Break complex tasks into specific, actionable items
- Use descriptive task names that clearly indicate the work required
- **Always include verification steps** as separate todos (e.g., "Run TypeScript check", "Test build")
- For migration tasks, include separate todos for each phase of the migration
- When fixing TypeScript errors, create separate todos for each affected file or error type

## API Design Pattern Guidelines

Follow these patterns for consistent code organization:

### When to Create API Endpoints (`/api/*/+server.ts`)
- External data operations (CRUD for database entities)
- Operations that require authentication/authorization
- Features that might be called from multiple places
- Complex business logic that belongs on the server

### When to Create Shared Utilities (`src/lib/server/*.ts`)
- Reusable logic used by multiple API endpoints
- Database operation helpers
- Complex calculations or data transformations
- Authentication/validation functions

### When to Use Inline Functions
- Simple, endpoint-specific operations
- One-time transformations within a single file
- Basic data formatting or validation

### Example Pattern
```typescript
// ✅ Good: Shared utility for common operation
// src/lib/server/stockedStatusUtils.ts
export async function updateStockedStatus(supabase, coffee_id, user_id) { ... }

// ✅ Good: API endpoint uses shared utility
// src/routes/api/update-stocked-status/+server.ts
import { updateStockedStatus } from '$lib/server/stockedStatusUtils';

// ✅ Good: Other APIs also use the same utility
// src/routes/api/roast-profiles/+server.ts
import { updateStockedStatus } from '$lib/server/stockedStatusUtils';
```

## UI/Dashboard Component Creation Guidelines

### Design System Consistency

When creating new UI components, especially dashboards, follow these patterns:

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

### Dashboard Component Structure

```typescript
// ✅ Standard dashboard layout pattern
<div class="">
  <!-- Header Section -->
  <div class="mb-6">
    <h1 class="text-primary-light mb-2 text-2xl font-bold">Page Title</h1>
    <p class="text-text-secondary-light">Page description</p>
  </div>

  <!-- KPI Cards Section -->
  <div class="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
    <!-- Individual KPI cards -->
    <div class="rounded-lg bg-background-secondary-light p-4">
      <h3 class="text-primary-light text-sm font-medium">Metric Name</h3>
      <p class="text-2xl font-bold text-green-500">Value</p>
      <p class="text-xs text-text-secondary-light mt-1">Context info</p>
    </div>
  </div>

  <!-- Charts/Analysis Section -->
  <div class="mb-6 rounded-lg bg-background-secondary-light p-4">
    <h3 class="text-primary-light mb-4 text-lg font-semibold">Chart Title</h3>
    <!-- Chart content -->
  </div>

  <!-- Data Tables/Cards -->
  <!-- Existing component content -->
</div>
```

### KPI Card Guidelines
- **Header**: Descriptive name in small text
- **Value**: Large, bold text with semantic color
- **Context**: Small supplementary text below value
- **Calculations**: Handle edge cases (division by zero, null values)
- **Responsive**: Stack on mobile, grid on larger screens

## Filter Store Integration Patterns

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

**Filter Integration:**
```typescript
// ✅ Proper filter setting
filterStore.setFilter('stocked', true);

// ✅ Clear filters action
filterStore.clearFilters();

// ✅ Handle both filtered and unfiltered states
<div class="text-sm text-text-secondary-light">
  Showing {$filteredData.length} of {data?.data?.length || 0} items
</div>
```

### Data Structure Handling

**Joined Data Access:**
```typescript
// ✅ Handle both direct and joined data structures
const displayName = item.coffee_catalog?.name || item.name;
const displaySource = item.coffee_catalog?.source || item.source;
```

**Safe Calculations:**
```typescript
// ✅ Handle null/undefined values in calculations
const totalCost = items.reduce((sum, item) => {
  return sum + ((item.bean_cost || 0) + (item.tax_ship_cost || 0));
}, 0);

// ✅ Safe division with fallback
const avgCost = totalWeight > 0 ? (totalCost / totalWeight).toFixed(2) : '0.00';
```

### Component State Management

**Reactive Updates:**
```typescript
// ✅ Components should react to filter changes automatically
// No manual data fetching needed - use $filteredData

// ✅ Handle empty states properly
{#if !$filteredData || $filteredData.length === 0}
  <!-- Handle both no data and filtered-out scenarios -->
  <div class="text-center">
    {data?.data?.length > 0 ? 'No items match filters' : 'No data available'}
  </div>
{/if}
```
