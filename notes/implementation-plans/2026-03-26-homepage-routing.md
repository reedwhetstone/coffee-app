# Implementation Plan: Homepage Routing

**Date:** 2026-03-26
**Slug:** homepage-routing
**Status:** Planning only, awaiting Reed review
**Repo:** coffee-app (web-only; no CLI changes needed)

---

## Feature

Make `/` the true public landing page for all visitors, including authenticated users, and treat `/catalog` as the dedicated browse route.

DEVLOG source: Priority 0, "Homepage Routing - Make `/` the true landing page and move catalog to its own dedicated route. Remove login-driven reroute behavior that hurts first contentful paint and perceived responsiveness."

---

## Candidate Scoring

Scored against the daily easy-win rubric:

- **Homepage routing**: P0 = 10, complexity medium = 6, risk low = 0, dependencies none = 0, **total 16**
- **Score & rating display formatting cleanup**: P2 = 6, complexity easy = 10, risk low = 0, dependencies none = 0, **total 16**
- **Improve skeleton loading states**: P3 = 5, complexity easy = 10, risk low = 0, dependencies some = -2, **total 13**
- **Roast chart resize on navigation**: P2 = 6, complexity medium = 6, risk medium = -2, dependencies some = -2, **total 8**
- **Bean delete dependency handling**: P1 = 8, complexity hard = 2, risk high = -5, dependencies none = 0, **total 5**

**Winner: Homepage routing.**

It tied numerically with the score/rating cleanup, but it wins on strategy alignment. The public discoverability overhaul just landed, `/catalog` already exists as a public route, and the remaining work is mostly removing an outdated auth-based branch rather than inventing a new system.

**Stale easy wins skipped during selection:** supplier cupping dashed-line opacity, cupping-notes reactive refresh, wholesale markers/filtering on sales, and wholesale markers/filtering on roast profiles all appear to have already shipped in recent PRs even though DEVLOG still lists some of them as open.

---

## Why now

The repo just merged a public discoverability overhaul focused on SEO, OG/Twitter metadata, and crawl quality. That work made the public surface better, but the root route still behaves like two different products:

- unauthenticated users see the marketing landing page
- authenticated users see an app-style dashboard shell

That split undermines the current product direction in three ways:

1. It weakens the public conversion funnel by making the most important URL context-dependent.
2. It preserves extra auth-driven branching on the page with the highest visibility.
3. It leaves `/catalog` half-promoted, even though it already exists as the dedicated browse surface.

This is a good daily PR candidate because the highest-risk part of the original idea is already done. `/catalog` exists, the marketing homepage exists, and the public metadata system was strengthened today. What remains is route-shell cleanup and CTA clarity.

CLI cross-check: recent `purveyors-cli` work added shared catalog and roast filters, but this feature is purely route/layout behavior for the web funnel. There is no CLI-first version of homepage routing, so this should be a coffee-app-only PR.

---

## Strategy Alignment Audit

### Active strategy themes from current context

1. **Public discoverability and conversion are top-of-funnel priorities.** DEVLOG Priority 0 explicitly calls out homepage routing and public catalog access.
2. **Deterministic, low-branching product surfaces beat unnecessary runtime complexity.** "Inference Is in the Name" argues for deterministic cores instead of dynamic behavior where it is not needed.
3. **Human-facing evaluation surfaces still matter in an agentic world.** The active outline "Agents Don't Pick Their Own Tools" argues that humans still approve platforms first, so the root URL needs to sell the product cleanly.
4. **Purveyors is positioning itself as public market-intelligence infrastructure, not just a private roastery dashboard.** "Who Profits When Coffee Data Stays Scarce?" reinforces the public data and market-intelligence wedge.
5. **Product philosophy should become load-bearing in the codebase.** The active outline "Building Product Philosophy into the Codebase" matches the idea of aligning route behavior with the documented public-first strategy.

### Verdict

**Strongly aligned.**

