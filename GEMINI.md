# GEMINI.md

## Project Overview

This is a SvelteKit web application for coffee purveyors. It allows users to track coffee trends, manage their green coffee inventory, and analyze their roasts. The application uses Supabase for its backend, including authentication and database storage. Stripe is integrated for handling subscriptions and payments. The frontend is built with Svelte and styled with TailwindCSS. The application is deployed on Vercel.

## Building and Running

### Prerequisites

- Node.js (version 22.x)
- pnpm

### Installation

```bash
pnpm install
```

### Running in Development

```bash
pnpm run dev
```

This will start the development server on `http://localhost:5173`.

### Building for Production

```bash
pnpm run build
```

This will create a production-ready build in the `.svelte-kit` directory.

### Testing

```bash
pnpm run test
```

This will run the unit tests using vitest.

## Development Conventions

### Code Style

The project uses Prettier for code formatting and ESLint for linting. You can format the code and check for linting errors with the following commands:

```bash
pnpm run format
pnpm run lint
```

### Testing

Unit tests are located in the `src` directory alongside the files they test, with a `.test.ts` or `.spec.ts` extension. The project uses `vitest` for testing.

### Authentication and Authorization

Authentication is handled by Supabase. The `hooks.server.ts` file contains the server-side hooks for managing sessions and protecting routes. User roles (`viewer`, `member`, `api-member`, `api-enterprise`, `admin`) are used to control access to different parts of the application.

### Environment Variables

The application uses environment variables for configuration. These are loaded from a `.env` file in the root of the project. See the `.env.example` file for a list of required variables.
