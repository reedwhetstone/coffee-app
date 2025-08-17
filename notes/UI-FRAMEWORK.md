# Coffee App UI Framework

This document defines the standardized UI patterns and components for the Coffee App to ensure consistent design language across all pages and components.

## Design System Foundation

### Color System

```css
/* Primary Backgrounds */
bg-background-primary-light     /* Main content areas */
bg-background-secondary-light   /* Cards, sections */
bg-background-tertiary-light    /* Accent elements, primary buttons */

/* Text Colors */
text-text-primary-light         /* Primary text */
text-text-secondary-light       /* Secondary/helper text */

/* Borders & Rings */
ring-1 ring-border-light        /* Standard card borders */
border-border-light             /* Standard borders */

/* Semantic Colors for KPIs */
text-green-500                  /* Revenue, positive values */
text-blue-500                   /* Profit, primary metrics */
text-purple-500                 /* Margins, percentages */
text-orange-500                 /* Secondary metrics */
text-red-500                    /* Costs, negative values */
text-indigo-500                 /* Inventory counts */
text-cyan-500                   /* Rates, ratios */
```

### Typography Scale

```css
/* Headers */
text-2xl font-bold              /* Page titles */
text-xl font-bold               /* Section titles */
text-lg font-semibold           /* Subsection titles */
font-medium                     /* Card titles */

/* Body Text */
text-sm font-medium             /* KPI labels */
text-xs                         /* Helper text, metadata */
```

### Spacing System

```css
/* Grid Gaps */
gap-4                           /* Standard grid gap */
gap-6                           /* Large section gap */

/* Padding */
p-4                             /* Standard card padding */
p-6                             /* Large container padding */
px-4 py-2                       /* Button padding */

/* Margins */
mb-6                            /* Section bottom margin */
mt-1                            /* Small top margin for values */
```

## Component Patterns

### 1. KPI Card Pattern

**Standard KPI Card Structure:**

```svelte
<div class="rounded-lg bg-background-secondary-light p-4 ring-1 ring-border-light">
	<h3 class="text-sm font-medium text-text-primary-light">[KPI Label]</h3>
	<p class="mt-1 text-2xl font-bold text-[semantic-color]">[Value]</p>
	<p class="mt-1 text-xs text-text-secondary-light">[Context/Unit]</p>
</div>
```

**KPI Dashboard Grids:**

```svelte
<!-- Primary Metrics (4 columns) -->
<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
	<!-- KPI Cards -->
</div>

<!-- Secondary Metrics (3 columns) -->
<div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
	<!-- KPI Cards -->
</div>

<!-- Extended Metrics (5 columns - beans page) -->
<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
	<!-- KPI Cards -->
</div>
```

### 2. Button System

```svelte
<!-- Primary Button -->
<button
	class="rounded-md bg-background-tertiary-light px-4 py-2 font-medium text-white transition-all duration-200 hover:bg-opacity-90"
>
	Primary Action
</button>

<!-- Secondary Button -->
<button
	class="rounded-md border border-background-tertiary-light px-4 py-2 text-background-tertiary-light transition-all duration-200 hover:bg-background-tertiary-light hover:text-white"
>
	Secondary Action
</button>

<!-- Danger Button -->
<button
	class="rounded-md border border-red-600 px-4 py-2 text-red-600 transition-all duration-200 hover:bg-red-600 hover:text-white"
>
	Delete/Danger Action
</button>
```

### 3. Content Card Pattern

```svelte
<div class="rounded-lg bg-background-primary-light p-4 ring-1 ring-border-light">
	<div class="mb-4 flex items-center justify-between">
		<h3 class="font-semibold text-text-primary-light">[Section Title]</h3>
		<!-- Optional action button -->
	</div>
	<!-- Content -->
</div>
```

### 4. Interactive Card Pattern (Coffee Cards, Roast Profiles)

