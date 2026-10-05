# PR 6: `/roast/saved`, Artisan file downloads, and Studio removal

Evidence for PR 6 of [Roast and portfolio workflows](../../2026-10-04-roast-and-portfolio-workflows.md).

Rendered locally at 1440×900 and 390×844 with the plan's seeded data behind a stand-in backend. The stand-in serves the saved references and plans, rename, remove, the stored Artisan files, and "Record as a roast I ran". Three of the fifteen seeded roasts keep their Artisan file, which is the proportion production has today. Everything below was read from the rendered page with the browser unless it says "covered by tests".

## The saved library

`/roast/saved` is the second segment under the roast list's title.

- **Rows** are newest first, each with its source and date: "Plan · Saved Oct 2, 2026", "Artisan file · Saved Sep 28, 2026", "Saved from a roast · Saved Sep 25, 2026". A row is 68 px tall on desktop and two or three lines on a phone. No sideways scrolling at either size.
- **First action on the row:** "Download for Artisan" on a plan, whose name opens the plan; "View curve" on a reference.
- **Row menu, on an Artisan file:** View curve, Compare, Plan from this, Download for Artisan, Record as a roast I ran, Rename, Remove. A plan has the same without "Record as a roast I ran". A reference that holds a roast's curve without its file has neither that nor "Plan from this".
- **View curve** opens the curve under the row and puts the reference in the link (`/roast/saved?ref=<id>`). Back closes it.
- **Compare** opens `/roast/compare?a=ref:<id>` with that side chosen. Ticking two rows and choosing Compare opens `/roast/compare?a=ref:<id>&b=ref:<id>` with the comparison drawn, the newer of the two as side A.
- **Plan from this** opens `/roast/plan?from=ref:<id>` with the reference chosen.
- **Rename** edits the name in the row. Nothing is sent until "Save name"; Cancel and Escape leave the name alone. The new name is still there after a reload.
- **Remove** asks first: "Remove Kenya Nyeri 10-04?", "It will no longer be here to compare, plan from, or download. This cannot be undone. Your roasts are not changed." Focus opens on "Keep it", which removes nothing. "Remove" takes the row away and says "Kenya Nyeri 10-04 is removed. Your roasts are not changed."
- **Add an Artisan file** opens a form with the helper "Keeps the file as a reference to compare or plan from. To record it as a roast you ran, import it from Roasts." The file's own name fills the name ("Kenya_Nyeri 10-04.alog" becomes "Kenya Nyeri 10-04"), so two uploads are not both called "Artisan reference". Choosing another file in its place renames the reference to match, until a name is typed: "Kenya_Nyeri 10-04.alog" and then "Guji_natural 10-05.alog" leaves "Guji natural 10-05"; a typed "October keeper" stays through a further choice. After saving: "Kenya Nyeri 10-04 is saved as a reference. It is not counted as a roast."
- **Record as a roast I ran** asks which coffee in the portfolio was roasted, then says "Recorded as roast #4601 of Ethiopia Yirgacheffe Wush Wush 96 Hour Anaerobic Natural. This saved reference is kept." with a link to the roast.
- **Nothing saved yet:** "**Nothing saved yet.** Save a roast you want to repeat, add an Artisan file, or make a plan from a roast." with a link to Roasts, where two of those three start.
- **The last row's menu** opens upward when it would otherwise run under the bottom of the screen, so "Rename" and "Remove" never sit under the chat button fixed to the corner. Measured with a seven-item menu on the last row at both sizes.

## Download for Artisan

The stand-in's stored files are deliberately not valid UTF-8 (a Latin-1 "é", a NUL, and bytes that cannot appear in UTF-8), so a download that passed through text anywhere would not match.

| Download                                               | File saved                             | Same bytes as stored |
| ------------------------------------------------------ | -------------------------------------- | -------------------- |
| "Download Artisan file" in an open roast's More menu   | `Ethiopia Yirgacheffe Wush 10-01.alog` | Yes, by SHA-256      |
| "Download for Artisan" on an uploaded reference        | `Guji natural September keeper.alog`   | Yes, by SHA-256      |
| "Download for Artisan" on a plan (the existing export) | `Purveyors-reference.alog`             | Not compared         |

