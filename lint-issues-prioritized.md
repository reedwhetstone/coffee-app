# Lint Issues Prioritized by Criticality

**Total Issues: 455 errors**

## CRITICAL - Runtime Failures (Fix Immediately)

### 1. Global Variable Declaration Issues

- `src/types/global.d.ts:2` - `var` usage instead of `let/const` (1 issue)
- `src/types/global.d.ts:4` - `any` type in global declaration (1 issue)

### 2. Undefined Global References

- `src/routes/subscription/StripeCheckout.svelte:67` - 'Stripe' is not defined (1 issue)

### 3. TypeScript Comment Violations

- `src/routes/subscription/StripeCheckout.svelte:66` - Use `@ts-expect-error` instead of `@ts-ignore` (1 issue)

### 4. Unused Expression Statements

- `src/routes/roast/RoastLogChart.svelte:1775-1776` - Expression statements without assignment (2 issues)

**Total Critical: 6 issues**

## HIGH - Type Safety Violations (Fix Soon)

### Explicit `any` Types (346 issues across multiple files)

Major files with high `any` usage:

- `src/routes/roast/RoastLogChart.svelte` - 168 issues
- `src/routes/roast/+page.svelte` - 49 issues
- `src/routes/beans/+page.svelte` - 34 issues
- `src/routes/beans/BeanDetailsDialog.svelte` - 19 issues
- `src/lib/services/ragService.ts` - 13 issues
- `src/lib/components/VirtualScrollList.svelte` - 10 issues
- `src/hooks.server.ts` - 4 issues
- Plus 35+ other files with 1-8 issues each

**Total High: 346 issues**

## MEDIUM - Code Quality Issues (Address When Convenient)

### 1. Unused Variables (95 issues)

Files with multiple unused variables:

- `src/lib/components/ProfitPageSkeleton.svelte` - 7 issues (skeleton placeholders)
- `src/lib/components/RoastPageSkeleton.svelte` - 5 issues (skeleton placeholders)
- `src/lib/components/BeansPageSkeleton.svelte` - 3 issues (skeleton placeholders)
- `src/lib/components/CatalogPageSkeleton.svelte` - 2 issues (skeleton placeholders)
- `src/lib/components/ChartSkeleton.svelte` - 2 issues (skeleton placeholders)
- Plus 50+ other files with 1-2 issues each

### 2. Unused Imports (8 issues)

- `src/lib/components/ChatMessageRenderer.svelte` - `parseTastingNotes` function
- `src/lib/components/VirtualScrollList.svelte` - `tick` import
- `src/routes/roast/RoastProfileDisplay.svelte` - 2 date utility functions
- `src/routes/roast/RoastProfileForm.svelte` - `formatDateForDisplay` function
- `src/hooks.server.ts` - `hasRole` function
- `scripts/validate-schemas.js` - `fileError` variable
- `src/routes/roast/RoastHistoryTable.svelte` - `completionStatus` variable

**Total Medium: 103 issues**

## Recommended Approach

### Phase 1: Critical Issues (6 fixes)

1. Fix global variable declarations in `global.d.ts`
2. Address Stripe global reference
3. Fix TypeScript comment usage
4. Fix unused expression statements

### Phase 2: High Priority - Type Safety (346 fixes)

1. Start with most critical files (`RoastLogChart.svelte`, `+page.svelte` files)
2. Create proper TypeScript interfaces for frequently used objects
3. Gradually replace `any` with specific types
4. Focus on data structures passed between components

### Phase 3: Medium Priority - Code Quality (103 fixes)

1. Remove unused imports and variables
2. Consider if skeleton component variables are intentionally unused (may need ESLint disable comments)
3. Clean up development artifacts

### Estimated Time Investment

- **Critical**: 1-2 hours
- **High Priority**: 15-20 hours (spread across multiple sessions)
- **Medium Priority**: 3-4 hours

### Tools/Strategies

- Use TypeScript's `--strict` mode progressively
- Create shared type definitions for common data structures
- Consider ESLint disable rules for intentional unused variables in skeleton components
- Use IDE refactoring tools for bulk type inference where possible
