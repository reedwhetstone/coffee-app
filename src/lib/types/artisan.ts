export interface ArtisanRoastData {
	// Metadata
	recording_version?: string;
	recording_revision?: string;
	recording_build?: string;
	version?: string;
	revision?: string;
	build?: string;
	artisan_os?: string;
	artisan_os_version?: string;
	artisan_os_arch?: string;

	// Core data
	title: string;
	roastertype: string;
	roastersize?: number;
	temperature_unit: 'F' | 'C'; // This will be mapped from 'mode' field
	mode: 'F' | 'C'; // Original field name in Artisan
	roastdate?: string;
	roasttime?: string;
	roast_uuid?: string;

	// Time series data (required arrays)
	timex: number[]; // Time in seconds from start
	temp1: number[]; // Bean temperature (BT)
	temp2: number[]; // Environmental temperature (ET)

	// Milestone events - indices into timex array
	// [CHARGE, DRY_END, FC_START, FC_END, SC_START, SC_END, DROP, COOL]
	timeindex: number[];

	// Roast metadata
	weight: [number, number, string]; // [input_weight, output_weight, unit]
	defects_weight?: number;
	volume?: [number, number, string];
	density?: [number, string, number, string];
	density_roasted?: [number, string, number, string];

	// Roaster settings
	roasterheating?: number;
	machinesetup?: string;
	drumspeed?: string;

	// People and organization
	operator?: string;
	organization?: string;

	// Flavor and cupping
	flavors?: number[];
	flavors_total_correction?: number;
	flavorlabels?: string[];
	beans?: string;
	roastingnotes?: string;
	cuppingnotes?: string;

	// Additional characteristics
	heavyFC?: boolean;
	lowFC?: boolean;
	lightCut?: boolean;
	darkCut?: boolean;
	drops?: boolean;
	oily?: boolean;
	uneven?: boolean;
	tipping?: boolean;
	scorching?: boolean;
	underdeveloped?: boolean;

	// Extra devices (fan, heat, damper data)
	extradevices?: number[];
	extraname1?: string[];
	extraname2?: string[];
	extratimex?: number[][];
	extratemp1?: number[][];
	extratemp2?: number[][];

	// Environment types
	etypes?: string[];

	// Locale
	locale?: string;
	viewerMode?: boolean;
}

export interface MilestoneData {
	charge?: number; // timeindex[0]
	dry_end?: number; // timeindex[1]
	fc_start?: number; // timeindex[2]
	fc_end?: number; // timeindex[3]
	sc_start?: number; // timeindex[4]
	sc_end?: number; // timeindex[5]
	drop?: number; // timeindex[6]
	cool?: number; // timeindex[7]
}

export interface ProcessedTemperaturePoint {
	time_seconds: number;
	bean_temp: number | null;
	environmental_temp: number | null;
	fan_setting?: number | null;
	heat_setting?: number | null;
}

export interface ProcessedRoastData {
	// For roast_profiles table
	profileData: {
		coffee_name: string;
		roaster_type: string;
		roaster_size: number;
		input_weight: number;
		output_weight: number;
		weight_unit: string;
		temperature_unit: 'F' | 'C';
		roast_notes?: string;
		roast_uuid?: string;
		data_source: 'artisan_import';
	};

	// For profile_log table
	temperaturePoints: Array<{
		roast_id: number;
		time_seconds: number;
		bean_temp: number | null;
		environmental_temp: number | null;
		fan_setting: number;
		heat_setting: number;
		data_source: 'artisan_import';
		// Milestone flags
		start: number;
		charge: number;
		maillard: number;
		fc_start: number;
		fc_rolling: number;
		fc_end: number;
		sc_start: number;
		drop: number;
		end: number;
	}>;

	// Extracted milestones
	milestones: MilestoneData;

	// Phase calculations
	phases: {
		drying_percent: number;
		maillard_percent: number;
		development_percent: number;
		total_time_seconds: number;
	};

	// Roast events for roast_events table
	roastEvents: Array<{
		roast_id: number;
		time_seconds: number;
		event_type: number;
		event_string: string;
		category: string;
		subcategory: string;
		user_generated: boolean;
		automatic: boolean;
		notes: string;
	}>;

	// Roast phases for roast_phases table
	roastPhases: Array<{
		roast_id: number;
		phase_name: string;
		phase_order: number;
		start_time: number;
		end_time: number;
		duration: number;
		percentage_of_total: number;
		calculation_method: string;
		confidence_score: number;
	}>;

	// Extra device data for extra_device_data table
	extraDeviceData: Array<{
		roast_id: number;
		device_id: number;
		device_name: string;
		sensor_type: string;
		time_seconds: number;
		value: number;
		unit: string;
		quality: string;
	}>;
}

export interface ValidationResult {
	valid: boolean;
	errors: string[];
	warnings?: string[];
}

// Type guard for Artisan data
export function isArtisanRoastData(data: any): data is ArtisanRoastData {
	return (
		typeof data === 'object' &&
		data !== null &&
		Array.isArray(data.timex) &&
		Array.isArray(data.temp1) &&
		Array.isArray(data.temp2) &&
		Array.isArray(data.timeindex) &&
		typeof data.title === 'string' &&
		(data.mode === 'F' || data.mode === 'C')
	);
}

// Milestone names mapping
export const MILESTONE_NAMES = {
	0: 'CHARGE',
	1: 'DRY_END',
	2: 'FC_START',
	3: 'FC_END',
	4: 'SC_START',
	5: 'SC_END',
	6: 'DROP',
	7: 'COOL'
} as const;

export const MILESTONE_LABELS = {
	charge: 'Charge',
	dry_end: 'Dry End',
	fc_start: 'First Crack Start',
	fc_end: 'First Crack End',
	sc_start: 'Second Crack Start',
	sc_end: 'Second Crack End',
	drop: 'Drop',
	cool: 'Cool'
} as const;
