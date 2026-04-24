# Outline: Null Means Two Things (and Your Pipeline Can't Tell Which)

**Pillar:** coffee-data-pipeline
**Target:** 1,500–2,000 words (HARD CEILING)
**Status:** outlined
**Source material:** coffee-scraper PR #60 (validation guards), PR #55 (grade normalization), scrape/cleaning/unifiedCleaner.ts (mergeFields + validateFinalFields)

## Thesis

Every data pipeline that merges upstream extractions treats null as one thing. It's actually two: "I tried and found nothing" vs "I tried and rejected what I found." Defensive merge logic that keeps originals when null arrives is correct for the first case and catastrophic for the second. Codd identified this in 1990. We still build pipelines that can't tell the difference, and the result is bad data that survives every cleaning pass forever.

## Voice Constraints

- Short and punchy. 1,500–2,000 words max.
- Gladwell/Freakonomics framing: the code designed to protect data quality is the code that destroys it.
- No salesmanship, no narrative arc. Get to the insight immediately.
- Data and analysis over narrative. Cite numbers and concrete evidence.
- 2–3 research citations that directly reinforce specific claims.
- Every section earns its place. If it doesn't deliver new insight, cut it.

## Verification Checklist

- [ ] Confirm mergeFields logic in unifiedCleaner.ts: line 365 `value === null && original !== null` → keeps original
- [ ] Confirm validateFinalFields exists and runs after mergeFields
- [ ] Verify the concrete examples: "Grade 1" as grade (not elevation), "Italy" as country (not coffee origin), "May – October" as arrival date (harvest range, not date)
- [ ] Confirm PR #60 prod data numbers: 55 invalid grade records, 470 non-standard arrival dates, 1 "Italy" country record
- [ ] Verify Codd's 1990 A-Values/I-Values proposal is correctly attributed (The Relational Model for Database Management, Version 2)

## External References

1. **Codd, E.F. (1990).** _The Relational Model for Database Management, Version 2._ Proposed A-Values ("Missing But Applicable") and I-Values ("Missing But Inapplicable") as two distinct null markers. SQL never adopted this. Key quote from Wikipedia's Null (SQL) article: "Codd indicated in his 1990 book... that the single Null mandated by the SQL standard was inadequate, and should be replaced by two separate Null-type markers to indicate the reason why data is missing."

   - https://en.wikipedia.org/wiki/Null_(SQL)

2. **Kimball Group, Design Tip #43 (2003).** "Dealing With Nulls in the Dimensional Model." Recommends substituting descriptive strings ("Unknown," "Not Applicable") rather than bare nulls, because nulls have ambiguous meaning to both developers and users. This is the dimensional modeling world's workaround for the same semantic overloading problem.

   - https://www.kimballgroup.com/2003/02/design-tip-43-dealing-with-nulls-in-the-dimensional-model/

3. **Sanderson, Chad (2022).** "The Rise of Data Contracts." Frames null ambiguity as a systemic data quality problem: "model-breaking pipeline failures, NULLs, head-scratching errors, and angry data consumers are a weekly occurrence." Data contracts enforce explicit semantics at boundaries rather than relying on implicit merge conventions.
   - https://dataproducts.substack.com/p/the-rise-of-data-contracts

## Structure

### The Defensive Merge That Freezes Bad Data (~350 words)

Open with the concrete pattern. A multi-step data pipeline extracts fields from upstream sources. When the extractor returns null, the merge logic says: "Keep the original value; the extraction probably just failed." This is reasonable. It's also a trap.

Show the code pattern (simplified pseudocode, not the full implementation):

```
if new_value is null and original is not null:
    keep original  // "don't overwrite good data with failed extraction"
```

Then show what happens when null means "I examined this value and deliberately rejected it." The merge logic can't distinguish the two cases. Result: invalid data survives every cleaning pass indefinitely.

Key data point: in our coffee data pipeline, this single rule preserved 55 invalid elevation records (grade labels like "Grade 1" misclassified as elevation data), 470 unparseable arrival dates (harvest ranges like "May – October"), and 1 non-coffee-origin country ("Italy"). All persisted through months of daily cleaning runs.

### Codd Saw This Coming (~300 words)

E.F. Codd proposed two kinds of null in 1990: A-Values ("Missing But Applicable," i.e., extraction failed) and I-Values ("Missing But Inapplicable," i.e., value deliberately rejected/not applicable). SQL never adopted this distinction. Every database, every ORM, every pipeline framework has one null. Developers must overload its meaning.

This isn't obscure theory. The Kimball Group's Design Tip #43 recommended substituting descriptive strings ("Unknown" vs "Not Applicable") precisely because bare nulls are semantically ambiguous. Dimensional modelers solved this 20+ years ago by encoding intent in the value itself. ETL pipelines mostly ignored the lesson.

The irony: defensive merge logic exists because developers know null is ambiguous. The defense against ambiguity creates the exact problem the ambiguity causes.

### The Taxonomy of Null in Pipelines (~350 words)

Enumerate the distinct meanings null carries in a typical extraction pipeline:

1. **"Not attempted"**: The extractor didn't run for this field.
2. **"Attempted, found nothing"**: The field doesn't exist in the source.
3. **"Attempted, extraction failed"**: The AI/parser errored out.
4. **"Attempted, value rejected"**: The validator examined the value and determined it's invalid for this field type.

All four return null. Only case 3 justifies "keep original." Cases 1 and 2 are ambiguous (maybe keep, maybe clear). Case 4 demands clearing the original, which is the opposite of the defensive behavior.

The practical test: if a downstream consumer receives a value, they need to know whether it survived because it was validated or because it was shielded from a null that actually meant "rejected." In the default merge pattern, there's no way to tell.

### The Fix Pattern: Post-Merge Validation Guards (~350 words)

The structural fix isn't smarter merge logic. It's a second pass. After the merge preserves originals (correctly handling case 3), a validation guard runs over the merged output and enforces format invariants regardless of how the value got there.

Show the pattern:

```
// Phase 1: Merge (conservative, null-preserving)
mergeFields(original, extracted)

// Phase 2: Validate (strict, format-enforcing)
validateFinalFields(merged)
```

The guard doesn't need to know whether a value is original or extracted. It only asks: "Does this value meet the format requirements for this field?" Grade must be a valid elevation in MASL. Arrival date must parse to "Month YYYY." Country must be a recognized coffee-producing origin. If not, clear it.

This works because validation is stateless. It doesn't care about provenance. The merge logic can remain conservative (protecting against extraction failures) while the validator catches everything that slips through.

Connect to Sanderson's data contracts: this is essentially an inline contract enforcement. The contract says "grade is MASL format or null." The validator enforces it. The merge logic doesn't need to be rewritten.

### The General Principle (~200 words)

Close with the transferable insight: any system that uses null for multiple semantic purposes and then writes conditional logic around null will eventually encode the wrong assumption for at least one of those purposes. The defensive case ("keep original") and the corrective case ("clear invalid") are literally opposite operations triggered by the same input.

Solutions that work: typed result envelopes (Rust's `Option<Result<T, E>>`), sentinel values with explicit semantics (Kimball), or post-merge validation guards that enforce invariants regardless of provenance. Solutions that don't: trusting that null means what you assumed it means at the point where you wrote the merge logic.

One-line takeaway: defensive final validation is more robust than smarter merge logic, because it doesn't need to understand why a value is there to determine whether it should be.
