# PR 2: actions on the roast and `/roast/compare`

Before-and-after evidence for PR 2 of [Roast and portfolio workflows](../../2026-10-04-roast-and-portfolio-workflows.md).

Rendered locally at 1440×900 and 390×844 with the plan's seeded data behind a stand-in backend. Positions and click counts were read from the rendered page with the browser. "Before" is `main` at `3161c0e6`, which already has PR 1 and PR 4.

## Compare this roast with an earlier one (job 3)

| Measure                                   | Desktop before               | Desktop after  | Phone before                   | Phone after    |
| ----------------------------------------- | ---------------------------- | -------------- | ------------------------------ | -------------- |
| Clicks, starting on the open roast        | 7                            | 2              | 7                              | 2              |
| Scrolls                                   | 2                            | 0              | 2                              | 0              |
| Distance down to the comparison controls  | 2,638 px, 2.9 screens        | None: a button | 4,082 px, 4.8 screens          | None: a button |
| Distance from the controls to the result  | 234 px to 834 px, 0.3 to 0.9 | Same screen    | 490 px to 1,310 px, 0.6 to 1.6 | Same screen    |
| The roast on screen has to be found again | Yes, in the first picker     | No             | Yes, in the first picker       | No             |
| The comparison has a link                 | No                           | Yes            | No                             | Yes            |

The seven clicks on `main`: open the first picker, type, choose; open the second picker, type, choose; Compare. The two after: "Compare with…", then the roast to compare with. The second picker is already open and lists the same coffee's other roasts first, most recent first.

Back from the comparison returns to the roast it was opened from, with the roast open.

## Where things sit on an open roast

| Measure               | Desktop before  | Desktop after | Phone before    | Phone after |
| --------------------- | --------------- | ------------- | --------------- | ----------- |
| "Compare with…", More | Not on the page | 117 px        | Not on the page | 225 px      |
| Milestone line        | 116 px          | 166 px        | 224 px          | 274 px      |
| Top of the chart      | 220 px          | 270 px        | 426 px          | 476 px      |
| Bottom of the chart   | 680 px          | 730 px        | 748 px          | 798 px      |

The action bar adds 50 px above the chart. On desktop the chart still starts within the first 300 px. On a phone the whole chart still fits on the first screen (844 px).

## Task check (ADR-009)

Open a comparison by link and read which milestone differed most and by how much. The link is `/roast/compare?a=roast:4531&b=roast:4507`.

- **Desktop:** the page opens with the result drawn and no click. "Drop: B was 13 sec earlier" sits at 419 px, above the chart (503 px), with the milestone table beside the chart. Pass.
- **Phone:** the same link opens with the result drawn. The same line sits at 683 px of an 844 px screen, under the key and above the chart (805 px). The table follows the chart as one row per milestone. Pass.
- **Not recorded:** with first crack never marked on B, the row reads "First crack 8:18 · Not recorded · First crack not recorded for B", and the largest difference is taken from the milestones both recorded.
- **Two saved references, no roast:** `/roast/compare?a=ref:<id>&b=ref:<id>` opens with "First crack: B was 20 sec later".
- **A reference against the plan made from it:** every milestone falls at the same time, and the line reads "All milestones: same time".

The seeded roasts 4531 and 4507 differ most at drop, so the line here reads "Drop: B was 13 sec earlier". The plan's "First crack: B was 45 sec earlier" is the same line for a pair that differs most at first crack.

## Live roast guard

On a roast that has a weight on record and no curve, so it can be compared and can still be logged:

- Start the timer, then choose "Compare with…". The page stays on the roast and asks "A roast is still recording." with "Keep roasting" and "Leave".
- "Keep roasting" closes the question. The timer is still running and the address has not changed.
- "Compare with…" again, then "Leave", opens `/roast/compare?a=roast:<id>`.

A roast with nothing recorded has nothing to compare, so its "Compare with…" is not available.

## Screenshots

| View                                    | Before                                                                                         | After                                                                                                                                                           |
| --------------------------------------- | ---------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Open roast                              | [desktop](before-roast-open-desktop.png), [phone](before-roast-open-phone.png)                 | [desktop](after-roast-open-desktop.png), [phone](after-roast-open-phone.png)                                                                                    |
| Open roast, More menu                   |                                                                                                | [desktop](after-roast-more-desktop.png), [phone](after-roast-more-phone.png)                                                                                    |
| Comparison with one side chosen         | [desktop](before-compare-one-side-desktop.png), [phone](before-compare-one-side-phone.png)     | [desktop](after-compare-one-side-desktop.png), [phone](after-compare-one-side-phone.png)                                                                        |
| Comparison with two sides               | [desktop](before-compare-two-sides-desktop.png), [phone](before-compare-two-sides-phone.png)   | [desktop](after-compare-two-sides-desktop.png), [phone](after-compare-two-sides-phone.png), [phone, full page](after-compare-two-sides-full-phone.png)          |
| Saved reference against saved reference | [desktop](before-compare-references-desktop.png), [phone](before-compare-references-phone.png) | [desktop](after-compare-references-desktop.png), [phone](after-compare-references-phone.png)                                                                    |
| A milestone one side did not record     |                                                                                                | [desktop](after-compare-not-recorded-desktop.png), [phone](after-compare-not-recorded-phone.png), [phone, full page](after-compare-not-recorded-full-phone.png) |
| A reference against its plan            |                                                                                                | [desktop](after-compare-reference-and-plan-desktop.png), [phone](after-compare-reference-and-plan-phone.png)                                                    |
| Leaving a recording roast to compare    |                                                                                                | [desktop](after-guard-compare-desktop.png), [phone](after-guard-compare-phone.png)                                                                              |
| Roast list header                       |                                                                                                | [desktop](after-roast-list-desktop.png), [phone](after-roast-list-phone.png)                                                                                    |

"Before" for the comparison rows is the Compare card inside the Studio section on `/roast`, which is where comparison lived.
