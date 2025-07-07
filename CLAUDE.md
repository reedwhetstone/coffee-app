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
- Non-trivial and complex tasks requiring careful planning
- User explicitly requests todo list usage
- User provides numbered or comma-separated task lists

**NEVER use TodoWrite when:**
- Single file edits or simple bug fixes
- Straightforward operations (single API call, simple component update)
- Immediate tasks completed in 1-2 steps
- Pure research or informational requests
- Reading files or understanding codebase
- Only one trivial task to complete
- Purely conversational or informational requests

### Todo Management Best Practices

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

*Complex Multi-Step Task (USE TodoWrite):*
```
User: "Add dark mode toggle to application settings and make sure tests pass"
✅ Creates todos: 
1. Create dark mode toggle component
2. Add state management for theme
3. Update CSS for dark theme
4. Run tests and fix any failures
```

*Simple Single Task (DON'T use TodoWrite):*
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

## UI/Form Consistency Patterns

### Identifying Existing Design Patterns

Before creating or modifying UI components, systematically analyze existing patterns:

**Step 1: Pattern Discovery**
- Read similar existing components to understand established patterns
- Look for repeated class combinations (e.g., `rounded-lg bg-background-secondary-light p-4 ring-1 ring-border-light`)
- Identify consistent spacing, typography, and color usage
- Note layout patterns (grid structures, responsive breakpoints)

**Step 2: Design Language Analysis**
- Compare target component with reference pages (e.g., /(home), /beans, /profit)
- Extract common elements: card styling, button designs, form layouts, typography hierarchy
- Document spacing patterns (`mt-1`, `mb-4`, `p-4`, etc.)
- Note semantic color usage (`text-green-500` for positive values, `text-red-500` for costs)

### Applying Consistent Design Patterns

**Form Restructuring Workflow:**
1. **Read reference components** to understand established patterns
2. **Identify design inconsistencies** in the target component
3. **Extract reusable patterns** from well-designed components
4. **Apply systematically** across all similar components
5. **Verify consistency** by comparing final results

**Common Pattern Applications:**

*Card-Based Design:*
```svelte
<!-- ✅ Consistent card pattern -->
<div class="rounded-lg bg-background-secondary-light p-4 ring-1 ring-border-light">
  <h3 class="text-sm font-medium text-text-primary-light">Card Title</h3>
  <p class="mt-1 text-2xl font-bold text-green-500">$123.45</p>
  <p class="text-xs text-text-secondary-light mt-1">Descriptive context</p>
</div>
```

*Form Section Organization:*
```svelte
<!-- ✅ Consistent form section pattern -->
<div class="rounded-lg bg-background-primary-light p-4 ring-1 ring-border-light">
  <h3 class="mb-4 text-lg font-semibold text-text-primary-light">Section Title</h3>
  <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
    <!-- Form fields -->
  </div>
</div>
```

*Button Consistency:*
```svelte
<!-- ✅ Primary action button -->
<button class="rounded-md bg-background-tertiary-light px-4 py-2 font-medium text-white transition-all duration-200 hover:bg-opacity-90">
  Primary Action
</button>

<!-- ✅ Secondary action button -->
<button class="rounded-md border border-background-tertiary-light px-4 py-2 text-background-tertiary-light transition-all duration-200 hover:bg-background-tertiary-light hover:text-white">
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