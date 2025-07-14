## Todo List

- [ ] **Bug** - Cannot delete a bean from green coffee inventory if it references a sales row; may also be linked to roast. Needs cascade delete function.
- [ ] **Bug** - can't edit user rating

- [ ] **Bug** - Links to new roast on bean page doesn't take you to the roast form
- [ ] **Bug** - The loading screen shows "No Beans" dialog before the db returns data - should be looking for a NULL return from table before rendering no beans. Otherwise should be rendering a loading screen - much earlier in the load.
- [ ] **Bug** - roast form doesn't fit on the page
- [ ] **Bug** - /beans profile just needs to pull not null data into the form in an organized way so it collects everything.
-
- [ ] **UI/UX** - the supplier cupping note dashed lines are way too dark, distracting
- [ ] **UI/UX** - fix score & rating display
- [ ] **UI/UX** - saving the cupping notes doesn't retrigger the page to render the new data saved to the db
- [ ] **UI/UX** - improve linking to roast logs from the bean page
- [ ] **UI/UX** - Clean up beans catalog profiles and remove user reference
-
- [ ] **Web Scraping** - Add option to add a bean based on a URL
- [ ] **Web Scraping** - Implement automatic scraping for supported URLs
-
- [ ] **AI** - Hybrid RAG: Use tool calls for structured lookups: filters, search, pricing, transactions. Use RAG for unstructured knowledge: guides, tips, reviews, roast advice.  
       - “Find Ethiopian naturals under $10/lb rated 88+” 🔧 Tool Call Clear filters → use MySQL API  
       - “What’s a good coffee for a chocolatey espresso profile?” 📚 RAG Requires semantic matching and taste context  
       - “Compare these two coffees side by side” 🔧 Tool Call Deterministic, tabular output  
       - “How does fermentation impact acidity in natural processed beans?” 📚 RAG Explanatory, doc-based
- [ ] **AI** - Extremely comprehensive synonym table to bolser RAG
- [ ] **AI** - add bean filter context button to chat bot
-
- [ ] **Performance** - Fix real experience score and content paint
-
- [ ] **Mobile** - Improve roast profile/bean profile appearance on mobile
- [ ] **Mobile** - Improve usability of roast chart buttons on mobile
- [ ] **Mobile** - Move fan settings below the chart on mobile
-
- [ ] **Navigation** - Improve menu UI - the icons are really hard to understand
- [ ] **Navigation** - Highlight the catalog page when you are on it in the navigation menu
- [ ] **Navigation** - move menu bar to bottom bar for mobile
- [ ] **Navigation** - only display relevant active menu options for each page. Currently showing all of them, indescriminantly
- [ ] **Navigation** - simplify nav bar area, have less going on. Make it easier to understand what icons mean what.
- [ ] **Navigation** - make it easier to navigate back to landing page from the pricing page
- [ ] **Navigation** - improve sales funnel & clickthrough to make it more seamless
- [ ] **Navigation** - simplify main page? Really long scrolling
-
- [ ] **Roast Insights** - make the roast comparison on bean profile show the actual roast names and allow you to navigate directly to those roast profiles

- [ ] **Roast Insights** - Add % weight loss display per roast
- [ ] **Roast Insights** - Add remaining purchased quantity data to bean inventory
-
- [ ] **Roast Chart** - Remove y-axis lines
- [ ] **Roast Chart** - Add average curve for heat and fan settings
- [ ] **Roast Chart** - Add color shading for roast phases
- [ ] **Roast Chart** - Add roast ID to roast profile page
- [ ] **Roast Chart** - Make up/down arrows work consistently for temp and fan
- [ ] **Roast Chart** - Smooth out temp curve for cleaner display
- [ ] **Roast Chart** - Remove fan and heat Y-axis labels; keep only external temp labels
-
- [ ] **Roast Data** - Add ambient temperature setting
- [ ] **Roast Data** - Add charge setting (machine hot or not)
- [ ] **Roast Data** - Add TP, FC, DROP times in roast profile
- [ ] **Roast Data** - Fix roast charting timer turning off when phone closes
- [ ] **Roast Data** - Implement TP, FC, and development % calculations and display them in the roast chart interface
- [ ] **Roast Data Import** - Parse fan and heat settings from Artisan import file
-
- [ ] **Text Handling** - Fix DB structure or front-end interpretation to preserve paragraph formatting in text fields
-
- [ ] **Database** - Add `stocked` column to `green_coffee_inv` and manage it through profiles
- [ ] **Database** - Need a purchased qty remaining data set in beans category to add to the stocked functionality
- [ ] **Database Optimization** - Reduce duplication between `green_coffee_inv` and `coffee_catalog` — only duplicate for original, unreferenced coffees
-
- [ ] **Tasting Notes** - brew method?
- [ ] **Tasting Notes** - add back the ability to edit user rating
-
- [ ] **Analytics** - Track all source pricing, stock, location distribution, and processing methods over time
- [ ] **Analytics** - Create trends and analysis charting page; prioritize fun and informational roasting insights
-
- [ ] **Feature Ideation** - Explore tools for Supplier & Origin Comparison
- [ ] **Feature Ideation** - Develop Real-time Coffee Market Pricing Analysis
- [ ] **Feature Ideation** - Implement Price Trend Monitoring for Green Coffee
- [ ] **Feature Ideation** - Add option to add a bean based on a URL - Implement automatic scraping for supported URLs
- [ ] **Feature Ideation** - Lot share platform to divide up lots (like Kickstarter for high-quality coffee lots)
- [ ] **Feature Ideation** - Ghost Roast - Implement “ghost roast” to follow a template roast profile
-
- [ ] **License / Open Source** - USE N8N framework for open source. Add github project to main page. https://github.com/n8n-io/n8n?tab=readme-ov-file#readme

