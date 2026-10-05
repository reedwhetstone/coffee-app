# PR 1: roast first on `/roast`

Before-and-after evidence for PR 1 of [Roast and portfolio workflows](../../2026-10-04-roast-and-portfolio-workflows.md).

Rendered locally at 1440×900 and 390×844 with the plan's seeded data (14 roasts in 10 batches) behind a stand-in backend. Positions were read from the rendered page with the browser. "Before" is `main` at `be0d5203`.

## Where the content starts

| Measure                                    | Desktop before                                                           | Desktop after                 | Phone before                                                          | Phone after                   |
| ------------------------------------------ | ------------------------------------------------------------------------ | ----------------------------- | --------------------------------------------------------------------- | ----------------------------- |
| Roast list: first batch                    | 1,731 px, 1.9 screens                                                    | 140 px, 0.16 screens          | 3,527 px, 4.2 screens                                                 | 254 px, 0.30 screens          |
| Roast list: first roast row                | None shown until a batch is opened                                       | 237 px, 0.26 screens          | None shown until a batch is opened                                    | 351 px, 0.42 screens          |
| Roast opened by link: where the page lands | Scrolled to 1,660 px                                                     | Top of the page, 0 px         | Scrolled to 3,488 px                                                  | Top of the page, 0 px         |
| Roast opened by link: top of the chart     | 890 px below the landing, 1.0 screens                                    | 220 px, 0.24 screens          | 1,236 px below the landing, 1.5 screens                               | 426 px, 0.50 screens          |
| Roast opened by link: first crack and drop | "FC" and "Drop" tiles in the detail panel, about 630 px down the landing | 116 px, in the milestone line | "FC" at the bottom edge behind the chat button, "Drop" below the fold | 268 px, in the milestone line |
| Studio section: where it starts            | 356 px                                                                   | 3,318 px                      | 1,016 px                                                              | 4,528 px                      |

On a phone the whole chart (426 px to 748 px) fits on the first screen of an opened roast.

## Task check (ADR-009)

Open a roast by link and read first crack and drop without scrolling:

- **Desktop:** `/roast?profileId=4531` lands at the top. "First crack 8:18" and "Drop 10:18 at 402°F" sit at 116 px. Pass.
- **Phone:** the same link lands at the top. Both sit at 268 px in a two-row grid. Pass.
- **Not marked:** a roast with no first crack reads "First crack not marked" in the same place.
- **Nothing recorded:** a roast that was set up and never logged says so in place of the milestone line, with the timer and Start on the first screen at desktop size.

## Screenshots

| View                          | Before                                             | After                                                                                                                          |
| ----------------------------- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Roast list, desktop           | [first screen](before-roast-list-desktop-fold.png) | [first screen](after-roast-list-desktop-fold.png), [full page](after-roast-list-desktop-full.png)                              |
| Roast list, phone             | [first screen](before-roast-list-phone-fold.png)   | [first screen](after-roast-list-phone-fold.png)                                                                                |
| Roast opened by link, desktop | [landing](before-roast-open-desktop-landing.png)   | [landing](after-roast-open-desktop-landing.png), [full page](after-roast-open-desktop-full.png)                                |
| Roast opened by link, phone   | [landing](before-roast-open-phone-landing.png)     | [landing](after-roast-open-phone-landing.png)                                                                                  |
| First crack not marked        |                                                    | [desktop](after-roast-open-no-first-crack-desktop-landing.png), [phone](after-roast-open-no-first-crack-phone-landing.png)     |
| Nothing recorded              |                                                    | [desktop](after-roast-open-nothing-recorded-desktop-landing.png), [phone](after-roast-open-nothing-recorded-phone-landing.png) |
