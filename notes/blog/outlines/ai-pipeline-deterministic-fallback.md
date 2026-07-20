# Outline: When Your AI Step Fails, the Deterministic Work Should Still Run

**Pillar:** coffee-data-pipeline
**Target:** 1,500-2,000 words (HARD CEILING)
**Status:** outlined
**Source material:**
- `repos/coffee-scraper/scrape/cleaning/unifiedCleaner.ts` (catch block pattern + applyPostProcessors call)
- `repos/coffee-scraper/scrape/cleaning/postProcessors.ts` (what deterministic steps actually run)
- `repos/coffee-scraper/scrape/utils/countryExtractor.ts` (example of raw-title-capable deterministic extraction)
- Brain idea note: "Graceful degradation in multi-step pipelines" (ideas.md, coffee-data-pipeline section)

## Thesis
When an AI extraction step fails in a hybrid pipeline, developers instinctively bail out of the entire pipeline run — silently skipping deterministic post-processing that doesn't need the AI output at all. The bug isn't the API quota error; it's treating a dependency graph as a sequential chain. Steps that require only raw input should always run, regardless of whether upstream AI succeeded.

## Voice Constraints
- Short and punchy. 1,500-2,000 words max.
- Gladwell/Freakonomics framing: the real failure is hidden by the visible failure
- No salesmanship, no narrative arc. Get to the bug immediately.
- Data and analysis over narrative. Concrete code pattern, concrete pipeline examples.
- 2 research citations that directly reinforce the dependency-classification claim
- Every section earns its place. If it doesn't deliver new insight, cut it.

## Verification Checklist
- [ ] Confirm `unifiedCleaner.ts` catch block calls `this.applyPostProcessors(result)` in the error path (grep for it; already read — confirmed)
- [ ] Confirm `postProcessors.ts` accepts `Record<string, unknown>` and runs on raw/partial data even without LLM fields
- [ ] Confirm `countryExtractor.ts` operates on raw product title (no LLM required) — confirmed from source
- [ ] Check that `cost_lb` unit correction logic in postProcessors runs deterministically (no LLM required)
- [ ] Verify there was actually a prior version where deterministic steps were NOT called in the catch block (check git history: `git log --oneline -- scrape/cleaning/unifiedCleaner.ts`)

## External References

1. **AWS Well-Architected Reliability Pillar — Graceful Degradation**
   URL: https://docs.aws.amazon.com/wellarchitected/latest/reliability-pillar/rel_mitigate_interaction_failure_graceful_degradation.html
   Key quote: "Design for partial failure. Categorize every dependency as critical (fail the request) or non-critical (degrade gracefully)."
   Use: grounds the dependency-classification principle in established distributed systems thinking

2. **DEV Community, 2026 — "Graceful Degradation Patterns: Keep Your Backend Running When Dependencies Fail"**
   URL: https://dev.to/young_gao/graceful-degradation-4b5p
   Key quote: "Your API should never be entirely down because one dependency is down. Categorize every dependency as critical or non-critical."
   Use: reinforces that this is not exotic — it's a standard pattern that hybrid AI pipelines routinely violate

## Structure

### The Bug You're Not Seeing (200-250 words)
The coffee scraper runs 30+ suppliers. For each product it makes an LLM call to extract structured fields: origin country, processing method, elevation, arrival date, grade. It also runs deterministic post-processors: country name standardization, continent derivation, elevation unit normalization, arrival date format validation, cost-per-lb correction.

When the LLM call fails — API quota, network timeout, rate limit — the scraper catches the error, logs it, and returns early. The deterministic steps never run.

This is the bug. And it's invisible in the logs.

The error log shows: "Unified extraction failed: API quota exceeded." What it doesn't show: country normalization never ran; continent was never derived; a raw "1850ft" elevation stayed as feet instead of being converted to MASL. The product made it into the database in a partially degraded state that looks identical to a product where nothing at all was extracted.

One visible failure hid a second, silent one.

### Why Sequential Thinking Breaks Hybrid Pipelines (250-300 words)
Most pipeline developers think in chains: step 1 → step 2 → step 3. If step 2 fails, step 3 doesn't run, because we assume each step feeds the next. For a purely sequential pipeline where each step genuinely needs the prior one's output, this is correct. If you can't parse the HTML, you can't extract the product name. If you can't extract the product name, you can't call the LLM.

