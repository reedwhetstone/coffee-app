// Aggregate-only replay. Legacy provenance is era-audit annotated; see README.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {
	reconstructTrend,
	type TrendObservation
} from '../../../src/lib/components/analytics/reconstructedTrend';
const read = (name: string): TrendObservation[] =>
	JSON.parse(fs.readFileSync(new URL(`./fixtures/${name}.json`, import.meta.url), 'utf8'));
const recorded = read('published-medians'),
	legacy = read('legacy-medians');
for (const origin of [...new Set(legacy.map((r) => r.origin))]) {
	const observed = recorded.filter((r) => r.origin === origin && !r.wholesale_only);
	const result = reconstructTrend([...legacy.filter((r) => r.origin === origin), ...observed]);
	const earlier = result.filter((p) => p.kind === 'historical_estimate');
	assert(earlier.length > 0);
	assert.deepEqual(
		result.filter((p) => p.kind !== 'historical_estimate'),
		reconstructTrend(observed)
	);
	assert(earlier.every((p) => p.original === undefined));
	for (let i = 1; i < result.length; i++)
		assert.equal(+result[i].date - +result[i - 1].date, 86400000);
	const firstRecorded = result.find((p) => p.kind === 'recorded_anchor')!;
	console.log(
		JSON.stringify({
			origin,
			start: earlier[0].date.toISOString().slice(0, 10),
			baseline: earlier[0].value,
			baselineDates: earlier[0].legacyBaseline?.dates,
			firstRecorded: firstRecorded.date.toISOString().slice(0, 10),
			firstRecordedPrice: firstRecorded.value,
			modeledDays: earlier.length,
			maxModeledDailyChange: Math.abs(earlier[1].value - earlier[0].value),
			observedHistoryUnchanged: true
		})
	);
}
