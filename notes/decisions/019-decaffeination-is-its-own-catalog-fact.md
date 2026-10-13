# ADR-019: Decaffeination is its own catalog fact

**Status:** Accepted (Reed, 2026-10-13, #scraper)

**Date:** 2026-10-13

## Context

A coffee's process is what happened at the farm or mill: washed, natural, honey. Decaffeination happens later, at a different plant, to coffee that already has a process. The catalog stores the two in one place, and one overwrites the other.

Scraper DADR-006 lists `Decaf` as a base method beside `Washed` and `Natural`. The effect, in production (read-only, 2026-10-13, in-stock rows):

- **271 of 3,211 lots are decaf (8.4%).** Every one stores `processing_base_method = 'Decaf'`.
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

| Code                 | Label                   | Suppliers write                         |
| -------------------- | ----------------------- | --------------------------------------- |
| `swiss_water`        | Swiss Water             | Swiss Water, SWP, SWD                   |
| `mountain_water`     | Mountain Water          | Mountain Water, MWP                     |
| `water_process`      | Water process           | Water Process, with no brand            |
| `ethyl_acetate`      | Ethyl acetate           | EA, sugarcane, sugar cane, natural EA   |
| `methylene_chloride` | Methylene chloride      | MC, KVW, European process               |
| `co2`                | Carbon dioxide          | CO2, supercritical CO2                  |

The set is small and closed, so supplier wording is mapped in the scraper's normalizer, as grade codes are, and a new method is a reviewed row plus a mapping.

### 3. What processing means

- `processing_base_method` no longer takes `Decaf`. For a decaf lot it holds the farm process when the supplier states it, and is null when they do not. Most decaf listings do not, and null is the honest value.
- `processing` (the display label) follows the same rule.
- This amends scraper DADR-006, whose base-method list loses `Decaf`.

### 4. Detection

`decaffeinated` is set from what the supplier states as a product fact: a decaf word or a named method in the title, a process or attribute field, or the supplier's own decaf collection. It is never set from part of a longer word ("Asdecafe").

### 5. Access and filters

- **Parchment API:** catalog responses carry `decaffeinated` and `decafMethod`. Catalog list, search and facets accept `decaf=true|false`. The processing facet stops returning `Decaf`.
- **coffee-app:** one decaf control with three states: any, decaf only, no decaf. The default is any. A decaf lot shows a decaf badge and its method. The processing filter lists farm processes only.
- **Similar coffees:** the existing "Decaf status differs" signal reads the flag.

### 6. Market Index

Decaf stays its own bucket in the processing dimension, computed from the flag, so published series do not break. Whether decaf should become a separate dimension is not decided here.

## Integration

- **Scraper:** the processing normalizer splits a label into farm process and decaf method. The pre-decaf note it already writes becomes the base method. An audit check lists lots whose name states decaf while the flag is false.
- **Existing rows:** 358 rows hold base `Decaf` (272 in stock). The flag and method are derived from the stored label, exactly. The farm process is recovered from the pre-decaf note or a farm word in the label where there is one, and is otherwise left empty.
- **Evidence:** `processing_evidence` already records where a processing value came from, and carries the decaf fields the same way.

## Sequence

1. **Parchment:** `decaf_methods`, the two columns, and a backfill of flag and method from stored labels. A transitional trigger sets them on any write that still says base `Decaf`, so the flag is right from the first night whichever scraper version is running. API fields, the `decaf` filter and facet, and the similarity and Market Index reads. The API treats a remaining base `Decaf` as no farm process.
2. **Scraper:** write the two fields, stop writing `Decaf` as a base method, recover the farm process, and move existing rows off `Decaf` with a dry-run and apply maintenance repair. Amend DADR-006. Add the audit check.
3. **coffee-app:** the decaf control, the badge, and the processing filter without decaf.
4. **Parchment cleanup:** drop the transitional trigger and forbid `Decaf` as a base method.

Each step works in production on its own. Step 3 depends on step 1 being applied.

## Consequences

- A decaf filter is one click and cannot miss a lot because of its label.
- Decaf lots can be filtered and compared by farm process where the supplier states it.
- The processing filter loses eleven entries.
- About 250 in-stock decaf lots will show no farm process, because their supplier states none. That is a visible gap that was hidden before.
- `Decaf` as a base process is part of the documented API today (`processingBaseMethod`). Clients filtering on it must move to `decaf=true`. The docs and CLI manifest change in step 3.
- Four coordinated changes across three repositories.
