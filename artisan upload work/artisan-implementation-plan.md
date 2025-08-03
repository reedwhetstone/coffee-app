# Artisan .alog File Implementation Plan

## Overview
This plan details the complete implementation for replacing the existing CSV/Excel import functionality with native Artisan .alog file support, utilizing the existing chart area in `RoastChartInterface.svelte` for visualization.

## Current State Analysis

### Existing Infrastructure ✅
- **Database schema**: Complete with Artisan-ready tables and columns
- **Chart component**: `RoastChartInterface.svelte` with D3.js visualization
- **Import UI**: Modal and button infrastructure already in place
- **Helper functions**: Temperature conversion and time formatting available

### Current Import Flow (to be replaced)
- Modal accepts CSV/XLSX files
- Calls `/api/artisan-import` endpoint
- Currently expects CSV format from Artisan exports

## Implementation Plan

### Phase 1: Backend API Enhancement

#### File: `/src/routes/api/artisan-import/+server.ts`
**Status**: Replace existing CSV/Excel logic with .alog JSON parsing

**Key Changes**:
```typescript
// Replace existing CSV parsing with JSON parsing
interface ArtisanData {
  title: string;
  roastertype: string;
  temperature_unit: string; // "F" or "C"
  timex: number[];          // Time array in seconds
  temp1: number[];          // Bean temperature (BT)
  temp2: number[];          // Environmental temperature (ET)
  timeindex: number[];      // Milestone indices [CHARGE, DRY_END, FC_START, FC_END, SC_START, SC_END, DROP, COOL]
  weight: [number, number, string]; // [in, out, unit]
  // ... other Artisan metadata
}

// Data transformation logic
function transformArtisanData(artisanData: ArtisanData, roastId: number) {
  // 1. Extract milestones from timeindex array
  // 2. Transform timex/temp arrays to profile_log entries
  // 3. Calculate phase percentages
  // 4. Update roast_profiles with metadata
}
```

**Dependencies**:
- Database schema (✅ Complete)
- Helper functions for temperature conversion (✅ Available)

#### File: `/src/lib/types/artisan.ts` (New)
**Purpose**: TypeScript interfaces for Artisan data structures

```typescript
export interface ArtisanRoastData {
  // Metadata
  title: string;
  roastertype: string;
  roastersize: number;
  temperature_unit: 'F' | 'C';
  roastdate: string;
  roasttime: string;
  roast_uuid: string;
  
  // Time series data
  timex: number[];    // Time in seconds
  temp1: number[];    // Bean temperature
  temp2: number[];    // Environmental temperature
  
  // Milestone events
  timeindex: number[]; // [CHARGE, DRY_END, FC_START, FC_END, SC_START, SC_END, DROP, COOL]
  
  // Roast metadata
  weight: [number, number, string];
  operator?: string;
  organization?: string;
  roast_notes?: string;
  cupping_notes?: string;
}

export interface ProcessedRoastData {
  profileData: RoastProfileInsert;
  logEntries: ProfileLogEntry[];
  milestones: MilestoneData;
  phases: PhaseCalculations;
}
```

### Phase 2: Frontend Import Enhancement

#### File: `/src/routes/roast/RoastChartInterface.svelte`
**Status**: Update import modal and functionality

**Key Changes**:
1. **File Input Update** (Lines 1406-1412):
   ```svelte
   <!-- Change from CSV/XLSX to JSON -->
   <input
     type="file"
     accept=".alog.json,.json"
     onchange={handleArtisanFileSelect}
     class="..."
   />
   ```

2. **Import Function Enhancement** (Lines 1022-1066):
   ```typescript
   async function importArtisanFile() {
     // Validate .alog.json file
     // Parse JSON content
     // Send to enhanced API endpoint
     // Handle response and reload chart
   }
   ```

3. **File Validation**:
   ```typescript
   function validateArtisanFile(file: File): boolean {
     return file.name.endsWith('.alog.json') || file.name.endsWith('.json');
   }
   ```

### Phase 3: Chart Data Integration

#### File: `/src/routes/roast/RoastChartInterface.svelte`
**Status**: Enhance chart to display Artisan temperature data

