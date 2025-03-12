# Notes

CoffeeApp is an all in one coffee management system.

- Manage coffee inventory
- Track coffee roasting
- Track coffee sales
- Track coffee consumption

# Todo:

- Scroll isn't working correctly. Not rendering complete list of products.
- Auto filter isn't working right on the home page. No suppliers are selected & it does not show all suppliers until you select them all.
- Improve the rating/notes function by bean. Select the roast specific to the bean, populate a date, make a rating scale that is more comprehensive
- Trends and analysis charting page- all sources price, stock, distribution of locations, process, etc over time.
- Roast charting timer turns off if phone closes
- Roast profile/ bean profile looks like shit on mobile. Hard to edit, etc
- Fix real experience score, content paint, etc
- Summary/rewrite of the front end descriptions.
- Collect tasting notes and convert them into a cupping score chart.
- H and f buttons disappear when start
- Check /no-cookies.. maybe remove
- Remove roast chart y axis lines
- Add y axis shade lines
- Make arrows up down just work with the temp and fan the same.
- Move the fan settings to below the chart on mobile
- Search takes you to new page on home but doesn't open the bean unless already on the home page
- Dig deep into the web scraping idea. Create website functionality that compares all online dealers of green coffee and ranks their coffee by the best deal you can get. Almost like a stock picking app or something like that like OverWatch or Yahoo finance
- Need an ambient temps setting in the profiler so I know how hot it was outside
- Need a charge setting- like was the machine hot or not
- Cupping/ tasting notes per profile that will be pulled when I click on the roast profiles on the main profile page.
- profile page is not refreshing on save on the beans page. You have to manual refresh in order to see changes.
- Theta Ridge Coffee Good beans, but they don’t provide lots of bean/farm information. Theta Ridge has some of the lowest prices you’ll find on beans.
- Burman Coffee Traders Good quality beans.
- Bodhi Leaf ongoing `SHIP59` coupon code which gets you free shipping if you buy $59 or more beans.
- work with the roast chart buttons on mobile to improve usability. 
- lot share platform to divvy up lots - like a kickstarter for high quality coffee lots
- overhaul green_coffee_inv structure:
  - green_coffe_inv should join / xref coffee_catalog.id and should no longer duplicate that data.
    - create a foreign key on green_coffee_inv.coffee_catalog_id that references coffee_catalog.id
- correct rank formatting to allow two decimal places
- fix db structure or front end interpretation of text to retain paragraph formatting
- add an average curve that takes the average of heat and fan settings and plots it on the chart
- desperately need to fix the filter functions so that they all work correctly. 
- add an option to add a bean based on a url - if the url is a supported url, it will trigger a scrape function that can add the new bean on command. 
- need roast id on the roast profile page
- ghost roast - follow a template roast profile
- TP, FC, DROP times in roast profile
- color shading phases on the chart
- Add loading states
- Add form validation
- Style components to match your design system
- add a login system

# Consider:

- Coffee app could be a vivino-like app where you rate and review coffee. Would need to import and aggregate data from global green coffee sellers. Is there a roasted coffee app that does this already fo roasted coffee?

## Roast Session Page:

- batch_name selection - new batch or a dropdown selection of existing batches
- roast_profiles.coffee_name = green_coffee_inv.name
- save roast session

- reference openroast - https://github.com/Roastero/Openroast
- reference artisan - https://github.com/artisan-roaster-scope/artisan

## Stack

- Playwright to webcrawl data (used in a seperate script hosted on Oracle Cloud) - https://playwright.dev/docs/intro
- Sveltekit @sveltejs/kit@2.15.1 - https://svelte.dev/docs/kit/introduction
- Node
- TypeScript, JS
- TailwindCSS
- Vite
- D3.js for charts
