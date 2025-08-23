# RoastChartInterface Data Refactoring Project

## Project Overview

**Objective**: Simplify the complex chart data transformation pipeline for roast profile visualization from 8+ steps to 2-3 steps to eliminate NaN errors and improve maintainability.

**Root Problem**: The existing data flow had too many transformation steps and touch points between the backend API and D3.js chart rendering, causing NaN values to propagate and making debugging difficult.

## Core Issue

**D3.js NaN path errors** - Invalid data points causing chart rendering failures due to overly complex data transformation pipeline between database and chart rendering.

## Discovery Phase

### Database Architecture Analysis

- **`roast_temperatures`**: Current table for temperature data (`bean_temp`, `environmental_temp`, `ror_bean_temp`)
- **`roast_events`**: Current table for milestone and control events with `category` and `event_string` fields
- **Data Investigation**: Need to verify why new API finds no data while old service finds 27 control events

### Data Flow Analysis

**Old Complex Pipeline** (8+ steps):

1. Database query via `roastDataService`
2. RPC function `get_even_temp_ids` for sampling
3. Data transformation in service layer
4. Multiple format conversions
5. EventValueSeries processing
6. Chart data conversion in component
7. D3.js data binding
8. Chart rendering with validation

**Target Simplified Pipeline** (2-3 steps):

1. Direct API endpoint with D3-ready data structure
2. Minimal format conversion in frontend
3. Direct D3.js rendering

## Implementation Progress

### Phase 1: API Endpoint Creation ✅

- **Created** `/api/roast-chart-data/+server.ts`
- **Designed** `D3ChartData` interface with pre-processed data structure:
  ```typescript
  interface D3ChartData {
  	temperatures: {
  		beanTemp: Array<{ time: number; value: number }>;
  		envTemp: Array<{ time: number; value: number }>;
  		ror: Array<{ time: number; value: number }>;
  	};
  	controls: {
  		fan: Array<{ time: number; value: number }>;
  		heat: Array<{ time: number; value: number }>;
  	};
  	milestones: Array<{
  		time: number;
  		name: string;
  		displayName: string;
  	}>;
  	chartConfig: {
  		chargeTime: number;
  		timeRange: [number, number];
  		tempRange: [number, number];
  		rorRange: [number, number];
  	};
  }
  ```

### Phase 2: Frontend Integration ✅

- **Updated** `loadSavedRoastData()` in `RoastChartInterface.svelte`
- **Replaced** complex `roastDataService` calls with direct API fetch
- **Implemented** temperature data merging using Map structure
- **Added** comprehensive debug logging

### Phase 3: Supporting Infrastructure ✅

- **Created** `/api/roast-chart-settings/+server.ts` for chart configuration
- **Fixed** TypeScript compilation errors
- **Removed** old service dependencies

## Current Status: Debugging Phase

### Issues Discovered

**API Data Mismatch**:

- New API queries `roast_temperatures` and `roast_events` tables correctly
- Control events use `burner`/`air` strings instead of expected `heat_setting`/`fan_setting`. Control events should be agnostic to event_string which are only used to label the lines. category is the field that controls how the row is displayed

**Debug Output Analysis**:

```
Roast chart data for 287: {
  tempPoints: 0,           // No temperature data found in roast_temperatures
  controlPoints: 0,        // No control events found in roast_events
  milestones: 0,          // No milestones found
}

roastDataService.getEventValueSeries: {
  rawDataCount: 27,        // Old service finds 27 events
  groupedEventsKeys: ['burner', 'air']  // Event strings differ from expected
}
```

### Root Cause Analysis

1. **Event String Mapping**: Need to asses logic requirements for `burner`→`heat`, `air`→`fan` in new API. We can map burner heat air and fan but we also can use fallbacks. What is important is that these controls are mapped and that they are displayed with their event_string name. Ideally heat is red, air is blue and dampener is purple but the event colors don't really matter as long as their color keys & mapping is correct.
2. **Stored Procedure**: Old service uses `get_even_temp_ids` RPC function for temperature sampling
3. **Data Processing**: New API needs same data processing logic as old service

## Next Steps (In Progress)

**IMPORTANT: look to codebase setup in b784b53de0f3ed165e7965cc51476dececd20cd9 to reference a working roast chart interface. We want to simplify and clean up the logic - the existing logic was over complicating the data movement but it was working. Core methodology & intent should be considered when refactoring - we are not reinventing the interface and data movement, we are cleaning it up**

### Phase 4: Data Source Correction

1. **Fix event string mapping** in new API to handle `burner`/`air` event strings
2. **Use same RPC function** (`get_even_temp_ids`) as old service for temperature sampling
3. **Add debug logging** to new API to identify data retrieval issues

### Phase 5: Frontend Simplification

1. **Simplify temperature data conversion** logic
2. **Remove complex merging** that may introduce bugs
3. **Test with actual roast data** (roast_id 287)

### Phase 6: Validation & Cleanup

1. **Compare old vs new data output**
2. **Verify chart rendering works**
3. **Remove old transformation pipeline**
4. **Performance testing**

## Technical Insights

### Architecture Lessons

- **Service layer complexity**: Multiple transformation steps made debugging difficult
- **Event naming inconsistency**: Database uses `burner`/`air` instead of expected `heat_setting`/`fan_setting`
- **Data sampling necessity**: Large datasets require RPC sampling function for performance

### Performance Considerations

- **Data sampling**: `get_even_temp_ids` RPC function required for large temperature datasets
- **Chart rendering**: D3.js performance depends on data point count, sampling maintains performance

## Success Metrics

- [ ] Chart renders without NaN errors
- [ ] Control events appear on chart (not just tooltips)
- [ ] Data pipeline reduced from 8+ to 2-3 steps
- [ ] Maintainable codebase with clear data flow
- [ ] Performance maintained or improved

## Files Modified

- `src/routes/api/roast-chart-data/+server.ts` (new)
- `src/routes/api/roast-chart-settings/+server.ts` (new)
- `src/routes/roast/RoastChartInterface.svelte` (major updates)
- Debug logging added throughout data pipeline

---

_Status_: **In Progress** - Currently debugging data source mismatch between API and actual database structure.
