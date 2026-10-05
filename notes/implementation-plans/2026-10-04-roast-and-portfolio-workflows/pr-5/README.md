# PR 5: `/roast/plan` and plan from a roast

Evidence for PR 5 of [Roast and portfolio workflows](../../2026-10-04-roast-and-portfolio-workflows.md).

Rendered locally at 1440×900 and 390×844 with the plan's seeded data behind a stand-in backend. The stand-in serves the roasts a plan can start from, the preview, the saved reference, the saved plan, and the download. Three of the fifteen seeded roasts keep their Artisan file, which is the proportion production has today. Click counts and positions were read from the rendered page with the browser.

## Plan the next roast from one I liked, send to Artisan (job 4)

| Measure                                | Before                          | Desktop after | Phone after |
| -------------------------------------- | ------------------------------- | ------------- | ----------- |
| Clicks, starting on the open roast     | 8                               | 4             | 5           |
| The Artisan file has to be found again | Yes, and uploaded a second time | No            | No          |
| A roast in history can be used         | No, uploaded Artisan files only | Yes           | Yes         |
| The plan has a link                    | No                              | Yes           | Yes         |
| What to do with the file in Artisan    | Not stated                      | Stated        | Stated      |

"Before" is the count in the plan's workflow table: name, choose file, Save reference, two for the starting reference, Preview, Save, Download.

The four clicks on desktop: "Plan next roast from this", Preview, Save plan, Download for Artisan. The roast arrives chosen and the default change (raise bean temperature 5°F for the first five minutes after charge) can be previewed as it stands. On a phone the open roast shows one action, "Compare with…", as the plan specifies, so "Plan next roast from this" is the first item under More and costs one more tap.

After Preview the page brings step 3 to the top. At desktop size the preview chart and "Save plan" are then on screen together.

## Where things sit on an open roast

The action bar gains one button on desktop and nothing on a phone, so the chart does not move.

| Measure             | Desktop | Phone  |
| ------------------- | ------- | ------ |
| Top of the chart    | 270 px  | 476 px |
| Bottom of the chart | 730 px  | 798 px |

These are the positions PR 2 measured.

## A roast that cannot be used

Parchment lists at most the 50 newest roasts that can be planned from, with a count of the rest. A link to a roast outside that list is checked with the read-only preview, which is the one read that returns the reason.

- **Imported before files were kept** (`/roast/plan?from=roast:4507`): "This roast was imported before Artisan files were kept, so a plan cannot be built from it. Import its .alog again to plan from it."
- **Logged live or entered by hand** (`/roast/plan?from=roast:4490`): "This roast has no Artisan file on record, so a plan cannot be built from it. Import its .alog to plan from it."
- Both show "Open this roast", which opens the roast where "Import Artisan file" lives. The reason is a status, not an error, and the rest of the form is not drawn.
- The count under "Start from" reads "12 roasts have no Artisan file on record, so a plan cannot be built from them. Import a roast's .alog to plan from it."

## Saving in two steps

A plan from a roast saves twice: the roast's Artisan file is kept as a saved reference, then the plan is saved on it. With the second call forced to fail once:

- The page says "Plans cannot be saved right now. Try again in a moment." and, under it, "This roast is now kept as a saved reference. Saving the plan again will use it." The preview stays on screen.
- "Save plan" again saves the plan. The stand-in received one request to keep the file and two to save the plan.
- The reference kept from a roast is named for the coffee and its date ("Ethiopia Yirgacheffe Wush Wush 96 Hour Anaerobic Natural, roasted Oct 1, 2026"). The roast is still offered once under "Start from".

## Task check (ADR-009)

Build a plan from a saved reference, read the preview, save it, and download it. The link is `/roast/plan?from=ref:<id>`.

- **Desktop:** the reference arrives chosen. Lowering bean temperature 8°F from 4 to 7 minutes and choosing Preview draws "−8°F bean temperature, 4 to 7 minutes after charge" over the dashed curve it started from. Save plan opens the saved plan; Download for Artisan saves `Purveyors-reference.alog`. Pass.
- **Phone:** the same steps stacked, with the chart under step 3 and Save under it. No sideways scrolling at any step. Pass.
- **A saved plan by link** (`/roast/plan?plan=<id>`): the name, "Plan · Saved Oct 2, 2026 · Started from Guji natural, September keeper", the download, and the Artisan instructions are on the first screen at both sizes.

## Live roast guard

On a roast that has a weight on record and no curve, so it can be planned from and can still be logged:

