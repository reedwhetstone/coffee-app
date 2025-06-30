import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';

interface ArtisanDataPoint {
	time: string;
	bean_temp: number | null;
	fan_setting: number | null;
	heat_setting: number | null;
}

interface ArtisanEvents {
	charge?: string;
	dry_end?: string;
	fc_start?: string;
	fc_end?: string;
	sc_start?: string;
	drop?: string;
	cool?: string;
}

interface ParsedArtisanData {
	events: ArtisanEvents;
	dataPoints: ArtisanDataPoint[];
}

function parseTimeToMs(timeStr: string): number {
	// Handle formats like "00:00", "03:26", "07:58"
	const parts = timeStr.split(':');
	if (parts.length === 2) {
		const minutes = parseInt(parts[0], 10);
		const seconds = parseInt(parts[1], 10);
		return (minutes * 60 + seconds) * 1000;
	}
	return 0;
}

function convertToMySQLTime(timeStr: string): string {
	// Convert MM:SS format to HH:MM:SS format for MySQL
	const parts = timeStr.split(':');
	if (parts.length === 2) {
		const minutes = parseInt(parts[0], 10);
		const seconds = parseInt(parts[1], 10);
		const hours = Math.floor(minutes / 60);
		const remainingMinutes = minutes % 60;
		return `${hours.toString().padStart(2, '0')}:${remainingMinutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
	}
	return '00:00:00';
}

function parseArtisanCSV(csvText: string): ParsedArtisanData {
	const lines = csvText.split('\n');

	if (lines.length < 3) {
		throw new Error('Invalid Artisan CSV format');
	}

	// Row 1: Events with times
	const eventLine = lines[0];
	const eventParts = eventLine.split('\t');

	const events: ArtisanEvents = {};

	// Parse events from first row
	eventParts.forEach((part) => {
		const trimmed = part.trim();
		if (trimmed.includes('CHARGE:')) {
			events.charge = trimmed.split('CHARGE:')[1];
		} else if (trimmed.includes('DRYe:')) {
			events.dry_end = trimmed.split('DRYe:')[1];
		} else if (trimmed.includes('FCs:')) {
			events.fc_start = trimmed.split('FCs:')[1];
		} else if (trimmed.includes('FCe:')) {
			events.fc_end = trimmed.split('FCe:')[1];
		} else if (trimmed.includes('SCs:')) {
			events.sc_start = trimmed.split('SCs:')[1];
		} else if (trimmed.includes('DROP:')) {
			events.drop = trimmed.split('DROP:')[1];
		} else if (trimmed.includes('COOL:')) {
			events.cool = trimmed.split('COOL:')[1];
		}
	});

	// Row 2: Column headers (Time1, Time2, ET, BT, Event)
	const headerLine = lines[1];
	const headers = headerLine.split('\t');

	// Find column indices
	const timeIndex = headers.findIndex((h) => h.trim() === 'Time1');
	const btIndex = headers.findIndex((h) => h.trim() === 'BT');

	if (timeIndex === -1 || btIndex === -1) {
		throw new Error('Required columns (Time1, BT) not found in CSV');
	}

	// Parse data rows (starting from row 3)
	const dataPoints: ArtisanDataPoint[] = [];

	for (let i = 2; i < lines.length; i++) {
		const line = lines[i].trim();
		if (!line) continue;

		const values = line.split('\t');

		if (values.length <= Math.max(timeIndex, btIndex)) continue;

		const timeStr = values[timeIndex]?.trim();
		const btStr = values[btIndex]?.trim();

		if (!timeStr) continue;

		dataPoints.push({
			time: timeStr,
			bean_temp: btStr && btStr !== '-1.0' ? parseFloat(btStr) : null,
			fan_setting: null, // CSV doesn't include fan/heat settings
			heat_setting: null
		});
	}

	return { events, dataPoints };
}

function parseArtisanXLSX(buffer: ArrayBuffer): ParsedArtisanData {
	const workbook = XLSX.read(buffer, { type: 'array' });
	const firstSheet = workbook.Sheets[workbook.SheetNames[0]];

	if (!firstSheet) {
		throw new Error('No worksheet found in XLSX file');
	}

	// Convert to JSON to work with the data
	const data = XLSX.utils.sheet_to_json(firstSheet, { header: 1 }) as any[][];

	if (data.length < 5) {
		throw new Error('Invalid Artisan XLSX format - need at least 5 rows');
	}

	// XLSX structure:
	// Row 0: Header labels (Date, Unit, CHARGE, TP, DRYe, FCs, FCe, SCs, SCe, DROP, COOL, Time)
	// Row 1: Event times and metadata
	// Row 2: (blank)
	// Row 3: Time series column headers (Time1, Time2, ET, BT, Δ BT, Event)
	// Row 4+: Time series data

	const headerLabels = data[0] as string[];
	const eventTimes = data[1] as string[];
	const timeSeriesHeaders = data[3] as string[];

	const events: ArtisanEvents = {};

	// Parse events by matching header labels with their corresponding times
	headerLabels.forEach((label, index) => {
		if (typeof label === 'string' && eventTimes[index]) {
			const labelStr = label.toString().trim();
			const timeStr = eventTimes[index]?.toString().trim();
			
			if (timeStr && timeStr !== '' && timeStr !== '0') {
				if (labelStr === 'CHARGE') {
					events.charge = timeStr;
				} else if (labelStr === 'DRYe') {
					events.dry_end = timeStr;
				} else if (labelStr === 'FCs') {
					events.fc_start = timeStr;
				} else if (labelStr === 'FCe') {
					events.fc_end = timeStr;
				} else if (labelStr === 'SCs') {
					events.sc_start = timeStr;
				} else if (labelStr === 'DROP') {
					events.drop = timeStr;
				} else if (labelStr === 'COOL') {
					events.cool = timeStr;
				}
			}
		}
	});

	// Find column indices in the time series headers (row 3)
	const timeIndex = timeSeriesHeaders.findIndex((h) => h && h.toString().trim() === 'Time1');
	const btIndex = timeSeriesHeaders.findIndex((h) => h && h.toString().trim() === 'BT');
	const eventIndex = timeSeriesHeaders.findIndex((h) => h && h.toString().trim() === 'Event');
	const fanIndex = timeSeriesHeaders.findIndex(
		(h) => h && h.toString().trim().toLowerCase().includes('fan')
	);
	const heatIndex = timeSeriesHeaders.findIndex(
		(h) => h && h.toString().trim().toLowerCase().includes('heat')
	);

	if (timeIndex === -1 || btIndex === -1) {
		console.log('Available time series headers:', timeSeriesHeaders);
		throw new Error('Required columns (Time1, BT) not found in XLSX time series headers');
	}

	// Parse data rows (starting from row 4)
	const dataPoints: ArtisanDataPoint[] = [];

	for (let i = 4; i < data.length; i++) {
		const row = data[i];
		if (!row || row.length === 0) continue;

		const timeCell = row[timeIndex];
		const btCell = row[btIndex];
		const fanCell = fanIndex >= 0 ? row[fanIndex] : null;
		const heatCell = heatIndex >= 0 ? row[heatIndex] : null;

		if (!timeCell) continue;

		dataPoints.push({
			time: timeCell.toString(),
			bean_temp: btCell && btCell !== -1.0 ? parseFloat(btCell.toString()) : null,
			fan_setting: fanCell ? parseFloat(fanCell.toString()) : null,
			heat_setting: heatCell ? parseFloat(heatCell.toString()) : null
		});
	}

	return { events, dataPoints };
}

function convertToProfileLogs(roastId: number, artisanData: ParsedArtisanData): any[] {
	const profileLogs: any[] = [];

	// Add event entries based on Artisan events
	const { events, dataPoints } = artisanData;

	// Create event entries
	if (events.charge) {
		profileLogs.push({
			roast_id: roastId,
			fan_setting: 0,
			heat_setting: 0,
			time: convertToMySQLTime(events.charge),
			start: 0,
			maillard: 0,
			fc_start: 0,
			fc_rolling: 0,
			fc_end: 0,
			sc_start: 0,
			drop: 0,
			end: 0,
			charge: 1,
			bean_temp: null
		});
	}

	if (events.dry_end) {
		profileLogs.push({
			roast_id: roastId,
			fan_setting: 0,
			heat_setting: 0,
			time: convertToMySQLTime(events.dry_end),
			start: 0,
			maillard: 1,
			fc_start: 0,
			fc_rolling: 0,
			fc_end: 0,
			sc_start: 0,
			drop: 0,
			end: 0,
			charge: 0,
			bean_temp: null
		});
	}

	if (events.fc_start) {
		profileLogs.push({
			roast_id: roastId,
			fan_setting: 0,
			heat_setting: 0,
			time: convertToMySQLTime(events.fc_start),
			start: 0,
			maillard: 0,
			fc_start: 1,
			fc_rolling: 0,
			fc_end: 0,
			sc_start: 0,
			drop: 0,
			end: 0,
			charge: 0,
			bean_temp: null
		});
	}

	if (events.fc_end) {
		profileLogs.push({
			roast_id: roastId,
			fan_setting: 0,
			heat_setting: 0,
			time: convertToMySQLTime(events.fc_end),
			start: 0,
			maillard: 0,
			fc_start: 0,
			fc_rolling: 0,
			fc_end: 1,
			sc_start: 0,
			drop: 0,
			end: 0,
			charge: 0,
			bean_temp: null
		});
	}

	if (events.sc_start) {
		profileLogs.push({
			roast_id: roastId,
			fan_setting: 0,
			heat_setting: 0,
			time: convertToMySQLTime(events.sc_start),
			start: 0,
			maillard: 0,
			fc_start: 0,
			fc_rolling: 0,
			fc_end: 0,
			sc_start: 1,
			drop: 0,
			end: 0,
			charge: 0,
			bean_temp: null
		});
	}

	if (events.drop) {
		profileLogs.push({
			roast_id: roastId,
			fan_setting: 0,
			heat_setting: 0,
			time: convertToMySQLTime(events.drop),
			start: 0,
			maillard: 0,
			fc_start: 0,
			fc_rolling: 0,
			fc_end: 0,
			sc_start: 0,
			drop: 1,
			end: 0,
			charge: 0,
			bean_temp: null
		});
	}

	if (events.cool) {
		profileLogs.push({
			roast_id: roastId,
			fan_setting: 0,
			heat_setting: 0,
			time: convertToMySQLTime(events.cool),
			start: 0,
			maillard: 0,
			fc_start: 0,
			fc_rolling: 0,
			fc_end: 0,
			sc_start: 0,
			drop: 0,
			end: 1,
			charge: 0,
			bean_temp: null
		});
	}

	// Add temperature data points (sample every few seconds to avoid too much data)
	dataPoints.forEach((point, index) => {
		// Sample every 10th data point to reduce database load, or if there's temperature data
		if (index % 10 === 0 || point.bean_temp !== null) {
			profileLogs.push({
				roast_id: roastId,
				fan_setting: point.fan_setting || 0,
				heat_setting: point.heat_setting || 0,
				time: convertToMySQLTime(point.time),
				start: 0,
				maillard: 0,
				fc_start: 0,
				fc_rolling: 0,
				fc_end: 0,
				sc_start: 0,
				drop: 0,
				end: 0,
				charge: 0,
				bean_temp: point.bean_temp
			});
		}
	});

	return profileLogs;
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

		// Verify ownership of the roast profile
		const { data: profile } = await supabase
			.from('roast_profiles')
			.select('user')
			.eq('roast_id', roastId)
			.single();

		if (!profile || profile.user !== user.id) {
			return json({ error: 'Unauthorized' }, { status: 403 });
		}

		let parsedData: ParsedArtisanData;

		if (file.name.toLowerCase().endsWith('.csv')) {
			const text = await file.text();
			parsedData = parseArtisanCSV(text);
		} else if (file.name.toLowerCase().endsWith('.xlsx')) {
			const buffer = await file.arrayBuffer();
			parsedData = parseArtisanXLSX(buffer);
		} else {
			return json(
				{ error: 'Unsupported file format. Please use CSV or XLSX files.' },
				{ status: 400 }
			);
		}

		// Convert to profile logs format
		const profileLogs = convertToProfileLogs(parseInt(roastId), parsedData);
		console.log(`Generated ${profileLogs.length} profile log entries for roast ${roastId}`);

		// Clear existing logs for this roast
		const { error: deleteError } = await supabase
			.from('profile_log')
			.delete()
			.eq('roast_id', parseInt(roastId));
		if (deleteError) {
			console.error('Error deleting existing logs:', deleteError);
			throw deleteError;
		}

		// Insert new logs in batches
		const batchSize = 50;
		let totalInserted = 0;
		for (let i = 0; i < profileLogs.length; i += batchSize) {
			const batch = profileLogs.slice(i, i + batchSize);
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

		return json({
			success: true,
			message: `Successfully imported ${profileLogs.length} data points from ${file.name}`,
			events: parsedData.events,
			dataPointsCount: parsedData.dataPoints.length
		});
	} catch (error) {
		console.error('Error importing Artisan file:', error);
		return json(
			{
				error: error instanceof Error ? error.message : 'Failed to import Artisan file'
			},
			{ status: 500 }
		);
	}
};