**Key Enhancements**:

1. **Dual Temperature Support** (Lines 442-453):
   ```typescript
   // Enhance existing temperature line rendering
   const btLine = line<RoastPoint>()
     .x(d => xScale(d.time / (1000 * 60)))
     .y(d => yScaleTemp(d.bean_temp))
     .defined(d => d.bean_temp !== null);

   const etLine = line<RoastPoint>()
     .x(d => xScale(d.time / (1000 * 60))) 
     .y(d => yScaleTemp(d.environmental_temp))
     .defined(d => d.environmental_temp !== null);
   ```

2. **Milestone Markers Enhancement** (Lines 494-527):
   ```typescript
   // Add Artisan-specific milestone rendering
   const artisanMilestones = [
     { name: 'CHARGE', color: '#10B981' },
     { name: 'DRY END', color: '#F59E0B' },
     { name: 'FC START', color: '#EF4444' },
     { name: 'DROP', color: '#8B5CF6' }
   ];
   ```

3. **Temperature Scale Adjustment** (Lines 687, 631-653):
   ```typescript
   // Dynamic temperature range based on data
   const tempExtent = d3.extent(data, d => Math.max(d.bean_temp || 0, d.environmental_temp || 0));
   yScaleTemp.domain([tempExtent[0] - 50, tempExtent[1] + 50]);
   ```

### Phase 4: Data Loading and Display

#### File: `/src/routes/api/profile-log/+server.ts`
**Status**: Enhance to support Artisan data retrieval

**Key Changes**:
```typescript
// Add support for retrieving both live and imported data
const query = supabase
  .from('profile_log')
  .select(`
    *,
    time_seconds,
    environmental_temp,
    bean_temp,
    data_source
  `)
  .eq('roast_id', roastId)
  .order('time_seconds', { ascending: true });
```

#### File: `/src/routes/roast/stores.ts`
**Status**: Extend interfaces for Artisan data

**Key Changes**:
```typescript
export interface RoastPoint {
  time: number;
  heat: number;
  fan: number;
  bean_temp?: number | null;
  environmental_temp?: number | null; // Add ET support
  data_source?: 'live' | 'artisan_import';
}

export interface ProfileLogEntry {
  // ... existing fields
  environmental_temp?: number;
  time_seconds?: number;
  data_source?: string;
}
```

### Phase 5: Temperature Unit Handling

#### File: `/src/lib/utils/temperature.ts` (New)
**Purpose**: Temperature conversion utilities

```typescript
export function convertTemperature(
  value: number,
  from: 'F' | 'C',
  to: 'F' | 'C'
): number {
  if (from === to) return value;
  
  if (from === 'F' && to === 'C') {
    return (value - 32) * 5 / 9;
  } else {
    return (value * 9 / 5) + 32;
  }
}

export function formatTemperature(
  value: number,
  unit: 'F' | 'C',
  displayUnit?: 'F' | 'C'
): string {
  const displayValue = displayUnit && displayUnit !== unit
    ? convertTemperature(value, unit, displayUnit)
    : value;
  
  return `${displayValue.toFixed(1)}°${displayUnit || unit}`;
}
```

### Phase 6: Enhanced Milestone Display

#### File: `/src/routes/roast/RoastChartInterface.svelte`
**Status**: Update milestone calculation display (Lines 1282-1317)

**Key Changes**:
```svelte
<!-- Enhanced milestone display with Artisan data -->
<div class="grid grid-cols-2 gap-2 sm:grid-cols-4 md:grid-cols-6">
  <!-- Existing milestones -->
  <MilestoneCard label="CHARGE" value={chargeTemp} time={chargeTime} />
  <MilestoneCard label="DRY END" value={dryEndTemp} time={dryEndTime} />
  <MilestoneCard label="FC START" value={fcStartTemp} time={fcStartTime} />
  <MilestoneCard label="DROP" value={dropTemp} time={dropTime} />
  
  <!-- Phase calculations -->
  <MilestoneCard label="DRYING %" value={dryingDisplay} />
  <MilestoneCard label="MAILLARD %" value={maillardDisplay} />
  <MilestoneCard label="DEV %" value={devDisplay} />
</div>
```

