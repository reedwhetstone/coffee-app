# Notes

CoffeeApp is an all in one coffee management system.

- Manage coffee inventory
- Track coffee roasting
- Track coffee sales
- Track coffee consumption

# Todo:

- need to add user managment of tables - adding user_id when they make a submission and only showing their own data
- the roast chart interface is poorly scaling with page loads between charts in the different states. It is keeping the sizing of the prior chart, causing the controls and other aspecs to be misaligned.
- lot share platform to divvy up lots - like a kickstarter for high quality coffee lots
- overhaul green_coffee_inv structure:
  - green_coffe_inv should join / xref coffee_catalog.id and should no longer duplicate that data.
    - create a foreign key on green_coffee_inv.coffee_catalog_id that references coffee_catalog.id
  - coffee_catalog should have a column for source website - Sweet Marias, etc.
  - New coffee form should select the source website, coffee name -> should just xref the coffee_catalog.id
- the sweet scripts need to be fixed with the new db structure
- debug db issues with updating the db - green_coffee_inv, roast_profiles, roast_sessions etc
- fix the search with new db
- set up the entire app for mobile use
- fix the navbar to be mobile friendly
- correct rank formatting to allow two decimal places
- fix db structure to retain paragraph formatting
- add an average curve that takes the average of heat and fan settings and plots it on the chart
- add additional details to the new coffee script and create an algo to recommend purchases based on freshness, cost, and rating
- get #product-price-27637 > span "price per lb bean" into the coffee_catalog table
- restructure the green_coffee_inv table to pull coffee data from the coffee_catalog table
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
