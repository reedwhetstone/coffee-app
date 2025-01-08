# Notes

CoffeeApp is an all in one coffee management system.

- Manage coffee inventory
- Track coffee roasting
- Track coffee sales
- Track coffee consumption

# Todo:

- Add proper type definitions
- Implement proper error handling
- Add loading states
- Add form validation
- Style components to match your design system
- add a login system
- import more data for beans - long descriptions, farm details, tasting notes, images, etc.

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
