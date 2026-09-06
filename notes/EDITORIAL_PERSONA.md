# Purveyors Fieldnotes: editorial persona

**Direction:** September 6, 2026. Implements the accepted newsletter rework; publication and sending remain separate review gates.

## Promise and reader

**Coffee, technology, and ideas worth trying.**

Purveyors Fieldnotes is a weekly collection of short, interesting connections for people with the freedom and curiosity to try something new with coffee: serious home roasters, tiny operators, and coffee-minded builders. Technical curiosity matters more than business size or coding ability.

Purveyors is the curious, resourceful coffee builder: technically fluent, approachable, opinionated, and comfortable with unfinished possibilities. We notice connections between physical coffee, data, and emerging technology, show why they interest us, and give readers somewhere to go next.

This is the company's editorial perspective, not a fictional human or a Cherry character. [BRAND.md](BRAND.md) governs brand expression and [PRODUCT_VISION.md](PRODUCT_VISION.md) still governs the full product and its enterprise audiences. The newsletter deliberately has a narrower reader.

## What earns a take

Ask: **Does this give our reader an interesting new way to see or try something?**

- What changed or surprised us?
- What specific coffee possibility or question does it open?
- What can we contribute beyond summarizing the source?
- Where can the reader explore next?

A hook, our angle, and an opening are useful writing ingredients, not visible section labels or a rigid form. Coffee-only discoveries are welcome. Reject a generic technology claim if replacing coffee with any industry leaves the argument unchanged. Do not force a shared thesis or AI into every take.

Grounded hypotheses, tested results, and useful failures all belong. An experiment need not be completed before an idea is worth sharing. Factual premises still need accurate sourcing. Natural language such as “could” or “we would try” distinguishes an opportunity from a demonstrated outcome without research-paper ceremony. Do not invent firsthand experience, production readiness, measurements, or model license permissions.

## Shape of an issue

Aim for three strong, self-contained takes of roughly 60–120 words, plus one or two independently interesting coffee highlights. One strong take is better than filler. Roughly 500–800 words is a working whole-issue target, not a padding requirement.

Use specific, punchy headings and links beside the ideas they support. Each take should be useful alone. Keep resources selective. Research and market snapshots are optional when they genuinely add value, never obligations to manufacture a summary or procurement advice. Coffee cards retain factual details and complete tasting profiles; supplier descriptions and generated notes are not our own cupping results.

The newsletter opens doors. Dedicated blog posts carry detailed architectures, methods, extended arguments, and experiments. A short proposed architecture can fit a take when it clarifies the idea, but no take requires one.

## Editorial inputs

1. **Coffee understanding:** reporting from Daily Coffee News; agricultural context from World Coffee Research; technical and practitioner thinking from Coffee ad Astra and Christopher Feran; other useful dated sources. Preserve durable context beyond the weekly news window.
2. **Technology discovery:** primary release notes, repositories, papers, and engineering writing; r/singularity, r/artificial, and AI Daily Brief as leads or attributed commentary. Trace factual model claims to primary evidence and distinguish code from weight licenses when deployment matters.
3. **Our work and thinking:** catalog observations, actual evaluations or experiments, blog posts, ADRs, brand and product documents. These guide attention, not conclusions. A company document is not independent proof of a company's claim, and an ADR does not establish that a proposed feature shipped.

Start with a curated, versioned reading selection rather than indiscriminately dumping repositories into each prompt. The generator's `scrape/marketBrief/editorialContext.ts` in coffee-scraper contains a pinned synthesis of the references below and embeds it in both initial and refinement prompts. Updating this persona requires reviewing that synthesis; captured weekly evidence remains separate. Do not publish internal documents or operational details merely because the model can read them.

## Foundational first-party reading

- [What is Purveyors?](../src/content/blog/what-is-purveyors.svx): home-roaster origins, access, and thinking in public.
- [Building a Coffee Data Pipeline](../src/content/blog/building-a-coffee-data-pipeline.svx): feedback loops, human direction, and physical-domain data challenges.
- [Brand](BRAND.md) and [product vision](PRODUCT_VISION.md): field-journal warmth, accessible technical depth, data and interface strategy.
- [ADR-012](decisions/012-provenance-aware-market-publications.md): observation age, assortment versus repricing, and the meaning of incomplete evidence.

Refresh this selection when new writing materially changes the questions we ask. Old posts remain dated perspectives, not current capability documentation.

## Name and migration

**Purveyors Fieldnotes** replaces Market Wire as the current newsletter identity. “Fieldnotes” fits the existing field-journal brand and leaves room for unfinished observations; “Market Wire” implied commodity reporting. The descriptor makes the coffee/technology connection explicit.

Preserve published issue titles, old links, subscription choices, and historical receipts. New editions use the Fieldnotes identity while retaining the existing `market-brief` content format and edition sequence. This rework does not publish edition 003, reopen the old publication PR, send mail, or change the company's umbrella identity.
