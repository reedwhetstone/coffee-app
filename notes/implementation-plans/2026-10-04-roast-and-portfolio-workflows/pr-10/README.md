# PR 10: locked roast page

Evidence for PR 10 of [Roast and portfolio workflows](../../2026-10-04-roast-and-portfolio-workflows.md), decision 4.

Rendered locally at 1440×900 and 390×844 behind a stand-in backend seeded with 15 roasts, signed in as three accounts: a viewer, an account with Parchment Intelligence and no Mallard Studio, and a member. Requests were read from the browser and from the stand-in backend's own log.

## What each account gets

| Request                                                    | Viewer                         | Parchment Intelligence only    | Member           | Signed out         |
| ---------------------------------------------------------- | ------------------------------ | ------------------------------ | ---------------- | ------------------ |
| `/roast`                                                   | Locked page                    | Locked page                    | Roast list       | Sent to `/catalog` |
| `/roast?roast=4531`, `/roast?profileId=4531`               | Locked page, no roast loaded   | Locked page, no roast loaded   | That roast       | Sent to `/catalog` |
| `/roast/__data.json`, with or without a roast in the query | The lock flag and nothing else | The lock flag and nothing else | Roast list       | Sent to `/catalog` |
| `/roast/` (trailing slash)                                 | Sent to `/roast` by SvelteKit  | Sent to `/roast` by SvelteKit  | Same             | Same               |
| `/roast/` followed from a link inside the app              | Locked page                    | Locked page                    | Roast list       | Sent to `/catalog` |
| `/roast/compare`, `/roast/plan`, `/roast/saved`            | Sent to `/dashboard`           | Sent to `/dashboard`           | Passes the guard | Sent to `/catalog` |
| `/roast/compare/__data.json`                               | Sent to `/dashboard`           | Sent to `/dashboard`           | Passes the guard | Sent to `/catalog` |
| `POST /roast`                                              | Sent to `/dashboard`           | Sent to `/dashboard`           | Passes the guard | Sent to `/catalog` |
| `/profit`                                                  | Sent to `/dashboard`           | Sent to `/dashboard`           | Opens            | Sent to `/catalog` |

The child pages are built in their own PRs. For a member this change leaves the guard as it was.

A page request for `/roast/` never reaches the guard, because SvelteKit redirects it to `/roast` first. A link to `/roast/` followed inside the app is different: its data request reaches the guard with the slash kept. The guard reads `/roast/` as the same page, so a locked account gets the locked page there too, and the address bar ends on `/roast`. The app has no such link today. This was checked in a browser for all three signed-in accounts: before the correction the viewer and the Parchment Intelligence-only account landed on the dashboard, and after it they land on the locked page with no roast request received by the stand-in backend.

## No roast data for a locked account

For the viewer and the Parchment Intelligence-only account, at both widths, on `/roast`, `/roast?roast=4531`, and `/roast?profileId=4531`:

- The browser made no request to a roast, coffee, reference, sale, or profit route of the app.
- The stand-in backend received no request for roasts, references, comparisons, inventory, sales, or profit.
- None of the 12 seeded coffee and batch names appears in the page.
- The data response for the route is 285 bytes: the account and `roastsLocked: true`. The same response for a member is 13,522 bytes and carries the roast list.

Opening the locked page from the navigation behaves the same way: hovering and clicking the Roast item made no roast request.

The member run is the control. It showed the roast list, and the backend log recorded its roast request, so the checks above can see one when it happens.

## The page

- One heading, one paragraph, one button, and nothing else from the page.
- The button opens `/subscription?plan=studio-monthly`.
- The app's roast filter control is not shown beside the locked page, because there is nothing to filter.
- No sideways scroll and no page errors at either width.

## Screenshots

| View                                             | Screenshot                               |
| ------------------------------------------------ | ---------------------------------------- |
| Locked page, desktop                             | [1440×900](locked-roast-desktop.png)     |
| Locked page, phone                               | [390×844](locked-roast-phone.png)        |
| Navigation for a viewer, Roast leads to the page | [1440×900](nav-locked-roast-desktop.png) |

## Not changed

The roast and reference API routes are untouched. Roast reads through `/api/roast-profiles` and `/api/roast-chart-data` are owner-scoped for any signed-in account, as they were before this change, and the reference routes require Mallard Studio.
