# Notes

CoffeeApp is an all in one coffee management system.

- Manage coffee inventory
- Track coffee roasting
- Track coffee sales
- Track coffee consumption

# Todo:

- add additional details to the new coffee script and create an algo to reccomend purchases based on freshness, cost, and rating
- sales page
- get #product-price-27637 > span "price per lb bean" into the coffee_catalog table
- get all coffee data for coffee_catalog table - farm notes, tasting notes, etc.
- restructure the green_coffee_inv table to pull coffee data from the coffee_catalog table
- heat setting should end at drop - setting 0
  take rounding out of the oz in oz out display on the roast profile - 8.50 & 8.59. Currently is rounding into the table!!!!
- need roast id on the roast profile page
- ghost roast - follow a template roast profile
- search tool
- PURCHASED in navbar in blue when selected is broken - probably due to changing the folder structure of the (home) page
- TP, FC, DROP times in roast profile
- color shading phases on the chart
- add the profile_log.drop column to the roast input data
- adjust the save functionality so that it looks for the time @ Stop and logs the data at that time into the profile_log.end column.
- move the green coffee inv table to a separate component.
- import more data for beans - long descriptions, farm details, tasting notes, images, etc.

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
