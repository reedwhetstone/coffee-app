# Analytics Chart Audit

_Evaluated March 22, 2026. Based on /analytics dashboard state at PR #138._

---

## 1. Origin Line Chart (Price Trends by Origin)

**What it does well:** A line chart is the correct primitive for time-series data. The color-coded multi-series design efficiently encodes 5 origins in one view, and the volume-ranked ordering means the most liquid origins dominate the visible palette. The legend with sample counts is a good touch.

**What it does poorly:** With only 1 day of snapshot data, every "line" is a single dot — the chart communicates almost nothing. At 2-3 data points it starts looking like noise rather than signal. The sparse-data fallback message is good, but it only shows on `filteredSnapshots.length === 0`; once the scraper has run once, the empty-state disappears and users see a mostly-meaningless single-point chart. There's also no visual affordance for the "data just started" context — a new visitor won't understand why all the lines are flat stubs. Another issue: the x-axis range defaults to `[new Date(), new Date()]` when there are fewer than 2 dates, which causes a degenerate scale and potentially collapsed rendering.

**Recommendation:** Add a minimum-data guard (show the empty-state until there are at least 7 snapshot dates). In the interim show a "data collection started March 21" banner inside the chart area rather than replacing it. When data accumulates, consider a "sparkline + current price" layout as the compact view and a full time-series as an expandable or PPI-gated deep view — the public dashboard doesn't need 30-day history visible on day 1.

---

## 2. Process Donut Chart (Processing Method Distribution)

**What it does well:** Donut charts are appropriate for part-of-whole comparisons with 5-8 categories, which matches the processing method set (Washed, Natural, Honey, Anaerobic, Wet Hulled, Other). The color encoding and category labels make this immediately readable. It answers the question "what share of stocked beans are washed?" instantly.

**What it does poorly:** At very small segment counts (e.g., Anaerobic = 3 beans), arc segments become too thin to interact with or distinguish. The current implementation has no minimum-arc threshold or "other" bucketing, so rare methods create visual clutter. More importantly, a donut encodes angle/arc area — humans are notably bad at comparing arcs, especially for adjacent slices of similar size. A horizontal bar chart of the same 5-6 categories would let readers compare processing shares far more accurately and would use the same screen area more efficiently.

**Recommendation:** Keep the donut as the "at a glance" quick summary (it's visually distinctive and loads fast), but add percentage labels inside or adjacent to each arc for the top 3 segments. Merge any category with < 3% share into "Other". For the PPI-gated section, replace or supplement with a sorted bar chart showing count + percentage — much more scannable for actual analysis work.

---

## 3. New Origin Range Chart (Price Ranges by Origin — PR #138)

**What it does well:** This chart directly solves the outlier problem. Showing min/max range, IQR, median, and mean in one row gives a complete picture of price distribution per origin without outliers distorting the mean. The median vs. mean comparison is particularly valuable for green coffee: Ethiopian Naturals often have a long right tail (a handful of premium competition lots) that pulls the mean $2-3 above the median — the range chart makes this skew visible. The live catalog query means it's useful on day 1 without any snapshot accumulation.

**What it could do better:** With 15 origins stacked, the chart height needs to be generous (currently h-80, which is fine). If origins are added by the scraper over time, the top-15 cutoff by sample_size means origins with fewer listings never appear — this is correct for readability but could leave out interesting niche origins. The teal diamond for mean only renders when it differs meaningfully from median (`Math.abs(xMean - xMedian) > 1px`), which at narrow scales might suppress it even when skew is real. A percentage-threshold check would be more reliable than a pixel-distance check.

**Recommendation:** The chart is production-ready as shipped. One valuable enhancement: add a second sort mode (by origin name alphabetically) toggled by clicking the Y-axis label area — buyers often search for a specific origin by name rather than by price rank. Also consider making the IQR box slightly more opaque (0.4 vs. 0.3) to improve contrast on lighter screens.

---

## 4. Overall Dashboard Layout

**What it does well:** The public stats tiles (suppliers, bean count, origins, last updated) anchor the page with credibility and give data journalists or curious buyers a quick snapshot. The gated section with blur + CTA is a reasonable conversion pattern, and the "data collection started" messaging manages expectations honestly.

**What's missing from a professional analytics dashboard:**

- **Context and benchmarks.** Absolute prices mean little without anchors. Even a simple note like "Ethiopian avg $8.20/lb vs. last month $7.80" or "vs. US market avg" would transform raw numbers into intelligence. Currently all figures are orphaned — no trend direction, no comparison baseline.
- **A single "so what" headline.** Professional dashboards lead with the insight, not the chart. Something like "Guatemalan prices dropped 12% this week — 3 suppliers updated listings" would give return visitors a reason to check back daily.
- **Search/filter within the chart panel.** When the origin list grows to 30+, users will want to search for "Colombia" or filter by process method. The current static top-15 view doesn't scale to a real market intelligence product.
- **Price alert or watchlist mechanic (PPI gated).** The most valuable thing a buyer can do with this data is get notified when a specific origin hits their target price. Even a simple "watch this origin" button seeded into the UI now would set the stage for a high-value PPI feature.
- **Last-updated freshness indicator.** The "last updated" stat tile shows the date but not the time. For a daily scraper, buyers care whether today's data is in yet — "Updated 2h ago" vs. "Updated yesterday" is meaningfully different.
- **Mobile layout.** The two-column grid (donut + range chart) collapses to single-column on mobile, which is fine, but the range chart at h-80 on a 375px screen is very tall and the y-axis labels may truncate on short origin names. Test at 375px width.

---

_Document authored by OpenClaw Bot. For questions, see PR #138._
