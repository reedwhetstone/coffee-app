# Artisan Roast Profile Data Mapping Analysis

## Overview
This document provides a comprehensive analysis of mapping Artisan roast profile data to a structured SQL schema for web-based charting with D3.js. The analysis is based on the Costa Rica Jaguar Honey roast profile from June 3, 2025.

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
  "temp1": [333.8456, 333.1778, ...], // Bean Temperature (BT) in Fahrenheit  
  "temp2": [383.072, 382.6904, ...], // Environmental Temperature (ET)
  
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
2. **temp1**: Bean Temperature readings in Fahrenheit (BT sensor)
3. **temp2**: Environmental Temperature readings in Fahrenheit (ET sensor) 
4. **timeindex**: Milestone event indices into the timex/temp arrays
5. **phases**: Additional phase markers for roast progression

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

## SQL Schema Design

### Enhanced `roast_profiles` Table
```sql
CREATE TABLE roast_profiles (
  -- Primary keys and relationships
  roast_id INT PRIMARY KEY AUTO_INCREMENT,
  user VARCHAR(36) NOT NULL,
  coffee_id INT,
  
  -- Core roast metadata
  title VARCHAR(255),
  roaster_type VARCHAR(100),
  roaster_size DECIMAL(4,2), -- kg (0.4)
  roast_date DATETIME,
  roast_time TIME,
  roast_uuid VARCHAR(36),
  
  -- Weight and yield data  
  weight_in DECIMAL(6,2), -- grams
  weight_out DECIMAL(6,2), -- grams
  weight_loss_percent DECIMAL(4,1), -- calculated: (in-out)/in * 100
  weight_unit VARCHAR(5) DEFAULT 'g',
  
  -- Milestone timings (seconds from roast start)
  charge_time DECIMAL(8,3),
  dry_end_time DECIMAL(8,3),
  fc_start_time DECIMAL(8,3),
  fc_end_time DECIMAL(8,3),
  sc_start_time DECIMAL(8,3),
  drop_time DECIMAL(8,3),
  cool_time DECIMAL(8,3),
  
  -- Milestone temperatures (Fahrenheit)
  charge_temp DECIMAL(5,1),
  dry_end_temp DECIMAL(5,1),
  fc_start_temp DECIMAL(5,1),
  fc_end_temp DECIMAL(5,1),
  sc_start_temp DECIMAL(5,1),
  drop_temp DECIMAL(5,1),
  cool_temp DECIMAL(5,1),
  
  -- Phase calculations  
  dry_percent DECIMAL(4,1), -- Drying phase %
  maillard_percent DECIMAL(4,1), -- Maillard phase %
  development_percent DECIMAL(4,1), -- Development phase %
  total_roast_time DECIMAL(8,3), -- Total time in seconds
  
  -- Additional metadata
  roast_notes TEXT,
  cupping_notes TEXT,
  operator VARCHAR(100),
  batch_number INT,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

### Enhanced `profile_log` Table
```sql
CREATE TABLE profile_log (
  -- Primary keys and relationships
  log_id INT PRIMARY KEY AUTO_INCREMENT,
  roast_id INT NOT NULL,
  
  -- Time data
  time_seconds DECIMAL(8,3), -- Precise time from roast start
  timestamp_offset VARCHAR(20), -- MySQL TIME format for compatibility
  
  -- Temperature readings
  bean_temp DECIMAL(5,1), -- BT (temp1 from Artisan)
  environmental_temp DECIMAL(5,1), -- ET (temp2 from Artisan)
  ambient_temp DECIMAL(5,1), -- Optional third sensor
  
  -- Control settings (for live roasting)
  heat_setting DECIMAL(4,1),
  fan_setting DECIMAL(4,1),
  damper_setting DECIMAL(4,1),
  
  -- Event markers (boolean flags for milestones)
  is_charge BOOLEAN DEFAULT FALSE,
  is_dry_end BOOLEAN DEFAULT FALSE,
  is_fc_start BOOLEAN DEFAULT FALSE,
  is_fc_end BOOLEAN DEFAULT FALSE,
  is_sc_start BOOLEAN DEFAULT FALSE,
  is_drop BOOLEAN DEFAULT FALSE,
  is_cool BOOLEAN DEFAULT FALSE,
  
  -- Data source tracking
  data_source ENUM('live', 'artisan_import', 'manual') DEFAULT 'live',
  
  -- Index for performance
  INDEX idx_roast_time (roast_id, time_seconds),
  FOREIGN KEY (roast_id) REFERENCES roast_profiles(roast_id) ON DELETE CASCADE
);
```

## Data Transformation Logic

### JSON → SQL Field Mapping

```typescript
interface ArtisanImportData {
  // Profile metadata mapping
  title: string;              // → roast_profiles.title
  roastertype: string;        // → roast_profiles.roaster_type  
  roastersize: number;        // → roast_profiles.roaster_size
  weight: [number, number, string]; // → weight_in, weight_out, weight_unit
  roastdate: string;          // → roast_profiles.roast_date
  roasttime: string;          // → combined with roastdate
  roastUUID: string;          // → roast_profiles.roast_uuid
  
