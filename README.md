# Notes

"Democratizing coffee"
"Make coffee roasting fun, accesable, and informational"

- coffee trends & green supply analysis
- micro-lots crowd funding
- green coffee marketplace
- Manage coffee inventory
- Track coffee roasting
- Track coffee sales
- Track coffee consumption

# Todo List
##
- [ ] **Bug** - Cannot delete a bean from green coffee inventory if it references a sales row; may also be linked to roast. Needs cascade delete function.
##
- [ ] **Form Validation** - Limit bean selection in forms to stocked items only (beans, roast, sales)
- [ ] 
- [ ] **UI/UX** - Correct rank formatting to two decimal places and improve visual layout
- [ ] **UI/UX** - Redesign roast, bean, and profit pages to match landing/catalog aesthetic; reduce table formatting; emphasize profile & analytics
- [ ] **UI/UX** - Clean up roast page UI to align with beans page UI
- [ ] **UI/UX** - Clean up beans catalog profiles and remove user reference
##
- [ ] **Web Scraping** - Add option to add a bean based on a URL
- [ ] **Web Scraping** - Implement automatic scraping for supported URLs
- [ ] **Web Scraping** - Summarize/rewrite front-end descriptions for fair use
- [ ] **Web Scraping** - Automate vector embeding in the scrape workflow
- [ ] **Web Scraping** - Automate data cleaning of columns with Gemini when we scrape
- [ ] **Web Scraping** - Automate llm interpretation of the text into an AI blurb column - claims extraction & cleaning of data columns during scrape
##
- [ ] **AI** - Hybrid RAG: Use tool calls for structured lookups: filters, search, pricing, transactions. Use RAG for unstructured knowledge: guides, tips, reviews, roast advice.  
      - “Find Ethiopian naturals under $10/lb rated 88+” 🔧 Tool Call Clear filters → use MySQL API  
      - “What’s a good coffee for a chocolatey espresso profile?” 📚 RAG Requires semantic matching and taste context  
      - “Compare these two coffees side by side” 🔧 Tool Call Deterministic, tabular output  
      - “How does fermentation impact acidity in natural processed beans?” 📚 RAG Explanatory, doc-based  

- [ ] **Performance** - Fix real experience score and content paint

- [ ] **General** - Set up no-cookies banner at the bottom of the page
- [ ] **General** - Remove some / all of the user reviews?
- [ ] **Forms** - date popilation is inconsistent and poor across form completions

- [ ] **Mobile** - Improve roast profile/bean profile appearance on mobile
- [ ] **Mobile** - Improve usability of roast chart buttons on mobile
- [ ] **Mobile** - Move fan settings below the chart on mobile

- [ ] **Navigation** - Improve manu UI - the icons are really hard to understand
- [ ] **Navigation** - move manu bar to bottom bar for mobile
- [ ] **Navigation** - only display relevant active menu options for each page. Currently showing all of them, indescriminantly
- [ ] *Navigation** - make it easier to navigate back to landing page fromt the pricing page
- [ ] **Navigation** - improve sales funnel & clickthrough to make it more seamless
- [ ] **Navigation** - simplify main page? Really long scrolling

- [ ] **Roast Insights** - Organize roasts by bean for roast comparison, instead of by batch
- [ ] **Roast Insights** - Add % weight loss display per roast
- [ ] **Roast Insights** - Add remaining purchased quantity data to bean inventory

- [ ] **Roast Chart** - Remove y-axis lines
- [ ] **Roast Chart** - Add average curve for heat and fan settings
- [ ] **Roast Chart** - Add color shading for roast phases
- [ ] **Roast Chart** - Add roast ID to roast profile page
- [ ] **Roast Chart** - Make up/down arrows work consistently for temp and fan
- [ ] **Roast Chart** - Smooth out temp curve for cleaner display
- [ ] **Roast Chart** - Remove fan and heat Y-axis labels; keep only external temp labels

- [ ] **Roast Data** - Add ambient temperature setting
- [ ] **Roast Data** - Add charge setting (machine hot or not)
- [ ] **Roast Data** - Add TP, FC, DROP times in roast profile
- [ ] **Roast Data** - Fix roast charting timer turning off when phone closes
- [ ] **Roast Data** - Implement TP, FC, and development % calculations and display them in the roast chart interface
- [ ] **Roast Data Import** - Parse fan and heat settings from Artisan import file

- [ ] **Text Handling** - Fix DB structure or front-end interpretation to preserve paragraph formatting in text fields
 
- [ ] **Database** - Add `stocked` column to `green_coffee_inv` and manage it through profiles
- [ ] **Database** - Need a purchased qty remaining data set in beans category to add to the stocked functionality
- [ ] **Database Optimization** - Reduce duplication between `green_coffee_inv` and `coffee_catalog` — only duplicate for original, unreferenced coffees

