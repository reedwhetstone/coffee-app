# Notes

CoffeeApp is an all in one coffee management system.

- Manage coffee inventory
- Track coffee roasting
- Track coffee sales
- Track coffee consumption

# Todo:

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

- Playwright to webcrawl data - https://playwright.dev/docs/intro
- Sveltekit @sveltejs/kit@2.15.1 - https://svelte.dev/docs/kit/introduction
- MySQL - https://dev.mysql.com/doc/
- Node
- Express
- TypeScript, JS
- TailwindCSS
- Vite
- D3.js for charts

# sv

Everything you need to build a Svelte project, powered by [`sv`](https://github.com/sveltejs/cli).

## Creating a project

If you're seeing this, you've probably already done this step. Congrats!

```bash
# create a new project in the current directory
npx sv create

# create a new project in my-app
npx sv create my-app
```

## Developing

Once you've created a project and installed dependencies with `npm install` (or `pnpm install` or `yarn`), start a development server:

```bash
npm run dev

# or start the server and open the app in a new browser tab
npm run dev -- --open
```

## Building

To create a production version of your app:

```bash
npm run build
```

You can preview the production build with `npm run preview`.

> To deploy your app, you may need to install an [adapter](https://svelte.dev/docs/kit/adapters) for your target environment.
