import { json } from '@sveltejs/kit';
import type { components } from '@purveyors/sdk';
type ReferenceProfileChart = components['schemas']['ReferenceProfileChart'];
import type { RequestHandler } from './$types';
import { requireMemberRole } from '$lib/server/auth';
import { createParchmentServerClient } from '$lib/server/parchmentClient';
import { routeFailure, upstreamFailure } from '$lib/server/referenceGeneration';

// The roast chart gives the editor the charge offset and the original curve. This read
// does not create a saved reference or alter the roast.
export const GET: RequestHandler = async (event) => {
	try {
		await requireMemberRole(event);
		const id = Number(event.params.id);
		if (!Number.isSafeInteger(id) || id <= 0)
			return json({ error: 'Choose a roast' }, { status: 400 });
		const client = await createParchmentServerClient(event, {
			mode: 'session',
			signal: event.request.signal
		});
		const result = await client.roasts.chartData(String(id), { target_points: 1000 });
		if (result.error || !result.data)
			return upstreamFailure(result.error, result.response?.status, 'Unable to load this roast');
		const roast = result.data.data;
		const chart: ReferenceProfileChart = {
			temperatureUnit: roast.metadata.temperature_unit === 'C' ? 'C' : 'F',
			chargeTimeMilliseconds: roast.metadata.charge_time_ms,
			series: roast.series
				.filter(
					(series) =>
						series.kind === 'bean_temperature' ||
						series.kind === 'environmental_temperature' ||
						series.kind === 'auxiliary'
				)
				.map((series) => ({
					id: series.id,
					name: series.name,
					kind:
						series.kind === 'bean_temperature'
							? 'bean_temperature'
							: series.kind === 'environmental_temperature'
								? 'environmental_temperature'
								: 'auxiliary',
					unit: series.unit,
					deviceIndex: series.device_index,
					channel: series.channel,
					points: series.points.map((point) => ({
						timeMilliseconds: point.time_milliseconds,
						value: point.value_numeric
					}))
				})),
			events: roast.events.map((event) => ({
				timeMilliseconds: event.time_milliseconds,
				name: event.name,
				value: event.value,
				category: event.category === 'milestone' ? 'milestone' : 'control'
			}))
		};
		return json({ data: { chart, revision: roast.metadata.revision } });
	} catch (error) {
		return routeFailure(error, 'Unable to load this roast');
	}
};
