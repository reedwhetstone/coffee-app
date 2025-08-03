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

	// Create temperature points for profile_log
	const temperaturePoints: any[] = [];

	// Add milestone events first
	Object.entries(milestones).forEach(([event, timeSeconds]) => {
		if (timeSeconds && timeSeconds > 0) {
			const milestoneFlags = {
				start: 0,
				charge: event === 'charge' ? 1 : 0,
				maillard: event === 'dry_end' ? 1 : 0,
				fc_start: event === 'fc_start' ? 1 : 0,
				fc_rolling: 0,
				fc_end: event === 'fc_end' ? 1 : 0,
				sc_start: event === 'sc_start' ? 1 : 0,
				drop: event === 'drop' ? 1 : 0,
				end: event === 'cool' ? 1 : 0
			};

			// Find closest temperature reading
			const closestIndex = timex.findIndex((t) => Math.abs(t - timeSeconds) < 1) || 0;
			const beanTemp = beanTemps[closestIndex] || null;
			const envTemp = envTemps[closestIndex] || null;
			const fanSetting = fanData[closestIndex] || 0;
			const heatSetting = heatData[closestIndex] || 0;

			temperaturePoints.push({
				roast_id: roastId,
				user: userId,
				time_seconds: timeSeconds,
				time: secondsToMySQLTime(timeSeconds), // Also populate time field for compatibility
				bean_temp: beanTemp,
				environmental_temp: envTemp,
				fan_setting: fanSetting,
				heat_setting: heatSetting,
				data_source: 'artisan_import',
				...milestoneFlags
			});
		}
	});

	// Add temperature data points (sample to avoid overwhelming database)
	const sampleRate = Math.max(1, Math.floor(timex.length / 1000)); // Limit to ~1000 points
	timex.forEach((timeSeconds, index) => {
		// Include every Nth point, or points with significant temperature changes
		if (
			index % sampleRate === 0 ||
			(index > 0 && Math.abs((beanTemps[index] || 0) - (beanTemps[index - 1] || 0)) > 5)
		) {
			// Skip if this exact time already has a milestone event
			const hasExistingEvent = temperaturePoints.some(
				(p) => Math.abs(p.time_seconds - timeSeconds) < 0.5
			);

			if (!hasExistingEvent) {
				temperaturePoints.push({
					roast_id: roastId,
					user: userId,
					time_seconds: timeSeconds,
					time: secondsToMySQLTime(timeSeconds), // Also populate time field for compatibility
					bean_temp: beanTemps[index] || null,
					environmental_temp: envTemps[index] || null,
					fan_setting: fanData[index] || 0,
					heat_setting: heatData[index] || 0,
					data_source: 'artisan_import',
					start: 0,
					charge: 0,
					maillard: 0,
					fc_start: 0,
					fc_rolling: 0,
					fc_end: 0,
					sc_start: 0,
					drop: 0,
					end: 0
				});
			}
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

	// Create roast events data
	const roastEvents: any[] = [];
	Object.entries(milestones).forEach(([eventName, timeSeconds]) => {
		if (timeSeconds && timeSeconds > 0) {
			const eventTypeMap: { [key: string]: number } = {
				charge: 0,
				dry_end: 1,
				fc_start: 2,
				fc_end: 3,
				sc_start: 4,
				sc_end: 5,
				drop: 6,
				cool: 7
			};

			roastEvents.push({
				roast_id: roastId,
				time_seconds: timeSeconds,
				event_type: eventTypeMap[eventName] || 0,
				event_string: eventName.toUpperCase(),
				category: 'milestone',
				subcategory: 'artisan_import',
				user_generated: false,
				automatic: true,
				notes: `Imported from Artisan: ${eventName.replace('_', ' ')}`
			});
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
		temperaturePoints: temperaturePoints.sort((a, b) => a.time_seconds - b.time_seconds),
		milestones,
		phases: {
			drying_percent: dryingPercent,
			maillard_percent: maillardPercent,
			development_percent: developmentPercent,
			total_time_seconds: totalTime
		},
		roastEvents,
		roastPhases,
		extraDeviceData
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
			`Generated ${processedData.temperaturePoints.length} temperature points for roast ${roastId}`
		);

		// Clear existing logs for this roast (imported data only)
		const { error: deleteError } = await supabase
			.from('profile_log')
			.delete()
			.eq('roast_id', parseInt(roastId))
			.eq('data_source', 'artisan_import');
		if (deleteError) {
			console.error('Error deleting existing imported logs:', deleteError);
			throw deleteError;
		}

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
				charge_time: milestones.charge || null,
				dry_end_time: milestones.dry_end || null,
				fc_start_time: milestones.fc_start || null,
				fc_end_time: milestones.fc_end || null,
				sc_start_time: milestones.sc_start || null,
				drop_time: milestones.drop || null,
				cool_time: milestones.cool || null,
				// Phase calculations
				dry_percent: dryingPercent || null,
				maillard_percent: maillardPercent || null,
				development_percent: developmentPercent || null,
				total_roast_time: totalTime || null,
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

		// Insert temperature points in batches
		const batchSize = 100; // Larger batches for better performance
		let totalInserted = 0;
		for (let i = 0; i < processedData.temperaturePoints.length; i += batchSize) {
			const batch = processedData.temperaturePoints.slice(i, i + batchSize);
			console.log(`Inserting batch ${Math.floor(i / batchSize) + 1}, ${batch.length} records`);

			const { data: insertedData, error } = await supabase
				.from('profile_log')
				.insert(batch)
				.select('log_id');

			if (error) {
				console.error('Error inserting batch:', error);
				throw error;
			}

			totalInserted += insertedData?.length || 0;
			console.log(`Successfully inserted ${insertedData?.length || 0} records in this batch`);
		}

		console.log(`Total records inserted: ${totalInserted}`);
		
		// ALSO POPULATE NEW TABLE STRUCTURE
		try {
			console.log('Populating new table structure...');
			
			// 1. Clear existing temperature data for this roast
			await supabase
				.from('roast_temperatures')
				.delete()
				.eq('roast_id', parseInt(roastId))
				.eq('data_source', 'artisan_import');
			
			// 2. Insert temperature data to roast_temperatures table
			const temperatureData = processedData.temperaturePoints.map(point => ({
				roast_id: parseInt(roastId),
				time_seconds: point.time_seconds,
				bean_temp: point.bean_temp,
				environmental_temp: point.environmental_temp,
				ambient_temp: null, // Artisan doesn't typically have ambient temp
				data_source: 'artisan_import'
			}));
			
			// Insert temperature data in batches
			for (let i = 0; i < temperatureData.length; i += batchSize) {
				const batch = temperatureData.slice(i, i + batchSize);
				const { error: tempError } = await supabase
					.from('roast_temperatures')
					.insert(batch);
				
				if (tempError) {
					console.warn('Error inserting temperature batch:', tempError);
				}
			}
			
			console.log(`Inserted ${temperatureData.length} temperature points to new structure`);
			
			// 3. Clear existing events for this roast
			await supabase
				.from('roast_events')
				.delete()
				.eq('roast_id', parseInt(roastId))
				.in('category', ['milestone', 'control', 'machine']);
			
			// 4. Insert milestone events (NULL values)
			const milestoneEventData = [];
			Object.entries(milestones).forEach(([eventName, timeSeconds]) => {
				if (timeSeconds && timeSeconds > 0) {
					milestoneEventData.push({
						roast_id: parseInt(roastId),
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
			
			if (milestoneEventData.length > 0) {
				const { error: milestoneError } = await supabase
					.from('roast_events')
					.insert(milestoneEventData);
				
				if (milestoneError) {
					console.warn('Error inserting milestone events:', milestoneError);
				} else {
					console.log(`Inserted ${milestoneEventData.length} milestone events to new structure`);
				}
			}
			
			// 5. Insert control events (fan/heat settings with TEXT values)
			const controlEventData = [];
			processedData.temperaturePoints.forEach(point => {
				if (point.fan_setting !== null && point.fan_setting !== undefined && point.fan_setting !== 0) {
					controlEventData.push({
						roast_id: parseInt(roastId),
						time_seconds: point.time_seconds,
						event_type: 1, // Control event type
						event_value: point.fan_setting.toString(),
						event_string: 'fan_setting',
						category: 'control',
						subcategory: 'machine_setting',
						user_generated: false,
						automatic: true
					});
				}
				
				if (point.heat_setting !== null && point.heat_setting !== undefined && point.heat_setting !== 0) {
					controlEventData.push({
						roast_id: parseInt(roastId),
						time_seconds: point.time_seconds,
						event_type: 1, // Control event type
						event_value: point.heat_setting.toString(),
						event_string: 'heat_setting',
						category: 'control',
						subcategory: 'machine_setting',
						user_generated: false,
						automatic: true
					});
				}
			});
			
			// Insert control events in batches (may be large)
			if (controlEventData.length > 0) {
				for (let i = 0; i < controlEventData.length; i += batchSize) {
					const batch = controlEventData.slice(i, i + batchSize);
					const { error: controlError } = await supabase
						.from('roast_events')
						.insert(batch);
					
					if (controlError) {
						console.warn('Error inserting control event batch:', controlError);
					}
				}
				console.log(`Inserted ${controlEventData.length} control events to new structure`);
			}
			
			// 6. Insert machine events from Artisan extradevices if available
			if (artisanData.extradevices && artisanData.extraname1 && artisanData.extratimex) {
				const machineEventData = [];
				
				artisanData.extradevices.forEach((deviceId, deviceIndex) => {
					const deviceName = artisanData.extraname1?.[deviceIndex];
					const deviceTimes = artisanData.extratimex?.[deviceIndex];
					const deviceValues = artisanData.extratemp1?.[deviceIndex];
					
					if (deviceName && deviceTimes && deviceValues) {
						deviceTimes.forEach((time, timeIndex) => {
							const value = deviceValues[timeIndex];
							if (value !== null && value !== undefined) {
								machineEventData.push({
									roast_id: parseInt(roastId),
									time_seconds: time,
									event_type: 2, // Machine event type
									event_value: value.toString(),
									event_string: deviceName,
									category: 'machine',
									subcategory: 'artisan_device',
									user_generated: false,
									automatic: true
								});
							}
						});
					}
				});
				
				if (machineEventData.length > 0) {
					for (let i = 0; i < machineEventData.length; i += batchSize) {
						const batch = machineEventData.slice(i, i + batchSize);
						const { error: machineError } = await supabase
							.from('roast_events')
							.insert(batch);
						
						if (machineError) {
							console.warn('Error inserting machine event batch:', machineError);
						}
					}
					console.log(`Inserted ${machineEventData.length} machine events to new structure`);
				}
			}
			
		} catch (newStructureError) {
			console.warn('Failed to populate new table structure:', newStructureError);
			// Continue - don't fail the import if new structure population fails
		}

		// Insert roast events
		if (processedData.roastEvents.length > 0) {
			const { error: eventsError } = await supabase
				.from('roast_events')
				.insert(processedData.roastEvents);
			if (eventsError) {
				console.error('Error inserting roast events:', eventsError);
				// Non-critical, continue
			} else {
				console.log(`Inserted ${processedData.roastEvents.length} roast events`);
			}
		}

		// Insert roast phases
		if (processedData.roastPhases.length > 0) {
			const { error: phasesError } = await supabase
				.from('roast_phases')
				.insert(processedData.roastPhases);
			if (phasesError) {
				console.error('Error inserting roast phases:', phasesError);
				// Non-critical, continue
			} else {
				console.log(`Inserted ${processedData.roastPhases.length} roast phases`);
			}
		}

		// Insert extra device data
		if (processedData.extraDeviceData.length > 0) {
			const { error: deviceError } = await supabase
				.from('extra_device_data')
				.insert(processedData.extraDeviceData);
			if (deviceError) {
				console.error('Error inserting extra device data:', deviceError);
				// Non-critical, continue
			} else {
				console.log(`Inserted ${processedData.extraDeviceData.length} extra device data points`);
			}
		}

		// Create import log entry
		const { error: logError } = await supabase.from('artisan_import_log').insert({
			user_id: user.id,
			roast_id: parseInt(roastId),
			filename: file.name,
			file_size: file.size,
			artisan_version: artisanData.version || 'Unknown',
			total_data_points: processedData.temperaturePoints.length,
			processing_status: 'success',
			processing_messages: [
				`Imported ${processedData.temperaturePoints.length} temperature points`,
				`Created ${processedData.roastEvents.length} milestone events`,
				`Generated ${processedData.roastPhases.length} roast phases`,
				`Stored ${processedData.extraDeviceData.length} extra device data points`
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
			message: `Successfully imported ${processedData.temperaturePoints.length} data points from ${file.name}`,
			milestones: processedData.milestones,
			phases: processedData.phases,
			total_time: processedData.phases.total_time_seconds,
			temperature_unit: 'F',
			roast_events: processedData.roastEvents.length,
			roast_phases: processedData.roastPhases.length,
			extra_device_points: processedData.extraDeviceData.length
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
