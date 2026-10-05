# PR 5: plan the next roast

Evidence for job 4 in [Roast and portfolio workflows](../../2026-10-04-roast-and-portfolio-workflows.md). The page was rendered at 1440×900 and 390×844 against a stand-in Parchment/Supabase backend. One foreground browser script started both servers, exercised the flow, saved these screenshots, and stopped the servers. The script confirmed no horizontal overflow at either width, a read-only preview request before the save requests, a downloaded `Purveyors-reference.alog`, direct saved-plan reopening, and the no-file reason as a next step rather than an alert.

## Job 4: plan the next roast from one I liked, send to Artisan

| Starting on the open roast |                Desktop |                  Phone |
| -------------------------- | ---------------------: | ---------------------: |
| Before (Studio form)       |   8 clicks + re-upload |   8 clicks + re-upload |
| After (this page)          | 4 clicks, no re-upload | 5 clicks, no re-upload |

Desktop after: **Plan next roast from this → Preview → Save plan → Download for Artisan**. On a phone, **More** precedes the plan action. The deep link fills the source; the default adjustment can be changed without extra clicks if desired. These counts omit optional editing and count activation of the file download.

## Artisan wording

The current [Artisan Background documentation](https://artisan-scope.org/docs/background/) says **“Menu: Roast » Background”** and describes loading a background profile in the Profile Background dialog. That confirms the planned instruction: “In Artisan, open Roast, then Background, and load this file.” The same documentation describes Playback Events as a separately selected option; downloading a planned background is not itself roaster control.

## Access and incomplete source

The member page guard redirects a viewer from `/roast/plan` to `/dashboard`; a member opens the page. The new BFF routes also require member role. An older roast without a retained Artisan file returns the API's `roast_artisan_source_unavailable` reason. The page says what to do next and does not claim the plan failed to save.

## Screenshots

| State                           | Desktop                                        | Phone                                      |
| ------------------------------- | ---------------------------------------------- | ------------------------------------------ |
| 1. Start from a roast           | [desktop](plan-step-1-desktop.png)             | [phone](plan-step-1-phone.png)             |
| 2. What to change               | [desktop](plan-step-2-desktop.png)             | [phone](plan-step-2-phone.png)             |
| 3. Preview                      | [desktop](plan-step-3-desktop.png)             | [phone](plan-step-3-phone.png)             |
| 4. Save and send to Artisan     | [desktop](plan-step-4-before-save-desktop.png) | [phone](plan-step-4-before-save-phone.png) |
| Saved plan and download         | [desktop](plan-saved-desktop.png)              | [phone](plan-saved-phone.png)              |
| Saved plan reopened by `?plan=` | [desktop](plan-reopened-desktop.png)           | [phone](plan-reopened-phone.png)           |
| Roast cannot be used            | [desktop](plan-cannot-be-used-desktop.png)     | [phone](plan-cannot-be-used-phone.png)     |

## Sequence notes

- The older plan's SDK version/dependency row is stale: main already has `@purveyors/sdk` 0.59.0 with `roastCandidates`, `previewFromRoast`, and `fromRoast`. This PR uses those typed methods and does not take the 0.61.0 `downloadArtisanFile` addition.
- The portfolio Roasting-tab row-menu action is a follow-up on the sibling PR 3 work; this PR does not edit `src/routes/beans`.
- Downloading a roast's original file is later work; this PR downloads the generated plan, as specified. Full Studio removal is PR 6.
