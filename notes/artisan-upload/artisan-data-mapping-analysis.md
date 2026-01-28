# Artisan Roast Profile Data Mapping Analysis

## Overview

This document provides a comprehensive analysis of mapping Artisan roast profile data to a **new normalized SQL schema** for web-based charting with D3.js. The analysis is based on the Costa Rica Jaguar Honey roast profile from June 3, 2025.

## 🔄 **SCHEMA UPDATE - NEW NORMALIZED STRUCTURE**

The roast data has been restructured into a normalized schema that separates high-volume temperature data from events, eliminates redundancy, and standardizes all event handling.

### New Table Structure

1. **`roast_temperatures`** - High-volume time series data with pre-calculated RoR
2. **`roast_events`** - Normalized events (milestones, controls, machine settings)
3. **`roast_profiles`** - Master roast metadata with chart display settings
4. **`profile_log`** - DEPRECATED (will be removed after migration)

## Original Roast Profile Data (User Input)

```
Roaster Type    Kaleido Serial
Roaster Size    400 g
Uploaded        June 3, 2025, 11:48 a.m.
Roasted         June 3, 2025, 11:29 a.m.
Charge          194.5° C    —:—
Dry End         155.3° C    5:18 m
1st Crack       198.8° C    9:29 m
1st Crack End   —           —:—
2nd Crack       —           —:—
Drop            210.4° C    10:35 m
Cool            184.2° C    12:30 m
Dry %           50.1%       5:18 m
Maillard %      39.5%       4:11 m
Dev %           10.4%       1:06 m
Weight          300.0 g to 256.2 g    14.6% Loss
```

## Artisan JSON Structure Analysis

### Core Data Structure

The Artisan JSON export contains several key sections:

```json
{
  // METADATA - Basic roast information
  "title": "Costa Rica Jaguar Honey",
  "roastertype": "Kaleido Serial",
  "roastersize": 0.4,
  "weight": [300.0, 256.2, "g"], // [in, out, unit]
  "roastdate": "Tue Jun 3 2025",
  "roastisodate": "2025-06-03",
  "roasttime": "09:29:07",
  "roastUUID": "2d28af2080eb460282e0a7ed917c83aa",

  // TIME SERIES ARRAYS - Core temperature/time data
  "timex": [0.713, 2.213, 3.713, ...], // Time in seconds (785 data points)
  "temp1": [383.072, 382.6904, ...], // Environmental Temperature (ET) in Fahrenheit
  "temp2": [333.8456, 333.1778, ...], // Bean Temperature (BT) in Fahrenheit

  // MILESTONE EVENTS - Key roast phases
  "timeindex": [21, 233, 400, 0, 0, 0, 444, 521],
  // Array indices: [CHARGE, DRY_END, FC_START, FC_END, SC_START, SC_END, DROP, COOL]

  "phases": [300, 312, 390, 450], // Phase transition points in timex array

  // ADDITIONAL CONTROL DATA
  "extradevices": [141, 139, 140],
  "extraname1": ["{3}", "SV", "{1}"],
  "extraname2": ["{0}", "AT", "AH"],
  "extratimex": [[...], [...], [...]],  // Additional sensor time arrays

  // CHART DISPLAY SETTINGS
  "zmax": 45, "zmin": 0,      // Z-axis (control) range
  "ymax": 527, "ymin": 100,   // Y-axis (temperature) range
  "xmin": -14.66, "xmax": 825 // X-axis (time) range
}
```

### Key Data Arrays

1. **timex**: Time values in seconds from roast start (785 data points)
2. **temp1**: Environmental Temperature readings in Fahrenheit (ET sensor)
3. **temp2**: Bean Temperature readings in Fahrenheit (BT sensor)
4. **timeindex**: Milestone event indices into the timex/temp arrays
5. **phases**: Additional phase markers for roast progression

### Important Temperature Mapping

**CRITICAL**: In Artisan .alog files, the temperature arrays are:

- `temp1` = Environmental Temperature (ET)
- `temp2` = Bean Temperature (BT)

This is the reverse of what might be intuitive, so proper mapping is essential.

### Milestone Mapping

