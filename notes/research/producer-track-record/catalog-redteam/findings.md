# Red-team of Reed's notes against Purveyors catalog data (2026-10-02)

Source: read-only snapshot of coffee_catalog (8,968 rows; retail = wholesale != true). Scripts a1-a4.py in this folder.

## Price: score vs origin vs identity (retail, price $2-200/lb)

- Hedonic sample (retail rows with price + score): n=1,524, 11 suppliers. Score present for only 11 of 37 retail suppliers (26 publish no score).
- R2 of log price: score alone 0.005; supplier alone 0.070; country alone 0.432; score+supplier+country 0.488.
- Within supplier+country: +1 point = +1.8% price. (CoE auctions: ~+18.7%/pt plus rank premiums, Traore et al. 2018.)
- Median $/lb by score band: <84 $10.00; 84-86 $9.35; 86-88 $9.25; 88-90 $9.35; 90+ $9.75. 10-90th pct roughly $8 to $13 in every band.
- Score calibration differs by supplier for same origin: Ethiopia mean score Sweet Maria's 91.0 (n=75, median $9.15) vs Showroom 86.4 (n=17, median $10.74). Kenya: Sweet Maria's 90.5 vs Showroom 86.6. Scores are supplier-relative.
- Identity vs story (n=3,194 priced retail, supplier+country FE): any structured identity (site/farmer/coop) +14.5% (p<0.001); +1,000 chars farm narrative +1.4% (p=0.35, n.s.). Correlational; identity correlates with microlot positioning.

## Descriptors

- Listings with cupping notes: 2,041. Fruit descriptor present in the supplier-written `cupping_notes`: washed 78%, natural 85%, honey 77%. Avg fruit terms: washed 2.3, natural 3.2. (Adding the AI-derived `ai_tasting_notes` tags would raise these to 84% / 93% / 92%; that derived signal is not supplier vocabulary and is excluded.)
- Washed fruit-descriptor share by supplier (>=20 washed listings, 14 suppliers): 17% to 98%. Supplier vocabulary dominates.

## Freshness

- Stocked retail: arrival_date populated 54%; harvest/crop year mentioned in description 32%.
- Of parseable arrival dates (590): median 3.0 months since arrival; 24.6% >12 months; 13.2% >18 months; 20% are forward-listed (future arrival).
- Showroom: arrival_date 100% populated; median 2.6 months arrival->listing for naturals, 2.2 for washed. Historical 59 washed vs 28 natural. Two Yemen naturals (arrival Dec 2022) listed Mar 2026.

## Identity and persistence

- Normalized site names (accents, Finca/Hacienda/etc. stripped): 406 distinct; cross-supplier matches rise from 10 exact to 17.
- Normalized sites seen across >300 days: 0; >180 days: 11. Site extraction is ~7 months old, so no harvest-over-harvest record exists yet.
- Ratnagiri Estate: 9 Cafe Imports lots across ~6 process variants; Hacea 3 lots scored 83.5-85.25 at $7.34-9.56. Covoya/Prime Green "Pearl Mountain Estate" resolved to Ratnagiri via site field (identity ambiguity, verify).
- Los Pirineos: 16 Ally lots, 5 varieties (Bourbon, Pacamara, SL28, Geisha, Java) x ~6 processes.
- Kayon Mountain Farm: 9 Cafe Imports lots with identical name "Shakiso - Grade 1"; cup notes range from "toffee, cooked apple" to "perfumey hibiscus, strawberry, tropical fruit". Same name, different coffee.
- No same-farm pair has scores from two suppliers, so supplier scores cannot be cross-checked today.

## Farm narrative content (1,633 stocked listings with farm notes)

- Contains elevation number 19.8%; farm size 17.6%; founding year/generation 31.0%; named variety 19.0%; number of producers 11.8%; processing duration 15.0%; price/premium paid to producer 0.1%.
- Marketing vocab (passion/dedication/family/tradition/unique...): median 0.3 hits per 100 words; 27% of narratives have >=3 hits. Narratives are mostly descriptive, not hype-heavy, but rarely checkable.

## Interpretation threads

- Process/variety experimentation has decoupled place from cup: one farm offers more flavor range than a region "should". AOC fixed methods per place, making place names predictive (memetic). Coffee place names do not predict the cup.
- Retail market prices origin and identity, barely prices score. Flat price across score bands = either quality arbitrage or buyers discounting uncalibrated scores (likely both).
- Story text not priced; identity priced. Matches Ethiopia ECX evidence.