## Done List

- [x] **Form Validation** - Limit bean selection in forms to stocked items only (beans, roast, sales)
- [x] **Web Scraping** - Automate vector embeding in the scrape workflow
- [x] **Web Scraping** - Summarize/rewrite front-end descriptions for fair use
- [x] **Web Scraping** - Automate data cleaning of NULL columns with Gemini when we scrape
- [x] **Web Scraping** - Automate llm interpretation of the text into an AI blurb column - claims extraction & cleaning of data columns during scrape
- [x] **UI/UX** - Correct rank formatting to two decimal places and improve visual layout
- [x] **Tasting Notes** - Create new table to manage comprehensive rating form data
- [x] **Tasting Notes** - Improve rating/notes function by bean
- [x] **Tasting Notes** - Allow roast selection specific to the bean
- [x] **Tasting Notes** - Create more comprehensive rating scale (brew method, nose, flavor, etc.)
- [x] **Tasting Notes** - Collect tasting notes and convert to cupping score chart
- [x] **Forms** - date population is inconsistent and poor across form completions
- [x] **Tasting Notes** - Display cupping/tasting notes per profile on main profile page
- [x] **Roast Insights** - Organize roasts by bean for roast comparison, instead of by batch
- [x] **COOKIE notifications** - implement a cookie accept popup / Set up no-cookies banner at the bottom of the page
- [x] **UI/UX** - Redesign roast, bean, and profit pages to match landing/catalog aesthetic; reduce table formatting;
- [x] **UI/UX** - Clean up roast page UI to align with beans page UI
- [x] **Bug** - Bring forms to front, they are beneath the card layers on the beans page. Check each page -/profit and /roast. Have to click profile to get the cards out of the way.

## Suppliers:

https://www.home-barista.com/roasting/green-coffee-sources-list-2024-t91583.html

- [ ] Theta Ridge Coffee: Good beans with low prices but limited bean/farm information,Importers of Brazil Daterra
- [ ] Burman Coffee Traders: Good quality beans
- [x] Bodhi Leaf: Ongoing `SHIP59` coupon code for free shipping on orders $59+
- [ ] prime green coffee - https://primegreencoffee.org/shop/ have coferments
- [ ] onyx green coffee - Onyx Box (20 or 40lbs) of Guatemala - with $10 Fedex Shipping
- [ ] https://sleepymangocoffee.com/collections/frontpage
- [ ] Royal Coffee Crown Jewels - selling 22 and 1lb bags of their Royal Crown Jewels. My preferred source of decaf.
- [ ] Genuine Origin - 65lb in grain pro bags in boxes shipping included; 300 gram samples $7.50 each
- [ ] https://www.coffeebeancorral.com/categories/Green-Coffee-Beans/All-Coffees.aspx?q=&o=1&i=200&d=200
- [ ] Hacea Coffee Source - Excellent packaging and quality greens; great service. - https://haceacoffee.com/collections/green-coffee
- [x] Showroom Coffee - Solid selection of greens; sells Huky and ARC roasters.
- [ ] Prime Green Coffee - High end offerings; Jim is easy to work with
- [ ] Aida Batlle Direct
- [ ] Primos Nicaragua
- [ ] Cafe Juan Ana
- [ ] Coffee Bean Corral - Best matrix for filtering choices.
- [ ] Café Kreyol
- [ ] Green Coffee Buying Club
- [ ] Java Beans Plus
- [ ] Len's Coffee
- [ ] Leverhead Coffee
- [ ] Lost Dutchman
- [ ] The Coffee Project
- [ ] Roast Coffee Company
- [ ] Blazing Bean Roasters
- [ ] Smokin' Beans Coffee Co.
- [x] The Captain's Coffee
- [ ] Invalsa
- [ ] CopanTrade
- [ ] Rhodes Roast 5lbs bags; free shipping.
- [ ] Yellow Rooster
- [ ] Mill City Roasters
- [x] Sweet Maria's
- [ ] Roastmasters
- [ ] Burman Coffee Traders
- [ ] Royal New York 22lb boxes
- [ ] Coffee Shrub 50lb bags; shipping calculated (example to CO was $25 or 50 cents a pound NY was $35); 200 gram samples (up to 10 for $7.55) for wholesale customers only. Wholesale side of Sweet Marias.
- [ ] Roastmasters 50lb gain pro bags; $22 flat rate shipping
- [ ] Ally Open Core Coffees (50lb boxes) are consistently available regional community lots. Microlots (50lb boxes) are limited edition coffees from our partner farms. Reserve Lots (25lb boxes) are super-special coffees ideal for competitions and showcase occasions.
- [ ] Coffee Crafters Green 10 and 20 pound bags plus see larger quantities too.
- [ ] Crop to Cup
- [ ] Covoya
- [ ] klatch https://www.klatchcoffee.com/collections/green-coffee
- [ ] Cofinet - 52.5 lb units - https://www.cofinet.com.au/store/
- [ ] Forest Coffee - https://coffeegreenbeans.com/collections/greencoffeestore

## Thoughts & references

- Allio bullet roasting software
- Openroast - https://github.com/Roastero/Openroast
- Artisan - https://github.com/artisan-roaster-scope/artisan
- Home-barista.com
- Cupofexcellence.org

## Stack

- Playwright to webcrawl data (used in a seperate script hosted on Oracle Cloud) - https://playwright.dev/docs/intro
- Sveltekit @sveltejs/kit@2.15.1 - https://svelte.dev/docs/kit/introduction
- Node
- TypeScript, JS
- TailwindCSS
- Vite
- D3.js for charts
