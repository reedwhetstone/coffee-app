import type { RoastProfile } from '$lib/types/component.types';

/**
 * A stand-in for the roast list route, `GET /api/roast-profiles`, over a set of roasts. It
 * applies the filters, the order, the paging, and the totals the route passes through from
 * Parchment, so a page test asserts which roasts come back for what it asked.
 */
export function roastListResponse(roasts: readonly RoastProfile[], address: string): Response {
	const params = new URL(address, 'http://localhost').searchParams;
	const q = params.get('q')?.trim() ?? '';
	// eslint-disable-next-line no-control-regex
	if (q.length > 100 || /[\u0000-\u001f\u007f]/.test(q)) {
		return Response.json({ error: 'Invalid search term', code: 'invalid_search' }, { status: 400 });
	}

	const coffeeId = params.get('coffee_id');
	const roastId = params.get('roast_id');
	const batchId = params.get('batch_id');
	const start = params.get('date_start');
	const end = params.get('date_end');
	const wholesale = params.get('is_wholesale');
	const idSearch = q.match(/^#?(\d+)$/)?.[1];
	const text = q.toLowerCase();

	const matching = roasts
		.filter((roast) => {
			const day = roast.roast_date?.slice(0, 10) ?? '';
			if (coffeeId !== null && String(roast.coffee_id) !== coffeeId) return false;
			if (roastId !== null && String(roast.roast_id) !== roastId) return false;
			if (batchId !== null && roast.batch_id !== batchId) return false;
			if (start !== null && day < start) return false;
			if (end !== null && day > end) return false;
			if (wholesale !== null && String(Boolean(roast.is_wholesale)) !== wholesale) return false;
			if (!q) return true;
			return (
				(roast.coffee_name ?? '').toLowerCase().includes(text) ||
				(roast.batch_name ?? '').toLowerCase().includes(text) ||
				(idSearch !== undefined && String(roast.roast_id) === idSearch)
			);
		})
		.sort(
			(a, b) => (b.roast_date ?? '').localeCompare(a.roast_date ?? '') || b.roast_id - a.roast_id
		);

	const losses = matching.flatMap((roast) => roast.weight_loss_percent ?? []);
	const totals = {
		roasts: matching.length,
		batches: new Set(matching.map((roast) => roast.batch_id)).size,
		average_loss_percent:
			losses.length > 0 ? losses.reduce((sum, loss) => sum + loss, 0) / losses.length : null
	};

	const limit = params.get('limit');
	const offset = Number(params.get('offset') ?? 0);
	const data = limit === null ? matching : matching.slice(offset, offset + Number(limit));
	return Response.json({ data, totals });
}

/**
 * A stand-in for the batch route, `GET /api/roast-batches`, over the same roasts: each batch
 * with every roast it holds. A batch is dated by its earliest roast, and `date_start` and
 * `date_end` keep the batches dated in that span.
 */
export function roastBatchesResponse(roasts: readonly RoastProfile[], address: string): Response {
	const params = new URL(address, 'http://localhost').searchParams;
	const start = params.get('date_start');
	const end = params.get('date_end');
	const batches = new Map<string, { id: string; batch_date: string; roast_ids: number[] }>();
	for (const roast of roasts) {
		if (!roast.batch_id) continue;
		const day = roast.roast_date?.slice(0, 10) ?? '';
		const batch = batches.get(roast.batch_id);
		if (batch) {
			batch.roast_ids.push(roast.roast_id);
			if (day < batch.batch_date) batch.batch_date = day;
		} else {
			batches.set(roast.batch_id, {
				id: roast.batch_id,
				batch_date: day,
				roast_ids: [roast.roast_id]
			});
		}
	}
	return Response.json({
		data: [...batches.values()]
			.filter(
				(batch) =>
					(start === null || batch.batch_date >= start) && (end === null || batch.batch_date <= end)
			)
			.map((batch) => ({ ...batch, roast_count: batch.roast_ids.length }))
	});
}

/** The roast list requests a fetch stand-in received, as their query parameters. */
export function roastListRequests(fetchMock: { mock: { calls: unknown[][] } }): URLSearchParams[] {
	return fetchMock.mock.calls
		.map(([input]) => String(input))
		.filter((address) => address.startsWith('/api/roast-profiles?'))
		.map((address) => new URL(address, 'http://localhost').searchParams);
}