But hybrid AI+deterministic pipelines break this assumption because the deterministic steps often don't need the AI output. Country normalization operates on the raw product title. Continent derivation needs only a valid country name — which deterministic extraction already got from the title, before the LLM was ever called. Elevation unit conversion needs only a number and a unit string from raw scraped text.

The dependency graph was never mapped. The pipeline *looks* sequential, but the actual data dependencies are not. Several "downstream" steps are actually independent of the AI step entirely.

This distinction matters because LLM calls are the unreliable part. They're rate-limited, latency-sensitive, and occasionally hallucinate. They're soft dependencies by nature, even when they sit in the middle of a critical path. When you model the whole pipeline as a chain, you've accidentally promoted a soft dependency to a hard one — and everything downstream inherits that brittleness.

### The Fix Is Structural, Not a Patch (300-350 words)
The fix isn't retry logic or better error messages. It's restructuring the catch block to decouple deterministic work from AI success.

In `unifiedCleaner.ts`, the current implementation does exactly this:

```typescript
try {
  await this.runUnifiedExtraction(data, result, sourceName);
} catch (error) {
  const msg = `Unified extraction failed: ${formatError(error)}`;
  result.errors.push(msg);
  // Still run deterministic post-processors (continent derivation,
  // grade validation, country normalization) even when extraction
  // fails — these don't need the API.
  this.applyPostProcessors(result);
}
```

The comment in the code is doing real work: it names the invariant. Deterministic steps run unconditionally. The `applyPostProcessors()` call appears in both the success path and the catch path.

`postProcessors.ts` accepts `Record<string, unknown>` — raw or partial data. It doesn't care whether the LLM filled in the fields. It runs country standardization on whatever country string is present (even one extracted deterministically from the title). It derives continent from country. It corrects `cost_lb` if it looks like a per-bag total rather than a per-lb price. It validates and normalizes arrival date format.

None of this requires the LLM. It never did.

The structural pattern: identify which steps require AI output and which require only raw input (or each other). Make the former conditional on AI success. Make the latter unconditional. In practice, this usually means two explicit blocks: AI extraction in a try/catch, deterministic post-processing in a finally or as a separate top-level call that always runs.

A more defensive version: `finally { this.applyPostProcessors(result); }` — guarantees execution regardless of how extraction exits. But even the current catch pattern works if it's consistently applied.

### Map Dependencies, Not Steps (200-250 words)
The broader rewrite: stop modeling pipelines as ordered step lists. Model them as dependency graphs.

For each processing step, ask one question: "What does this step actually need as input?" Not "what runs before it" — what data does it genuinely require?

- Steps that require only raw scraped input: always run
- Steps that require LLM output: conditional on LLM success
- Steps that require both: partial degradation — run what you can with what you have, flag the gap

AWS Well-Architected puts it this way: classify every dependency as critical (the request fails without it) or non-critical (degrade gracefully). This is distributed systems thinking that applies equally to single-process pipelines. The LLM extraction step is non-critical for deterministic normalization. Treating it as critical was the architectural error.

This reframe also improves observability. When you track success at the step level rather than the pipeline level, you can distinguish "AI extraction failed but deterministic steps succeeded" from "everything failed." The first is an enrichment gap. The second is a data problem. They're not the same and shouldn't look identical in your logs.

### What This Means as AI Enters More Pipelines (200-250 words)
This pattern will matter more as AI steps embed deeper into production pipelines. The standard advice — "wrap AI calls in try/catch" — is necessary but not sufficient. The catch block is where the architectural decision lives: what still runs when the AI doesn't?

The right mental model for hybrid pipelines: treat the LLM extraction layer as a best-effort enrichment pass. It adds structured fields from unstructured text. When it succeeds, great. When it doesn't, the raw data is still there and the deterministic work that doesn't need enrichment should proceed.

Practically: audit your catch blocks. If you're logging the error and returning, check what other processing you're skipping. Any step in that remaining work that doesn't actually require the failed step's output is silently blocked for no reason. You've made a soft failure cascade into a hard one.

The unit confusion class mentioned in the idea note is a useful concrete example: if a scraper extracted "1850 ft" from the raw title and your normalizer converts it to MASL — but the normalizer only runs in the LLM success path — then every quota outage silently populates the database with feet-denominated elevations. The unit error is real. The root cause is the dependency model.

Build pipelines where deterministic work fails loudly on its own merits. Don't let AI failures carry it.
