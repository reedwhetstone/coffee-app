# Outline: What the Fair Use Conversation Is Missing About LLM Data Extraction

**Pillar:** coffee-data-pipeline
**Target:** 1,500-1,800 words (HARD CEILING)
**Status:** outlined (v2, reworked from cron-generated v1)
**Source material:** coffee-scraper/scrape/cleaning/extractionPrompt.ts, unifiedCleaner.ts, postProcessors.ts, llmClient.ts

## Thesis

The fair use debate is almost entirely about training: who can feed what data into a model. That's genuinely complicated. But there's a different use of LLMs that the conversation hasn't really caught up to yet: using models to consume third-party content and extract structured facts from it. Not training. Not generation. Extraction. And the interesting part is that the engineering decisions that make extracted data legally clean also make it better data for structured storage. Microsoft Research is already formalizing this pattern with Claimify. We've been doing a version of it in production for months. What does this mean for how we think about fair use going forward?

## Voice Constraints

- Curious, open-ended. Not "everyone's wrong, here's the answer." More "here's what we might be missing, and here's what it looks like in practice."
- Short and punchy. 1,500-1,800 words max.
- Data and code examples over narrative. Show the actual before/after.
- 3 citations: Feist v. Rural (legal foundation), Claimify (big tech formalizing the pattern), USCO Part 3 (the current conversation's scope)
- Purveyors as illustration, not pitch. One example, move on.

## Verification Checklist

- [ ] AI description prompt's fair-use constraints in llmClient.ts (6-word consecutive quote limit, factual focus, transformative requirement)
- [ ] Extraction prompt auto-generates from COLUMN_SCHEMA (extractionPrompt.ts)
- [ ] Max 3 API calls per product (unifiedCleaner.ts)
- [ ] Post-processors are deterministic, never LLM (postProcessors.ts)
- [ ] Feist v. Rural holding: facts not copyrightable, only creative arrangement
- [ ] Claimify: 3-stage pipeline (Selection, Disambiguation, Decomposition), 99% entailment, ACL 2025

## External References

1. **Feist Publications v. Rural Telephone Service (1991)** — Facts are not copyrightable; only creative selection/arrangement is protected. https://www.law.cornell.edu/supremecourt/text/499/340
2. **Microsoft Research: Claimify (2025)** — LLM-based claims extraction that decomposes text into atomic verifiable statements. 3-stage pipeline, 99% entailment rate. Research-framed (fact-checking), but the pattern maps directly to commercial data extraction. Accepted ACL 2025. https://www.microsoft.com/en-us/research/blog/claimify-extracting-high-quality-claims-from-language-model-outputs/
3. **U.S. Copyright Office Part 3 Report (2025)** — The current legal conversation's scope. Focuses almost entirely on training data, not extraction/consumption use cases. The gap between what's being debated and what's being done commercially is itself noteworthy. https://www.copyright.gov/ai/Copyright-and-Artificial-Intelligence-Part-3-Generative-AI-Training-Report-Pre-Publication-Version.pdf

## Structure

### The conversation so far (~300 words)

Brief, neutral setup. The fair use debate right now centers on training data. Can OpenAI train on NYT articles? Can Stability train on Getty images? The USCO Part 3 report, the lawsuits, the congressional hearings. All training-focused.

But there's a different category of LLM use that doesn't fit neatly into this debate: context consumption and extraction. Using a model not to learn from data but to read it, extract the facts, and output structured representations. This is what a growing number of data businesses actually do with LLMs every day, and the legal framework might be clearer than people assume.

Worth noting: training is genuinely complicated. Both the raw source text and cleaned factual data are valuable for training, just in different ways. They expand different parts of the neural network. The extraction question is simpler because the output is structurally different from the input.

### What claims extraction looks like in practice (~400 words)

Get concrete. Microsoft Research published Claimify (ACL 2025): a 3-stage pipeline that decomposes text into atomic, verifiable claims. Selection → Disambiguation → Decomposition. 99% of extracted claims are entailed by their source sentence. It's framed as a fact-checking tool, but the pattern is the same thing data companies do commercially.

Show the purveyors version: a supplier lists a coffee with a 500-word marketing description. What we need: country, region, elevation, processing method, variety. Structured fields, not prose. The extraction prompt auto-generates from the schema. Each extracted field is essentially an atomic claim: "This coffee is from Colombia." "The elevation is 1,600 MASL." "It's washed process." Verifiable against the source, but structurally independent from the source's expression.

After the LLM: deterministic post-processors handle consistency (country standardization, MASL formatting, date normalization). The LLM handles ambiguity. Code handles formatting. The output is clean, structured, factual data.

The key observation: the engineering that makes this data legally clean (stripping marketing language, extracting only facts, restructuring into a different format) also makes it better data. Clean factual fields are what you want in a catalog. Marketing prose in a database column is useless. Legal hygiene and data quality converge.

### Why extraction is a different legal surface (~350 words)

Not prescriptive. Curious. Feist v. Rural (1991) established that facts aren't copyrightable. Only creative arrangement is. When an LLM reads a product description and outputs "Colombia, 1600 MASL, washed" in structured JSON, those are facts in a new structure.

The four-factor fair use analysis looks different for extraction than for training:

- Purpose: highly transformative (prose in, structured data out)
- Nature: product descriptions are primarily factual (thinner protection)
- Amount: reads the full text but outputs only extracted facts
- Market effect: doesn't substitute for the original; may drive traffic to it

But be honest about the nuance. The line between "extracting a fact" and "paraphrasing expression" exists and matters. The 6-word consecutive quote cap in the purveyors prompt isn't just cautious. It's a deliberate engineering decision to stay on the facts side of that line. These are choices you make in prompts, not in legal briefs.

The USCO Part 3 report barely touches this use case. The legal conversation hasn't caught up to what practitioners are doing.

### Where this is heading (~250 words)

Claimify points toward a future where claims extraction is formalized tooling, not custom prompts. The pattern is already showing up everywhere: LlamaExtract, Unstract, Simon Willison's structured extraction work.

The interesting question: as these tools mature, does the data moat get easier or harder to build? The extraction pattern becomes commodity. But the accumulated dataset, the years of daily scraping and cleaning and enrichment, the domain-specific schema, that stays proprietary. The moat isn't the extraction. It's what you've extracted over time.

### Closing (~100 words)

Short. The fair use conversation will catch up to extraction eventually. When it does, the companies that engineered fair use constraints into their pipelines from day one will be in a better position than those that didn't. And they'll also have better data. That's the part nobody's talking about yet.
