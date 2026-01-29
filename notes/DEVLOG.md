# Coffee App Development Log

> Master todo list and development notes for purveyors.io coffee tracking platform.

---

## Priority 1: Critical Bugs

These issues break core functionality and should be fixed first.

- [x] **Bug** - Cannot delete a bean from green coffee inventory if it references a sales row or roast profile. Needs cascade delete function or proper dependency handling to prevent orphaned records.
- [x] **Bug** - User rating editing is broken. The rating input/save mechanism on bean profiles doesn't persist changes to the database.
- [x] **Bug** - "New Roast" link on bean page doesn't navigate to roast form correctly. The link routing is malformed or missing coffee_id parameter.
- [x] **Bug** - Roast form layout overflow. The form doesn't fit within the page viewport on certain screen sizes, requiring horizontal scrolling.
- [x] **Bug** - Bean profile data collection incomplete. The `/beans` profile should pull all non-null data fields into the form display in an organized layout.

---

## Priority 2: UI/UX Issues Affecting User Experience

These issues impact usability but don't break core functionality.

- [ ] **UI/UX** - Supplier cupping note dashed lines are too dark and visually distracting. Reduce opacity or change to lighter color.
- [ ] **UI/UX** - Score & rating display formatting needs cleanup. Numbers and labels aren't aligned consistently.
- [ ] **UI/UX** - Saving cupping notes doesn't refresh page data. After save, the UI should re-render to show the newly saved data without requiring manual refresh.
- [ ] **UI/UX** - Clean up beans catalog profiles to remove exposed user reference fields from the display.
- [ ] **UI/UX** - Roast chart doesn't resize when navigating between pages. Chart container needs ResizeObserver or layout recalculation on route change.
- [ ] **UI/UX** - Poor page refresh management across the app. Forms/edits save but page data doesn't update reactively to show changes.

---

## Priority 3: Page Loading & Performance

These issues affect perceived performance and page transitions.

- [ ] **Performance** - Fix real experience score (Core Web Vitals). Address First Contentful Paint and Time to First Byte issues identified in performance analysis.
- [ ] **Performance** - Implement page loading optimization plan. Convert blocking server loads to client-side loading for `/catalog`, `/beans`, `/roast` routes to match `/profit` page transition speed. See `notes/page-loading-optimization-plan.md`.
- [ ] **Performance** - Profit page doesn't auto-refresh on new sale form submission. Data should reload after successful sale creation.
- [ ] **Performance** - Improve skeleton loading states. Current skeleton conditions never trigger because server loads provide data immediately.

---

## Priority 4: Mobile Experience

Mobile-specific improvements for roasters on the go.

- [ ] **Mobile** - Improve roast profile/bean profile appearance on mobile. Cards and details are cramped or cut off.
- [ ] **Mobile** - Improve usability of roast chart buttons on mobile. Touch targets are too small and controls overlap.
- [ ] **Mobile** - Move fan settings display below the chart on mobile. Currently covers chart area on small screens.
- [ ] **Mobile** - Move navigation menu bar to bottom bar for mobile. Easier thumb-reach for common actions.

---

## Priority 5: Roast Chart Improvements

The roast chart is a core feature that needs refinement.

- [ ] **Roast Chart** - Add visual save confirmation when clicking "cool end" button. Users need feedback that the action succeeded.
- [ ] **Roast Chart** - Remove y-axis gridlines for cleaner appearance.
- [ ] **Roast Chart** - Add average curve overlay for heat and fan settings across multiple roasts of same bean.
- [ ] **Roast Chart** - Add color shading for roast phases (drying, maillard, development) as background regions.
- [ ] **Roast Chart** - Add roast ID display on roast profile page for easier reference/sharing.
- [ ] **Roast Chart** - Make up/down arrows work consistently for both temp and fan adjustments.
- [ ] **Roast Chart** - Smooth out temperature curve display to reduce noise/jitter.
- [ ] **Roast Chart** - Remove fan and heat Y-axis labels; keep only external temp labels for clarity.
- [ ] **Roast Chart** - Complete chart data refactoring project. Simplify the 8+ step data transformation pipeline to 2-3 steps. See `notes/Chart.md`.
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

## Priority 12: Web Scraping & Data Import

Tools for adding new coffee data.