### Phase 7: Error Handling and Validation

#### File: `/src/lib/utils/artisan-validator.ts` (New)
**Purpose**: Validate Artisan file structure

```typescript
export function validateArtisanData(data: any): ValidationResult {
  const errors: string[] = [];
  
  // Required fields validation
  if (!data.timex || !Array.isArray(data.timex)) {
    errors.push('Missing or invalid time data');
  }
  
  if (!data.temp1 || !Array.isArray(data.temp1)) {
    errors.push('Missing bean temperature data');
  }
  
  if (!data.temp2 || !Array.isArray(data.temp2)) {
    errors.push('Missing environmental temperature data');
  }
  
  // Array length consistency
  if (data.timex?.length !== data.temp1?.length) {
    errors.push('Time and temperature data length mismatch');
  }
  
  return { valid: errors.length === 0, errors };
}
```

## File Dependencies and Modifications

### New Files to Create:
1. `/src/lib/types/artisan.ts` - TypeScript interfaces
2. `/src/lib/utils/temperature.ts` - Temperature conversion utilities  
3. `/src/lib/utils/artisan-validator.ts` - Data validation
4. `/src/lib/components/MilestoneCard.svelte` - Reusable milestone display

### Existing Files to Modify:
1. `/src/routes/api/artisan-import/+server.ts` - **Major rewrite** for JSON parsing
2. `/src/routes/roast/RoastChartInterface.svelte` - **Enhanced** chart rendering and import modal
3. `/src/routes/api/profile-log/+server.ts` - **Minor updates** for data retrieval
4. `/src/routes/roast/stores.ts` - **Interface extensions** for new data types

### Database Tables Utilized:
- `roast_profiles` - Store Artisan metadata ✅
- `profile_log` - Store time series data ✅
- `artisan_import_log` - Track import history ✅
- `roast_events` - Store milestone events ✅

## Testing Strategy

### Unit Tests:
1. **Artisan data parsing** - Validate JSON structure transformation
2. **Temperature conversion** - Test F/C conversion accuracy
3. **Milestone extraction** - Verify timeindex to milestone mapping
4. **Phase calculations** - Validate percentage calculations

### Integration Tests:
1. **Full import workflow** - End-to-end .alog file processing
2. **Chart rendering** - Verify dual temperature line display
3. **Data persistence** - Confirm database storage accuracy
4. **Error handling** - Test malformed file handling

### User Acceptance Tests:
1. **File upload flow** - Test complete user experience
2. **Chart interaction** - Verify milestone markers and zoom
3. **Data accuracy** - Compare with Artisan software display
4. **Performance** - Test with large data sets (1000+ points)

## Migration Strategy

### Phase 1: Backend Foundation (Week 1)
- Implement JSON parsing in `/api/artisan-import`
- Create TypeScript interfaces and utilities
- Add data validation and error handling

### Phase 2: Frontend Integration (Week 2)  
- Update import modal for .alog.json files
- Enhance chart rendering for dual temperatures
- Implement milestone display enhancements

### Phase 3: Testing and Refinement (Week 3)
- Comprehensive testing with real Artisan files
- Performance optimization for large datasets
- User experience improvements and error handling

### Phase 4: Documentation and Deployment (Week 4)
- Update user documentation
- Create troubleshooting guides
- Deploy to production with feature flag

## Success Criteria

### Functional Requirements:
- ✅ Import .alog.json files successfully
- ✅ Display bean temperature (BT) and environmental temperature (ET) curves
- ✅ Show accurate milestone markers (charge, first crack, drop, etc.)
- ✅ Calculate and display phase percentages
- ✅ Handle temperature unit conversion (F/C)
- ✅ Maintain existing live roasting functionality

### Performance Requirements:
- Import files up to 10MB within 30 seconds
- Render charts with 1000+ data points smoothly
- Responsive chart interaction without lag

### User Experience Requirements:
- Intuitive file upload process
- Clear error messages for invalid files
- Visual feedback during import process
- Seamless integration with existing roast management

This implementation will transform the current basic import functionality into a comprehensive Artisan integration, providing professional-grade roast profile analysis and visualization capabilities.