- Start the timer, then choose "Plan next roast from this" (under More on a phone). The page stays on the roast and asks "A roast is still recording." with "Keep roasting" and "Leave".
- "Keep roasting" closes the question. The timer is still running and the address has not changed.
- The same action again, then "Leave", opens `/roast/plan?from=roast:<id>`.

## Access

Read over plain HTTP from the running app:

| Request                                             | Member                     | Without Mallard Studio | Signed out        |
| --------------------------------------------------- | -------------------------- | ---------------------- | ----------------- |
| `/roast/plan`, with `?from=` or `?plan=`            | 200                        | 303 to `/dashboard`    | 303 to `/catalog` |
| `GET /api/reference-profiles/from-roast/candidates` | 200                        | 403                    | 401               |
| `POST /api/reference-profiles/from-roast/preview`   | Succeeds in the runs above | 403                    | 401               |
| `POST /api/reference-profiles/from-roast`           | Succeeds in the runs above | 403                    | 401               |

## Artisan wording

The download instruction was checked against Artisan's documentation on 2026-10-04.

- [Artisan documentation, Background](https://artisan-scope.org/docs/background/): "Menu: Roast » Background. The Profile Background dialog box is where you would load a background profile".
- [Artisan blog, Profile Templates](https://artisan-roasterscope.blogspot.com/2017/10/profile-templates.html): "To load an existing .alog file as profile template choose menu Roast >> Background to open the Profile Background dialog and push the Load button."

"In Artisan, open Roast, then Background, and load this file" matches both.

The plan's last sentence, "It does not control your roaster", does not hold in every setup. The same blog post says that with Playback Events on, "Artisan will automatically issue the events of the background profile during a roast", and a roaster maker's guide ([Kaleido, How to Load an Artisan Background](https://kaleidoroasters.com/blogs/coffee-roasting-blog/how-to-load-an-artisan-background)) describes a "Background" set-value mode in which Artisan follows a loaded background. A saved plan keeps the heat and fan events of what it started from. The sentence now reads: "It does not control your roaster, unless Artisan is set to play back a background's events or to follow the background."

## Screenshots

| View                                             | Desktop                                                | Phone                                                                                           |
| ------------------------------------------------ | ------------------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| Open roast with the plan action                  | [desktop](roast-open-desktop.png)                      | [phone](roast-open-phone.png), [More](roast-more-phone.png)                                     |
| Plan from a roast: start from and what to change | [desktop](plan-from-roast-steps-desktop.png)           | [phone](plan-from-roast-steps-phone.png), [full page](plan-from-roast-steps-full-phone.png)     |
| Plan from a roast: preview                       | [desktop](plan-from-roast-preview-desktop.png)         | [phone](plan-from-roast-preview-phone.png), [full page](plan-from-roast-preview-full-phone.png) |
| Plan from a roast: save and send to Artisan      | [desktop](plan-from-roast-save-desktop.png)            | [phone](plan-from-roast-save-phone.png)                                                         |
| Saved plan with its download                     | [desktop](plan-saved-desktop.png)                      | [phone](plan-saved-phone.png), [full page](plan-saved-full-phone.png)                           |
| Cannot be used: imported before files were kept  | [desktop](plan-cannot-be-used-not-kept-desktop.png)    | [phone](plan-cannot-be-used-not-kept-phone.png)                                                 |
| Cannot be used: logged live                      | [desktop](plan-cannot-be-used-logged-live-desktop.png) | [phone](plan-cannot-be-used-logged-live-phone.png)                                              |
| The plan failed to save after the file was kept  | [desktop](plan-save-failed-desktop.png)                | [phone](plan-save-failed-phone.png)                                                             |
| A saved plan reopened by link                    | [desktop](plan-reopened-desktop.png)                   | [phone](plan-reopened-phone.png)                                                                |
| "Start from" opened, after a plan from a roast   | [desktop](plan-picker-open-desktop.png)                | [phone](plan-picker-open-phone.png)                                                             |
| Nothing chosen yet                               | [desktop](plan-nothing-chosen-desktop.png)             | [phone](plan-nothing-chosen-phone.png)                                                          |
| Plan from a saved reference: preview             | [desktop](plan-from-reference-preview-desktop.png)     | [phone](plan-from-reference-preview-phone.png)                                                  |
| Leaving a recording roast to plan                | [desktop](guard-plan-desktop.png)                      | [phone](guard-plan-phone.png)                                                                   |
| The Studio section's plan card on `/roast`       | [desktop](studio-plan-card-desktop.png)                | [phone](studio-plan-card-phone.png)                                                             |