- [ ] **Web Scraping** - Add option to add a bean based on a URL. User pastes supplier URL and system extracts coffee data.
- [ ] **Web Scraping** - Implement automatic scraping for supported supplier URLs. Auto-detect and parse known supplier page formats.

---

## Priority 13: Tasting Notes & Cupping

Improvements to tasting and evaluation features.

- [ ] **Tasting Notes** - Add brew method field to cupping form. Different brew methods affect tasting notes.
- [ ] **Tasting Notes** - Restore ability to edit user ratings. Rating edit functionality was removed or broken.

---

## Priority 14: Analytics & Insights

Data analysis and visualization features.

- [ ] **Analytics** - Track all source pricing, stock levels, location distribution, and processing methods over time. Build historical dataset.
- [ ] **Analytics** - Create trends and analysis charting page. Prioritize fun, informational roasting insights like "your most consistent roasts" or "price trends by origin".

---

## Priority 15: API Product Development

Public API for external developers and integrations.

- [ ] **API** - Integrate full API infrastructure into front-end app. Internal app should consume same APIs sold externally.
- [ ] **API** - Green coffee processing API endpoint. Input a URL or coffee name, output a cleaned, normalized data row.
- [ ] **API** - Tasting notes API endpoint. Input tasting notes text, output a cupping score chart with custom visualization.
- [ ] **API** - Roast calculations API endpoint. Input roast tracking data, output full charted interface with RoR calculations.
- [ ] **API** - Implement API tier row limits. Free tier: limited rows, Member: more rows, Enterprise: unlimited.
- [ ] **API** - Implement API key limits per tier. Free: 1 key, Member: up to 10 keys, Enterprise: unlimited keys.
- [ ] **API** - Add roast IDs to profiles for more accurate tagging and API reference.

---

## Priority 16: Feature Ideas & Future Development

Longer-term feature concepts to explore.

- [ ] **Feature Ideation** - Explore supplier & origin comparison tools. Side-by-side analysis of same origin from different suppliers.
- [ ] **Feature Ideation** - Develop real-time coffee market pricing analysis. Track and display current market prices.
- [ ] **Feature Ideation** - Implement price trend monitoring for green coffee. Alerts when prices drop on watched coffees.
- [ ] **Feature Ideation** - Lot share platform (like Kickstarter for coffee). Allow multiple buyers to split high-quality coffee lots.
- [ ] **Feature Ideation** - Ghost Roast feature. Follow a template roast profile in real-time during roasting session.
- [ ] **Feature Ideation** - Publish quarterly "State of the Green Coffee Market" data blog post using collected data.
- [ ] **Feature Ideation** - Lot buying model like ThoughtfulCoffee for green coffee group purchases.
- [ ] **Feature Ideation** - Focus on viral, shareable tools. Filter URLs, recommendation engines, easy-share API outputs.
- [ ] **Feature Ideation** - License cleaned coffee dataset to roast machine companies (like RoastWorld) for integration.

---

## Priority 17: Open Source & Community

Community and open-source initiatives.

- [ ] **Open Source** - Explore N8N framework for open-source workflow automation. Link: https://github.com/n8n-io/n8n
- [ ] **Open Source** - Add GitHub project link to main page for community contributions.

---

## Priority 18: Code Quality & Technical Debt

Ongoing code maintenance tasks.

- [ ] **TypeScript** - Fix 5 critical generic type issues in `VirtualScrollList.svelte`. 'T' is not defined errors.
- [ ] **TypeScript** - Address ~380 explicit `any` type violations across codebase. Major files: RoastLogChart (~151), roast/+page (~49), beans/+page (~34). See `notes/lint-issues-prioritized.md`.
- [ ] **API Migration** - Implement share token support in `/api/roast-profiles` endpoint. Currently missing from new endpoint. See `notes/MIGRATION-NOTES.md`.

---

## Unclear / Needs Clarification (??)

Items that need more context before they can be actionable.

- [ ] ?? **thoughtfulcoffeenyc** - Referenced but unclear what action is needed.
- [ ] ?? **"Allio bullet roasting software"** - Reference only; unclear if integration is planned.
- [ ] ?? Links to external resources (miicoffee, getprodigal, etc.) - Referenced for inspiration but no clear action items.

---

## Completed Items

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

### Integrated Suppliers

