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

BUG: when a new user with no green coffees in their beans page accesses their bean page from the catalog page it retains all catalog data on the page and makes it look like you can edit the profiles for random coffees

BUG: cannot delete a bean from green coffee inventory if it is referencing a row from sales. May also be an issue from roast as well. Need a cascade function.

## Database & Data Structure

Create a stocked coffees col in green coffee inv- create stocked coffees management functionality

- **Green Coffee Inventory Structure Overhaul**
  - Create a foreign key on green_coffee_inv.coffee_catalog_id that references coffee_catalog.id
  - Remove duplication of data between green_coffee_inv and coffee_catalog
- **Bean Selection Improvements**
  - Make new roast form bean selection based on stocked beans
  - Add stocked column to green_coffee_inv and manage it in profiles
- **Data Formatting**
  - Correct rank formatting to allow two decimal places
  - Fix database structure or front-end interpretation of text to retain paragraph formatting

## Web Scraping & Data Import

-fix the stocked coffees procedure so that it only adds and removes the new changes- will allow you to track trends in stockings.

- add a stocked calculation that marks a coffee's total time in stock when it gets marked to false.
- add Showroom Coffee, Royal Coffee, Genuine Origin
- https://www.coffeebeancorral.com/categories/Green-Coffee-Beans/All-Coffees.aspx?q=&o=1&i=200&d=200
- https://haceacoffee.com/collections/green-coffee
- **Sweet Marias Scraping Fix**
  - Correct scrape function to not wipe stocked beans if it finds 0 beans that day
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
- Reference professional roasting software:
  - Allio bullet roasting software
  - Openroast - https://github.com/Roastero/Openroast
  - Artisan - https://github.com/artisan-roaster-scope/artisan

## Coffee Evaluation & Analysis

- **Tasting Notes System**

  - Improve rating/notes function by bean
  - Select roast specific to the bean
  - Populate date automatically
  - Create more comprehensive rating scale
  - Collect tasting notes and convert them into a cupping score chart
  - Add cupping/tasting notes per profile for display on main profile page

- **Analytics & Reporting**
  - Create trends and analysis charting page
  - Track all sources price, stock, distribution of locations, process, etc. over time

## Content & Catalog Management

https://www.home-barista.com/roasting/green-coffee-sources-list-2024-t91583.html

- Clean up roast page UI to align with beans page UI
- Clean up beans catalog profiles and remove user
- Summarize/rewrite front-end descriptions for fair use
- Add supplier information:
  - Theta Ridge Coffee: Good beans with low prices but limited bean/farm information
  - Burman Coffee Traders: Good quality beans
  - Bodhi Leaf: Ongoing `SHIP59` coupon code for free shipping on orders $59+
  - prime green coffee
  - hacea
  - onyx green coffee
  - https://sleepymangocoffee.com/collections/frontpage

Hacea Coffee Source - Excellent packaging and quality greens; great service.
Royal Coffee Crown Jewels - selling 22 and 1lb bags of their Royal Crown Jewels. My preferred source of decaf.
Genuine Origin - 65lb in grain pro bags in boxes shipping included; 300 gram samples $7.50 each
Showroom Coffee - Solid selection of greens; sells Huky and ARC roasters.
Prime Green Coffee - High end offerings; Jim is easy to work with

Direct from Farm - Limited Varieties
These providers usually have both green and roasted in limited varieties and quantities.
Aida Batlle Direct
Primos Nicaragua
Cafe Juan Ana

Other US Choices
WHEN YOU ORDER FROM THESE PLEASE ASK THEM TO JOIN THE ARTISAN COLLABORATION

In no particular order:

Theta Ridge Importers of Brazil Daterra
Coffee Bean Corral - Best matrix for filtering choices.
Café Kreyol
Green Coffee Buying Club
Java Beans Plus
Len's Coffee
Leverhead Coffee
Lost Dutchman
The Coffee Project
Roast Coffee Company
Blazing Bean Roasters
Smokin' Beans Coffee Co.
The Captain's Coffee
Invalsa
CopanTrade
Rhodes Roast 5lbs bags; free shipping.
Yellow Rooster
Mill City Roasters
Sweet Maria's
Roastmasters
Burman Coffee Traders

Larger Quantities-

Onyx Box (20 or 40lbs) of Guatemala - with $10 Fedex Shipping
Genuine Origin 65lb in grain pro bags in boxes shipping included; 300 gram samples $7.50 each
Royal Coffee Crown Jewels 22lb Crown Royal boxes (free shipping) or 100lb bags shipped freight. Occasional 50lb Crown Jewels as well.
Royal New York 22lb boxes
Showroom Coffee offers 33 and 66lb choices. Free shipping for orders over 60lbs.
Coffee Shrub 50lb bags; shipping calculated (example to CO was $25 or 50 cents a pound NY was $35); 200
gram samples (up to 10 for $7.55) for wholesale customers only. Wholesale side of Sweet Marias.
Roastmasters 50lb gain pro bags; $22 flat rate shipping
Ally Open Core Coffees (50lb boxes) are consistently available regional community lots. Microlots (50lb boxes) are limited edition coffees from our partner farms. Reserve Lots (25lb boxes) are super-special coffees ideal for competitions and showcase occasions.
Coffee Crafters Green 10 and 20 pound bags plus see larger quantities too.
Crop to Cup

## Future Features

- Lot share platform to divide up lots (like Kickstarter for high-quality coffee lots)

## Thoughts & references

- allio bullet roasting software
- openroast - https://github.com/Roastero/Openroast
- artisan - https://github.com/artisan-roaster-scope/artisan

## Stack

- Playwright to webcrawl data (used in a seperate script hosted on Oracle Cloud) - https://playwright.dev/docs/intro
- Sveltekit @sveltejs/kit@2.15.1 - https://svelte.dev/docs/kit/introduction
- Node
- TypeScript, JS
- TailwindCSS
- Vite
- D3.js for charts
