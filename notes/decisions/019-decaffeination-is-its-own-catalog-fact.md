# ADR-019: Decaffeination is its own catalog fact

**Status:** Accepted (Reed, 2026-10-13, #scraper)

**Date:** 2026-10-13

## Context

A coffee's process is what happened at the farm or mill: washed, natural, honey. Decaffeination happens later, at a different plant, to coffee that already has a process. The catalog stores the two in one place, and one overwrites the other.

Scraper DADR-006 lists `Decaf` as a base method beside `Washed` and `Natural`. The effect, in production (read-only, 2026-10-13, in-stock rows):

- **271 of 3,211 lots store `processing_base_method = 'Decaf'` (8.4%).** That is the decaf set the catalog can identify today. It is a floor: a decaf lot stored under another base method is not in it (see the last bullet).
- **The farm process is gone on 264 of them.** The `processing` label holds the decaf method: Water Process Decaf (87), Swiss Water Decaf (74), EA Decaf (60), Mountain Water Decaf (15), Decaf (15), MC Decaf (11), CO2 Decaf (2). Seven keep a farm word beside it (Washed Decaf, Natural Decaf, Honey Decaf, "Pulped Natural, Decaf").
- **Only 24 keep it anywhere.** The scraper writes "Pre-decaf processing: Washed." into `processing_notes` when a title states it (Washed 17, Natural 6, Semi-Washed 1). An Ally lot titled "Volcan Azul – Caturra – Honey – Microlot – SWD" is stored as "Swiss Water Decaf" with no trace of the honey.
- **The processing filter is cluttered.** 11 of the 29 distinct `processing` values in stock are decaf variants.
- **Detection is by string.** A Sonofresco "Swiss Water Process Decaf" is stored as Washed and would be missed by any decaf filter. A search of names for "decaf" matches the cooperative "Asdecafe".

People looking for decaf want exactly that: decaf or not. They should not have to know which of eleven labels to pick.

## Decision

Decaffeination becomes two catalog fields of its own, and processing goes back to meaning the farm process.

### 1. Catalog columns

On `coffee_catalog`:

- `decaffeinated boolean not null default false`. True when the supplier sells the lot as decaffeinated.
- `decaf_method_code text` referencing a new `decaf_methods` table. Null when the supplier does not say how. It may be set only when `decaffeinated` is true.

### 2. Vocabulary

`decaf_methods (code, label, description, active, sort_order)`, in Parchment, seeded with the methods suppliers name today:

| Code                 | Label              | Suppliers write                       |
| -------------------- | ------------------ | ------------------------------------- |
| `swiss_water`        | Swiss Water        | Swiss Water, SWP, SWD                 |
| `mountain_water`     | Mountain Water     | Mountain Water, MWP                   |
| `water_process`      | Water process      | Water Process, with no brand          |
| `ethyl_acetate`      | Ethyl acetate      | EA, sugarcane, sugar cane, natural EA |
| `methylene_chloride` | Methylene chloride | MC, KVW, European process             |
| `co2`                | Carbon dioxide     | CO2, supercritical CO2                |

The set is small and closed, so supplier wording is mapped in the scraper's normalizer, as grade codes are, and a new method is a reviewed row plus a mapping.

### 3. What processing means

- `processing_base_method` no longer takes `Decaf`. For a decaf lot it holds the farm process when the supplier states it, and is null when they do not. Most decaf listings do not, and null is the honest value.
- `processing` (the display label) follows the same rule.
- This amends scraper DADR-006, whose base-method list loses `Decaf`.

### 4. Detection

`decaffeinated` is set from what the supplier states as a product fact: a decaf word or a named method in the title, a process or attribute field, or the supplier's own decaf collection. It is never set from part of a longer word ("Asdecafe").

### 5. Access and filters

- **Parchment API:** catalog responses carry `decaffeinated` and `decafMethod`. Catalog list, search and facets accept `decaf=true|false`. The processing facet stops returning `Decaf` once no row stores it.
- **coffee-app:** one decaf control with three states: any, decaf only, no decaf. The default is any. A decaf lot shows a decaf badge and its method. The processing filter lists farm processes only.
- **Similar coffees:** the existing "Decaf status differs" signal reads the flag.
- **Access (amended by Reed, 2026-10-14):** per the decaf amendment in ADR-005, the independent filter and its counts use `canUseDecafFilter`, not `canUseProcessFacets`. Signed-in free Viewer, Member, and Admin website sessions and customer API keys of every plan with `catalog:read` may use it. The exact legacy base-method `Decaf` alias follows the same capability during the compatibility window; every other structured process filter retains its existing gate. Anonymous and public-demo callers remain denied; the website loader strips their `decaf` param, the control explains free sign-in on demand, and the BFF omits decaf counts. Row facts and badges remain visible wherever the row is. Parchment must deploy the independent access/count support before the corrected coffee-app reader ships. No release flag or separate activation switch is introduced.

### 6. Market Index

Decaf stays its own bucket in the processing dimension, computed from the flag, so published series do not break. Whether decaf should become a separate dimension is not decided here.

### 7. Purveyor Score

`purveyor-score-v1` credits process transparency from `processing_base_method`: six points and one structured confidence signal when it is present (`src/lib/catalog/purveyorScore.ts`). A lot that stores `Decaf` earns that credit today for a value that is not a farm process.

- **The formula does not change, and the version stays `purveyor-score-v1`.** The credit follows the farm process, so a decaf lot earns it when the supplier states one and loses it when they do not. A disclosed decaf method earns no process-transparency credit. Crediting it would be a new formula version, and this ADR does not make one.
- **Effect:** for the about 250 in-stock decaf lots with no stated farm process, the process-transparency factor drops by six points and the confidence by one structured signal. Some may move down a tier, and score-ranked results reorder.
- **Obligation:** Parchment computes the stored score in the database and coffee-app keeps a TypeScript fallback, so no formula code changes. The scraper's cleanup repair re-scores every row it moves. Its dry run reports how many in-stock lots change score and tier, and the apply runs only after that report is read.

## Integration

- **Scraper:** the processing normalizer splits a label into farm process and decaf method. The pre-decaf note it already writes becomes the base method. An audit check lists lots whose name states decaf while the flag is false, and step 5 does not apply until it lists none.
- **Existing rows:** 358 rows hold base `Decaf` (272 in stock). The backfill applies the section 4 rules to every signal a row stores: the title, the processing label and notes, and the process attributes. It is not limited to rows whose base method is `Decaf`, so a decaf title stored as `Washed` (the Sonofresco lot) is flagged, and the method is read from the same text. A lot that only the supplier's decaf collection identifies is set by the scraper the next time it sees the lot, and the audit check lists any lot still unflagged. The farm process is recovered from the pre-decaf note or a farm word in the label where there is one, and is otherwise left empty.
- **Persisted sourcing briefs:** a stored brief can carry `criteria.processing_base_method = "Decaf"`. That is persisted consumer state: it cannot move itself, and once rows leave `Decaf` the brief's matches would silently be empty. Parchment adds `decaf` (boolean) as a sourcing brief criterion. The coffee-app criteria parser rejects unknown criteria fields today, so it accepts `decaf` first (step 3). Only then does Parchment accept the criterion on write, release it in the SDK, and rewrite stored `Decaf` criteria to `decaf: true` (step 4). Until step 6, a request filter or a stored criterion that still says base method `Decaf` is read as `decaf=true`, so no client or brief changes result in the interval.
- **Evidence:** `processing_evidence` already records where a processing value came from, and carries the decaf fields the same way.

## Sequence

1. **Parchment, additive:** `decaf_methods`, the two columns, and a backfill of flag and method from every stored signal (see Existing rows). A transitional trigger sets them on any write that still says base `Decaf`, so the flag is right from the first night whichever scraper version is running. API fields, the `decaf` filter and facet gated per section 5, and the similarity and Market Index reads. The API treats a remaining base `Decaf` as no farm process and reads a `Decaf` base-method filter or criterion as `decaf=true`. The processing facet and the data are unchanged. SDK minor release.
2. **purveyors-cli:** the `decaf` flag on the catalog commands, against the released SDK, and a CLI release. The manifest has no decaf flag today, and coffee-app regenerates its CLI reference only from a published, exactly pinned version (ADR-017), so CLI users cannot move off `Decaf` without this step.
3. **coffee-app, readers and control:** bump the SDK and CLI pins and regenerate the CLI reference. Show the decaf badge and method, and accept the `decaf` brief criterion, in every first-party reader of the label: CoffeeCard, the catalog map, the similar-coffee panel, the supplier comparison table, the bean inventory overview, the chat assistant's catalog tool output (its field allowlist), and the brief summary and dashboard link. Each reads the new fields and falls back to the legacy label, so it renders correctly before and after the data moves. Add the gated decaf control.
4. **Parchment, briefs:** accept the `decaf` brief criterion on write, release it in the SDK, and rewrite stored `Decaf` criteria to `decaf: true`. This waits for step 3, so the parser in production accepts the new field.
5. **Scraper:** write the two fields, stop writing `Decaf` as a base method, recover the farm process, and move existing rows off `Decaf` with a dry-run and apply maintenance repair that also re-scores them (section 7). Amend DADR-006. Add the audit check. This is the first step that clears a legacy `processing` value, so steps 3 and 4 are live and the audit lists no unflagged decaf lot before the apply.
6. **Parchment cleanup:** drop the transitional trigger and the `Decaf` filter and criterion reading, and forbid `Decaf` as a base method.

Each step works in production on its own. Step 3 depends on steps 1 and 2 being released and step 1 being applied. Steps 4 and 5 depend on step 3 being deployed.

## Consequences

- One decaf control replaces the separate method labels; the compact toolbar opens its three choices on demand.
- Decaf lots can be filtered and compared by farm process where the supplier states it.
- The processing filter loses eleven entries.
- About 250 in-stock decaf lots will show no farm process, because their supplier states none. That is a visible gap that was hidden before. Their Purveyor Score falls for the same reason (section 7), and the Market Index score series move with them.
- `Decaf` as a base process is part of the documented API today (`processingBaseMethod`). Clients filtering on it must move to `decaf=true` before step 6. Stored briefs are rewritten for them in step 4. The docs and CLI manifest change in steps 2 and 3.
- Signed-in free Viewer sessions can find decaf lots with the independent control after labels change. Anonymous visitors still see the badge and method but must sign in to use the decaf filter, per amended ADR-005.
- Six coordinated changes across four repositories: Parchment (with its SDK), purveyors-cli, coffee-app and the scraper.
