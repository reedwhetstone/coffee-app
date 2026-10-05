# PR 3: portfolio as the launch point

Before-and-after evidence for PR 3 of [Roast and portfolio workflows](../../2026-10-04-roast-and-portfolio-workflows.md).

Rendered locally at 1440×900 and 390×844 with the plan's seeded data (5 coffees, 15 roasts in 10 batches, plus one finished coffee that is no longer stocked) behind a stand-in backend. Positions and click counts were read from the rendered page with the browser. "Before" is `main` at `f3bae563`, which already has PRs 1, 2, 4, and 10. "After" is this branch on `main` at `d46d9998`; the one merge between the two changed the catalog and left portfolio and roast as they were.

## Click counts

A click is one click, tap, or option chosen. Back counts as one.

| Job                                                                                    | Before                             | After    |
| -------------------------------------------------------------------------------------- | ---------------------------------- | -------- |
| 1. Review how a coffee has been roasting: time, drop, and development for five roasts  | 19 clicks, on desktop and on phone | 2 clicks |
| 1. The same, from a link (`/beans?coffee=101&tab=roasting`)                            | No such link                       | 0 clicks |
| 7. Check stock and start the next roast: from the portfolio to the form, coffee filled | 3 clicks                           | 1 click  |
| Compare the two newest roasts of a coffee, from the open Roasting tab                  | Not possible from portfolio        | 3 clicks |

The 19 clicks on `main`: the coffee card, the Roasting tab, then each of five roasts opened to read its values (5), Back after each of the first four (4), and the card and tab again each time (8), because the panel does not reopen. Nothing reloads on `main`; PR 1 already made that navigation in-app. The plan's "about 17 clicks and 5 reloads" was counted before PR 1.

The 2 clicks after: the coffee card and the Roasting tab. The table carries time, drop, and development for every roast.

## Where things sit

| Measure                                    | Desktop before          | Desktop after         | Phone before          | Phone after           |
| ------------------------------------------ | ----------------------- | --------------------- | --------------------- | --------------------- |
| Portfolio: first coffee card               | 754 px, 0.84 screens    | 522 px, 0.58 screens  | 1,552 px, 1.84        | 1,320 px, 1.56        |
| Portfolio: "Portfolio by source"           | 451 px, above cards     | 1,562 px, below cards | 1,249 px, above cards | 3,554 px, below cards |
| Roasting tab: the summary line             | None                    | 379 px                | None                  | 478 px                |
| Roasting tab: how the newest roast differs | Not stated              | 482 px                | Not stated            | 673 px of 844         |
| `/roast?coffee=101`: roasts shown          | 15, the link is ignored | 5, under a chip       | 15                    | 5, under a chip       |

On a phone the first card is still more than a screen down. Moving "Portfolio by source" saved 232 px; the hero and five stacked tiles above the cards are unchanged in this PR.

## Task check (ADR-009)

Read how the newest roast differs from the one before, then open the comparison of those two from the tab. The link is `/beans?coffee=101&tab=roasting`.

- **Desktop:** the panel opens on the Roasting tab with no click. "22 sec longer · 4°F hotter drop than Sep 27" sits under the newest row at 482 px. Tick Oct 1 and Sep 27, then Compare: 3 clicks open `/roast/compare?a=roast:4531&b=roast:4529` in the app, with "Drop: B was 22 sec earlier" drawn. Pass.
- **Phone:** the same link opens the same tab. The line sits at 673 px of an 844 px screen, under a two-line row. The same 3 taps open the same comparison. Pass.
- **Back** from the comparison, and from a roast opened by its row, returns to `/beans?coffee=101&tab=roasting` with the panel open on the Roasting tab.
- **Not recorded:** the Sep 27 roast with no weight out shows "12 oz" and "—" for loss.

## Other checks in the browser

- **Row link:** a row opens `/roast?roast=4531` without a page load.
- **See all in Roasts:** opens `/roast?coffee=101` without a page load: 5 roasts in 4 batches, the count line for those 5, and the coffee named in a chip. A roast opened from that list keeps the coffee in the address (`/roast?coffee=101&roast=4529`), and "← Roasts" returns to the narrowed list. Removing the chip shows all 15.
- **History:** opening a card writes `/beans?coffee=101`; a tab writes `&tab=cupping`; Back closes the panel and returns to `/beans`. Purchased and Bookmarked write and remove `?tab=bookmarked`.
- **A coffee that is not on the page:** `/beans?coffee=106&tab=roasting` names a finished coffee the default view leaves out. Its panel opens on the Roasting tab, which says no roasts yet.
- **Remaining sort:** most first reads 8.5, 6.0, 5.5, 5.0, 4.5 lb; least first reverses it.
- **Without Mallard Studio** (Parchment Intelligence only): the tab says roast history is part of Mallard Studio, with "See Mallard Studio". No table, no "Roast" on the cards, and no roast request reaches the backend.
- **Live roast guard:** a roast with nothing recorded, opened from the Roasting tab, was started and then "← Roasts" was chosen. The page asked "A roast is still recording." and "Keep roasting" kept it open.

## Screenshots

| View                                     | Before                                                                                   | After                                                                                                  |
| ---------------------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Portfolio cards                          | [desktop](before-portfolio-cards-desktop.png), [phone](before-portfolio-cards-phone.png) | [desktop](after-portfolio-cards-desktop.png), [phone](after-portfolio-cards-phone.png)                 |
| Roasting tab                             | [desktop](before-roasting-tab-desktop.png), [phone](before-roasting-tab-phone.png)       | [desktop](after-roasting-tab-desktop.png), [phone](after-roasting-tab-phone.png)                       |
| `/roast?coffee=101`                      | [desktop](before-roast-coffee-desktop.png), [phone](before-roast-coffee-phone.png)       | [desktop](after-roast-coffee-desktop.png), [phone](after-roast-coffee-phone.png)                       |
| Roasting tab, two rows ticked            |                                                                                          | [desktop](after-roasting-tab-two-ticked-desktop.png), [phone](after-roasting-tab-two-ticked-phone.png) |
| The comparison opened from the tab       |                                                                                          | [desktop](after-compare-from-portfolio-desktop.png), [phone](after-compare-from-portfolio-phone.png)   |
| Roasting tab without Mallard Studio      |                                                                                          | [desktop](after-roasting-tab-no-studio-desktop.png), [phone](after-roasting-tab-no-studio-phone.png)   |
| Roasting tab, a coffee with no roasts    |                                                                                          | [desktop](after-roasting-tab-empty-desktop.png), [phone](after-roasting-tab-empty-phone.png)           |
| Portfolio sorted by least remaining      |                                                                                          | [desktop](after-portfolio-remaining-sort-desktop.png)                                                  |
| Leaving a recording roast from portfolio |                                                                                          | [desktop](after-guard-from-portfolio-desktop.png)                                                      |

## Limits of this render

- The stand-in backend returns roasted weight to every account. Parchment withholds it from an account without Mallard Studio, so the "remaining" figure in the no-Studio screenshot is not what production shows.
- The stand-in has no bookmarked lots, so the Bookmarked section was checked for its address only.
- Seeded data is small. The "Remaining" sort and the last-roast line read every roast and, for that sort, every coffee in the filtered selection; neither was timed against production volumes.