```
timeindex[0] = 21  → CHARGE (timex[21] = 21.713 seconds)
timeindex[1] = 233 → DRY_END (timex[233] = 233.213 seconds = 3:53)
timeindex[2] = 400 → FC_START (timex[400] = 401.213 seconds = 6:41)
timeindex[3] = 0   → FC_END (not set)
timeindex[4] = 0   → SC_START (not set)
timeindex[5] = 0   → SC_END (not set)
timeindex[6] = 444 → DROP (timex[444] = 444.713 seconds = 7:25)
timeindex[7] = 521 → COOL (timex[521] = 521.213 seconds = 8:41)
```

## NEW NORMALIZED SQL SCHEMA

### 1. `roast_temperatures` - High-Volume Time Series Data

```sql
CREATE TABLE roast_temperatures (
  temp_id BIGSERIAL PRIMARY KEY,
  roast_id INTEGER NOT NULL,
  time_seconds DECIMAL(8,3) NOT NULL,

  -- Temperature readings
  bean_temp DECIMAL(5,1),           -- BT (temp2 from Artisan)
  environmental_temp DECIMAL(5,1),  -- ET (temp1 from Artisan)
  ambient_temp DECIMAL(5,1),        -- Optional third sensor
  inlet_temp DECIMAL(5,1),          -- Optional inlet sensor

  -- Pre-calculated Rate of Rise for bean temperature only (per minute)
  -- Only calculated during active roasting period (charge to drop)
  ror_bean_temp DECIMAL(5,2),

  -- Data source tracking
  data_source TEXT DEFAULT 'live' CHECK (data_source IN ('live', 'artisan_import', 'manual')),
  data_quality TEXT DEFAULT 'good' CHECK (data_quality IN ('good', 'interpolated', 'estimated', 'poor')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  FOREIGN KEY (roast_id) REFERENCES roast_profiles(roast_id) ON DELETE CASCADE
);

-- Performance indexes
CREATE INDEX idx_roast_temperatures_roast_time ON roast_temperatures(roast_id, time_seconds);
CREATE INDEX idx_roast_temperatures_data_source ON roast_temperatures(data_source);
```

### 2. `roast_events` - Normalized Event Data

```sql
-- roast_events table (already exists, updated for new structure)
CREATE TABLE roast_events (
  event_id SERIAL PRIMARY KEY,
  roast_id INTEGER NOT NULL,
  time_seconds DECIMAL(8,3) NOT NULL,
  event_type INTEGER NOT NULL,
  event_value TEXT,              -- Changed from NUMERIC to TEXT for flexibility
  event_string TEXT,             -- Event name: 'charge', 'fc_start', 'fan_setting', etc.
  category TEXT,                 -- 'milestone', 'control', 'machine'
  subcategory TEXT,              -- 'roast_phase', 'machine_setting', 'artisan_device'
  user_generated BOOLEAN DEFAULT FALSE,
  automatic BOOLEAN DEFAULT TRUE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Performance indexes
CREATE INDEX idx_roast_events_category ON roast_events(roast_id, category, time_seconds);
CREATE INDEX idx_roast_events_milestone ON roast_events(roast_id, event_string) WHERE category = 'milestone';
```

#### Event Categories:

**Milestone Events (X-axis only - NULL values):**

- `event_string`: 'charge', 'dry_end', 'fc_start', 'fc_end', 'sc_start', 'drop', 'cool'
- `event_value`: NULL (row existence indicates event occurred)
- `category`: 'milestone'

**Control Events (Y-axis values as TEXT):**

- `event_string`: 'fan_setting', 'heat_setting', 'damper_setting'
- `event_value`: '8', '75%', '3.5'
- `category`: 'control'

**Machine Events from Artisan (Y-axis values as TEXT):**

- `event_string`: 'Air', 'Drum', 'Damper', 'Burner'
- `event_value`: '75', '85%'
- `category`: 'machine'

### 3. `roast_profiles` - Master Metadata with Chart Settings