This change directly supports the current public discoverability push, sharpens the human-facing funnel, and reduces unnecessary auth-based branching on the root route. It does not conflict with the larger public-catalog-access work; it is a smaller, cleaner precursor that makes the product story more coherent right now.

### Contradictions / caveats

- This does **not** solve the broader "Public Catalog Access + Conversion Funnel" item by itself. It only makes the entry point coherent.
- Existing signed-in users currently get a dashboard-style `/` experience. Replacing that with a marketing page needs a clear "Open app" path so the change feels intentional, not regressive.

---

## Scope

### In scope

- Make `/` use the marketing shell regardless of authentication state
- Remove the authenticated-dashboard variant from `src/routes/(home)/+page.svelte`
- Introduce or formalize `/dashboard` as the explicit logged-in app home route
- Keep `/catalog` as the dedicated browse route for both signed-in and signed-out users
- Add signed-in-aware CTA behavior on the root page so authenticated users can jump straight into the app
- Add a compact signed-in quick-link row on `/` when appropriate (`Catalog`, `Inventory`, `Roast`) without cluttering the page
- Simplify homepage data loading so the page no longer needs a custom session-based content branch

### Out of scope

- Public catalog row limits, teaser gating, or premium conversion mechanics
- Mobile navigation redesign
- App sidebar changes outside the special handling for `/`
- Auth guard behavior for protected routes like `/beans`, `/roast`, `/profit`, `/chat`
- Any CLI or API changes
- Any DEVLOG cleanup PR

---

## Proposed UX behavior

1. **`/` always behaves like the public landing page.** Logged-in status should not swap the route into an app dashboard.
2. **Unauthenticated users** keep the existing marketing flow: unified header, hero, features, pricing, CTA, and limited marketplace preview.
3. **Authenticated users** also see the marketing landing page, but with session-aware app-entry controls:
   - primary CTA: `Dashboard`
   - compact secondary links: `Catalog`, `Inventory`, `Roast`
   - keep the quick-link row visually light so it helps power users without cluttering the marketing page
4. **Canonical logged-in app home should move to `/dashboard`.**
   - `/` is the public landing page for everyone
   - `/dashboard` becomes the explicit app-entry route for signed-in users
   - this makes the public/app split legible instead of overloading `/`
5. **No app sidebar on `/`.** The app shell should begin on app routes like `/dashboard`, `/catalog`, `/beans`, `/roast`, `/profit`, and related authenticated pages.
6. **Root route remains indexable and stable.** There should be one canonical public experience for the most important URL.
7. **Signed-in acknowledgement should be lightweight, not dashboard-like.** A small signed-in strip or CTA row above the fold is enough.

---

## Files to change

1. **`src/routes/+layout.svelte`**
   - Change the layout decision so `/` always uses the marketing layout, not the authenticated sidebar shell
   - Update unified-header logic so the public header can appear on `/` even when a session exists

2. **`src/routes/(home)/+page.server.ts`**
   - Remove page-level session branching responsibility from the homepage load
   - Keep public landing data and metadata generation focused on catalog preview + schema/meta

3. **`src/routes/(home)/+page.svelte`**
   - Remove the authenticated dashboard branch entirely
   - Always render the marketing landing content
   - Add a light signed-in affordance, such as a small banner or CTA row
   - Primary signed-in CTA should be `Dashboard`
   - Compact secondary app links can sit below or beside the primary CTA if they stay visually quiet

4. **`src/routes/dashboard/+page.*`** (new or moved route)
   - Create or formalize `/dashboard` as the canonical logged-in app home
   - If the current signed-in `/` branch contains useful app-entry content, move it here rather than deleting it outright

5. **`src/lib/components/layout/UnifiedHeader.svelte`**
   - Accept auth-aware state or derive it from layout data
   - Swap `Sign In` / `Get Started` controls for `Dashboard` when a session exists
   - Optionally include compact app links in the authenticated header state if they do not clutter the nav

