// Offline empirical replay; inputs and provenance boundary documented in README.md.
import fs from 'node:fs';
import {
	reconstructTrend,
	type TrendObservation
} from '../../../src/lib/components/analytics/reconstructedTrend';
const all: TrendObservation[] = JSON.parse(
	fs.readFileSync(new URL('./fixtures/published-medians.json', import.meta.url), 'utf8')
);
for (const origin of ['Colombia', 'Guatemala', 'Indonesia', 'Brazil', 'Ethiopia']) {
	const rows = all.filter((r) => r.origin === origin && !r.wholesale_only);
	const versions = [0.5, 0.6, 0.7].map((ratio) => {
		const ps = reconstructTrend(rows, ratio);
		return {
			ratio,
			anchors: ps.filter((p) => p.kind === 'recorded_anchor').length,
			estimates: ps.filter((p) => p.kind !== 'recorded_anchor').length,
			july: ps
				.filter((p) =>
					['2026-07-10', '2026-07-11', '2026-07-15', '2026-07-16'].includes(
						p.date.toISOString().slice(0, 10)
					)
				)
				.map((p) => ({
					date: p.date.toISOString().slice(0, 10),
					value: p.value,
					kind: p.kind,
					raw: p.original?.price_median
				}))
		};
	});
	const trusted = reconstructTrend(rows).filter((p) => p.kind === 'recorded_anchor');
	const holdout = trusted
		.filter((p, i) => i % 7 === 3)
		.map((p) => p.date.toISOString().slice(0, 10));
	const hidden = reconstructTrend(rows.filter((r) => !holdout.includes(r.snapshot_date)));
	const errs = trusted
		.filter((p) => holdout.includes(p.date.toISOString().slice(0, 10)))
		.flatMap((p) => {
			const q = hidden.find((q) => +p.date === +q.date);
			return q ? [Math.abs(p.value - q.value) / p.value] : [];
		})
		.sort((a, b) => a - b);
	const blockKeys = trusted.slice(30, 71).map((p) => p.date.toISOString().slice(0, 10));
	const block = reconstructTrend(rows.filter((r) => !blockKeys.includes(r.snapshot_date)));
	const blockErrs = trusted
		.filter((p) => blockKeys.includes(p.date.toISOString().slice(0, 10)))
		.flatMap((p) => {
			const q = block.find((q) => +p.date === +q.date);
			return q ? [Math.abs(p.value - q.value) / p.value] : [];
		})
		.sort((a, b) => a - b);
	console.log(
		JSON.stringify({
			origin,
			versions,
			holdoutN: errs.length,
			holdoutMedianPct: 100 * errs[Math.floor(errs.length / 2)],
			blockN: blockErrs.length,
			blockDates: [blockKeys[0], blockKeys.at(-1)],
			blockMedianPct: 100 * blockErrs[Math.floor(blockErrs.length / 2)],
			blockMaxPct: 100 * Math.max(...blockErrs),
			holdoutMaxPct: 100 * Math.max(...errs)
		})
	);
}
