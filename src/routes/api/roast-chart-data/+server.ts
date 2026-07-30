import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createParchmentServerClient } from '$lib/server/parchmentClient';
import { unwrapParchment } from '$lib/services/tools/parchment';

// Raw chart data structure from optimized database functions
export interface RawChartData {
	rawData: Array<{
		data_type: string;
		time_milliseconds: number; // Standardized on milliseconds
		field_name: string;
		value_numeric: number;
		event_string: string;
		category: string;
		subcategory: string;
	}>;
	metadata: {
		dataPoints: number;
		roastDurationMinutes: number;
		sampleRate: number;
		timeRange: [number, number]; // [min, max] in milliseconds
		tempRange: [number, number]; // [min, max] in °F
		rorRange: [number, number]; // [min, max] in °F/min
		chargeTime: number; // In milliseconds
		performanceMetrics: {
			dbQueryTime: number;
			processingTime: number;
			totalApiTime: number;
		};
	};
}

export const GET: RequestHandler = async (event) => {
	const startTime = performance.now();
	const { url, locals } = event;

	if (!locals.session || !locals.user) {
		return json({ error: 'Authentication required' }, { status: 401 });
	}

	const roastId = url.searchParams.get('roastId');
	if (!roastId || isNaN(parseInt(roastId))) {
		return json({ error: 'Valid roastId parameter required' }, { status: 400 });
	}

	const roastIdNum = parseInt(roastId);

	try {
		const dbQueryStart = performance.now();
		const client = await createParchmentServerClient(event, { mode: 'session' });
		const data = unwrapParchment(
			await client.roasts.chartData(String(roastIdNum), { target_points: 400 })
		).data;
		const dbQueryTime = performance.now() - dbQueryStart;
		const processingStart = performance.now();
		const metadata = data.metadata;

		const responseData: RawChartData = {
			rawData: data.points,
			metadata: {
				dataPoints: metadata.total_data_points,
				roastDurationMinutes: metadata.roast_duration_minutes ?? 0,
				sampleRate: Math.ceil(metadata.total_data_points / metadata.target_points),
				timeRange: [metadata.time_min_ms ?? 0, metadata.time_max_ms ?? 0],
				tempRange: [metadata.temp_min ?? 0, metadata.temp_max ?? 500],
				rorRange: [metadata.ror_min ?? 0, metadata.ror_max ?? 50],
				chargeTime: metadata.charge_time_ms ?? 0,
				performanceMetrics: {
					dbQueryTime,
					processingTime: 0,
					totalApiTime: 0
				}
			}
		};

		const processingTime = performance.now() - processingStart;
		const totalApiTime = performance.now() - startTime;

		// Add performance metrics
		responseData.metadata.performanceMetrics.processingTime = processingTime;
		responseData.metadata.performanceMetrics.totalApiTime = totalApiTime;

		return json(responseData);
	} catch (error) {
		console.error('Error fetching roast chart data from Parchment:', error);
		return json({ error: 'Failed to process chart data' }, { status: 500 });
	}
};
