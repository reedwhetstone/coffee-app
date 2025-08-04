import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { ArtisanRoastData, ProcessedRoastData, MilestoneData } from '$lib/types/artisan.js';
import { validateArtisanData, validateProcessedData } from '$lib/utils/artisan-validator.js';
import { normalizeArtisanTemperatures, artisanModeToUnit } from '$lib/utils/temperature.js';
import { processAlogFile } from '$lib/utils/alog-parser.js';

// Legacy interfaces removed - now using comprehensive types from artisan.ts

// Time conversion utilities for database storage
function secondsToMySQLTime(seconds: number): string {
	const totalSeconds = Math.floor(seconds);
	const hours = Math.floor(totalSeconds / 3600);
	const minutes = Math.floor((totalSeconds % 3600) / 60);
	const secs = totalSeconds % 60;
	const milliseconds = Math.floor((seconds - totalSeconds) * 1000);
	return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${milliseconds.toString().padStart(3, '0')}`;
}

// Parse Artisan .alog or .alog.json data
function parseArtisanFile(fileContent: string, fileName: string): ArtisanRoastData {
	try {
		let data: any;

		if (fileName.toLowerCase().endsWith('.alog')) {
			// Parse Python literal syntax (.alog file)
			data = processAlogFile(fileContent);
		} else {
			// Parse standard JSON (.alog.json file)
			data = JSON.parse(fileContent);
		}

		// Validate the basic structure
		const validation = validateArtisanData(data);
		if (!validation.valid) {
			throw new Error(`Invalid Artisan file: ${validation.errors.join(', ')}`);
		}

		// Map 'mode' to 'temperature_unit' for consistency
		data.temperature_unit = artisanModeToUnit(data.mode);

		return data as ArtisanRoastData;
	} catch (error) {
		if (error instanceof Error) {
			throw error;
		}
		throw new Error('Failed to parse Artisan file');
	}
}

// Extract milestone events from Artisan timeindex array
function extractMilestones(artisanData: ArtisanRoastData): MilestoneData {
	const milestones: MilestoneData = {};
	const { timex, timeindex } = artisanData;

	// timeindex maps: [CHARGE, DRY_END, FC_START, FC_END, SC_START, SC_END, DROP, COOL]
	if (timeindex[0] > 0 && timeindex[0] < timex.length) {
		milestones.charge = timex[timeindex[0]];
	}
	if (timeindex[1] > 0 && timeindex[1] < timex.length) {
		milestones.dry_end = timex[timeindex[1]];
	}
	if (timeindex[2] > 0 && timeindex[2] < timex.length) {
		milestones.fc_start = timex[timeindex[2]];
	}
	if (timeindex[3] > 0 && timeindex[3] < timex.length) {
		milestones.fc_end = timex[timeindex[3]];
	}
	if (timeindex[4] > 0 && timeindex[4] < timex.length) {
		milestones.sc_start = timex[timeindex[4]];
	}
	if (timeindex[5] > 0 && timeindex[5] < timex.length) {
		milestones.sc_end = timex[timeindex[5]];
	}
	if (timeindex[6] > 0 && timeindex[6] < timex.length) {
		milestones.drop = timex[timeindex[6]];
	}
	if (timeindex[7] > 0 && timeindex[7] < timex.length) {
		milestones.cool = timex[timeindex[7]];
	}

	return milestones;
}

// Transform Artisan data into database format
function transformArtisanData(
	roastId: number,
	artisanData: ArtisanRoastData,
	userId: string
): ProcessedRoastData {
	const { timex, temp1, temp2, timeindex, extratemp1, extratemp2 } = artisanData;

	// Extract milestones
	const milestones = extractMilestones(artisanData);

	// Normalize temperatures to Fahrenheit for consistency
	const { beanTemps, envTemps, unit } = normalizeArtisanTemperatures(
		temp1,
		temp2,
		artisanData.temperature_unit,
		'F' // Store everything in Fahrenheit
	);

	// Extract fan/heat data from extra devices if available
	const fanData = extratemp1?.[0] || [];
	const heatData = extratemp2?.[0] || [];

	// Create temperature data for roast_temperatures table
	const temperatureData: any[] = [];

	// Add temperature data points (sample to avoid overwhelming database)
	const sampleRate = Math.max(1, Math.floor(timex.length / 1000)); // Limit to ~1000 points
	timex.forEach((timeSeconds, index) => {
		// Include every Nth point, or points with significant temperature changes
		if (
			index % sampleRate === 0 ||
			(index > 0 && Math.abs((beanTemps[index] || 0) - (beanTemps[index - 1] || 0)) > 5)
		) {
			temperatureData.push({
				roast_id: roastId,
				time_seconds: timeSeconds,
				bean_temp: beanTemps[index] || null,
				environmental_temp: envTemps[index] || null,
				ambient_temp: null, // Artisan doesn't typically have ambient temp
				data_source: 'artisan_import'
			});
		}
	});

	// Calculate phase percentages
	const chargeTime = milestones.charge || 0;
	const dropTime = milestones.drop || timex[timex.length - 1];
	const totalTime = dropTime - chargeTime;

	let dryingPercent = 0;
	let maillardPercent = 0;
	let developmentPercent = 0;

	if (totalTime > 0) {
		if (milestones.dry_end && milestones.dry_end > chargeTime) {
			dryingPercent = ((milestones.dry_end - chargeTime) / totalTime) * 100;
		}
		if (milestones.fc_start && milestones.dry_end && milestones.fc_start > milestones.dry_end) {
			maillardPercent = ((milestones.fc_start - milestones.dry_end) / totalTime) * 100;
		}
		if (milestones.fc_start && dropTime > milestones.fc_start) {
			developmentPercent = ((dropTime - milestones.fc_start) / totalTime) * 100;
		}
	}

	// Prepare profile data for roast_profiles table (matching schema columns)
	const profileData = {
		coffee_name: artisanData.title || 'Imported Roast',
		roaster_type: artisanData.roastertype || 'Unknown',
		roaster_size: artisanData.roastersize || 0,
		input_weight: artisanData.weight?.[0] || 0, // Will map to oz_in
		output_weight: artisanData.weight?.[1] || 0, // Will map to oz_out
		weight_unit: artisanData.weight?.[2] || 'g',
		temperature_unit: 'F' as const, // Always store as Fahrenheit after conversion
		roast_notes:
			`Imported from Artisan\nRoaster: ${artisanData.roastertype || 'Unknown'}\nOriginal temp unit: ${artisanData.mode}\nWeight unit: ${artisanData.weight?.[2] || 'g'}` +
			(artisanData.roastingnotes ? `\n\nNotes: ${artisanData.roastingnotes}` : ''),
		roast_uuid: crypto.randomUUID(), // Generate a unique identifier
		data_source: 'artisan_import' as const
	};

	// Create milestone events for roast_events table
	const milestoneEvents: any[] = [];
	Object.entries(milestones).forEach(([eventName, timeSeconds]) => {
		if (timeSeconds && timeSeconds > 0) {
			milestoneEvents.push({
				roast_id: roastId,
				time_seconds: timeSeconds,
				event_type: 10, // Milestone event type
				event_value: null, // Milestone events have NULL values
				event_string: eventName, // 'charge', 'dry_end', 'fc_start', etc.
				category: 'milestone',
				subcategory: 'roast_phase',
				user_generated: false,
				automatic: true,
				notes: `Imported from Artisan: ${eventName.replace('_', ' ')}`
			});
		}
	});

	// Create control events for fan/heat settings
	const controlEvents: any[] = [];
	timex.forEach((timeSeconds, index) => {
		// Sample control events to avoid overwhelming database
		if (index % sampleRate === 0) {
			if (fanData[index] !== null && fanData[index] !== undefined && fanData[index] !== 0) {
				controlEvents.push({
					roast_id: roastId,
					time_seconds: timeSeconds,
					event_type: 1, // Control event type
					event_value: fanData[index].toString(),
					event_string: 'fan_setting',
					category: 'control',
					subcategory: 'machine_setting',
					user_generated: false,
					automatic: true
				});
			}
			
			if (heatData[index] !== null && heatData[index] !== undefined && heatData[index] !== 0) {
				controlEvents.push({
					roast_id: roastId,
					time_seconds: timeSeconds,
					event_type: 1, // Control event type
					event_value: heatData[index].toString(),
					event_string: 'heat_setting',
					category: 'control',
					subcategory: 'machine_setting',
					user_generated: false,
					automatic: true
				});
			}
		}
	});

	// Create roast phases data
	const roastPhases: any[] = [];
	if (totalTime > 0) {
		// Drying phase
		if (milestones.charge && milestones.dry_end) {
			roastPhases.push({
				roast_id: roastId,
				phase_name: 'drying',
				phase_order: 1,
				start_time: milestones.charge,
				end_time: milestones.dry_end,
				duration: milestones.dry_end - milestones.charge,
				percentage_of_total: dryingPercent,
				calculation_method: 'artisan',
				confidence_score: 1.0
			});
		}

		// Maillard phase
		if (milestones.dry_end && milestones.fc_start) {
			roastPhases.push({
				roast_id: roastId,
				phase_name: 'maillard',
				phase_order: 2,
				start_time: milestones.dry_end,
				end_time: milestones.fc_start,
				duration: milestones.fc_start - milestones.dry_end,
				percentage_of_total: maillardPercent,
				calculation_method: 'artisan',
				confidence_score: 1.0
			});
		}

		// Development phase
		if (milestones.fc_start && dropTime) {
			roastPhases.push({
				roast_id: roastId,
				phase_name: 'development',
				phase_order: 3,
				start_time: milestones.fc_start,
				end_time: dropTime,
				duration: dropTime - milestones.fc_start,
				percentage_of_total: developmentPercent,
				calculation_method: 'artisan',
				confidence_score: 1.0
			});
		}
	}

	// Create extra device data
	const extraDeviceData: any[] = [];
	if (fanData && fanData.length > 0) {
		timex.forEach((timeSeconds, index) => {
			if (fanData[index] !== undefined && index % sampleRate === 0) {
				extraDeviceData.push({
					roast_id: roastId,
					device_id: 1,
					device_name: 'Fan',
					sensor_type: 'percentage',
					time_seconds: timeSeconds,
					value: fanData[index],
					unit: '%',
					quality: 'good'
				});
			}
		});
	}

	if (heatData && heatData.length > 0) {
		timex.forEach((timeSeconds, index) => {
			if (heatData[index] !== undefined && index % sampleRate === 0) {
				extraDeviceData.push({
					roast_id: roastId,
					device_id: 2,
					device_name: 'Heat',
					sensor_type: 'percentage',
					time_seconds: timeSeconds,
					value: heatData[index],
					unit: '%',
					quality: 'good'
				});
			}
		});
	}

	return {
		profileData,
		temperatureData: temperatureData.sort((a, b) => a.time_seconds - b.time_seconds),
		milestones,
		phases: {
			drying_percent: dryingPercent,
			maillard_percent: maillardPercent,
			development_percent: developmentPercent,
			total_time_seconds: totalTime
		},
		milestoneEvents,
		controlEvents,
		roastPhases
	};
}

export const POST: RequestHandler = async ({ request, locals: { supabase, safeGetSession } }) => {
	try {
		const { session, user } = await safeGetSession();
		if (!session || !user) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		const formData = await request.formData();
		const file = formData.get('file') as File;
		const roastId = formData.get('roastId') as string;

		if (!file) {
			return json({ error: 'No file provided' }, { status: 400 });
		}

		if (!roastId) {
			return json({ error: 'No roast ID provided' }, { status: 400 });
		}

		// Verify ownership and get existing roast profile data
		const { data: profile } = await supabase
			.from('roast_profiles')
			.select('user, coffee_name, batch_name, oz_in, oz_out')
			.eq('roast_id', roastId)
			.single();

		if (!profile || profile.user !== user.id) {
			return json({ error: 'Unauthorized' }, { status: 403 });
		}

		// Validate file format - accept .alog, .alog.json, or .json files
		const fileName = file.name.toLowerCase();
		if (
			!fileName.endsWith('.alog') &&
			!fileName.endsWith('.alog.json') &&
			!fileName.endsWith('.json')
		) {
			return json(
				{
					error:
						'Unsupported file format. Please use .alog files from Artisan or .alog.json/.json files.'
				},
				{ status: 400 }
			);
		}

		// Parse file content
		const fileContent = await file.text();
		const artisanData = parseArtisanFile(fileContent, file.name);

		console.log(
			`Parsed Artisan data: ${artisanData.title} (${artisanData.timex.length} data points)`
		);

		// Transform to database format
		const processedData = transformArtisanData(parseInt(roastId), artisanData, user.id);

		// Validate processed data
		const validation = validateProcessedData(processedData);
		if (!validation.valid) {
			throw new Error(`Data processing failed: ${validation.errors.join(', ')}`);
		}

		console.log(
			`Generated ${processedData.temperatureData.length} temperature points for roast ${roastId}`
		);

		// Update roast profile metadata (preserve original coffee_name + add chart ranges)
		const { error: updateError } = await supabase
			.from('roast_profiles')
			.update({
				// Keep original coffee_name, use Artisan title for title field
				coffee_name: profile.coffee_name, // Preserve original coffee
				title: artisanData.title || 'Imported Roast', // Artisan title
				batch_name: profile.batch_name, // Preserve original batch name without modification
				roaster_type: artisanData.roastertype || 'Unknown',
				roaster_size: artisanData.roastersize || 0,
				oz_in: profile.oz_in || artisanData.weight?.[0] || 0, // Preserve existing input weight, use Artisan data as fallback
				oz_out: profile.oz_out || artisanData.weight?.[1] || 0, // Preserve existing output weight, use Artisan data as fallback
				weight_in: artisanData.weight?.[0] || 0, // New weight fields for normalized structure
				weight_out: artisanData.weight?.[1] || 0,
				weight_unit: artisanData.weight?.[2] || 'g',
				temperature_unit: 'F', // Always store as Fahrenheit
				// Chart display settings from Artisan
				chart_x_min: (artisanData as any).xmin || null,
				chart_x_max: (artisanData as any).xmax || null,
				chart_y_min: (artisanData as any).ymin || null,
				chart_y_max: (artisanData as any).ymax || null,
				chart_z_min: (artisanData as any).zmin || null,
				chart_z_max: (artisanData as any).zmax || null,
				// Milestone data for quick access
				charge_time: processedData.milestones.charge || null,
				dry_end_time: processedData.milestones.dry_end || null,
				fc_start_time: processedData.milestones.fc_start || null,
				fc_end_time: processedData.milestones.fc_end || null,
				sc_start_time: processedData.milestones.sc_start || null,
				drop_time: processedData.milestones.drop || null,
				cool_time: processedData.milestones.cool || null,
				// Phase calculations
				dry_percent: processedData.phases.drying_percent || null,
				maillard_percent: processedData.phases.maillard_percent || null,
				development_percent: processedData.phases.development_percent || null,
				total_roast_time: processedData.phases.total_time_seconds || null,
				roast_notes:
					`Imported from Artisan\nRoaster: ${artisanData.roastertype || 'Unknown'}\nOriginal temp unit: ${artisanData.mode}\nWeight unit: ${artisanData.weight?.[2] || 'g'}` +
					(artisanData.roastingnotes ? `\n\nNotes: ${artisanData.roastingnotes}` : ''),
				roast_uuid: processedData.profileData.roast_uuid,
				data_source: 'artisan_import'
			})
			.eq('roast_id', parseInt(roastId));

		if (updateError) {
			console.error('Error updating roast profile:', updateError);
			throw updateError;
		}

		// Insert data into new table structure
		const batchSize = 100;
		
		// 1. Clear existing data for this roast
		console.log('Clearing existing imported data...');
		await supabase
			.from('roast_temperatures')
			.delete()
			.eq('roast_id', parseInt(roastId))
			.eq('data_source', 'artisan_import');
			
		await supabase
			.from('roast_events')
			.delete()
			.eq('roast_id', parseInt(roastId))
			.in('category', ['milestone', 'control', 'machine']);
		
		// 2. Insert temperature data to roast_temperatures table
		console.log(`Inserting ${processedData.temperatureData.length} temperature points...`);
		for (let i = 0; i < processedData.temperatureData.length; i += batchSize) {
			const batch = processedData.temperatureData.slice(i, i + batchSize);
			const { error: tempError } = await supabase
				.from('roast_temperatures')
				.insert(batch);
			
			if (tempError) {
				console.error('Error inserting temperature batch:', tempError);
				throw tempError;
			}
		}
		
		// 3. Insert milestone events
		if (processedData.milestoneEvents.length > 0) {
			console.log(`Inserting ${processedData.milestoneEvents.length} milestone events...`);
			const { error: milestoneError } = await supabase
				.from('roast_events')
				.insert(processedData.milestoneEvents);
			
			if (milestoneError) {
				console.error('Error inserting milestone events:', milestoneError);
				throw milestoneError;
			}
		}
		
		// 4. Insert control events in batches
		if (processedData.controlEvents.length > 0) {
			console.log(`Inserting ${processedData.controlEvents.length} control events...`);
			for (let i = 0; i < processedData.controlEvents.length; i += batchSize) {
				const batch = processedData.controlEvents.slice(i, i + batchSize);
				const { error: controlError } = await supabase
					.from('roast_events')
					.insert(batch);
				
				if (controlError) {
					console.error('Error inserting control event batch:', controlError);
					throw controlError;
				}
			}
		}

		// Note: roast_phases table no longer exists, skipping phase insertion

		// Create import log entry
		const { error: logError } = await supabase.from('artisan_import_log').insert({
			user_id: user.id,
			roast_id: parseInt(roastId),
			filename: file.name,
			file_size: file.size,
			artisan_version: artisanData.version || 'Unknown',
			total_data_points: processedData.temperatureData.length,
			processing_status: 'success',
			processing_messages: [
				`Imported ${processedData.temperatureData.length} temperature points`,
				`Created ${processedData.milestoneEvents.length} milestone events`,
				`Generated ${processedData.controlEvents.length} control events`
			],
			original_data: JSON.stringify({
				title: artisanData.title,
				roaster: artisanData.roastertype,
				weight: artisanData.weight,
				temperature_unit: artisanData.mode,
				timeindex: artisanData.timeindex,
				data_points: artisanData.timex.length
			})
		});
		if (logError) {
			console.error('Error creating import log:', logError);
			// Non-critical, continue
		}

		return json({
			success: true,
			message: `Successfully imported ${processedData.temperatureData.length} data points from ${file.name}`,
			milestones: processedData.milestones,
			phases: processedData.phases,
			total_time: processedData.phases.total_time_seconds,
			temperature_unit: 'F',
			milestone_events: processedData.milestoneEvents.length,
			control_events: processedData.controlEvents.length
		});
	} catch (error) {
		console.error('Error importing Artisan file:', error);

		// Provide more specific error messages
		let errorMessage = 'Failed to import Artisan file';
		let statusCode = 500;

		if (error instanceof Error) {
			errorMessage = error.message;

			// Client errors
			if (
				error.message.includes('Invalid Artisan file') ||
				error.message.includes('Missing required field') ||
				error.message.includes('Failed to parse JSON')
			) {
				statusCode = 400;
			}
		}

		return json({ error: errorMessage }, { status: statusCode });
	}
};