```sql
-- Updated roast_profiles table with chart display settings
ALTER TABLE roast_profiles
ADD COLUMN chart_z_max DECIMAL(6,2),  -- Control range max (45)
ADD COLUMN chart_z_min DECIMAL(6,2),  -- Control range min (0)
ADD COLUMN chart_y_max DECIMAL(6,1),  -- Temperature range max (527)
ADD COLUMN chart_y_min DECIMAL(6,1),  -- Temperature range min (100)
ADD COLUMN chart_x_max DECIMAL(8,3),  -- Time range max (825 seconds)
ADD COLUMN chart_x_min DECIMAL(8,3),  -- Time range min (-14.66 seconds)
ADD COLUMN weight_in DECIMAL(6,2),    -- Input weight in grams
ADD COLUMN weight_out DECIMAL(6,2),   -- Output weight in grams
ADD COLUMN weight_unit VARCHAR(5) DEFAULT 'g';
```

### 4. `profile_log` - DEPRECATED (Legacy Support Only)

The `profile_log` table is now deprecated and will be removed after migration. During the transition period, APIs write to both the legacy table and the new normalized structure to maintain backward compatibility.

## Data Transformation Logic

### JSON → SQL Field Mapping

```typescript
interface ArtisanImportData {
	// Profile metadata mapping
	title: string; // → roast_profiles.title
	roastertype: string; // → roast_profiles.roaster_type
	roastersize: number; // → roast_profiles.roaster_size
	weight: [number, number, string]; // → weight_in, weight_out, weight_unit
	roastdate: string; // → roast_profiles.roast_date
	roasttime: string; // → combined with roastdate
	roastUUID: string; // → roast_profiles.roast_uuid

	// Time series arrays
	timex: number[]; // Time in seconds
	temp1: number[]; // Environmental temperature (ET)
	temp2: number[]; // Bean temperature (BT)

	// Milestone indices
	timeindex: number[]; // [CHARGE, DRY_END, FC_START, FC_END, SC_START, SC_END, DROP, COOL]
	phases: number[]; // Additional phase markers
}

// Extraction functions
function extractMilestoneData(data: ArtisanImportData) {
	const milestones = {
		charge: {
			time: data.timeindex[0] ? data.timex[data.timeindex[0]] : null,
			temp: data.timeindex[0] ? data.temp2[data.timeindex[0]] : null // Use BT (temp2) for milestones
		},
		dry_end: {
			time: data.timeindex[1] ? data.timex[data.timeindex[1]] : null,
			temp: data.timeindex[1] ? data.temp2[data.timeindex[1]] : null // Use BT (temp2) for milestones
		},
		fc_start: {
			time: data.timeindex[2] ? data.timex[data.timeindex[2]] : null,
			temp: data.timeindex[2] ? data.temp2[data.timeindex[2]] : null // Use BT (temp2) for milestones
		},
		fc_end: {
			time: data.timeindex[3] ? data.timex[data.timeindex[3]] : null,
			temp: data.timeindex[3] ? data.temp2[data.timeindex[3]] : null // Use BT (temp2) for milestones
		},
		sc_start: {
			time: data.timeindex[4] ? data.timex[data.timeindex[4]] : null,
			temp: data.timeindex[4] ? data.temp2[data.timeindex[4]] : null // Use BT (temp2) for milestones
		},
		drop: {
			time: data.timeindex[6] ? data.timex[data.timeindex[6]] : null,
			temp: data.timeindex[6] ? data.temp2[data.timeindex[6]] : null // Use BT (temp2) for milestones
		},
		cool: {
			time: data.timeindex[7] ? data.timex[data.timeindex[7]] : null,
			temp: data.timeindex[7] ? data.temp2[data.timeindex[7]] : null // Use BT (temp2) for milestones
		}
	};

	return milestones;
}

// Phase calculation logic
function calculatePhases(milestones: any) {
	const chargeTime = milestones.charge?.time || 0;
	const dryEndTime = milestones.dry_end?.time || 0;
	const fcStartTime = milestones.fc_start?.time || 0;
	const dropTime = milestones.drop?.time || 0;

	const totalTime = dropTime - chargeTime;

	if (totalTime <= 0) return { dry: 0, maillard: 0, development: 0 };

	const dryPercent = dryEndTime > chargeTime ? ((dryEndTime - chargeTime) / totalTime) * 100 : 0;
	const maillardPercent =
		fcStartTime > dryEndTime && dryEndTime > 0 ? ((fcStartTime - dryEndTime) / totalTime) * 100 : 0;
	const devPercent =
		dropTime > fcStartTime && fcStartTime > 0 ? ((dropTime - fcStartTime) / totalTime) * 100 : 0;

	return {
		dry: Math.round(dryPercent * 10) / 10,
		maillard: Math.round(maillardPercent * 10) / 10,
		development: Math.round(devPercent * 10) / 10
	};
}
```

