# Coffee App Development Log

> Master todo list and development notes for purveyors.io coffee tracking platform.

---

## Priority 0: New Product Priorities (Mar 2026)

- [ ] **Purveyors Price Index (PPI)** — First revenue-generating data product. Daily specialty green coffee price index by origin, process, and grade, derived from 35 scraped suppliers. `/api/v1/price-index` endpoint with tier-based access (free/member $29/enterprise $199). Blog teaser page as top-of-funnel. Revenue target: $35K+/year at modest adoption. Existing auth + Stripe infrastructure reused. Full plan: `notes/implementation-plans/2026-03-16-purveyors-price-index.md`.
- [x] **Mobile Navigation** - Redesign sidebar behavior on mobile. Current desktop-style sidebar consumes too much horizontal space. Evaluated the mobile shell approach and shipped a top app bar + full-screen menu / overlay model for authenticated pages. (Implemented in PR #230: mobile-first shell foundation)
- [x] **Homepage Routing** - Make `/` the true landing page and move catalog to its own dedicated route. Remove login-driven reroute behavior that hurts first contentful paint and perceived responsiveness. (Fixed PR #179)
- [ ] **Public Catalog Access + Conversion Funnel** - Allow non-auth users to browse catalog with limited access (example: page 1 only) while keeping filters available. Add clear incentives to sign up/log in and promote AI search as a premium conversion lever.

---

## Priority 1: Critical Bugs

These issues break core functionality and should be fixed first.

- [ ] **Bug** - Cannot delete a bean from green coffee inventory if it references a sales row or roast profile. Needs cascade delete function or proper dependency handling to prevent orphaned records.
- [x] **Bug** - Bean profile data collection incomplete. The `/beans` profile should pull all non-null data fields into the form display in an organized layout. (Fixed PR #123)

---

## Priority 2: UI/UX Issues Affecting User Experience

These issues impact usability but don't break core functionality.

- [x] **UI/UX** - Supplier cupping note dashed lines are too dark and visually distracting. Reduce opacity or change to lighter color. (Fixed PR #172)

- [x] **UI/UX** - Saving cupping notes doesn't refresh page data. After save, the UI should re-render to show the newly saved data without requiring manual refresh. (Fixed PR #156)
- [ ] **UI/UX** - Clean up beans catalog profiles to remove exposed user reference fields from the display.
- [ ] **UI/UX** - Roast chart doesn't resize when navigating between pages. Chart container needs ResizeObserver or layout recalculation on route change.
- [ ] **UI/UX** - Poor page refresh management across the app. Forms/edits save but page data doesn't update reactively to show changes.
- [x] **UI/UX** - Add wholesale markers/indicators to green coffee inventory page. Catalog has wholesale support; extend visibility to inventory views. (Fixed PR #121)
- [x] **UI/UX** - Add wholesale markers/filtering to roast profiles page. Show which roasts used wholesale beans. (Fixed PR #157)
- [x] **UI/UX** - Add wholesale markers/filtering to sales page. Track wholesale vs retail sales distinctly. (Fixed PR #166)

---

## Priority 3: Page Loading & Performance

These issues affect perceived performance and page transitions.

- [ ] **Performance** - Fix real experience score (Core Web Vitals). Address First Contentful Paint and Time to First Byte issues identified in performance analysis.
- [ ] **Performance** - Implement page loading optimization plan. Server loads stripped for beans/profit/roast forms (PR #77); remaining: convert blocking server loads for page data on `/catalog` route. See `notes/page-loading-optimization-plan.md`.
- [ ] **Performance** - Profit page doesn't auto-refresh on new sale form submission. Data should reload after successful sale creation.
- [ ] **Performance** - Improve skeleton loading states. Current skeleton conditions never trigger because server loads provide data immediately.

---

## Priority 4: Mobile Experience

Mobile-specific improvements for roasters on the go.

- [ ] **Mobile** - Improve roast profile/bean profile appearance on mobile. Cards and details are cramped or cut off.
- [ ] **Mobile** - Improve usability of roast chart buttons on mobile. Touch targets are too small and controls overlap.
- [ ] **Mobile** - Move fan settings display below the chart on mobile. Currently covers chart area on small screens.
- [ ] **Mobile** - Consider moving the existing authenticated mobile shell from its current top app bar to a bottom bar for easier thumb-reach on phones. This is now a refinement of the shipped mobile shell, not a missing shell foundation.

---

## Priority 5: Roast Chart Improvements

The roast chart is a core feature that needs refinement.

- [x] **Bug** - Artisan file import (`/roast` page "Import Artisan File") has no loading indicator after clicking save. Takes noticeably longer than it used to and gives no feedback during the wait — looks like nothing happened. (Fixed PR #199)
- [ ] **Bug** - Fan/heat settings from `.alog` imports render off-chart. Settings axes need to auto-detect the actual value range from the imported data (e.g., 0–100 in steps of 5 vs. 0–10) and scale accordingly instead of using a fixed axis range.
- [ ] **Roast Chart** - Add visual save confirmation when clicking "cool end" button. Users need feedback that the action succeeded.
- [ ] **Roast Chart** - Remove y-axis gridlines for cleaner appearance.
- [ ] **Roast Chart** - Add average curve overlay for heat and fan settings across multiple roasts of same bean.
- [ ] **Roast Chart** - Add color shading for roast phases (drying, maillard, development) as background regions.
- [ ] **Roast Chart** - Add roast ID display on roast profile page for easier reference/sharing.
- [ ] **Roast Chart** - Make up/down arrows work consistently for both temp and fan adjustments.
- [ ] **Roast Chart** - Smooth out temperature curve display to reduce noise/jitter.
- [ ] **Roast Chart** - Remove fan and heat Y-axis labels; keep only external temp labels for clarity.
- [x] **Roast Chart** - Complete chart data refactoring project. Simplify the 8+ step data transformation pipeline to 2-3 steps. See `notes/archive/Chart.md`.
- [ ] **Roast Chart** - Fix chart timer stopping when phone screen locks/closes. Timer should continue running in background.

---

## Priority 6: Roast Data & Insights

Improve roast tracking and analysis features.

- [ ] **Roast Data** - Improve UI to demystify roasting process. Terms like "Maillard" and "FC Start" are confusing for beginners. Add explanatory tooltips and learning funnels.
- [ ] **Roast Data** - Add ambient temperature setting field. Useful for tracking environmental conditions affecting roast.
- [ ] **Roast Data** - Add charge setting field (machine preheated or not). Important variable for roast consistency.
- [ ] **Roast Data** - Add TP (turning point), FC (first crack), DROP times display in roast profile summary.
- [ ] **Roast Data** - Implement TP, FC, and development % calculations with display in roast chart interface.
- [ ] **Roast Data** - Parse fan and heat settings from Artisan import file. Currently only temperature data is extracted.
- [ ] **Roast Insights** - Add % weight loss display per roast. Weight loss is a key indicator of roast development level.
- [ ] **Roast Insights** - Add remaining purchased quantity data to bean inventory. Track how much green coffee is left from each purchase.
- [ ] **Roast Insights** - Integrate roast darkness token into `/roast` and `/beans` sections. Visual indicator based on weight loss percentage ranges.
- [ ] **Roast Comparison** - Build roast comparison feature. Upload 10+ roasts from same bag and run analysis comparing weight loss, development/phase percentages, drop temp, etc. Flag outliers for cupping review.

---

## Priority 7: Profit Page

Improvements to sales and profit tracking.

- [ ] **Profit Page** - Chart visualization needs improvement. Current display is difficult to read; consider dashboard dials or better chart type.
- [ ] **Profit Page** - Add bean-to-roast selection flow in new sale form. User selects bean first, then gets dropdown of actual roasts for that bean.

---

## Priority 8: Database & Data Structure

Backend improvements for data integrity and performance.

- [ ] **Database** - Add `stocked` column management through profiles if not already complete. Verify auto-update when inventory is depleted.
- [ ] **Database** - Add purchased quantity remaining dataset to beans. Calculate remaining green coffee from purchases minus roasts.
- [ ] **Database** - Reduce duplication between `green_coffee_inv` and `coffee_catalog`. Only duplicate data for original, unreferenced coffees.
- [ ] **Database** - Fix text field paragraph formatting. DB structure or front-end interpretation strips newlines from multi-paragraph text fields.

---

## Priority 9: Sharing & Collaboration Features

Features for roasters to share their work.

- [ ] **Share** - Build roast profile report share function. Allow roasters to generate and share a complete roast breakdown.
- [ ] **Share** - Create shareable roast package with bean info, roast data, cupping notes, and chart.
- [ ] **Share** - Expand share functionality for filtered catalog results. Share a URL that preserves current filter state.
- [ ] **Share** - Full breakdown share to customers. Let roasters send complete roast reports with bean details, tasting notes, roast profile to their customers.

---

## Priority 10: AI & Chat Features

AI-powered tools and chatbot improvements.

- [ ] **AI** - Add bean filter context button to chatbot. Allow users to ask questions about currently filtered beans.
- [ ] **AI** - Add "Analyze" buttons to roast and bean areas to summon the AI chatbot with relevant context.
- [ ] **AI** - Showroom needs to collect tasting notes from images if no cupping notes exist in chart data. OCR or AI-based extraction.

---

## Priority 11: Navigation & UX Flow

Improvements to app navigation and user flows.

- [ ] **Navigation** - Improve sales funnel & clickthrough flow. Reduce friction from discovery to purchase/subscription.
- [ ] **Navigation** - Simplify main page. Currently requires long scrolling; consider above-fold optimization or tab navigation.
- [ ] **Navigation** - Emphasize "green coffee" marketplace focus on main page. Make sourcing discovery more prominent.

---

## Priority 12: Tasting Notes & Cupping

Improvements to tasting and evaluation features.

- [ ] **Tasting Notes** - Add brew method field to cupping form. Different brew methods affect tasting notes.

---

## Priority 13: Analytics & Insights

Data analysis and visualization features.

- [ ] **Analytics** - Track all source pricing, stock levels, location distribution, and processing methods over time. Build historical dataset.
- [ ] **Analytics** - Create trends and analysis charting page. Prioritize fun, informational roasting insights like "your most consistent roasts" or "price trends by origin".

---

## Priority 14: API Product Development

Public API for external developers and integrations.

- [ ] **API** - Integrate full API infrastructure into front-end app. Internal app should consume same APIs sold externally.
- [ ] **API** - Green coffee processing API endpoint. Input a URL or coffee name, output a cleaned, normalized data row.
- [ ] **API** - Tasting notes API endpoint. Input tasting notes text, output a cupping score chart with custom visualization.
- [ ] **API** - Roast calculations API endpoint. Input roast tracking data, output full charted interface with RoR calculations.
- [x] **API** - Implement API tier row limits. Free tier: limited rows, Member: more rows, Enterprise: unlimited.
- [ ] **API** - Implement API key limits per tier. Free: 1 key, Member: up to 10 keys, Enterprise: unlimited keys.
- [ ] **API** - Add roast IDs to profiles for more accurate tagging and API reference.

---

## Priority 15: Feature Ideas & Future Development

Longer-term feature concepts to explore.

- [ ] **Feature Ideation** - Explore supplier & origin comparison tools. Side-by-side analysis of same origin from different suppliers.
- [ ] **Feature Ideation** - Develop real-time coffee market pricing analysis. Track and display current market prices.
- [ ] **Feature Ideation** - Implement price trend monitoring for green coffee. Alerts when prices drop on watched coffees.
- [ ] **Feature Ideation** - Lot share platform (like Kickstarter for coffee). Allow multiple buyers to split high-quality coffee lots.
- [ ] **Feature Ideation** - Ghost Roast feature. Follow a template roast profile in real-time during roasting session.
- [ ] **Feature Ideation** - Publish quarterly "State of the Green Coffee Market" data blog post using collected data.
- [ ] **Feature Ideation** - Lot buying model like ThoughtfulCoffee for green coffee group purchases.
- [ ] **Feature Ideation** - Focus on viral, shareable tools. Filter URLs, recommendation engines, easy-share API outputs.
- [ ] **Feature Ideation** - Add a macro data transparency ranking column or score for catalog coffees based on the number, specificity, and source quality of disclosed data points. Keep this separate from raw API/CLI output so machine consumers receive clean data while the web UI can offer buyer-facing analysis.
- [ ] **Feature Ideation** - License cleaned coffee dataset to roast machine companies (like RoastWorld) for integration.

### Beyond the Coffee Belt: Platform Feature Ideas (Mar 2026)

- [ ] **Feature Ideation** - Schema upgrades for resilience metadata: `species`, `cultivar_lineage_confidence`, `isolation_profile`, `microclimate_driver`, and `resilience_notes`.
- [ ] **Feature Ideation** - Portfolio concentration risk dashboard (country/region/species/supplier concentration, single-point-of-failure alerts).
- [ ] **Feature Ideation** - Barbell sourcing planner (core reliability vs edge discovery mix targets with gap detection).
- [ ] **Feature Ideation** - Supplier diversification scoring model (optionality contribution, uniqueness contribution, resilience contribution).
- [ ] **Feature Ideation** - Risk-adjusted economics calculator: `effective_cost = landed_cost + concentration_risk_premium - differentiation_value`.
- [ ] **Feature Ideation** - Buyer intent mode in catalog/chat: Reliability intent vs Discovery intent with different ranking strategies.
- [ ] **Feature Ideation** - Edge-origin watchlist and alerts for low-volume/high-differentiation lots and emerging non-traditional origins.

---

## Priority 16: Open Source & Community

Community and open-source initiatives.

- [ ] **Open Source** - Explore N8N framework for open-source workflow automation. Link: https://github.com/n8n-io/n8n
- [ ] **Open Source** - Add GitHub project link to main page for community contributions.

---

## Priority 17: Code Quality & Technical Debt

Ongoing code maintenance tasks.

- [x] **TypeScript** - Fix 5 critical generic type issues in `VirtualScrollList.svelte`. 'T' is not defined errors.
- [ ] **TypeScript** - Address ~380 explicit `any` type violations across codebase. Major files: RoastLogChart (~151), roast/+page (~49), beans/+page (~34). See `notes/lint-issues-prioritized.md`.
- [ ] **Lint Boundary** - Split repo-wide prose/notes formatting from product lint, or narrow `pnpm lint` so docs and code PRs are not blocked by historical markdown drift outside the changed scope.
- [ ] **Public Route Metadata** - Centralize public route metadata for `/v1`, `/docs`, `/api`, `/api-dashboard`, and legacy docs redirects so README, `llms.txt`, and docs marketing copy share one source of truth.
- [ ] **CLI Docs Contract Sync** - Consume a tiny generated docs fragment from `@purveyors/cli/manifest` (published or vendored) so coffee-app docs stay in lockstep with the shipped CLI contract instead of manually shadowing it.
- [ ] **API Migration** - Implement share token support in `/api/roast-profiles` endpoint. Currently missing from new endpoint. See `notes/MIGRATION-NOTES.md`.

---

## Unclear / Needs Clarification (??)

Items that need more context before they can be actionable.

- [ ] ?? **thoughtfulcoffeenyc** - Referenced but unclear what action is needed.
- [ ] ?? **"Allio bullet roasting software"** - Reference only; unclear if integration is planned.
- [ ] ?? Links to external resources (miicoffee, getprodigal, etc.) - Referenced for inspiration but no clear action items.

---

## Completed Items

- [x] **fix: use Chat Completions API for OpenRouter instead of Responses API** (PR #83)
- [x] **fix: reliable bean pre-selection in roast form from bean profile** (PR #82)
- [x] **refactor(profit): URL-driven form architecture (Phase C)** (PR #76)
- [x] **refactor(beans): URL-driven form architecture (Phase B)** (PR #75)
- [x] **refactor(roast): URL-driven form architecture** (PR #74)
- [x] **Fix user rating editing: null checks, validation, segmented UI** (PR #73)
- [x] **Switch embeddings to Qwen3 via OpenRouter, drop OPENAI_API_KEY; switch chat/summarize to OpenRouter** (PR #72)
- [x] **Fix roast form double-scroll on mobile** (PR #70)
- [x] **Forms** - Extract shared FormShell component with unified scroll containment, body scroll lock, and ARIA attributes (PR #77)
- [x] **Performance** - Remove server-side form data queries; forms fetch data client-side for instant navigation (PR #77)
- [x] **Performance** - Add lightweight `?fields=dropdown` param to catalog API for form dropdowns (PR #77)
- [x] **Bug** - Roast form layout overflow. Fixed by FormShell unified scroll containment (PR #77)
- [x] **Wholesale** - Wholesale data model and catalog UX implemented (price_tiers, wholesale flag, catalog filters)
- [x] **Bug** - The loading screen shows "No Beans" dialog before the db returns data
- [x] **Form Validation** - Limit bean selection in forms to stocked items only (beans, roast, sales)
- [x] **Web Scraping** - Automate vector embedding in the scrape workflow
- [x] **Web Scraping** - Summarize/rewrite front-end descriptions for fair use
- [x] **Web Scraping** - Automate data cleaning of NULL columns with Gemini when we scrape
- [x] **Web Scraping** - Automate LLM interpretation of text into AI blurb column
- [x] **UI/UX** - Correct rank formatting to two decimal places and improve visual layout
- [x] **Tasting Notes** - Create new table to manage comprehensive rating form data
- [x] **Tasting Notes** - Improve rating/notes function by bean
- [x] **Tasting Notes** - Allow roast selection specific to the bean
- [x] **Tasting Notes** - Create more comprehensive rating scale (brew method, nose, flavor, etc.)
- [x] **Tasting Notes** - Collect tasting notes and convert to cupping score chart
- [x] **Forms** - Date population is now consistent across form completions
- [x] **Tasting Notes** - Display cupping/tasting notes per profile on main profile page
- [x] **Roast Insights** - Organize roasts by bean for roast comparison, instead of by batch
- [x] **Cookie Notifications** - Implement cookie accept popup / no-cookies banner
- [x] **UI/UX** - Redesign roast, bean, and profit pages to match landing/catalog aesthetic
- [x] **UI/UX** - Clean up roast page UI to align with beans page UI
- [x] **Bug** - Forms now render above card layers on beans, profit, and roast pages
- [x] **Lint Cleanup** - All unused imports and variables removed (medium priority lint issues 100% complete)
- [x] **API Dashboard** - Basic dashboard infrastructure built (keys, usage, docs pages exist)
- [x] **Stocked Functionality** - Stocked column implemented and managed through the application
- [x] **Share Tokens** - Basic share token support implemented for beans

---

## Supplier Tracking

### Integrated Suppliers (39 live as of 2026-03-20)

See `coffee-scraper` repo `SUPPLIERS.md` for the full list. Representative examples:

- [x] Bodhi Leaf
- [x] Sweet Maria's
- [x] Coffee Bean Corral
- [x] Burman Coffee Traders
- [x] Happy Mug
- [x] Mill City Roasters
- [x] T.M. Ward Coffee (added PR #99 2026-03-17)
- [x] Ally Coffee (wholesale catalog, added PR #107 2026-03-20)
- [x] Roastmasters (Miva Merchant, added PR #105 2026-03-20)
- [x] Genuine Origin (NetSuite, added PR #109 2026-03-20)
- [x] Ally Open (Shopify, added PR #106 2026-03-20)

### Suppliers to Add

- [ ] ~~Onyx Green Coffee~~ — Onyx Box is not a public green bean offering; excluded
- [ ] Green Coffee Buying Club
- [ ] Len's Coffee
- [ ] Leverhead Coffee
- [ ] Lost Dutchman
- [ ] Roast Coffee Company
- [ ] Blazing Bean Roasters
- [ ] Crop to Cup

---

## Weight Loss Reference Guide

For roast darkness token implementation:

| Weight Loss | Roast Level   | Notes                                                     |
| ----------- | ------------- | --------------------------------------------------------- |
| <11%        | Under-roasted | Generally concerning; some low-moisture greens can be 10% |
| 11-13%      | Light         | Almost always light roast territory                       |
| 14-16%      | Medium        | Less acidity, more caramels, nuts, chocolate              |
| 17-18%      | Dark          | Roast notes dominate: smoke, dark chocolate, woody        |
| 19-21%      | Very Dark     | Roast notes dominate in unpleasant ways                   |
| >22%        | Dangerous     | Near-fire territory, avoid                                |

---

## Reference Documentation

Additional detailed notes are available in the `/notes` folder:

- `API-strategy.md` - Full API-first platform strategy
- `APITIER.md` - API pricing tier details
- `APITODOS.md` - Detailed API implementation plan
- `Chart.md` - Roast chart refactoring project status
- `MARKET_ANALYSIS.md` - Market analysis and user targeting
- `MIGRATION-NOTES.md` - API migration notes and missing features
- `page-loading-optimization-plan.md` - Performance optimization plan
- `DEVLOG-DAILY-PR-AUDIT.md` - Daily PR automation audit and easy-win selection rubric
- `lint-issues-prioritized.md` - TypeScript/lint issue tracking
- `UI-FRAMEWORK.md` - Design system documentation
- `svelte5README.md` - SvelteKit 5 migration reference
- `artisan-upload/artisan-data-mapping-analysis.md` - Artisan data schema documentation

---

## Tech Stack

- **Frontend**: SvelteKit 5, TypeScript, TailwindCSS, D3.js
- **Backend**: SvelteKit API routes, Supabase (PostgreSQL + Auth)
- **Deployment**: Vercel (adapter-vercel)
- **AI/ML**: OpenRouter (Qwen3) embeddings, Google AI
- **Payments**: Stripe
- **Web Scraping**: Playwright (Oracle Cloud hosted)

---

## External References

- Home-barista.com green coffee sources: https://www.home-barista.com/roasting/green-coffee-sources-list-2024-t91583.html
- Openroast: https://github.com/Roastero/Openroast
- Artisan: https://github.com/artisan-roaster-scope/artisan
- Cupofexcellence.org
- N8N workflow automation: https://github.com/n8n-io/n8n
