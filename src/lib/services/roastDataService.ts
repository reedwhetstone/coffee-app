/**
 * Roast Data Service
 * Provides unified access to roast data from new normalized table structure
 * (roast_temperatures and roast_events)
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export interface TemperatureDataPoint {
	time_seconds: number;
	bean_temp: number | null;
	environmental_temp: number | null;
	ambient_temp: number | null;
	ror_bean_temp: number | null; // Only bean temp RoR calculated
	data_source: 'live' | 'artisan_import' | 'manual';
}

export interface RoastEvent {
	time_seconds: number;
	event_string: string;
	event_value: string | null;
	category: string;
	subcategory: string;
	user_generated: boolean;
}

export interface MilestoneEvent {
	time_seconds: number;
	event_string: string;
	temperature?: number | null; // Temperature at the time of the event
}

export interface ControlEvent {
	time_seconds: number;
	event_string: string;
	event_value: string;
}

export interface EventValueSeries {
	event_string: string;
	category: string;
	values: Array<{
		time_seconds: number;
		value: number;
	}>;
	value_range: {
		min: number;
		max: number;
		detected_scale: 'percentage' | 'decimal' | 'custom'; // 0-100, 0-10, or custom
	};
}

export interface ChartData {
	temperatures: TemperatureDataPoint[];
	milestones: MilestoneEvent[];
	controls: ControlEvent[];
	eventValueSeries: EventValueSeries[]; // New: grouped event data with value ranges
	metadata: {
		totalDataPoints: number;
		timeRange: [number, number];
		temperatureRange: [number, number];
	};
}

export class RoastDataService {
	constructor(private supabase: SupabaseClient) {}

	/**
	 * Get all temperature data for a roast
	 */
	async getTemperatureData(roastId: number): Promise<TemperatureDataPoint[]> {
		// Use stored function to sample every other temperature record by primary key
		const { data, error } = await this.supabase.rpc('get_even_temp_ids', {
			roast_id_param: roastId
		});

		if (error) {
			console.error('Error fetching temperature data:', error);
			throw new Error(`Failed to fetch temperature data: ${error.message}`);
		}

		return (data || [])
			.map((temp: any) => ({
				...temp,
				time_seconds: parseFloat(String(temp.time_seconds)) // Convert string to number
			}))
			.filter((temp: any) => !isNaN(temp.time_seconds));
	}

	/**
	 * Get milestone events for a roast
	 */
	async getMilestoneEvents(roastId: number): Promise<MilestoneEvent[]> {
		const { data, error } = await this.supabase
			.from('roast_events')
			.select('time_seconds, event_string, category, subcategory')
			.eq('roast_id', roastId)
			.eq('category', 'milestone')
			.is('event_value', null) // Milestone events have NULL values
			.order('time_seconds', { ascending: true });

		if (error) {
			console.error('Error fetching milestone events:', error);
			throw new Error(`Failed to fetch milestone events: ${error.message}`);
		}

		// Get temperatures at milestone times for chart markers
		const milestones: MilestoneEvent[] = [];
		for (const event of data || []) {
			const timeSeconds = parseFloat(String(event.time_seconds));
			if (isNaN(timeSeconds)) continue; // Skip invalid time values

			// Find temperature reading closest to this milestone time
			const { data: tempData } = await this.supabase
				.from('roast_temperatures')
				.select('bean_temp')
				.eq('roast_id', roastId)
				.gte('time_seconds', timeSeconds - 2) // Within 2 seconds
				.lte('time_seconds', timeSeconds + 2)
				.order('time_seconds', { ascending: true })
				.limit(1);

			milestones.push({
				time_seconds: timeSeconds, // Convert string to number
				event_string: event.event_string,
				temperature: tempData?.[0]?.bean_temp || null
			});
		}

		return milestones;
	}

	/**
	 * Get control events for a roast (fan, heat settings)
	 */
	async getControlEvents(roastId: number): Promise<ControlEvent[]> {
		const { data, error } = await this.supabase
			.from('roast_events')
			.select('time_seconds, event_string, event_value, category')
			.eq('roast_id', roastId)
			.in('category', ['control', 'machine'])
			.not('event_value', 'is', null)
			.order('time_seconds', { ascending: true });

		if (error) {
			console.error('Error fetching control events:', error);
			throw new Error(`Failed to fetch control events: ${error.message}`);
		}

		return (data || [])
			.filter((event) => !isNaN(parseFloat(String(event.time_seconds))))
			.map((event) => ({
				time_seconds: parseFloat(String(event.time_seconds)), // Convert string to number
				event_string: event.event_string,
				event_value: event.event_value
			}));
	}

	/**
	 * Get event value series grouped by event type with automatic range detection
	 */
	async getEventValueSeries(roastId: number): Promise<EventValueSeries[]> {
		const { data, error } = await this.supabase
			.from('roast_events')
			.select('time_seconds, event_string, event_value, category')
			.eq('roast_id', roastId)
			.not('event_value', 'is', null)
			.order('time_seconds', { ascending: true });

		if (error) {
			console.error('Error fetching event value series:', error);
			throw new Error(`Failed to fetch event value series: ${error.message}`);
		}

		// Group events by event_string
		const groupedEvents = new Map<
			string,
			Array<{ time_seconds: number; value: number; category: string }>
		>();

		for (const event of data || []) {
			const numericValue = parseFloat(event.event_value);
			if (isNaN(numericValue)) continue; // Skip non-numeric values

			const timeSeconds = parseFloat(String(event.time_seconds));
			if (isNaN(timeSeconds)) continue; // Skip invalid time values

			if (!groupedEvents.has(event.event_string)) {
				groupedEvents.set(event.event_string, []);
			}

			groupedEvents.get(event.event_string)!.push({
				time_seconds: timeSeconds, // Convert string to number
				value: numericValue,
				category: event.category
			});
		}

		// Create event value series with range detection
		const eventValueSeries: EventValueSeries[] = [];

		console.log('roastDataService.getEventValueSeries:', {
			roastId,
			rawDataCount: data?.length || 0,
			groupedEventsCount: groupedEvents.size,
			groupedEventsKeys: Array.from(groupedEvents.keys()),
			rawEventSample: data?.slice(0, 5).map((e) => ({
				time_seconds: e.time_seconds,
				event_string: e.event_string,
				event_value: e.event_value
			}))
		});

		for (const [eventString, values] of groupedEvents) {
			if (values.length === 0) continue;

			const numericValues = values.map((v) => v.value);
			const min = Math.min(...numericValues);
			const max = Math.max(...numericValues);

			// Auto-detect scale type: if any value > 11, use 0-100 scale, else use 0-10 scale
			let detected_scale: 'percentage' | 'decimal' | 'custom' = 'custom';
			const hasValueAbove11 = numericValues.some((value) => value > 11);
			if (hasValueAbove11) {
				detected_scale = 'percentage'; // 0-100 scale
			} else if (min >= 0 && max <= 10) {
				detected_scale = 'decimal'; // 0-10 scale
			}

			const series = {
				event_string: eventString,
				category: values[0].category, // Use category from first event
				values: values.map((v) => ({
					time_seconds: v.time_seconds,
					value: v.value
				})),
				value_range: {
					min,
					max,
					detected_scale
				}
			};

			console.log(`EventValueSeries for ${eventString}:`, {
				valuesCount: series.values.length,
				timeRange: [
					Math.min(...series.values.map((v) => v.time_seconds)),
					Math.max(...series.values.map((v) => v.time_seconds))
				],
				valueRange: [min, max],
				detected_scale,
				hasValueAbove11,
				sampleValues: series.values.slice(0, 3)
			});
			eventValueSeries.push(series);
		}

		console.log('Final eventValueSeries:', eventValueSeries);
		return eventValueSeries;
	}

	/**
	 * Get complete chart data for a roast
	 */
	async getChartData(roastId: number): Promise<ChartData> {
		// Fetch all data in parallel
		const [temperatures, milestones, controls, eventValueSeries] = await Promise.all([
			this.getTemperatureData(roastId),
			this.getMilestoneEvents(roastId),
			this.getControlEvents(roastId),
			this.getEventValueSeries(roastId)
		]);

		// Calculate metadata
		const timeRange: [number, number] =
			temperatures.length > 0
				? [temperatures[0].time_seconds, temperatures[temperatures.length - 1].time_seconds]
				: [0, 0];

		const allTemps = temperatures
			.flatMap((t) => [t.bean_temp, t.environmental_temp, t.ambient_temp])
			.filter((temp) => temp !== null) as number[];

		const temperatureRange: [number, number] =
			allTemps.length > 0 ? [Math.min(...allTemps), Math.max(...allTemps)] : [0, 0];

		return {
			temperatures,
			milestones,
			controls,
			eventValueSeries,
			metadata: {
				totalDataPoints: temperatures.length,
				timeRange,
				temperatureRange
			}
		};
	}

	/**
	 * Get chart data with data reduction for performance
	 * Reduces temperature data points while preserving milestone events
	 */
	async getOptimizedChartData(roastId: number, maxPoints: number = 200): Promise<ChartData> {
		const fullData = await this.getChartData(roastId);

		// If we have fewer points than the limit, return as-is
		if (fullData.temperatures.length <= maxPoints) {
			return fullData;
		}

		// Reduce temperature data points
		const step = Math.ceil(fullData.temperatures.length / maxPoints);
		const reducedTemperatures: TemperatureDataPoint[] = [];

		for (let i = 0; i < fullData.temperatures.length; i += step) {
			reducedTemperatures.push(fullData.temperatures[i]);
		}

		// Always include the last point
		const lastTemp = fullData.temperatures[fullData.temperatures.length - 1];
		if (reducedTemperatures[reducedTemperatures.length - 1] !== lastTemp) {
			reducedTemperatures.push(lastTemp);
		}

		// Preserve all milestone and control events (they're typically much fewer)
		return {
			...fullData,
			temperatures: reducedTemperatures
		};
	}

	/**
	 * Get roast chart display settings from roast_profiles
	 */
	async getChartSettings(roastId: number) {
		const { data, error } = await this.supabase
			.from('roast_profiles')
			.select('chart_x_min, chart_x_max, chart_y_min, chart_y_max, chart_z_min, chart_z_max')
			.eq('roast_id', roastId)
			.single();

		if (error) {
			console.error('Error fetching chart settings:', error);
			return null;
		}

		return {
			xRange: [data.chart_x_min, data.chart_x_max],
			yRange: [data.chart_y_min, data.chart_y_max],
			zRange: [data.chart_z_min, data.chart_z_max]
		};
	}

}

// Helper function to create service instance
export function createRoastDataService(supabase: SupabaseClient): RoastDataService {
	return new RoastDataService(supabase);
}