### Time Series Data Processing

```typescript
function generateProfileLogEntries(data: ArtisanImportData, roastId: number) {
	const entries = [];
	const milestoneIndices = new Set(data.timeindex.filter((idx) => idx > 0));

	for (let i = 0; i < data.timex.length; i++) {
		const entry = {
			roast_id: roastId,
			time_seconds: data.timex[i],
			bean_temp: data.temp2[i], // temp2 = BT (Bean Temperature)
			environmental_temp: data.temp1[i], // temp1 = ET (Environmental Temperature)

			// Set milestone flags
			is_charge: i === data.timeindex[0],
			is_dry_end: i === data.timeindex[1],
			is_fc_start: i === data.timeindex[2],
			is_fc_end: i === data.timeindex[3],
			is_sc_start: i === data.timeindex[4],
			is_drop: i === data.timeindex[6],
			is_cool: i === data.timeindex[7],

			data_source: 'artisan_import'
		};

		entries.push(entry);
	}

	return entries;
}
```

## D3.js Chart Data Structure

### Chart-Ready Data Format

```typescript
interface ChartDataPoint {
	timeSeconds: number; // X-axis: time from roast start
	beanTemp: number; // Y-axis: Bean temperature
	environmentalTemp: number; // Y-axis: Environmental temperature
	heatSetting?: number; // Optional: heat control
	fanSetting?: number; // Optional: fan control
}

interface MilestoneMarker {
	timeSeconds: number;
	temperature: number;
	label: string; // "CHARGE", "FC START", "DROP"
	type: 'charge' | 'dry_end' | 'fc_start' | 'fc_end' | 'sc_start' | 'drop' | 'cool';
	color: string; // Marker color for visualization
}

interface PhaseRegion {
	startTime: number;
	endTime: number;
	label: string; // "Drying", "Maillard", "Development"
	percentage: number; // Phase percentage of total roast
	color: string; // Background color for phase
}

interface RoastChartData {
	dataPoints: ChartDataPoint[];
	milestones: MilestoneMarker[];
	phases: PhaseRegion[];
	metadata: {
		title: string;
		roasterType: string;
		totalTime: number; // seconds
		weightLoss: number; // percentage
		roastDate: string;
	};
	chartConfig: {
		xAxisMax: number; // Maximum time for chart
		yAxisMin: number; // Minimum temperature
		yAxisMax: number; // Maximum temperature
	};
}
```

### Data Transformation for Charts

