import { json } from '@sveltejs/kit';
import { requireMemberRole } from '$lib/server/auth';
import type { RequestHandler } from './$types';

// Interface for tool input validation
interface RoastChartToolInput {
	roast_id: string;
	include_events?: boolean;
	include_temperature_data?: boolean;
}

// Tool response interface
interface RoastChartToolResponse {
	roast_profile: any;
	chart_data?: {
		temperature_data: Array<{
			time_seconds: number;
			bean_temp?: number;
			environmental_temp?: number;
			fan_setting?: number;
		}>;
		event_data: Array<{
			time_seconds: number;
			event_type: number;
			event_value?: string;
			notes?: string;
		}>;
	};
	chart_ready: boolean;
	message: string;
}

export const POST: RequestHandler = async (event) => {
	try {
		// Require member role for tool access
		const { user } = await requireMemberRole(event);
		const { supabase } = event.locals;

		const input: RoastChartToolInput = await event.request.json();

		// Validate required parameters
		const {
			roast_id,
			include_events = true,
			include_temperature_data = true
		} = input;

		if (!roast_id) {
			return json({ error: 'roast_id is required' }, { status: 400 });
		}

		// Get the roast profile first
		const { data: roastProfile, error: profileError } = await supabase
			.from('roast_profiles')
			.select(`
				*,
				green_coffee_inv!coffee_id (
					id,
					notes,
					coffee_catalog!catalog_id (
						name,
						processing,
						region,
						cultivar_detail
					)
				)
			`)
			.eq('roast_id', roast_id)
			.eq('user', user.id)
			.single();

		if (profileError || !roastProfile) {
			return json({ 
				error: 'Roast profile not found or access denied',
				roast_profile: null,
				chart_ready: false,
				message: `No roast profile found for roast_id: ${roast_id}`
			}, { status: 404 });
		}

		let chartData: {
			temperature_data: Array<{
				time_seconds: number;
				bean_temp?: number;
				environmental_temp?: number;
				fan_setting?: number;
			}>;
			event_data: Array<{
				time_seconds: number;
				event_type: number;
				event_value?: string;
				notes?: string;
			}>;
		} | undefined;
		let chartReady = false;
		let message = 'Roast profile found.';

		// Get chart data if requested
		if (include_temperature_data || include_events) {
			chartData = {
				temperature_data: [],
				event_data: []
			};

			// Get temperature/time data from profile_log
			if (include_temperature_data) {
				const { data: tempData, error: tempError } = await supabase
					.from('profile_log')
					.select('time_seconds, bean_temp, environmental_temp, fan_setting')
					.eq('roast_id', roast_id)
					.order('time_seconds', { ascending: true });

				if (!tempError && tempData && tempData.length > 0) {
					chartData.temperature_data = tempData;
					chartReady = true;
				}
			}

			// Get roast events if requested
			if (include_events) {
				const { data: eventData, error: eventError } = await supabase
					.from('roast_events')
					.select('time_seconds, event_type, event_value, notes')
					.eq('roast_id', roast_id)
					.order('time_seconds', { ascending: true });

				if (!eventError && eventData) {
					chartData.event_data = eventData;
				}
			}

			if (chartReady) {
				message = `Chart data ready for roast ${roastProfile.batch_name || roast_id}. Found ${chartData.temperature_data.length} temperature points and ${chartData.event_data.length} events.`;
			} else {
				message = `Roast profile found but no detailed chart data available for ${roastProfile.batch_name || roast_id}.`;
			}
		}

		// Prepare clean roast profile data
		const cleanProfile = {
			roast_id: roastProfile.roast_id,
			roast_name: roastProfile.roast_name,
			batch_name: roastProfile.batch_name,
			roast_date: roastProfile.roast_date,
			coffee_name: roastProfile.green_coffee_inv?.coffee_catalog?.name,
			coffee_processing: roastProfile.green_coffee_inv?.coffee_catalog?.processing,
			coffee_region: roastProfile.green_coffee_inv?.coffee_catalog?.region,
			// Key roast metrics
			oz_in: roastProfile.oz_in,
			oz_out: roastProfile.oz_out,
			total_roast_time: roastProfile.total_roast_time,
			development_percent: roastProfile.development_percent,
			fc_start_time: roastProfile.fc_start_time,
			charge_temp: roastProfile.charge_temp,
			fc_start_temp: roastProfile.fc_start_temp,
			drop_temp: roastProfile.drop_temp,
			roast_notes: roastProfile.roast_notes
		};

		const response: RoastChartToolResponse = {
			roast_profile: cleanProfile,
			chart_data: chartData,
			chart_ready: chartReady,
			message: message
		};

		return json(response);
	} catch (error) {
		console.error('Roast chart tool error:', error);
		return json(
			{ error: error instanceof Error ? error.message : 'Unknown error' },
			{ status: 500 }
		);
	}
};