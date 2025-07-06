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