```typescript
function transformToChartData(roastProfile: any, profileLogs: any[]): RoastChartData {
	// Transform log entries to chart points
	const dataPoints: ChartDataPoint[] = profileLogs.map((log) => ({
		timeSeconds: log.time_seconds,
		beanTemp: log.bean_temp,
		environmentalTemp: log.environmental_temp,
		heatSetting: log.heat_setting,
		fanSetting: log.fan_setting
	}));

	// Create milestone markers
	const milestones: MilestoneMarker[] = [
		{
			timeSeconds: roastProfile.charge_time,
			temperature: roastProfile.charge_temp,
			label: 'CHARGE',
			type: 'charge',
			color: '#10B981'
		},
		{
			timeSeconds: roastProfile.fc_start_time,
			temperature: roastProfile.fc_start_temp,
			label: 'FIRST CRACK',
			type: 'fc_start',
			color: '#F59E0B'
		},
		{
			timeSeconds: roastProfile.drop_time,
			temperature: roastProfile.drop_temp,
			label: 'DROP',
			type: 'drop',
			color: '#EF4444'
		}
	].filter((m) => m.timeSeconds && m.temperature);

	// Create phase regions
	const phases: PhaseRegion[] = [
		{
			startTime: roastProfile.charge_time,
			endTime: roastProfile.dry_end_time,
			label: 'Drying',
			percentage: roastProfile.dry_percent,
			color: '#EFF6FF'
		},
		{
			startTime: roastProfile.dry_end_time,
			endTime: roastProfile.fc_start_time,
			label: 'Maillard',
			percentage: roastProfile.maillard_percent,
			color: '#FEF3C7'
		},
		{
			startTime: roastProfile.fc_start_time,
			endTime: roastProfile.drop_time,
			label: 'Development',
			percentage: roastProfile.development_percent,
			color: '#FEE2E2'
		}
	].filter((p) => p.startTime && p.endTime);

	return {
		dataPoints,
		milestones,
		phases,
		metadata: {
			title: roastProfile.title,
			roasterType: roastProfile.roaster_type,
			totalTime: roastProfile.total_roast_time,
			weightLoss: roastProfile.weight_loss_percent,
			roastDate: roastProfile.roast_date
		},
		chartConfig: {
			xAxisMax: roastProfile.total_roast_time + 30, // Add buffer
			yAxisMin: 150, // Reasonable temp minimum
			yAxisMax: Math.max(...dataPoints.map((d) => Math.max(d.beanTemp, d.environmentalTemp))) + 20
		}
	};
}
```

## Integration with Existing System

### API Endpoint Structure

```typescript
// /api/artisan-import/+server.ts
export const POST: RequestHandler = async ({ request, locals: { supabase, safeGetSession } }) => {
	const { session, user } = await safeGetSession();
	if (!session) return json({ error: 'Unauthorized' }, { status: 401 });

	const formData = await request.formData();
	const file = formData.get('file') as File;
	const coffeeId = formData.get('coffee_id') as string;

	// Parse Artisan JSON
	const artisanData = JSON.parse(await file.text());

	// Extract and calculate roast data
	const milestones = extractMilestoneData(artisanData);
	const phases = calculatePhases(milestones);
	const weightLoss =
		((artisanData.weight[0] - artisanData.weight[1]) / artisanData.weight[0]) * 100;

	// Insert roast profile
	const { data: profile, error: profileError } = await supabase
		.from('roast_profiles')
		.insert({
			user: user.id,
			coffee_id: parseInt(coffeeId),
			title: artisanData.title,
			roaster_type: artisanData.roastertype,
			roaster_size: artisanData.roastersize,
			weight_in: artisanData.weight[0],
			weight_out: artisanData.weight[1],
			weight_loss_percent: weightLoss,
			roast_date: new Date(artisanData.roastisodate + ' ' + artisanData.roasttime),
			roast_uuid: artisanData.roastUUID,

			// Milestone data
			charge_time: milestones.charge?.time,
			charge_temp: milestones.charge?.temp,
			dry_end_time: milestones.dry_end?.time,
			dry_end_temp: milestones.dry_end?.temp,
			fc_start_time: milestones.fc_start?.time,
			fc_start_temp: milestones.fc_start?.temp,
			drop_time: milestones.drop?.time,
			drop_temp: milestones.drop?.temp,

			// Phase calculations
			dry_percent: phases.dry,
			maillard_percent: phases.maillard,
			development_percent: phases.development,
			total_roast_time: milestones.drop?.time - milestones.charge?.time
		})
		.select()
		.single();

	if (profileError) throw profileError;

	// Generate and insert profile log entries
	const logEntries = generateProfileLogEntries(artisanData, profile.roast_id);

	// Insert in chunks to avoid query size limits
	const chunkSize = 100;
	for (let i = 0; i < logEntries.length; i += chunkSize) {
		const chunk = logEntries.slice(i, i + chunkSize);
		const { error: logError } = await supabase.from('profile_log').insert(chunk);
		if (logError) throw logError;
	}

	return json({
		success: true,
		roast_id: profile.roast_id,
		data_points: logEntries.length
	});
};
```

### Frontend Integration

