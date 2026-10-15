# Producer Identity Data Infrastructure: Wine, Finance, Coffee (research notes, as of 2026-10-02)

Research context: Purveyors.io green-coffee catalog has rich per-listing farm narrative but no persistent producer identity. These notes cover the identifier and registry infrastructure other domains built so context accumulates on durable entities, and what exists in coffee.

Method note: The Brave search provider returned repeated HTTP 429 rate-limit errors, and enveritas.org and w3.org returned Cloudflare 403 blocks. Several items were therefore taken from search snippets of the primary site instead of full page fetches. These are marked "(snippet)". Unverified items are listed under Gaps, not filled from memory.

## Wine: LWIN, Wine-Searcher, Vivino, CellarTracker (producer/wine/vintage modeling)

### Takeaway

Wine solved "same wine, many sellers" with a free, open, hierarchical identifier (LWIN). The base 7-digit code identifies the wine/label regardless of vintage, and the extensions append vintage, bottle size and pack size. Because the identity sits at the wine level rather than the offer or bottle level, prices, merchant offers and community tasting notes all accumulate on that durable entity across years and sellers. Adoption came from a dominant trading platform publishing the codes free under Creative Commons, followed by the biggest aggregator (Wine-Searcher) wiring them into search and merchant feeds.

### Cited Findings

