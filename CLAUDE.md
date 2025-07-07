# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> **Note**: This documentation focuses on stable architectural patterns and development guidelines. Avoid including implementation details that may change over time (specific database queries, current bugs, temporary workarounds, etc.). Keep guidance general and architectural.

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
- **Protected routes**: Some routes require `member` role
- **Session management**: JWT validation in `hooks.server.ts`
- **Auth flow**: OAuth callback handling

### Database Structure (Supabase)

- **coffee_catalog**: Main coffee inventory with embeddings for semantic search
- **green_coffee_inv**: User's personal coffee inventory
- **roast_profiles**: Roasting session data with D3.js charting
- **Vector search**: Uses RPC functions for embeddings

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

## Database Development Guidelines

### Schema Awareness

Before writing any database queries:
- ALWAYS verify column existence in the target table
- Understand foreign key relationships and their directions
- Use proper Supabase join syntax
- Test queries with actual data to ensure joins work correctly
- When modifying existing APIs, check all related queries for consistency

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
const { data } = await supabase
  .from('main_table')
  .select('*')
  .eq('user', user.id);

// ✅ Simple join pattern
const { data } = await supabase
  .from('main_table')
  .select(`
    *,
    related_table (field1, field2)
  `)
  .eq('user', user.id);

// ✅ Manual join for complex cases
const { data: mainData } = await supabase.from('main_table').select('*');
const { data: relatedData } = await supabase.from('related_table').select('*');
const combined = mainData?.map(item => ({
  ...item,
  related: relatedData?.filter(rel => rel.main_id === item.id) || []
}));
```

## Todo List Usage Guidelines

### When to Use TodoWrite

**ALWAYS use TodoWrite when:**
- Framework migrations or version updates
- Task involves 3+ distinct operations or phases
- Changes affect 3+ files across different directories
- System-wide updates impact multiple features/routes
- Database schema modifications or API restructuring
- User provides multiple requirements or a feature list
- Task requires planning implementation steps before coding

**NEVER use TodoWrite when:**
- Single file edits or simple bug fixes
- Straightforward operations (single API call, simple component update)
- Immediate tasks completed in 1-2 steps
- Pure research or informational requests
- Reading files or understanding codebase

### Todo Management Best Practices
- Mark todos as `in_progress` BEFORE starting work
- Complete todos IMMEDIATELY after finishing each step
- Only have ONE todo in `in_progress` at a time
- Break complex tasks into specific, actionable items
- Use descriptive task names that clearly indicate the work required
- Always include verification steps as separate todos
- For migration tasks, include separate todos for each phase

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

### Performance Considerations

- Clean up debugging code after resolving issues
- Use efficient query patterns (avoid N+1 queries)
- Handle loading states and error conditions gracefully
- Test with realistic data volumes