```svelte
<!-- ArtisanImportForm.svelte -->
<script lang="ts">
	let { coffeeId } = $props<{ coffeeId: number }>();

	let file = $state<File | null>(null);
	let uploading = $state(false);
	let result = $state<any>(null);

	async function handleImport() {
		if (!file || !coffeeId) return;

		uploading = true;
		const formData = new FormData();
		formData.append('file', file);
		formData.append('coffee_id', coffeeId.toString());

		try {
			const response = await fetch('/api/artisan-import', {
				method: 'POST',
				body: formData
			});

			result = await response.json();

			if (result.success) {
				// Navigate to roast profile view
				window.location.href = `/roast/profile/${result.roast_id}`;
			}
		} catch (error) {
			console.error('Import failed:', error);
		} finally {
			uploading = false;
		}
	}
</script>

<div class="rounded-lg bg-background-secondary-light p-6">
	<h3 class="mb-4 text-lg font-semibold">Import Artisan Roast Profile</h3>

	<div class="space-y-4">
		<div>
			<label class="mb-2 block text-sm font-medium"> Artisan JSON File (.alog.json) </label>
			<input
				type="file"
				accept=".json,.alog.json"
				onchange={(e) => (file = e.target.files?.[0] || null)}
				class="w-full rounded-md border border-border-light px-3 py-2"
			/>
		</div>

		<button
			onclick={handleImport}
			disabled={!file || uploading}
			class="rounded-md bg-background-tertiary-light px-4 py-2 text-white disabled:opacity-50"
		>
			{uploading ? 'Importing...' : 'Import Roast Profile'}
		</button>

		{#if result}
			<div
				class="mt-4 rounded-md p-3 {result.success
					? 'bg-green-50 text-green-800'
					: 'bg-red-50 text-red-800'}"
			>
				{result.success
					? `Successfully imported ${result.data_points} data points`
					: `Error: ${result.error}`}
			</div>
		{/if}
	</div>
</div>
```

## Data Validation and Error Handling

### Import Validation Checklist

```typescript
function validateArtisanData(data: any): { valid: boolean; errors: string[] } {
	const errors: string[] = [];

	// Required fields
	if (!data.title) errors.push('Missing roast title');
	if (!data.timex || !Array.isArray(data.timex)) errors.push('Missing or invalid time data');
	if (!data.temp1 || !Array.isArray(data.temp1))
		errors.push('Missing or invalid bean temperature data');
	if (!data.temp2 || !Array.isArray(data.temp2))
		errors.push('Missing or invalid environmental temperature data');

	// Array length consistency
	if (data.timex && data.temp1 && data.timex.length !== data.temp1.length) {
		errors.push('Time and temperature arrays have different lengths');
	}

	// Reasonable data ranges
	if (data.timex && data.timex[data.timex.length - 1] > 3600) {
		errors.push('Roast time exceeds 1 hour - may be incorrect');
	}

	// Valid milestone indices
	if (data.timeindex) {
		for (const idx of data.timeindex) {
			if (idx > 0 && idx >= data.timex.length) {
				errors.push(`Invalid milestone index: ${idx}`);
			}
		}
	}

	return { valid: errors.length === 0, errors };
}
```

## Performance Considerations

### Database Optimization

```sql
-- Indexes for efficient querying
CREATE INDEX idx_roast_profiles_user_date ON roast_profiles(user, roast_date DESC);
CREATE INDEX idx_roast_profiles_coffee ON roast_profiles(coffee_id);
CREATE INDEX idx_profile_log_roast_time ON profile_log(roast_id, time_seconds);
CREATE INDEX idx_profile_log_milestones ON profile_log(roast_id, is_charge, is_fc_start, is_drop);
```

### Data Aggregation for Charts

```typescript
// For large datasets, consider data reduction for chart display
function reduceDataPoints(logs: ProfileLogEntry[], maxPoints = 200): ProfileLogEntry[] {
	if (logs.length <= maxPoints) return logs;

	const step = Math.ceil(logs.length / maxPoints);
	const reduced = [];

	for (let i = 0; i < logs.length; i += step) {
		reduced.push(logs[i]);
	}

	// Always include milestone points
	const milestones = logs.filter(
		(log) => log.is_charge || log.is_fc_start || log.is_drop || log.is_cool
	);

	return [...reduced, ...milestones].sort((a, b) => a.time_seconds - b.time_seconds);
}
```