- LWIN is free to download and "always will be" under a Creative Commons licence. Liv-ex describes it as "the most comprehensive open source database available to the industry," covering over 200,000 wines and spirits. — [Liv-ex LWIN page](https://www.liv-ex.com/lwin/)
- Liv-ex's stated value propositions: a unique code per wine "eliminating confusion caused by inconsistent naming conventions and abbreviations"; consistent display names; complementary metadata (region, colour, classification); and easier information sharing among retailers, importers and suppliers. — [Liv-ex LWIN page](https://www.liv-ex.com/lwin/)
- "Each LWIN refers to the wine itself i.e. the producer, brand or vineyard. The first six numbers of the code represent each wine's unique identifier, while the seventh number is a 'check digit' that minimises input errors. Additional information including the vintage, pack and bottle size can be appended to the LWIN in a standard format." — [Liv-ex, "LWIN – a common language for fine wine"](https://www.liv-ex.com/lwin-3/lwin-common-language-fine-wine/) (snippet); same text at [developers.liv-ex.com](https://developers.liv-ex.com/2014/10/lwin-common-language-fine-wine/) (snippet, dated 2014)
- Code hierarchy: LWIN-7 = wine/label. LWIN-11 adds vintage, LWIN-16 adds bottle size and LWIN-18 adds pack/case size. Example: LWIN-18 `123456720121200750` = "Winery name, Cabernet, 2012, 12 bottles of 750ml." — [Wine-Searcher news, Aug 2022](https://www.wine-searcher.com/m/2022/08/wine-searcher-integrates-lwin-wine-codes); example format from [Liv-ex FAQ](http://www.liv-ex.com/contact-faqs/) (snippet)
- Bottle volume in LWIN-16 is "liquid volume per bottle in millilitres, zero-padded to five digits" appended to LWIN-11. — [The Cellar Index, Apr 2026](https://thecellarindex.ai/insights/lwin-database-explained/) (snippet; secondary source)
- Wine-Searcher integrated LWIN-7/11/16/18 into its search box, merchant data feed and text API (Aug 2022). Its database then held 16 million offers. Example: LWIN 1012361 = Château Léoville Barton grand vin. Liv-ex named other adopters: Vinous, Berry Bros & Rudd and London City Bond. At that time LWIN covered "more than 125,000" wines and spirits; it is now >200,000. — [Wine-Searcher](https://www.wine-searcher.com/m/2022/08/wine-searcher-integrates-lwin-wine-codes); [Liv-ex](https://www.liv-ex.com/lwin/)
- Wine-Searcher framed LWIN as "the equivalent of an ISBN number for books." — [Wine-Searcher](https://www.wine-searcher.com/m/2022/08/wine-searcher-integrates-lwin-wine-codes)
- CellarTracker advertises "more than 13 million community and professional tasting notes," which its app listing splits into 11M community notes plus 2M professional reviews. In Sept 2024 its support docs cited "over 7.5 million user-generated reviews." Tasting notes record "how a particular wine is tasting at any given point in time," and users can log a note each time they taste a wine. — [CellarTracker home](https://www.cellartracker.com/) (snippet, Jul 2026); [App Store listing](https://apps.apple.com/us/app/cellartracker-1-wine-tracker/id6446102275) (snippet); [CellarTracker support: Tasting Notes](https://support.cellartracker.com/article/49-tasting-notes-and-ratings) (snippet); [What you can track](https://support.cellartracker.com/article/32-what-can-be-tracked) (snippet)
- Note the discrepancy: 7.5M (support doc, 2024) vs 11M community notes (app listing, 2026). These likely reflect growth plus different counting (user-generated only vs. including imports). Treat 11–13M as the current marketing figure.

### Inferences

- **Data-model lesson:** the durable entity is a vintage-independent "wine" (producer + label/cuvée), with vintage as a child entity and pack/format as a further child. In coffee, the analogue is Producer → Farm/Site → Lot (or "coffee," e.g., a named varietal/process selection that recurs) → Harvest year → Supplier offer. Purveyors' current unit (the supplier listing) sits at the leaf. Context accumulates only if listings are attached upward to durable parents.
- **Recurrence is the key unit:** in wine, the label (e.g., Léoville Barton grand vin) recurs every year. In coffee, the recurring unit is less stable: the same farm may sell different varietal/process lots each year. The nearest durable unit is therefore usually the farm/producer and sometimes a "signature lot" (e.g., farm + varietal + process), not the lot itself.
- **Adoption pattern:** the identifier won because it was free, open-licensed, carried a check digit, and was seeded by a market-maker (Liv-ex) and adopted by the largest aggregator (Wine-Searcher). A coffee analogue would need a similarly neutral, openly licensed ID that importers can put in their feeds. Purveyors, as a cross-supplier aggregator, sits structurally where Wine-Searcher sits.
- **Community notes accumulate per wine across vintages** because notes attach to the vintage child, which rolls up to the wine parent. A roaster community's cupping/roast notes could do the same if attached to Lot → Farm.

### Gaps

- Vivino's internal data model (wine vs. vintage IDs, size of database, how user label-scan matching resolves to a wine): not verified this session. Search was rate-limited.
- LWIN issuance governance (who can request a new code, turnaround, deduplication process) not verified.
- Wine-Searcher's own producer/wine ID scheme and how it maps merchant listings to wines not verified beyond LWIN integration.
- No source fetched on how LWIN handles producer-level identity (whether there is a separate producer ID) vs. wine-level only.

## Finance: LEI/GLEIF, FIGI, CUSIP, entity data vendors

### Takeaway

After 2008, regulators could not identify counterparties across markets. The G20/FSB response was a global, open, regulator-governed Legal Entity Identifier with mandatory annual re-validation, corroboration against authoritative registries, and "Level 2" parent relationships ("who owns whom"). FIGI shows the complementary design principle: permanent, never-reused, semantically meaningless IDs, with all meaning held in metadata. Identity infrastructure came first, and aggregation of risk, ownership and context was built on top.

### Cited Findings

- "In the wake of the 2008 financial crisis, regulators worldwide acknowledged their inability to identify parties to transactions across markets, products, and regions." The FSB and G20 advocated a universal LEI. At the November 2011 Cannes Summit, the G20 asked the FSB to lead. The G20 endorsed the FSB recommendations at Los Cabos (Leaders Declaration, 19 June 2012). The Regulatory Oversight Committee (ROC) charter was endorsed Nov 2012 and the ROC was established Jan 2013. GLEIF's board held its inaugural meeting 26 June 2014 in Zurich. — [GLEIF History](https://www.gleif.org/en/about/history)
- Stated purpose: the LEI would "increase the authorities' ability to evaluate systemic and emerging risk, identify trends, and take corrective steps." — [GLEIF History](https://www.gleif.org/en/about/history)
- GLEIF has extended the system with the verifiable LEI (vLEI), a digital-credential counterpart issued via "Qualified vLEI Issuers." — [GLEIF History](https://www.gleif.org/en/about/history)
- Q1 2026 scale: active LEI population passed 3 million (3.02M at quarter end, +3.4% QoQ, ~100,000 new). Total including retired LEIs exceeded 3.26M. Drivers included EU DORA, an RBI master direction (March 2026) making the LEI compulsory for all participants in RBI-regulated markets, and Brazil (+9%). — [GLEIF blog, Q1 2026](https://www.gleif.org/en/newsroom/blog/the-lei-in-numbers-active-lei-population-surpasses-3-million-in-q1-2026)
- **Freshness/trust mechanics:** the annual renewal process means entity and issuer "review and re-validate legal entity reference data at least once per year," and GLEIF publishes when each record was last verified. The overall renewal rate in Q1 2026 was 56.6% (EU 61.1%, non-EU 49.6%). — [GLEIF blog, Q1 2026](https://www.gleif.org/en/newsroom/blog/the-lei-in-numbers-active-lei-population-surpasses-3-million-in-q1-2026)
- **Corroboration:** issuers verify name, address, legal form and corporate structure "against authoritative sources listed in the GLEIF Registration Authority List." At end of Q1 2026, 87.6% of LEIs were "fully corroborated." — [GLEIF blog, Q1 2026](https://www.gleif.org/en/newsroom/blog/the-lei-in-numbers-active-lei-population-surpasses-3-million-in-q1-2026)
- **Level 2 relationships:** the LEI answers "who is who," and Level 2 data answers "who owns whom." Entities report their direct and ultimate accounting-consolidating parent. In Q1 2026, more than 3.13M registrants (99% of active) reported parent information, and 100% of new or renewed LEIs did. GLEIF also models fund relationships. — [GLEIF Level 2](https://www.gleif.org/en/lei-data/access-and-use-lei-data/level-2-data-who-owns-whom); [GLEIF blog Q1 2026](https://www.gleif.org/en/newsroom/blog/the-lei-in-numbers-active-lei-population-surpasses-3-million-in-q1-2026)
- GLEIF Concatenated (golden copy) files are freely downloadable. The relationship file had 665,902 records (search snippet, file dated around Aug 2026). — [GLEIF Concatenated Files](https://www.gleif.org/en/lei-data/gleif-concatenated-file/download-the-concatenated-file) (snippet)
- **FIGI:** a 12-character alphanumeric, randomly generated ID under the Object Management Group standard. It is permanent: "Once a FIGI is assigned, it never changes… If the financial instrument… ceases to exist, the FIGI… is retired and never reused, but still accessible." It is semantically meaningless: "The FIGI code itself contains no information about the instrument… All semantically meaningful data… is captured through Metadata." Structure: characters 1–2 identify the certified provider that minted it; character 3 is always "G"; characters 4–11 are random, with no vowels; character 12 is a check digit. FIGI is open data with an MIT open-source declaration embedded, and it models multiple "functional contexts" of the same instrument (e.g., the same obligation listed on multiple exchanges). — [OpenFIGI Overview](https://www.openfigi.com/about/overview)

### Inferences

- **Design principles directly transferable to coffee producer IDs:**
  1. Opaque, permanent, never-reused IDs (FIGI). Don't encode country or farm name in the ID, because names change and get misspelled. Keep meaning in metadata.
  2. Retire IDs instead of deleting them, so a sold-out lot keeps a resolvable ID and stays "retired but accessible." This directly addresses Purveyors' "lots vanish when sold out" problem.
  3. Separate "who is who" (Level 1 entity) from "who relates to whom" (Level 2 relationships). In coffee, a farm-belongs-to-cooperative or lot-processed-at-washing-station edge is the analogue of a parent relationship.
  4. Record-level freshness and corroboration status, e.g., `last_verified_at` and `corroboration_level` (self-reported vs. verified against an authoritative source), per GLEIF's renewal and corroboration model.
  5. Multiple contexts for one entity (FIGI): the same lot offered by three importers is one lot with three offers, not three lots.
- **"Identity first, context second":** the LEI's justification was explicitly about aggregating exposures across fragmented systems. That maps onto aggregating one farm's narrative, scores, prices and certifications across ~45 suppliers.

### Gaps

- CUSIP (CUSIP Global Services/FactSet ownership, licensing fees, contrast with open FIGI): not fetched this session.
- Bloomberg/FactSet entity data products (FactSet Entity/Symbology, Bloomberg entity IDs) and how they link news, filings, ESG and supply chain relationships to entities: not verified this session. Only general knowledge exists, which is excluded per the no-memory-fill rule.
- No primary source fetched quantifying that entity identity enabled downstream context products (e.g., supply-chain relationship datasets keyed on entity IDs).

## Coffee: identity and traceability infrastructure that exists or is emerging

### Takeaway

No open, cross-industry producer registry exists in coffee. What exists:

- a regulatory forcing function (EUDR) requiring plot-level geolocation, which applies from 30 Dec 2026 for large/medium operators and was confirmed with no third delay;
- proprietary farm datasets held by assurance and traceability vendors (Enveritas, Agridence/Farmer Connect, Cropster Origin);
- marketplace producer profiles (Algrano);
- a sustainability-indicator standard (GCP Coffee Data Standard) that defines metrics, not identity;
- competition records (Cup of Excellence) that are traceable to farm and micro-lot but published as event results rather than as a registry.

The EUDR's due-diligence statement (DDS) reference number is the closest thing to a mandated shared identifier, but it identifies a shipment declaration, not a producer.

### Cited Findings

**EUDR (Regulation (EU) 2023/1115): current status**

- Regulation (EU) 2025/2650 (published Dec 2025) postponed application. Large operators must comply with main obligations from **30 December 2026**, and natural persons and micro/small enterprises from **30 June 2027**. Downstream operators and traders of all sizes are also on the 30 Dec 2026 date, as are micro/small enterprises for products in the EUTR annex. — [EU Access2Markets](https://trade.ec.europa.eu/access-to-markets/en/news/delay-until-december-2026-and-other-developments-implementation-eudr-regulation); [Council press release, 18 Dec 2025](https://www.consilium.europa.eu/en/press/press-releases/2025/12/18/deforestation-council-signs-off-targeted-revision-to-simplify-and-postpone-the-regulation/) (snippet)
- Delay history: entry into force 29 June 2023, with original application 30 Dec 2024 (large/medium) and 30 Jun 2025 (micro/small). First delay was Regulation (EU) 2024/3234 (published 23 Dec 2024), moving the dates to 30 Dec 2025 and 30 Jun 2026. Second delay: Parliament voted 11 Dec 2025, Council signed off 18 Dec 2025, and Regulation (EU) 2025/2650 of 19 Dec 2025 moved the dates to 30 Dec 2026 and 30 Jun 2027. — [myDPP, Aug 2026](https://mydpp.app/en/knowledge/eudr-delay-current-status-and-deadlines) (secondary; consistent with the EU sources above)
- **No third delay:** co-legislators required a Commission simplification report by 30 April 2026. The package arrived in May 2026 and confirmed the 30 Dec 2026 date for large and medium companies "without further delay." — [Herbert Smith Freehills Kramer (hlc.com)](https://www.hlc.com/en/publications/eu-deforestation-regulation-commission-publishes-simplification-package-ahead-of-december-2026) (snippet); [myDPP](https://mydpp.app/en/knowledge/eudr-delay-current-status-and-deadlines); [Global ELR, May 2026](https://www.globalelr.com/2026/05/european-commission-releases-new-eu-deforestation-regulation-measures/) (snippet)
- myDPP also lists "products newly brought into scope in July 2026" applying from 30 Dec 2027. This is **not verified** against an EU primary source; see Gaps.
- **Substantive changes in 2025/2650:** only the operator first placing product on the EU market files a DDS. Downstream operators and traders keep the reference number of the initial declaration instead of filing their own. A new "downstream operator" category is created. "Micro or small primary operators" in low-risk countries file a single simplified declaration (new Annex III). All operators retain supplier and customer details for 5 years. — [EU Access2Markets](https://trade.ec.europa.eu/access-to-markets/en/news/delay-until-december-2026-and-other-developments-implementation-eudr-regulation)
- **Unchanged:** the 31 Dec 2020 deforestation cut-off; geolocation ("Whoever files a DDS needs the coordinates of all plots where the commodities were produced"); the seven commodities including coffee; and penalties of at least 4% of EU turnover. — [myDPP](https://mydpp.app/en/knowledge/eudr-delay-current-status-and-deadlines)
- Geolocation format, as described by an assurance provider: GPS points per production plot, or polygons where the plot is larger than 4 hectares. — [Enveritas EUDR page](https://www.enveritas.org/eudr/) (snippet)
- Scale challenge: Ethiopia has "over 5 million smallholder coffee farming households and millions of small, fragmented plots," and many farmers own multiple non-contiguous plots, each requiring separate geolocation. — [Ethio Coffee, Mar 2026](https://www.ethiocoffee.co/insights/eu-deforestation-regulation-ethiopian-coffee-compliance) (snippet; industry blog)

**Enveritas**

- Nonprofit sustainability assurance for coffee and cocoa. It visits "more than 100,000 farms across more than 31 countries in Asia, Africa, and Latin America" each year. — [Enveritas About](https://www.enveritas.org/about/) (snippet)
- It identifies farms using satellite imagery and machine learning. Peet's reports that Enveritas visits roughly 20,000 farms annually in Peet's supply chains alone. — [Peet's partner spotlight, Apr 2025](https://www.peets.com/blogs/peets/partner-spotlight-enveritas) (snippet)
- Its EUDR approach uses "genuinely high-resolution satellite imagery (0.5 m), combined with AI and extensive ground truthing." — [Enveritas for business: EUDR](https://www.enveritas.org/for-business/eudr/) (snippet; page returned Cloudflare 403 on fetch)

**Farmer Connect / Thank My Farmer (blockchain attempt) → Agridence**

- Announced at CES on 6 Jan 2020: Farmer Connect, a traceability platform "powered by IBM Blockchain," launched the consumer app "Thank My Farmer." Development partners were Beyers Koffie, FNC (Colombian Coffee Growers Federation), ITOCHU, JDE, J.M. Smucker, Rabobank, RGC Coffee, Volcafe, Sucafina and Yara. The stated problem: each supply-chain participant "tracks only their small segment… each uses its own system to log data," so product information is fragmented. — [PR Newswire / IBM, 6 Jan 2020](https://www.prnewswire.com/news-releases/farmer-connect-uses-ibm-blockchain-to-bridge-the-gap-between-consumers-and-smallholder-coffee-farmers-300981149.html)
- **Outcome:** in Aug 2025 Singapore-based Agridence acquired Farmer Connect (Geneva). The combined platform is positioned on EUDR compliance (mapping, deforestation-risk monitoring, ESG reporting) across coffee, cocoa and palm. — [Food Ingredients First, 20 Aug 2025](https://www.foodingredientsfirst.com/news/agridence-farmer-connect-acquisition.html); [Baker McKenzie](https://www.bakermckenzie.com/en/newsroom/2025/08/agridence-acquires-farmer-connect) (snippet)
- As of 2 Oct 2026, farmerconnect.com redirects to agridence.com, which markets "supply chain traceability platform for EUDR & PPWR compliance… file DDS to EU TRACES." Customer logos include Beyers, Sucafina, Segafredo and Itochu. — direct fetch of [farmerconnect.com → agridence.com](https://agridence.com/)

**Cropster**

- Cropster Origin (producer/mill/exporter software) "integrates data and facilitates green inventory, samples, and quality management," covering cherry to customer. — [Cropster Origin](https://www.cropster.com/products/origin/) (snippet)
- Origin lot records can "highlight the information that tells the producer's story, links to information about the producing farms and fields." — [Engineering for Change product profile](https://www.engineeringforchange.org/solutions/product/cropster-origin/) (snippet; secondary)
- Origin features include tracking input/output details "as required by any regulators/government bodies." — [Cropster Origin features](https://cropster.com/products/origin/features) (snippet)

**Algrano**

- Swiss direct-trade green coffee marketplace, launched 2015. Producers and buyers "create their own verified profiles and tell their own stories." By 2023 it served "hundreds of roasters in 30 European countries" and launched in the US in April 2023. — [Daily Coffee News, Apr 2023](https://dailycoffeenews.com/2023/04/10/direct-trade-green-coffee-platform-algrano-makes-us-launch/)
- 2015 example: the APAS association (40 members, Serra da Mantiqueira, Brazil) created farm profiles on Algrano. — [Daily Coffee News, Jun 2015](https://dailycoffeenews.com/2015/06/15/meet-algrano-a-tech-based-platform-connecting-roasters-and-producers/) (snippet)

**Global Coffee Platform: Coffee Data Standard**

- Operationalizes 15 common farm-level sustainability indicators. Economic: profit, yield, cost of production, price, sustainable purchases. Social: poverty, wages, child labour, hunger, labour practices. Environmental: forest/ecosystem protection, fertilizer, water, pest control, soil. It provides metrics and data-quality requirements. — [GCP Coffee Data Standard](https://www.globalcoffeeplatform.org/our-work/tools/coffee-data-standard/)
- It was developed iteratively in 2017–2018, with an initial draft in November 2018. It builds on the "reference framework for first-mile-farm data" (farm-level-data-standard). It is used as a foundation for the "Delta Project" with GCP, ICO, Better Cotton Initiative and ICAC. — [Data Standard governance](http://datastandard.globalcoffeeplatform.org/en/latest/governance.html) (snippet); [about](http://datastandard.globalcoffeeplatform.org/en/latest/about.html) (snippet); [GCP](https://www.globalcoffeeplatform.org/our-work/tools/coffee-data-standard/) (snippet)

**Cup of Excellence (Alliance for Coffee Excellence)**

- Thousands of coffees are submitted each year. A 300-entry competition yields around 9,000 analysed cups, with each Top-10 coffee cupped at least 120 times. Samples are blind-coded, and "each lot is documented through the entire process so that winning coffees are traceable to the farm and exact micro-lot." — [ACE Auction Results](https://allianceforcoffeeexcellence.org/competition-auction-results/)

### Inferences

- **EUDR creates plot geolocation, not producer identity.** EU importers will hold plot coordinates and DDS reference numbers from 30 Dec 2026, but those sit in private compliance systems (Agridence, Enveritas and others) and in EU TRACES. They are not published. A DDS reference identifies a declaration and shipment, not a durable farm. Still, EUDR makes it far more likely that importers have a structured farm/plot record per lot, which Purveyors could ask suppliers to expose (e.g., a farm/plot ID or a hashed geolocation) in feeds.
- **2025/2650 weakens downstream data flow.** Downstream operators only retain the reference number, and onward transmission is not required. Roasters buying from EU importers may therefore receive less origin data than under the original text, not more. For US-focused Purveyors suppliers, EUDR has an indirect effect only.
- **The blockchain attempt pivoted to compliance SaaS.** Farmer Connect's IBM-blockchain consumer-traceability framing (2020) ended in acquisition by a compliance platform (2025). The durable value was mapping and compliance data, not the ledger. This is evidence that the bottleneck is entity data capture and matching, not tamper-proofing.
- **No neutral, open producer registry exists in coffee.** Each actor holds a proprietary silo: Enveritas (100k+ farms/yr, satellite-identified), Cropster Origin (mill/exporter lot records), Algrano (self-made producer profiles) and CoE (farm + micro-lot per competition). There is an opening for an LWIN-like open ID, and an aggregator (Purveyors) is structurally the Wine-Searcher of this market.
- The GCP standard is a model for **attribute** standardization (indicators and metrics), not identity. It could inform which farm-level fields to model, but it gives no ID scheme.

### Gaps

- **Coffee Quality Institute (CQI) database:** no source fetched this session on whether CQI's Q-grading database or any public CQI dataset exposes producer and farm identity. Unverified.
- **ICO producer registries / any open national farm registries:** not verified. Colombia's FNC SICA farm registry and Costa Rica ICAFE registries are known to exist but were not sourced this session.
- **CoE producer records as data:** no fetched source confirms whether ACE publishes a structured, queryable historical farm database or only per-competition result pages.
- **Enveritas data access:** whether farm-level data is licensable or shared with third parties is not verified (site blocked).
- **Cropster's producer-facing "Cropster Hub"/marketplace product and its producer data model:** not verified.
- **IBM Food Trust status** and quantitative results of blockchain coffee pilots (number of farms or lots traced, consumer usage of Thank My Farmer) were not found. Searches returned only general case studies.
- **The myDPP claim** about "products newly brought into scope in July 2026 → 30 Dec 2027" was not verified against EU primary text.
- **The May 2026 Commission simplification package:** exact contents (e.g., any change to geolocation for low-risk countries) not fetched from a Commission primary source. Only secondary summaries were used.

## Entity resolution for messy producer names and the producer → farm/site → lot → harvest graph

### Takeaway

No coffee-specific entity-resolution standard or published practice was found this session. The transferable patterns come from the finance and wine identifiers above: opaque permanent IDs, alias tables, separated relationship records, and a hierarchy with vintage/harvest as a child of a durable parent. Coffee adds a non-tree hierarchy problem: one lot can be a blend from many smallholders at a washing station or cooperative.

### Cited Findings

- LWIN exists precisely to remove "confusion caused by inconsistent naming conventions and abbreviations" by mapping all name variants to one code. — [Liv-ex LWIN](https://www.liv-ex.com/lwin/)
- FIGI explicitly models "multiple relationships between different functional contexts… of the same instrument," for example one obligation versus that obligation on multiple exchanges. — [OpenFIGI](https://www.openfigi.com/about/overview)
- GLEIF Level 2 models direct versus ultimate parent as separate relationship records, not as attributes on the entity. — [GLEIF Level 2](https://www.gleif.org/en/lei-data/access-and-use-lei-data/level-2-data-who-owns-whom)
- EUDR requires geolocation of "all plots where the commodities were produced." Smallholders often own multiple non-contiguous plots, each requiring separate geolocation. A single washing-station lot therefore maps to many plots and producers. — [myDPP](https://mydpp.app/en/knowledge/eudr-delay-current-status-and-deadlines); [Ethio Coffee](https://www.ethiocoffee.co/insights/eu-deforestation-regulation-ethiopian-coffee-compliance) (snippet)
- Cup of Excellence lots are traceable to "the farm and exact micro-lot," a single-farm case. — [ACE](https://allianceforcoffeeexcellence.org/competition-auction-results/)

### Inferences (proposed data model; not sourced practice)

- **Entities:**
  - `Producer` (person/family/company)
  - `Organization` (cooperative, association, washing station operator, exporter)
  - `Site` (farm/finca/estate, or washing station/mill as a distinct site type), with optional geolocation (point or polygon, per the EUDR >4 ha rule)
  - `Lot` (a specific harvest-year selection)
  - `Offer` (a supplier listing of a lot, with price/date)
- **Relationships as first-class records** (GLEIF Level 2 pattern), each with source and date:
  - `Producer —owns/operates→ Site`
  - `Site —member_of→ Organization`
  - `Lot —grown_at→ Site` (one or many; many for washing-station blends)
  - `Lot —processed_at→ Site(type=washing_station)`
  - `Offer —offers→ Lot`
- **Name normalization pipeline:**
  - Unicode NFKD accent folding plus case folding.
  - Strip or normalize generic prefixes into a `site_type` attribute rather than discarding them: Finca, Hacienda, Fazenda, Sítio, Granja, Estate, Beneficio, Washing Station / "WS", Cooperativa / "Coop", Asociación.
  - Tokenize the producer's personal name separately from the farm name, since listings mix them ("Finca El Paraíso – Diego Bermúdez").
  - Block candidates on country + region (+ altitude band) before fuzzy-matching names, because generic names ("La Esperanza," "El Paraíso," "Santa Rosa") recur across countries.
  - Keep an alias table per entity with a provenance pointer to each listing that used the alias.
- **Opaque permanent IDs** (FIGI pattern): never reuse or delete. When a lot sells out, mark the Offer inactive but keep the Lot, Site and Producer. Merges create a redirect from the losing ID (a "retired but resolvable" ID).
- **Harvest as a child of a durable parent** (LWIN-11 pattern): Site/farm acts like LWIN-7, Lot/harvest-year like LWIN-11, and supplier Offer/bag-size like LWIN-16/18.

### Gaps

- No published coffee-industry entity-resolution benchmark, naming-convention study, or open alias dataset was found (search rate-limited).
- No sourced example of a knowledge-graph schema for coffee (e.g., schema.org or an ontology for coffee farms/lots) was verified this session.
- Washing-station naming conventions (e.g., Ethiopian kebele and washing-station names, which can follow the station owner, the village or the exporter) are not sourced. They need a targeted follow-up.

## What makes context data trustworthy and maintainable: provenance and evidence models

### Takeaway

Mature registries make trust explicit at the record and claim level. GLEIF tracks last-verified date, annual renewal, and corroboration against named authoritative sources. Wikidata attaches references to each individual statement. W3C PROV standardizes entity/activity/agent provenance. For Purveyors, the pattern is to store farm facts as claims carrying their source listing, extraction method, timestamp and corroboration count, rather than as overwritten fields. Producer-contributed profiles (the Algrano model) are a distinct, higher-authority but self-reported source tier.

### Cited Findings

- W3C PROV is a W3C Recommendation family (2013; editors Paul Groth and Luc Moreau) covering a data model, an XML schema, an OWL2 ontology (PROV-O) mapping to RDF, a Dublin Core mapping, and a human-readable notation. Provenance is "information about entities, activities, and people involved in producing a piece of data or thing, which can be used to form assessments about its quality, reliability or trustworthiness." The core concepts are entity, activity and agent. "An entity captures a thing in the world (in a particular state). The entity was derived from some other entity, and was generated by an activity that used other entities." — [Wikipedia: W3C PROV](<https://en.wikipedia.org/wiki/PROV_(Provenance)>) (w3.org itself returned 403; overview at [w3.org/TR/prov-overview](https://www.w3.org/TR/prov-overview/))
- Wikidata's claim-with-source pattern: most statements "should be verifiable"; references point to the specific source backing a statement, typically via "stated in (P248)" for publications or "reference URL (P854)" for websites and databases. Guidance discourages duplicate references based on the same source. References to aggregators or community-edited sites "should be removed if other sources are already present." — [Wikidata Help:Sources](https://www.wikidata.org/wiki/Help:Sources)
- GLEIF: annual re-validation, published last-verification dates, a 56.6% renewal rate, and 87.6% "fully corroborated" against Registration Authority sources (Q1 2026). — [GLEIF blog Q1 2026](https://www.gleif.org/en/newsroom/blog/the-lei-in-numbers-active-lei-population-surpasses-3-million-in-q1-2026)
- Producer-contributed model: Algrano producers "create their own verified profiles and tell their own stories." — [Daily Coffee News](https://dailycoffeenews.com/2023/04/10/direct-trade-green-coffee-platform-algrano-makes-us-launch/)
- Third-party verified model: Enveritas uses field visits (100k+ farms/yr) plus 0.5 m satellite imagery and ground truthing. — [Enveritas About](https://www.enveritas.org/about/) (snippet); [Enveritas EUDR](https://www.enveritas.org/for-business/eudr/) (snippet)

### Inferences

- **Claim model for Purveyors:** store `Claim(subject_id, predicate, value, source_offer_id, source_supplier, observed_at, extraction_method [scraped field | LLM-extracted from narrative | producer-submitted | third-party], confidence, corroboration_count)`. Derive the "current" farm profile by resolving claims; never overwrite. This mirrors PROV (claim entity, wasGeneratedBy extraction activity, wasAttributedTo supplier agent) and the Wikidata references pattern.
- **Trust tiers, analogous to GLEIF corroboration:**

  1. self-reported by producer
  2. stated by one supplier
  3. corroborated by 2 or more independent suppliers or competition records (e.g., CoE)
  4. verified by a third party (EUDR plot data, Enveritas, certifier)

  Altitude, variety and process claims that agree across 3 importers are worth surfacing as "corroborated."

- **Freshness:** keep `last_observed_at` per claim (GLEIF last-verified pattern) so stale facts, such as the owner or a farm's processing method, can be flagged.
- **Wikidata's "prefer original over aggregator" rule applies to Purveyors itself:** when a producer-contributed or importer-primary source exists, rank it above Purveyors' own scraped and extracted aggregations.
- **Maintainability:** GLEIF's renewal economics (entities pay and re-validate yearly) do not transfer to smallholders. In coffee, the cheapest maintenance signal is recurrence: each new season's listing re-observes the farm. The scraping pipeline is effectively Purveyors' "renewal" mechanism.

### Gaps

- No peer-reviewed or industry source was fetched comparing producer-contributed versus third-party-aggregated profile accuracy or maintenance cost.
- The W3C primary spec text was not fetched (403); the Wikipedia summary was used.
- No coffee-specific provenance standard was found. Whether EUDR DDS submissions or GCP data carry provenance metadata usable downstream is unverified.
