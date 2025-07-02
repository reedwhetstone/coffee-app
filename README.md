# Notes

"Democratizing coffee"

- coffee trends & green supply analysis
- micro-lots crowd funding
- green coffee marketplace
- Manage coffee inventory
- Track coffee roasting
- Track coffee sales
- Track coffee consumption

# Todo List

- [ ] BUG: cannot delete a bean from green coffee inventory if it is referencing a row from sales. May also be an issue from roast as well. Need a cascade function.
- [ ] Clean up roast page UI to align with beans page UI
- [ ] Clean up beans catalog profiles and remove user
- [ ] Summarize/rewrite front-end descriptions for fair use
- [ ] Form bean selection should be limited to stocked items - beans, roast, sales forms should all cater to active items.
- [ ] Add stocked column to green_coffee_inv and manage it in profiles
- [ ] Optimize duplication of data between green_coffee_inv and coffee_catalog - only need diplication on original, unreferenced coffees (not in catalog)
- [ ] Correct rank formatting to be two decimal places. Restructure UI to look better
- [ ] Fix database structure or front-end interpretation of text to retain paragraph formatting
- [ ] Analysis & Reporting - Create trends and analysis charting page. analysis first - priority is to make roasting fun and informational - not to run a business.
- [ ] remove fan and heat Y axis labels - leave the outside to temp labels
- [ ] get import data on fan and heat settings from artisan import file
- [ ] clean up temp curve so it doesn't look jagged
- [ ] clean up roast, bean, and profit UI to be more aligned with landing page and catalog page. Make it more interactive and less table format - profile & analytics first. 
- [ ] **TP, FC, dev % data calculations & population in roast chart interface!!**

## Web Scraping & Data Import


- **Bean Import Feature**
  - Add option to add a bean based on a URL
  - Implement automatic scraping for supported URLs

## UI/UX Improvements

### General

Modified RAG -
Instead of straight vector searching, use the filter tool in a more prominent way on the main search platform, then dial in the reccomendation based on the filtered results. Pass through the result the user filters into the seach LLM bot.

'Supplier & Origin Comparison Tools',
'Real-time Coffee Market Pricing Analysis',
'Price Trend Monitoring for Green Coffee',

- roast insights view that shows the roasts organized by bean so you can compare how each actual roast went with the beans instead of by batch.
- need a purchased qty remaining data set in beans category to add to the stocked functionality
- add % loss to the roast area displayed per roast.
- comprehensive ratings form - roast batch, brew method, nose, flavor, etc - will need a new table to manage this data.
- add lot buys for large orders like 22lb crown jewels
- Add loading states
- Fix real experience score and content paint
- Set up no-cookies banner at the bottom of the page
- Fix scroll issues (not rendering complete list of products)

### Mobile Optimization

- Improve roast profile/bean profile appearance on mobile
- Work with roast chart buttons on mobile to improve usability
- Move fan settings below the chart on mobile

### Filtering & Navigation

- Move user login/logout & user settings management to its own leftbar & menu & set up nav as its own menu with the purveyors icon
- Fix auto filter on home page (suppliers selection issue)
- Fix all filter functions to work correctly
- Fix profile page not refreshing on save (beans page)

## Roasting Features

### Roast Chart Improvements

- Remove roast chart y-axis lines
- Add average curve (average of heat and fan settings)
- Color shading for roast phases
- Add roast ID on the roast profile page
- Make arrows up/down work consistently with temp and fan

### Roast Data Collection

- Add ambient temperature setting in profiler
- Add charge setting (machine hot or not)
- Add TP, FC, DROP times in roast profile
- Fix roast charting timer turning off when phone closes

### Advanced Roasting Features

- Implement "ghost roast" to follow a template roast profile

## Coffee Evaluation & Analysis

- **Tasting Notes System**
  - Improve rating/notes function by bean
  - Select roast specific to the bean
  - Populate date automatically
  - Create more comprehensive rating scale
  - Collect tasting notes and convert them into a cupping score chart
  - Add cupping/tasting notes per profile for display on main profile page

- **Analytics & Reporting**
  
  - Track all sources price, stock, distribution of locations, process, etc. over time

## Suppliers:
https://www.home-barista.com/roasting/green-coffee-sources-list-2024-t91583.html
-   [ ] Theta Ridge Coffee: Good beans with low prices but limited bean/farm information,Importers of Brazil Daterra
-   [ ] Burman Coffee Traders: Good quality beans
-   [x] Bodhi Leaf: Ongoing `SHIP59` coupon code for free shipping on orders $59+
-   [ ] prime green coffee
-   [ ] hacea
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

## Future Features

- Lot share platform to divide up lots (like Kickstarter for high-quality coffee lots)

## Thoughts & references

  - Allio bullet roasting software
  - Openroast - https://github.com/Roastero/Openroast
  - Artisan - https://github.com/artisan-roaster-scope/artisan

## Stack

- Playwright to webcrawl data (used in a seperate script hosted on Oracle Cloud) - https://playwright.dev/docs/intro
- Sveltekit @sveltejs/kit@2.15.1 - https://svelte.dev/docs/kit/introduction
- Node
- TypeScript, JS
- TailwindCSS
- Vite
- D3.js for charts