## Future Enhancements

### Additional Data Sources

- Support for other roaster software exports (Cropster, Artisan, etc.)
- Direct roaster integration via serial/USB protocols
- Manual data entry forms for legacy roasts

### Advanced Analytics

- Roast comparison overlays
- Rate of Rise (RoR) calculations
- Automatic roast scoring based on curve analysis
- Predictive modeling for roast optimization

### Export Features

- Export to PDF roast sheets
- Share roast profiles with other users
- Export to standard formats (CSV, Artisan, etc.)

## NEW DATA FLOW AND QUERY PATTERNS

### Chart Data Retrieval (New Normalized Structure)

**Temperature Curve Data:**

```sql
-- Get temperature data with pre-calculated bean temp RoR (charge to drop period only)
SELECT time_seconds, bean_temp, environmental_temp, ror_bean_temp
FROM roast_temperatures
WHERE roast_id = ?
ORDER BY time_seconds ASC;
```

**Milestone Markers:**

```sql
-- Get milestone events (NULL values indicate event occurrence)
SELECT time_seconds, event_string
FROM roast_events
WHERE roast_id = ? AND category = 'milestone' AND event_value IS NULL
ORDER BY time_seconds ASC;
```

**Control Overlays:**

```sql
-- Get control events (fan, heat settings)
SELECT time_seconds, event_string, event_value
FROM roast_events
WHERE roast_id = ? AND category IN ('control', 'machine') AND event_value IS NOT NULL
ORDER BY time_seconds ASC;
```

**Chart Display Settings:**

```sql
-- Get Artisan chart ranges for proper axis scaling
SELECT chart_x_min, chart_x_max, chart_y_min, chart_y_max, chart_z_min, chart_z_max
FROM roast_profiles
WHERE roast_id = ?;
```

### Migration Data Flow

**During Transition:**

1. **Dual-Write APIs**: Write to both `profile_log` and new structure
2. **Feature Flag**: `ENABLE_NEW_STRUCTURE = true` controls new table population
3. **Fallback Queries**: Chart components can read from either structure
4. **Data Validation**: Verify data consistency between old and new structures

**After Migration:**

1. **Single Source**: All queries read from normalized structure only
2. **Performance**: Optimized queries with proper indexing
3. **RoR Calculations**: Pre-calculated during insert, no runtime computation
4. **Event Flexibility**: TEXT values support any event data format

### Key Benefits of New Structure

#### **Performance Improvements:**

- **Separate Temperature Table**: Optimized for high-volume time series queries
- **Pre-calculated Bean Temp RoR**: Calculated only during active roasting (charge to drop)
- **Targeted Indexes**: Optimized for common query patterns
- **Reduced Event Table Size**: No temperature data in events table

#### **Data Consistency:**

- **Normalized Events**: Single structure for all event types
- **Standardized Time**: All tables use `time_seconds` format
- **TEXT Event Values**: Support for any value format ("75%", "8.5", etc.)
- **Clear Separation**: Temperature vs event data clearly separated

#### **Extensibility:**

- **Easy Event Addition**: New event types require no schema changes
- **Machine Integration**: Direct support for Artisan extradevices
- **Chart Flexibility**: Artisan display settings preserved for accurate rendering
- **Future Sensors**: Additional temperature sensors easily added

#### **Artisan Integration:**

- **Complete Data Preservation**: All Artisan data fields mapped and stored
- **Chart Compatibility**: Original chart ranges preserved for accurate display
- **Machine Events**: Full support for Air/Drum/Damper/Burner controls
- **Milestone Accuracy**: Exact timeindex mapping preserved

### Migration Verification

**Data Integrity Checks:**

```sql
-- Compare record counts between old and new structure
SELECT
    'Legacy Profile Logs' as table_name, COUNT(*) as record_count
FROM profile_log WHERE roast_id = ?
UNION ALL
SELECT
    'New Temperature Records' as table_name, COUNT(*) as record_count
FROM roast_temperatures WHERE roast_id = ?
UNION ALL
SELECT
    'New Event Records' as table_name, COUNT(*) as record_count
FROM roast_events WHERE roast_id = ?;
```

