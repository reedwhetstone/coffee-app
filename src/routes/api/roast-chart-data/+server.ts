import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// Raw chart data structure from optimized database functions
export interface RawChartData {
	rawData: Array<{
		data_type: 'temperature' | 'milestone' | 'control';
		time_milliseconds: number; // Standardized on milliseconds
		field_name: string;
		value_numeric: number | null;
		event_string: string | null;
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

export const GET: RequestHandler = async ({ url, locals }) => {
	const startTime = performance.now();
	const { safeGetSession, supabase } = locals;
	const { user } = await safeGetSession();

	if (!user) {
		return json({ error: 'Authentication required' }, { status: 401 });
	}

	const roastId = url.searchParams.get('roastId');
	if (!roastId || isNaN(parseInt(roastId))) {
		return json({ error: 'Valid roastId parameter required' }, { status: 400 });
	}

	const roastIdNum = parseInt(roastId);

	try {
		console.log(`=== RAW CHART DATA API: Roast ${roastIdNum} ===`);
		
		const dbQueryStart = performance.now();
		
		// Use time-based adaptive sampling - single RPC call replaces 4+ previous queries
		const [{ data: chartData, error: dataError }, { data: metadata, error: metaError }] = 
			await Promise.all([
				supabase.rpc('get_chart_data_sampled', { 
					roast_id_param: roastIdNum, 
					target_points: 400 // Stay under 1,000 row limit
				}),
				supabase.rpc('get_chart_metadata', { roast_id_param: roastIdNum })
			]);

		const dbQueryTime = performance.now() - dbQueryStart;

		if (dataError || metaError) {
			console.error('Database query error:', { dataError, metaError });
			return json({ error: 'Failed to fetch chart data' }, { status: 500 });
		}

		const processingStart = performance.now();
		
		// Database now returns time_milliseconds directly - no conversion needed
		const responseData: RawChartData = {
			rawData: chartData || [],
			metadata: {
				dataPoints: metadata?.[0]?.total_data_points || 0,
				roastDurationMinutes: metadata?.[0]?.roast_duration_minutes || 0,
				sampleRate: Math.ceil((metadata?.[0]?.total_data_points || 0) / 400), // Calculate from actual data
				timeRange: [
					metadata?.[0]?.time_min_ms || 0, // Keep in milliseconds
					metadata?.[0]?.time_max_ms || 0  // Keep in milliseconds
				],
				tempRange: [metadata?.[0]?.temp_min || 0, metadata?.[0]?.temp_max || 500],
				rorRange: [metadata?.[0]?.ror_min || 0, metadata?.[0]?.ror_max || 50],
				chargeTime: metadata?.[0]?.charge_time_ms || 0, // Keep in milliseconds
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

		console.log(`Raw chart data API results for ${roastIdNum}:`, {
			rawRows: chartData?.length || 0,
			dbQueryTime: `${dbQueryTime.toFixed(2)}ms`,
			processingTime: `${processingTime.toFixed(2)}ms`,
			totalApiTime: `${totalApiTime.toFixed(2)}ms`,
			estimatedSampleRate: responseData.metadata.sampleRate,
			temperatureRange: responseData.metadata.tempRange,
			timeRange: responseData.metadata.timeRange,
			chargeTime: responseData.metadata.chargeTime
		});

		return json(responseData);

	} catch (error) {
		console.error('Error fetching raw chart data:', error);
		return json({ error: 'Failed to process chart data' }, { status: 500 });
	}
};