  // Time series arrays
  timex: number[];            // Time in seconds
  temp1: number[];            // Bean temperature (BT) 
  temp2: number[];            // Environmental temperature (ET)
  
  // Milestone indices
  timeindex: number[];        // [CHARGE, DRY_END, FC_START, FC_END, SC_START, SC_END, DROP, COOL]
  phases: number[];           // Additional phase markers
}

// Extraction functions
function extractMilestoneData(data: ArtisanImportData) {
  const milestones = {
    charge: {
      time: data.timeindex[0] ? data.timex[data.timeindex[0]] : null,
      temp: data.timeindex[0] ? data.temp1[data.timeindex[0]] : null
    },
    dry_end: {
      time: data.timeindex[1] ? data.timex[data.timeindex[1]] : null,
      temp: data.timeindex[1] ? data.temp1[data.timeindex[1]] : null
    },
    fc_start: {
      time: data.timeindex[2] ? data.timex[data.timeindex[2]] : null,
      temp: data.timeindex[2] ? data.temp1[data.timeindex[2]] : null
    },
    fc_end: {
      time: data.timeindex[3] ? data.timex[data.timeindex[3]] : null,
      temp: data.timeindex[3] ? data.temp1[data.timeindex[3]] : null
    },
    sc_start: {
      time: data.timeindex[4] ? data.timex[data.timeindex[4]] : null,
      temp: data.timeindex[4] ? data.temp1[data.timeindex[4]] : null
    },
    drop: {
      time: data.timeindex[6] ? data.timex[data.timeindex[6]] : null,
      temp: data.timeindex[6] ? data.temp1[data.timeindex[6]] : null
    },
    cool: {
      time: data.timeindex[7] ? data.timex[data.timeindex[7]] : null,
      temp: data.timeindex[7] ? data.temp1[data.timeindex[7]] : null
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
  
  const dryPercent = dryEndTime > chargeTime ? 
    ((dryEndTime - chargeTime) / totalTime) * 100 : 0;
  const maillardPercent = (fcStartTime > dryEndTime && dryEndTime > 0) ? 
    ((fcStartTime - dryEndTime) / totalTime) * 100 : 0;
  const devPercent = (dropTime > fcStartTime && fcStartTime > 0) ? 
    ((dropTime - fcStartTime) / totalTime) * 100 : 0;
    
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
  const milestoneIndices = new Set(data.timeindex.filter(idx => idx > 0));
  
  for (let i = 0; i < data.timex.length; i++) {
    const entry = {
      roast_id: roastId,
      time_seconds: data.timex[i],
      bean_temp: data.temp1[i],
      environmental_temp: data.temp2[i],
      
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
  timeSeconds: number;        // X-axis: time from roast start
  beanTemp: number;          // Y-axis: Bean temperature 
  environmentalTemp: number; // Y-axis: Environmental temperature
  heatSetting?: number;      // Optional: heat control
  fanSetting?: number;       // Optional: fan control
}

interface MilestoneMarker {
  timeSeconds: number;
  temperature: number;
  label: string;            // "CHARGE", "FC START", "DROP"
  type: 'charge' | 'dry_end' | 'fc_start' | 'fc_end' | 'sc_start' | 'drop' | 'cool';
  color: string;            // Marker color for visualization
}

interface PhaseRegion {
  startTime: number;
  endTime: number;
  label: string;           // "Drying", "Maillard", "Development"
  percentage: number;      // Phase percentage of total roast
  color: string;          // Background color for phase
}

interface RoastChartData {
  dataPoints: ChartDataPoint[];
  milestones: MilestoneMarker[];
  phases: PhaseRegion[];
  metadata: {
    title: string;
    roasterType: string;
    totalTime: number;        // seconds
    weightLoss: number;       // percentage
    roastDate: string;
  };
  chartConfig: {
    xAxisMax: number;         // Maximum time for chart
    yAxisMin: number;         // Minimum temperature
    yAxisMax: number;         // Maximum temperature
  };
}
```

### Data Transformation for Charts

```typescript
function transformToChartData(roastProfile: any, profileLogs: any[]): RoastChartData {
  // Transform log entries to chart points
  const dataPoints: ChartDataPoint[] = profileLogs.map(log => ({
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
      label: "CHARGE",
      type: "charge",
      color: "#10B981"
    },
    {
      timeSeconds: roastProfile.fc_start_time,
      temperature: roastProfile.fc_start_temp,
      label: "FIRST CRACK",
      type: "fc_start", 
      color: "#F59E0B"
    },
    {
      timeSeconds: roastProfile.drop_time,
      temperature: roastProfile.drop_temp,
      label: "DROP",
      type: "drop",
      color: "#EF4444"
    }
  ].filter(m => m.timeSeconds && m.temperature);
  
  // Create phase regions
  const phases: PhaseRegion[] = [
    {
      startTime: roastProfile.charge_time,
      endTime: roastProfile.dry_end_time,
      label: "Drying",
      percentage: roastProfile.dry_percent,
      color: "#EFF6FF"
    },
    {
      startTime: roastProfile.dry_end_time,
      endTime: roastProfile.fc_start_time,
      label: "Maillard", 
      percentage: roastProfile.maillard_percent,
      color: "#FEF3C7"
    },
    {
      startTime: roastProfile.fc_start_time,
      endTime: roastProfile.drop_time,
      label: "Development",
      percentage: roastProfile.development_percent,
      color: "#FEE2E2"
    }
  ].filter(p => p.startTime && p.endTime);
  
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
      yAxisMax: Math.max(...dataPoints.map(d => Math.max(d.beanTemp, d.environmentalTemp))) + 20
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
  const weightLoss = ((artisanData.weight[0] - artisanData.weight[1]) / artisanData.weight[0]) * 100;
  
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
    const { error: logError } = await supabase
      .from('profile_log')
      .insert(chunk);
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
      <label class="block text-sm font-medium mb-2">
        Artisan JSON File (.alog.json)
      </label>
      <input 
        type="file" 
        accept=".json,.alog.json"
        onchange={(e) => file = e.target.files?.[0] || null}
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
      <div class="mt-4 p-3 rounded-md {result.success ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}">
        {result.success ? 
          `Successfully imported ${result.data_points} data points` : 
          `Error: ${result.error}`
        }
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
  if (!data.temp1 || !Array.isArray(data.temp1)) errors.push('Missing or invalid bean temperature data');
  if (!data.temp2 || !Array.isArray(data.temp2)) errors.push('Missing or invalid environmental temperature data');
  
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
  const milestones = logs.filter(log => 
    log.is_charge || log.is_fc_start || log.is_drop || log.is_cool
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

## Conclusion

This mapping provides a comprehensive bridge between Artisan's rich roast profile data and a modern web application architecture. The schema preserves all critical information while making it accessible for real-time charting, analysis, and sharing. The modular design allows for future expansion while maintaining compatibility with existing roast tracking workflows.