- [x] Bodhi Leaf (SHIP59 coupon code)
- [x] Showroom Coffee
- [x] The Captain's Coffee
- [x] Sweet Maria's
- [x] Coffee Bean Corral
- [x] Burman Coffee Traders

### Suppliers to Add

- [ ] Theta Ridge Coffee - Low prices but limited farm info; Daterra importer
- [ ] Prime Green Coffee - https://primegreencoffee.org/shop/ - has coferments
- [ ] Onyx Green Coffee - Onyx Box (20/40lbs) Guatemala with $10 Fedex
- [ ] Sleepy Mango Coffee - https://sleepymangocoffee.com/collections/frontpage
- [ ] Royal Coffee Crown Jewels - 22lb and 1lb bags, preferred decaf source
- [ ] Genuine Origin - 65lb grain pro bags, $7.50 300g samples
- [ ] Hacea Coffee Source - https://haceacoffee.com/collections/green-coffee
- [ ] Aida Batlle Direct
- [ ] Primos Nicaragua
- [ ] Cafe Juan Ana
- [ ] Cafe Kreyol - https://cafekreyol.com/shop/type/green-coffee/
- [ ] Green Coffee Buying Club
- [ ] Java Beans Plus
- [ ] Len's Coffee
- [ ] Leverhead Coffee
- [ ] Lost Dutchman
- [ ] Lavanta Coffee - https://lavantacoffee.com/product-category/green-coffee/
- [ ] The Coffee Project
- [ ] Roast Coffee Company
- [ ] Sea Island Coffee - https://seaislandcoffee.com/collections/unroasted
- [ ] Blazing Bean Roasters
- [ ] Smokin' Beans Coffee Co.
- [ ] Invalsa
- [ ] CopanTrade
- [ ] Rhodes Roast - 5lb bags, free shipping
- [ ] Yellow Rooster
- [ ] Mill City Roasters
- [ ] Roastmasters - 50lb grain pro bags, $22 flat rate shipping
- [ ] Royal New York - 22lb boxes
- [ ] Coffee Shrub - 50lb bags, 200g samples wholesale only
- [ ] Ally Coffee - Open Core 50lb, Microlots 50lb, Reserve 25lb
- [ ] Coffee Crafters Green - 10/20lb bags
- [ ] Crop to Cup
- [ ] Covoya
- [ ] Klatch - https://www.klatchcoffee.com/collections/green-coffee
- [ ] Cofinet - 52.5lb units - https://www.cofinet.com.au/store/
- [ ] Forest Coffee - https://coffeegreenbeans.com/collections/greencoffeestore
- [ ] Good Brothers Coffee - https://goodbrotherscoffee.com/collections/green-coffee-beans

---

## Weight Loss Reference Guide

For roast darkness token implementation:

| Weight Loss | Roast Level | Notes |
| ----------- | ----------- | ----- |
| <11% | Under-roasted | Generally concerning; some low-moisture greens can be 10% |
| 11-13% | Light | Almost always light roast territory |
| 14-16% | Medium | Less acidity, more caramels, nuts, chocolate |
| 17-18% | Dark | Roast notes dominate: smoke, dark chocolate, woody |
| 19-21% | Very Dark | Roast notes dominate in unpleasant ways |
| >22% | Dangerous | Near-fire territory, avoid |

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
- `lint-issues-prioritized.md` - TypeScript/lint issue tracking
- `UI-FRAMEWORK.md` - Design system documentation
- `svelte5README.md` - SvelteKit 5 migration reference
- `artisan-upload/artisan-data-mapping-analysis.md` - Artisan data schema documentation

---

## Tech Stack

- **Frontend**: SvelteKit 5, TypeScript, TailwindCSS, D3.js
- **Backend**: SvelteKit API routes, Supabase (PostgreSQL + Auth)
- **Deployment**: Vercel (adapter-vercel)
- **AI/ML**: OpenAI embeddings, Google AI
- **Payments**: Stripe
- **Web Scraping**: Playwright (Oracle Cloud hosted)

---

## External References

- Home-barista.com green coffee sources: https://www.home-barista.com/roasting/green-coffee-sources-list-2024-t91583.html
- Openroast: https://github.com/Roastero/Openroast
- Artisan: https://github.com/artisan-roaster-scope/artisan
- Cupofexcellence.org
- N8N workflow automation: https://github.com/n8n-io/n8n