6. **`src/lib/components/marketing/Hero.svelte`**
   - Make hero CTAs session-aware so authenticated users are not sent to `/auth`
   - Anonymous primary CTA remains marketing/conversion-oriented
   - Authenticated primary CTA becomes `/dashboard`

7. **`tests/e2e/smoke.spec.ts`**
   - Add or adjust coverage so `/` is validated as a stable public route and does not regress when authenticated
   - Add coverage for `/dashboard` as the new logged-in app entry point

---

## API / data impact

- **No API changes**
- **No database changes**
- **No CLI changes**
- Homepage data load likely becomes slightly simpler because it no longer needs to support a page-level authenticated dashboard branch
- Existing catalog preview query and SEO metadata can remain intact

---

## Acceptance criteria

- [ ] Visiting `/` while signed out renders the marketing landing page successfully
- [ ] Visiting `/` while signed in also renders the marketing landing page, not the authenticated sidebar/dashboard shell
- [ ] Authenticated users on `/` have an obvious primary CTA into the app: `/dashboard`
- [ ] Authenticated users may also see compact secondary links (`Catalog`, `Inventory`, `Roast`) without cluttering the page
- [ ] Unauthenticated users still have clear `Sign In` / `Get Started` behavior
- [ ] `/dashboard` works as the explicit logged-in app home route
- [ ] `/catalog` remains the dedicated browse route and continues to load successfully
- [ ] Root-route metadata, canonical URL, and schema output remain valid after the routing cleanup
- [ ] `pnpm check` passes
- [ ] `pnpm lint` passes
- [ ] `pnpm test:unit` passes
- [ ] Playwright smoke coverage passes for `/`, `/dashboard`, and `/catalog`

---

## Test plan

### Static / quality checks

- `pnpm check`
- `pnpm lint`
- `pnpm test:unit`

### Playwright expectations

- Existing smoke test for `/` still passes for anonymous requests
- Existing smoke test for `/catalog` still passes
- Add or update one authenticated browser-path assertion so logged-in navigation to `/` does not render the app sidebar shell or hit an auth redirect loop

### Manual smoke checks

1. Visit `/` signed out
   - confirm marketing layout
   - confirm unified header
   - confirm hero CTA goes to auth
2. Visit `/` signed in
   - confirm no left sidebar app shell
   - confirm primary CTA points to `/dashboard`
   - confirm compact app links, if present, are useful but visually restrained
   - confirm no `Sign In` button mismatch
3. Visit `/dashboard`
   - confirm it works as the explicit logged-in app home
4. Visit `/catalog`
   - confirm browse route remains intact for both auth states

---

## Risks and rollback

### Risks

1. **Layout-condition spillover**
   - Changing how `/` is classified in `+layout.svelte` could accidentally affect other public pages if the condition is written too broadly.
   - Mitigation: keep the special-case check strictly tied to `pathname === '/'`.

2. **Signed-in user friction**
   - Existing users may miss the old dashboard-style root experience if the replacement does not provide a clear app entry point.
   - Mitigation: give authenticated users a prominent `Open Catalog` or `Open App` CTA above the fold.

3. **Header/hero auth mismatch**
   - If the header becomes session-aware but the hero stays anonymous-only, logged-in users could see conflicting CTAs.
   - Mitigation: make both header and hero derive from the same auth-aware input.

### Rollback

Rollback is straightforward. Revert the layout, homepage, and CTA-component changes. No database or API state needs to be unwound.

---

## Decisions from Reed review

1. **Primary signed-in CTA:** use `Dashboard`.
2. **Signed-in quick links:** add compact secondary links if they stay visually quiet and do not clutter the page.
3. **Canonical logged-in app home:** move or formalize the new logged-in entry route at `/dashboard`.
4. **Authenticated landing philosophy:** keep `/` public-first even for signed-in users, with only a lightweight signed-in acknowledgement above the fold.

## Remaining judgment call

- **Navigation naming:** use best judgment during implementation; avoid a nav treatment that muddies the distinction between the public landing page and the logged-in app surfaces.