## Conclusion

The new normalized schema provides a robust, scalable foundation for roast data management that:

- **Eliminates Redundancy**: No more duplicate time/event columns
- **Improves Performance**: Optimized for high-volume temperature logging and chart queries
- **Standardizes Events**: Unified structure for all roast events and controls
- **Preserves Compatibility**: Full backward compatibility during migration
- **Supports Growth**: Easy to add new sensors, events, and features
- **Integrates Seamlessly**: Complete Artisan import with chart display fidelity

This restructured approach transforms the roast data system from a legacy single-table design to a modern, normalized architecture suitable for complex roast analysis, real-time logging, and advanced charting capabilities.

## Special Events System (Control Device Data)

### Overview

Artisan stores control device events in separate arrays from the temperature data. When `extratemp1/extratemp2` arrays are empty (common in newer Artisan versions), the actual control events are stored in the **special events system**.

### Special Events Data Structure

From analyzing .alog files like 275.py, the special events system consists of four parallel arrays:

```python
{
    "specialevents": [23, 23, 67, 74, 467, 504, 513, ...],           # Timestamps (seconds)
    "specialeventstype": [0, 3, 3, 0, 3, 0, 0, ...],                 # Event type codes
    "specialeventsvalue": [6.0, 9.5, 10.0, 4.5, 9.0, ...],          # Control values
    "specialeventsStrings": ["", "", "90", "35", "80", ...],         # Value strings
    "etypes": ["Air", "Drum", "Damper", "Burner", "--"]              # Device names
}
```

### Special Events Type Mapping

**Event Type Codes:**

- `0` = Button press/discrete event
- `3` = Slider/continuous control event

### Control Device Mapping Logic

The import system maps special events to control devices using this logic:

```typescript
// Map control values to device names based on typical roasting patterns
if (numValue >= 80) {
	eventName = etypes[0] || 'Air'; // Air - typically high values (80-100)
} else if (numValue >= 60) {
	eventName = etypes[1] || 'Drum'; // Drum - medium-high values (60-79)
} else if (numValue >= 30) {
	eventName = etypes[2] || 'Damper'; // Damper - medium values (30-59)
} else {
	eventName = etypes[3] || 'Burner'; // Burner - lower values (0-29)
}
```

### Processing Logic

The updated artisan-import API now includes fallback processing:

1. **Primary**: Process `extratemp1/extratemp2` arrays if populated
2. **Fallback**: If extra temp arrays are empty, process `specialevents*` arrays instead
3. **Event Creation**: Map each special event to a control event with:
   - **Time**: `specialevents[i]` (timestamp in seconds)
   - **Device**: Mapped from `etypes` array based on value ranges
   - **Value**: `specialeventsStrings[i]` (control setting)

### Database Integration

Special events are converted to `roast_events` table entries:

```sql
INSERT INTO roast_events (
    roast_id, time_seconds, event_type, event_value,
    event_string, category, subcategory,
    user_generated, automatic, notes
) VALUES (
    ?, -- roast_id
    ?, -- time from specialevents array
    1, -- Control event type
    ?, -- value from specialeventsStrings
    ?, -- device name (air, drum, damper, burner)
    'control',
    'machine_setting',
    false,
    true,
    'Imported from Artisan special events: {device} set to {value}'
);
```

### Example Data Transformation

From 275.py data:

```python
specialevents[2] = 67          # Time: 67 seconds
specialeventsStrings[2] = "90" # Value: 90%
specialeventstype[2] = 3       # Type: Slider control
etypes[0] = "Air"              # Device: Air (90 >= 80, maps to Air)
```

Results in roast event:

```sql
{
    "time_seconds": 67,
    "event_value": "90",
    "event_string": "air",
    "category": "control",
    "notes": "Imported from Artisan special events: air set to 90"
}
```

### Impact on Charts

Control events from special events system appear as:

- **Timeline markers** at specific timestamps
- **Control overlay data** showing device settings over time
- **Event annotations** with device names and values

This enables full visualization of roaster control changes (Air, Drum, Damper, Burner settings) throughout the roast timeline, matching the original Artisan interface experience.