- The file keeps the name Parchment sent. The route tests also check that Parchment's `Repr-Digest` header reaches the browser and still describes the body.
- After a download the page says what the file is and what to do with it: "Downloading Guji natural September keeper.alog. It is the Artisan file stored with this reference when you added it. In Artisan, open Roast, then Background, and load this file. It appears behind your live curve as a guide. It does not control your roaster, unless Artisan is set to play back a background's events or to follow the background."
- The message names the stored file and does not say it matches the file that was chosen. A download is the stored file byte for byte, but an upload is read as text on its way in, so a file that is not UTF-8 is stored as its decoded text.
- **A download that stops part way** (the answer starts and the file then fails to arrive) says "This file could not be downloaded. Try again in a moment." on its row, and the other rows' downloads stay usable. Read from the rendered page with a body that fails after its headers.
- **"Download Artisan file" is in More only when the roast has a file on record.** A roast imported before files were kept shows the menu without it.
- **A reference with no file** (a roast's curve kept without its Artisan file) answers with Parchment's reason as the next step, not an error: "This reference holds a roast's curve without its Artisan file, so there is no file to download. If that roast was imported from Artisan, its file is under More on the roast." with "Open the roast". Nothing is saved in the file's place.
- A roast whose flag is out of date gets the same treatment from the roast's reason ("This roast was imported before Artisan files were kept, so there is no file to download. Import its .alog again to keep a copy with the roast."). Covered by tests.

## `/roast` without the Studio section

- The page ends with the roast list. There is no Studio section, no "Upload an Artisan reference" or "Save a historical roast" card, and no numbered steps.
- The header links are "New roast", "Compare roasts" (`/roast/compare`), and "Plan next roast" (`/roast/plan`). The segments under the title are "Roasts" and "Saved references and plans" (`/roast/saved`).
- "Profile Studio" and "Roast studio" appear nowhere on `/roast`, `/roast/saved`, `/roast/compare`, or `/roast/plan`. Covered by tests on each page, on the navigation labels, and on the docs pages written in this repo.

### Where each part of the Studio section went

Walked against the inventory in the [2026-10-03 plan](../../2026-10-03-profile-studio-restructure.md#what-the-page-offers-today).

| #   | Old section                                     | Where it is now                                                                                                                                                                    |
| --- | ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Page hero, "Roast studio", four tiles           | The "Roasts" title and its count line (PR 1). "New roast" is the first header button.                                                                                              |
| 2   | Profile Studio header and three numbered steps  | Removed. It was read-only. Its three steps are the three pages below.                                                                                                              |
| 3   | "Upload an Artisan reference"                   | "Add an Artisan file" on `/roast/saved`.                                                                                                                                           |
| 4   | "Save a historical roast"                       | "Save as reference" in an open roast's More menu (PR 2), which now links to the library. Planning from a roast also keeps its file as a reference (PR 5).                          |
| 5   | "Plan the next batch"                           | `/roast/plan` (PR 5), from "Plan next roast" in the list header, "Plan next roast from this" on a roast, "Plan from this" in the library, and "Plan next roast" in portfolio.      |
| 6   | "Saved plans" with their downloads              | Rows on `/roast/saved`, each with "Download for Artisan". The name reopens the plan at `/roast/plan?plan=<id>`. The list PR 5 kept under the plan form is replaced by a link here. |
| 7   | "Compare profiles"                              | `/roast/compare` (PR 2), from "Compare roasts" in the list header, "Compare with…" on a roast, the library's row menu and its two ticks, and portfolio's two ticks.                |
| 8   | "Measured comparison" and "Discuss with Cherry" | On `/roast/compare`, with "Discuss with Cherry AI".                                                                                                                                |
| 9   | Roast list and the roast's chart                | `/roast` and `/roast?roast=<id>` (PRs 1 and 2).                                                                                                                                    |
| 10  | Locked Studio for an account without the plan   | The locked page at `/roast` (PR 10).                                                                                                                                               |

New with this PR, and listed in the earlier plan as missing: seeing a saved reference's curve, renaming, removing, downloading the original file, and recording an uploaded file as a roast.

## Portfolio's row menu

On a coffee's Roasting tab, "Plan next roast" is in the row menu of each roast whose Artisan file is on record, and opens `/roast/plan?from=roast:<id>` with that roast chosen.

- Of the coffee's five roasts, the two with a file show the menu; the other three show none. A plan cannot be built on a roast with no file, so the item is left off instead of leading to a refusal.
- A shared, read-only coffee shows no menu. Covered by tests.
- **The last roast's menu** opens below the table and is not cut off at the table's edge. Measured with a file on every roast, so the last row draws a menu: "Plan next roast" sits 35 px below the table's bottom edge on desktop and 11 px below it on a phone, takes the click, and opens the plan. With the table clipping its contents, as it did before, the same click on desktop landed on the page behind the menu.
- **An open menu sits above the roast under it.** Measured with a file on every roast: on desktop the "⋯" button of the next roast used to show through the right edge of the open menu and take the click there, on every roast with another under it. Every point of "Plan next roast" now takes the click on all five roasts at both sizes, and the row's own link and tick box still work beside the menu.
- "Log sale" joins this menu with PR 8.

## Live roast guard

On a roast with nothing recorded yet:

- Start the timer, then follow a link to `/roast/saved`. The page stays on the roast and asks "A roast is still recording." with "Keep roasting" and "Leave".
- "Keep roasting" closes the question. The timer is still running and the address has not changed.
- The same link again, then "Leave", opens `/roast/saved`.
- "Download Artisan file" does not navigate, so a recording roast keeps recording through it. Covered by tests.

`RoastChartInterface.svelte` is not changed by this PR.

## Access

Covered by tests:

- `/roast/saved`, with and without `?ref=`, opens for a member, redirects a signed-in account without Mallard Studio to `/dashboard` (with or without Parchment Intelligence), and redirects a signed-out visitor to `/catalog`. A percent-encoded form of the path gets the same guard.
- Each new server route checks the member role itself and answers 403 to a viewer and 401 to a signed-out request before Parchment is asked: rename and remove, the reference's file, the roast's file, and "Record as a roast I ran".

## Task check (ADR-009)

The library is a list to manage, so the plan gives it no module declaration. On a phone it is the same rows on two lines, with the same actions. Checked at both sizes: find a saved reference, see its curve, download its file, rename it, and remove it. Pass.

## Screenshots

| View                                        | Desktop                                                                     | Phone                                                                 |
| ------------------------------------------- | --------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| The library with rows                       | [desktop](saved-rows-desktop.png)                                           | [phone](saved-rows-phone.png)                                         |
| The library with nothing saved              | [desktop](saved-empty-desktop.png)                                          | [phone](saved-empty-phone.png)                                        |
| A row's menu                                | [desktop](saved-row-menu-desktop.png)                                       | [phone](saved-row-menu-phone.png)                                     |
| The last row's menu, opened upward          | [desktop](saved-last-row-menu-desktop.png)                                  | [phone](saved-last-row-menu-phone.png)                                |
| A reference's curve                         | [desktop](saved-curve-desktop.png)                                          | [phone](saved-curve-phone.png)                                        |
| After a download                            | [desktop](saved-downloaded-desktop.png)                                     | [phone](saved-downloaded-phone.png)                                   |
| No Artisan file on record                   | [desktop](saved-no-file-desktop.png)                                        | [phone](saved-no-file-phone.png)                                      |
| Rename                                      | [desktop](saved-rename-desktop.png)                                         | [phone](saved-rename-phone.png)                                       |
| Remove, asking first                        | [desktop](saved-remove-desktop.png)                                         | [phone](saved-remove-phone.png)                                       |
| Record as a roast I ran                     | [desktop](saved-record-desktop.png)                                         | [phone](saved-record-phone.png)                                       |
| Add an Artisan file                         | [desktop](saved-add-desktop.png)                                            | [phone](saved-add-phone.png)                                          |
| An open roast's More menu with the download | [desktop](roast-more-menu-desktop.png)                                      | [phone](roast-more-menu-phone.png)                                    |
| An open roast after the download            | [desktop](roast-downloaded-desktop.png)                                     | [phone](roast-downloaded-phone.png)                                   |
| `/roast` without the Studio section         | [desktop](roast-list-desktop.png), [full page](roast-list-full-desktop.png) | [phone](roast-list-phone.png), [full page](roast-list-full-phone.png) |
| Portfolio's row menu                        | [desktop](portfolio-row-menu-desktop.png)                                   | [phone](portfolio-row-menu-phone.png)                                 |
| Portfolio's menu on the last roast          | [desktop](portfolio-last-row-menu-desktop.png)                              | [phone](portfolio-last-row-menu-phone.png)                            |
