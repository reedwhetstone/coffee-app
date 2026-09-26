# Cherry compact UI browser fixture

This fixture imports the **actual root `+layout.svelte`, `/chat/+page.svelte`, desktop rail, mobile shell, chat workspace, composer, evidence, and drawer**. It does not copy their geometry or reconstruct their markup.

Authentication, SvelteKit client navigation/state, telemetry, Supabase client construction, and `/api/*` responses are synthetic/local. Other network origins are blocked by the runner. This is not SSR, production authentication, a backend-contract test, or a real iOS/Android keyboard test. The 683×384 case approximates a laptop's 200% CSS-pixel reflow area; it does not establish native browser-zoom or assistive-technology behavior.

## Reproduce

From the repository root, start the isolated fixture server:

```sh
pnpm exec vite --config tests/ui/cherry-compact/vite.config.mjs
```

In another terminal:

```sh
node tests/ui/cherry-compact/run.mjs
```

The runner launches a fresh headless Chrome with no shared profile. It defaults to `/usr/bin/google-chrome`; set `CHROME_PATH` to a supported local executable if necessary. `CHERRY_UI_BASE_URL` defaults to `http://127.0.0.1:5198`.

Artifacts are written to `notes/pr-audits/assets/cherry-compact/`: screenshots, geometry, and machine-readable results. A failed assertion exits nonzero and records a failure screenshot. Retained screenshots are synthetic coffee examples, not customer data.

## Coverage

- 1440×900, 1366×768, and 390×844: empty, settled, working, error, expanded context, evidence, and drawer.
- 320×640 and 683×384: settled, expanded context, and drawer.
- Actual root-shell dimensions, document overflow, input visibility, settled transcript budget, and disclosure viewport bounds.
- Context toggle state, menu Escape/focus return, memory open/close/focus return, suggestion selection/focus, and mobile menu access without the redundant chat launcher.
- Evidence source-message focus return; drawer initial focus, menu-only Escape, and draft retention across close/reopen.

Settled screenshots intentionally start at the question and first answer. Working/error screenshots retain the app's own scroll behavior. Composer geometry includes its one-line input, 44px touch controls, and padding; opening a bounded context panel overlays the transcript instead of changing its height.

## Reading and drafting journeys

With the same fixture server running, use `node tests/ui/cherry-compact/reading.mjs` for the 100-turn reading/drafting scenario. The fixture exposes a controllable synthetic stream only in `state=reading`; no production hooks or flags are added. It checks real wheel scrolling, new-output badges, stable reading position, explicit latest navigation, keyboard focus, source-message return, and no unintended draft submission through completion, Stop, failure, retry, or drawer reopen. Results/screenshots go to `notes/pr-audits/assets/cherry-reading/`.
