# Purveyors Fieldnotes: editorial persona

**Direction:** September 6, 2026. Implements the accepted newsletter rework; publication and sending remain separate review gates.

## Promise and reader

**Coffee, technology, and ideas worth trying.**

Purveyors Fieldnotes is a short weekly selection of worthwhile developments in coffee and technology for curious roasters and builders: serious home roasters, tiny operators, and coffee-minded people with the freedom to try something new. It preserves what is substantive in the original work, adds a considered perspective where useful, and provides a clear route to explore further. Coffee highlights remain a distinct pleasure of the issue. Technical curiosity matters more than business size or coding ability.

Purveyors is the curious, resourceful coffee builder: technically fluent, approachable, opinionated, and comfortable with unfinished possibilities. We notice connections between physical coffee, data, and emerging technology, show why they interest us, and give readers somewhere to go next.

This is the company's editorial perspective, not a fictional human or a Cherry character. [BRAND.md](BRAND.md) governs brand expression and [PRODUCT_VISION.md](PRODUCT_VISION.md) still governs the full product and its enterprise audiences. The newsletter deliberately has a narrower reader.

## Writing voice and ownership

[Reed's writing voice](https://github.com/reedwhetstone/second-brain/blob/main/VOICE.md) in the second-brain repository is the canonical authority for how writing attributed to Reed sounds. Read it alongside this persona before drafting or editing Fieldnotes. In the OpenClaw workspace, the same source is the root `VOICE.md`; use that checkout or authorized GitHub access, not a fragile relative path between repositories.

- **VOICE.md:** phrasing, rhythm, authorial perspective, and style.
- **This persona:** reader, interests, story selection, and newsletter format.
- **BRAND.md / PRODUCT_VISION.md:** company expression and product direction.

Apply voice guidance at the scale of each short take. Essay guidance about a central thesis does not require one unifying argument across an edition; the newsletter keeps its independent takes and shorter length. For a Reed-authored issue, use “I” when personal perspective adds value, or state the idea directly. The company perspective described above does not imply a collective “we” byline.

Keep the cross-repository link pointed at `main` so writers find the current authority; record the consulted commit or content hash in a saved drafting artifact when preserving a reproducible run. Do not maintain a copied voice guide here. This is an authoring reference, not a browser/runtime fetch dependency, and the link alone does not load the voice file into the generator's existing curated context. Do not require public readers to access the second-brain repository.

## What earns a take

Ask: **Will the reader learn something worthwhile from this source, with our judgment helping them understand or pursue it?**

Choose references worth encountering before developing an angle. Preserve the source's strongest finding, example, mechanism, disagreement, or practical consequence. The reference should be worth sharing even if the reader disagrees with our commentary. Valid citations alone do not make a take useful: the writing must convey what makes the cited work worth reading.

Perspective can be explanation, disagreement, a connection to another source, or a brief recommendation. Sometimes selection and juxtaposition do most of the work. No take requires an original thesis, imagined product feature, coffee agent, architecture, experiment, reader question, or procurement implication. Do not replace the source's concrete substance with a generic proposal about what we might build.

Coffee-only and technology-only items are welcome when relevant to the reader. Do not force AI into coffee reporting or a coffee application onto a technology development. Do not force a shared thesis across independent takes. Our identity guides attention, not mandatory product relevance.

Grounded hypotheses, tested results, and useful failures all belong. Factual premises need accurate sourcing; attribution separates a source's experience from our inference. Natural language such as “could” can distinguish an opportunity from a demonstrated outcome without research-paper ceremony. Do not invent firsthand experience, production readiness, measurements, or model license permissions.

## Deliberation and review

Use the thinking loop to improve selection and preserve substance, not to manufacture a defensible proposal for every reference:

1. Read for substance before selecting an angle. Record the source's strongest material and its context, including useful details that do not support an initial interpretation.
2. Judge the selection: why is this reference worth encountering, and why would this reader care?
3. Choose a treatment proportional to the material. Explanation, disagreement, connection, or a short recommendation are options, not compulsory sections.
4. Review what the draft lost. Restore omitted substance, reduce commentary that overwhelms reporting, and separate inference from established findings. Return to research or replace a weak selection when needed rather than repeatedly narrowing an uninteresting idea.

Save evidence and concise editorial decisions for traceability, but do not mistake a validation pass for reader value. Freezing a captured source preserves reproducibility; it must not prevent additional research before a revised selection is accepted.

## Shape of an issue

Aim for three strong, self-contained takes of roughly 60–120 words, plus one or two independently interesting coffee highlights. One strong take is better than filler. Roughly 500–800 words is a working whole-issue target, not a padding requirement.

Use specific, descriptive headings and links beside the ideas they support. Each take should be useful alone. Keep resources selective. Research and market snapshots are optional when they genuinely add value, never obligations to manufacture a summary or procurement advice. Coffee cards retain factual details and complete tasting profiles; supplier descriptions and generated notes are not our own cupping results.

The newsletter opens doors. Dedicated blog posts carry detailed architectures, methods, extended arguments, and experiments. A short proposed architecture can fit a take when it clarifies the idea, but no take requires one.

## Editorial inputs

1. **Coffee understanding:** reporting from Daily Coffee News; agricultural context from World Coffee Research; technical and practitioner thinking from Coffee ad Astra and Christopher Feran; other useful dated sources. Preserve durable context beyond the weekly news window.
2. **Technology discovery:** primary release notes, repositories, papers, and engineering writing; r/singularity, r/artificial, and AI Daily Brief as leads or attributed commentary. Trace factual model claims to primary evidence and distinguish code from weight licenses when deployment matters.
3. **Our work and thinking:** catalog observations, actual evaluations or experiments, blog posts, ADRs, brand and product documents. These guide attention and provide domain understanding, not conclusions or an agenda that every take must illustrate. A company document is not independent proof of a company's claim, and an ADR does not establish that a proposed feature shipped.

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