- [ ] **Tasting Notes** - Improve rating/notes function by bean
- [ ] **Tasting Notes** - Allow roast selection specific to the bean
- [ ] **Tasting Notes** - Create more comprehensive rating scale (brew method, nose, flavor, etc.)
- [ ] **Tasting Notes** - Collect tasting notes and convert to cupping score chart
- [ ] **Tasting Notes** - Display cupping/tasting notes per profile on main profile page
- [ ] **Tasting Notes** - Create new table to manage comprehensive rating form data
- [ ] **Tasting Notes** - comprehensive ratings form - roast batch, brew method, nose, flavor, etc - will need a new table to manage this data.

- [ ] **Analytics** - Track all source pricing, stock, location distribution, and processing methods over time
- [ ] **Analytics** - Create trends and analysis charting page; prioritize fun and informational roasting insights

- [ ] **Feature Ideation** - Explore tools for Supplier & Origin Comparison
- [ ] **Feature Ideation** - Develop Real-time Coffee Market Pricing Analysis
- [ ] **Feature Ideation** - Implement Price Trend Monitoring for Green Coffee
- [ ] **Feature Ideation** - Add option to add a bean based on a URL - Implement automatic scraping for supported URLs
- [ ] **Feature Ideation** - Lot share platform to divide up lots (like Kickstarter for high-quality coffee lots)
- [ ] **Feature Ideation** - Ghost Roast - Implement “ghost roast” to follow a template roast profile

  
## Suppliers:
https://www.home-barista.com/roasting/green-coffee-sources-list-2024-t91583.html
-   [ ] Theta Ridge Coffee: Good beans with low prices but limited bean/farm information,Importers of Brazil Daterra
-   [ ] Burman Coffee Traders: Good quality beans
-   [x] Bodhi Leaf: Ongoing `SHIP59` coupon code for free shipping on orders $59+
-   [ ] prime green coffee
-   [ ] onyx green coffee - Onyx Box (20 or 40lbs) of Guatemala - with $10 Fedex Shipping
-   [ ] https://sleepymangocoffee.com/collections/frontpage
-   [ ] Royal Coffee Crown Jewels - selling 22 and 1lb bags of their Royal Crown Jewels. My preferred source of decaf.
-   [ ] Genuine Origin - 65lb in grain pro bags in boxes shipping included; 300 gram samples $7.50 each
-   [ ] https://www.coffeebeancorral.com/categories/Green-Coffee-Beans/All-Coffees.aspx?q=&o=1&i=200&d=200
-   [ ] Hacea Coffee Source - Excellent packaging and quality greens; great service. - https://haceacoffee.com/collections/green-coffee
-   [x] Showroom Coffee - Solid selection of greens; sells Huky and ARC roasters.
-   [ ] Prime Green Coffee - High end offerings; Jim is easy to work with
-   [ ] Aida Batlle Direct
-   [ ] Primos Nicaragua
-   [ ] Cafe Juan Ana
-   [ ] Coffee Bean Corral - Best matrix for filtering choices.
-   [ ] Café Kreyol
-   [ ] Green Coffee Buying Club
-   [ ] Java Beans Plus
-   [ ] Len's Coffee
-   [ ] Leverhead Coffee
-   [ ] Lost Dutchman
-   [ ] The Coffee Project
-   [ ] Roast Coffee Company
-   [ ] Blazing Bean Roasters
-   [ ] Smokin' Beans Coffee Co.
-   [x] The Captain's Coffee
-   [ ] Invalsa
-   [ ] CopanTrade
-   [ ] Rhodes Roast 5lbs bags; free shipping.
-   [ ] Yellow Rooster
-   [ ] Mill City Roasters
-   [x] Sweet Maria's
-   [ ] Roastmasters
-   [ ] Burman Coffee Traders
-   [ ] Royal New York 22lb boxes
-   [ ] Coffee Shrub 50lb bags; shipping calculated (example to CO was $25 or 50 cents a pound NY was $35); 200 gram samples (up to 10 for $7.55) for wholesale customers only. Wholesale side of Sweet Marias.
-   [ ] Roastmasters 50lb gain pro bags; $22 flat rate shipping
-   [ ] Ally Open Core Coffees (50lb boxes) are consistently available regional community lots. Microlots (50lb boxes) are limited edition coffees from our partner farms. Reserve Lots (25lb boxes) are super-special coffees ideal for competitions and showcase occasions.
-   [ ] Coffee Crafters Green 10 and 20 pound bags plus see larger quantities too.
-   [ ] Crop to Cup
-   [ ] Covoya
-   [ ] https://coffeegreenbeans.com/collections/greencoffeestore

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