```svelte
<button
	class="group rounded-lg bg-background-primary-light p-4 text-left shadow-sm ring-1 ring-border-light transition-all hover:scale-[1.02] hover:ring-background-tertiary-light"
>
	<!-- Card Content -->

	<!-- Selection Arrow -->
	<div class="mt-3 flex items-center justify-end">
		<svg
			class="h-4 w-4 text-text-secondary-light transition-transform group-hover:translate-x-1 group-hover:text-background-tertiary-light"
		>
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
		</svg>
	</div>
</button>
```

### 5. Table/List Pattern (Based on RoastHistoryTable)

```svelte
<!-- Collapsible Section Header -->
<button
	class="flex w-full items-center justify-between p-4 transition-colors hover:bg-background-tertiary-light/5 focus:outline-none focus:ring-2 focus:ring-background-tertiary-light"
>
	<div class="flex items-center gap-3">
		<span
			class="text-background-tertiary-light transition-transform duration-200 {expanded
				? 'rotate-90'
				: ''}">▶</span
		>
		<div class="text-left">
			<h3 class="text-lg font-semibold text-text-primary-light">[Section Title]</h3>
			<div class="flex flex-wrap items-center gap-4 text-sm text-text-secondary-light">
				<span>[Metadata]</span>
			</div>
		</div>
	</div>
</button>

<!-- List Items Grid -->
<div class="grid gap-3 sm:grid-cols-2">
	<!-- Individual items following Interactive Card Pattern -->
</div>
```

## Page Layout Standards

### Page Header Pattern

```svelte
<div class="mb-6">
	<h1 class="mb-2 text-2xl font-bold text-text-primary-light">[Page Title]</h1>
	<p class="text-text-secondary-light">[Page Description]</p>
</div>
```

### Section Spacing

- Page sections: `space-y-6` or `mb-6`
- Card grids: `gap-4`
- Content within cards: `space-y-4` or specific margins

## Responsive Design Standards

### Breakpoints

- **Mobile First:** Base styles for mobile
- **sm:** 640px+ (small tablets)
- **lg:** 1024px+ (desktop)
- **xl:** 1280px+ (large desktop)

### Grid Responsive Patterns

```css
grid-cols-1 sm:grid-cols-2 lg:grid-cols-4    /* KPI cards */
grid-cols-1 md:grid-cols-2                   /* Coffee cards */
grid-cols-1 sm:grid-cols-3                   /* Secondary metrics */
```

## Accessibility Standards

### ARIA Patterns

```svelte
<!-- Collapsible sections -->
aria-expanded={isExpanded}
aria-controls="content-id" aria-label="Toggle section description"

<!-- Interactive cards -->
aria-pressed={isSelected}
aria-label="Descriptive action label"

<!-- Buttons -->
aria-label="Clear action description"
```

### Focus States

```css
focus:outline-none focus:ring-2 focus:ring-background-tertiary-light focus:ring-offset-2
```

## Animation Standards

### Transitions

```css
transition-all duration-200        /* Standard transitions */
transition-colors duration-200     /* Color-only transitions */
transition-transform duration-200  /* Transform-only transitions */
```

### Hover Effects

```css
hover:scale-[1.02]                 /* Subtle scale on interactive cards */
hover:translate-x-1                /* Arrow movement */
hover:bg-opacity-90                /* Button opacity change */
```

## Implementation Checklist

When creating new components, ensure:

- [ ] Uses established color tokens
- [ ] Follows responsive grid patterns
- [ ] Implements proper hover/focus states
- [ ] Includes accessibility attributes
- [ ] Uses standard spacing/typography scales
- [ ] Follows semantic color usage for data visualization

## Component-Specific Guidelines

### LeftSidebar

- **CRITICAL:** Must use light theme to match app design
- Background: `bg-background-primary-light`
- Text: `text-text-primary-light`
- Buttons: Follow standard button patterns

### Tables/Lists

- Use RoastHistoryTable as reference implementation
- Collapsible sections with smooth animations
- Card-based individual items
- Proper ARIA labeling

### Forms

- Card-based sections with consistent padding
- Clear field labeling
- Standard button placement (right-aligned)
- Responsive grid layouts for fields
