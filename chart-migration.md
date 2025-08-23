# Chart Interface Migration Analysis & Optimization Plan

## Executive Summary

**Current Status**: Attempted simplification by creating new API endpoints has **increased complexity without performance gains**. The implementation adds overhead while maintaining the same underlying database query patterns.

**Recommendation**: Pursue **Option B - Database Layer Optimization** to achieve genuine performance improvements that justify the added API complexity.

---

## Performance Assessment: Current Implementation

### ❌ **What We Actually Built**

1. **Two New API Endpoints**:
   - `/api/roast-chart-data/+server.ts` - Main data endpoint
   - `/api/roast-chart-settings/+server.ts` - Chart settings endpoint

2. **Current Architecture**: 
   ```
   Frontend → /api/roast-chart-data → roastDataService.getChartData() → Database (4+ queries)
   ```

### ❌ **Performance Reality Check**

**Zero performance improvements achieved:**

1. **Same Database Queries**: The new API still uses `roastDataService.getChartData()` internally, executing identical database operations:
   - `getTemperatureData()` - RPC call to `get_even_temp_ids`
   - `getMilestoneEvents()` - Query roast_events for milestones
   - `getControlEvents()` - Query roast_events for controls  
   - `getEventValueSeries()` - Query roast_events for value series

2. **Added Overhead**: Actually introduced performance penalties:
   - Extra HTTP request/response cycle
   - Additional JSON serialization/deserialization
   - Data format conversion: Database → Service Format → D3ChartData → savedEventValueSeries
   - Memory overhead from duplicate data structures

3. **No Query Optimization**: Same RPC functions, indexes, and database access patterns.

### ❌ **Complexity Analysis**

**Made system MORE complex, not simpler:**

**Before (Original)**:
```
Database → roastDataService → Frontend (direct usage)
Steps: 3-4 total
```

**After (Current Implementation)**:
```
Database → roastDataService → /api/roast-chart-data → D3ChartData format → 
savedEventValueSeries conversion → Frontend rendering
Steps: 6-8 total (increased!)
```

**Pipeline Steps Reality**:
- **Target Goal**: 2-3 steps  
- **Actual Result**: 6-8 steps (more than before)
- **Chart.md Goal**: FAILED - added complexity instead of reducing it

### 🎯 **What Was Actually Achieved**

**Positive Outcomes:**
1. ✅ **Working Chart**: Fixed authentication context issue (used `locals.supabase` vs `createClient()`)
2. ✅ **Clean Interface Design**: Created well-structured `D3ChartData` interface
3. ✅ **Event String Mapping**: Properly maps `burner/air → heat/fan`
4. ✅ **Data Compatibility**: Chart renders with correct control events

**Negative Outcomes:**
1. ❌ **No Performance Gains**: Same query execution time, added API overhead
2. ❌ **Increased Complexity**: More transformation layers, duplicate logic
3. ❌ **Technical Debt**: Multiple data format conversions to maintain
4. ❌ **Maintenance Burden**: Two additional API endpoints without justified benefits

### 🔍 **Root Cause Analysis**

**Original Problem Statement (from Chart.md)**:
- "8+ transformation steps causing NaN errors"
- "Overly complex data transformation pipeline"
- "Too many touch points between backend and D3.js"

**What We Actually Solved**:
- Authentication context for data access ✅
- Event string mapping consistency ✅

**What We DIDN'T Solve**:
- Database query performance ❌
- Data transformation complexity ❌ (made worse)
- Number of processing steps ❌ (increased)

**The Core Issues Remain**:
1. **Multiple database round trips** for single chart load
2. **Complex data transformations** in multiple layers
3. **Poor error handling** in data pipeline
4. **Inefficient data sampling** for large datasets

---

## Option B: Database Layer Optimization Plan (Revised)

### Strategic Overview

**Philosophy**: Optimize database queries for efficiency while keeping data formatting logic transparent in the frontend codebase. Focus on reducing query complexity and implementing adaptive sampling for Supabase's row limits, not data transformation.

**Expected Outcomes**:
- **80% reduction** in database queries (4+ → 2 RPC calls)
- **60% improvement** in API response time
- **Adaptive sampling** to respect Supabase 1,000 row limits
- **Frontend-visible formatting** logic for better maintainability
- **Simplified data flow** without unnecessary mappings

### 1. Database Function Optimization

#### Current Database Access Pattern
```sql
-- 4 separate queries executed in parallel:
-- 1. get_even_temp_ids(roast_id) - temperature sampling
-- 2. SELECT * FROM roast_events WHERE category = 'milestone' 
-- 3. SELECT * FROM roast_events WHERE category IN ('control', 'machine')
-- 4. SELECT * FROM roast_events WHERE event_value IS NOT NULL
```

#### Revised Optimized RPC Functions (Frontend-Focused)

**A. Simplified Data Function - `get_chart_data_raw(roast_id, sample_rate)`**

```sql
CREATE OR REPLACE FUNCTION get_chart_data_raw(
    roast_id_param INTEGER,
    sample_rate INTEGER DEFAULT 1
)
RETURNS TABLE(
    data_type TEXT,           -- 'temperature', 'milestone', 'control'  
    time_seconds NUMERIC,     -- Keep as seconds, let frontend convert
    field_name TEXT,          -- Raw field names: 'bean_temp', 'environmental_temp', etc.
    value_numeric NUMERIC,
    event_string TEXT,        -- Raw event_string from database
    category TEXT,
    subcategory TEXT
) 
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    -- Temperature data with adaptive sampling
    SELECT 
        'temperature'::TEXT as data_type,
        rt.time_seconds,
        'bean_temp'::TEXT as field_name,
        rt.bean_temp as value_numeric,
        NULL::TEXT as event_string,
        'temperature'::TEXT as category,
        'bean'::TEXT as subcategory
    FROM roast_temperatures rt 
    WHERE rt.roast_id = roast_id_param 
      AND rt.bean_temp IS NOT NULL
      AND rt.id % sample_rate = 0  -- Adaptive sampling
    
    UNION ALL
    
    SELECT 
        'temperature'::TEXT,
        rt.time_seconds,
        'environmental_temp'::TEXT,
        rt.environmental_temp,
        NULL::TEXT,
        'temperature'::TEXT,
        'environmental'::TEXT
    FROM roast_temperatures rt 
    WHERE rt.roast_id = roast_id_param 
      AND rt.environmental_temp IS NOT NULL
      AND rt.id % sample_rate = 0
      
    UNION ALL
    
    SELECT 
        'temperature'::TEXT,
        rt.time_seconds,
        'ror_bean_temp'::TEXT,
        rt.ror_bean_temp,
        NULL::TEXT,
        'temperature'::TEXT,
        'ror'::TEXT
    FROM roast_temperatures rt 
    WHERE rt.roast_id = roast_id_param 
      AND rt.ror_bean_temp IS NOT NULL 
      AND rt.ror_bean_temp > 0 
      AND rt.ror_bean_temp <= 50
      AND rt.id % sample_rate = 0
    
    UNION ALL
    
    -- Control events (NO pre-mapping - return raw event_string values)
    SELECT 
        'control'::TEXT,
        re.time_seconds,
        'event_value'::TEXT,
        re.event_value::NUMERIC,
        re.event_string,  -- Raw event_string (burner, air, etc.)
        re.category,
        re.subcategory
    FROM roast_events re
    WHERE re.roast_id = roast_id_param
      AND re.event_value IS NOT NULL
      AND re.event_value ~ '^[0-9]+(\.[0-9]+)?$'  -- Valid numeric values only
      
    UNION ALL
    
    -- Milestone events (NO pre-computed display names)
    SELECT 
        'milestone'::TEXT,
        re.time_seconds,
        'milestone'::TEXT,
        NULL::NUMERIC,
        re.event_string,  -- Raw event_string (charge, dry_end, etc.)
        re.category,
        re.subcategory
    FROM roast_events re
    WHERE re.roast_id = roast_id_param
      AND re.category = 'milestone'
    
    ORDER BY time_seconds, data_type;
END;
$$;
```

**B. Chart Metadata Function - `get_chart_metadata(roast_id)`**

```sql
CREATE OR REPLACE FUNCTION get_chart_metadata(roast_id_param INTEGER)
RETURNS TABLE(
    time_min_ms BIGINT,
    time_max_ms BIGINT, 
    temp_min NUMERIC,
    temp_max NUMERIC,
    ror_min NUMERIC,
    ror_max NUMERIC,
    charge_time_ms BIGINT,
    total_data_points INTEGER,
    roast_duration_minutes NUMERIC
)
LANGUAGE plpgsql 
AS $$
DECLARE
    charge_time NUMERIC;
    temp_count INTEGER;
BEGIN
    -- Get charge time from milestone events
    SELECT re.time_seconds INTO charge_time
    FROM roast_events re 
    WHERE re.roast_id = roast_id_param 
      AND re.event_string = 'charge'
    LIMIT 1;
    
    -- Count temperature data points
    SELECT COUNT(*) INTO temp_count
    FROM roast_temperatures rt
    WHERE rt.roast_id = roast_id_param;

    RETURN QUERY
    SELECT 
        COALESCE(MIN(rt.time_seconds * 1000), 0)::BIGINT as time_min_ms,
        COALESCE(MAX(rt.time_seconds * 1000), 0)::BIGINT as time_max_ms,
        COALESCE(MIN(LEAST(rt.bean_temp, rt.environmental_temp)), 0) as temp_min,
        COALESCE(MAX(GREATEST(rt.bean_temp, rt.environmental_temp)), 500) as temp_max,
        COALESCE(MIN(rt.ror_bean_temp) FILTER (WHERE rt.ror_bean_temp > 0), 0) as ror_min,
        COALESCE(MAX(rt.ror_bean_temp) FILTER (WHERE rt.ror_bean_temp <= 50), 50) as ror_max,
        COALESCE(charge_time * 1000, MIN(rt.time_seconds * 1000), 0)::BIGINT as charge_time_ms,
        temp_count as total_data_points,
        COALESCE(
            (MAX(rt.time_seconds) - MIN(rt.time_seconds)) / 60.0, 
            0
        ) as roast_duration_minutes
    FROM roast_temperatures rt
    WHERE rt.roast_id = roast_id_param;
END;
$$;
```

**C. Time-Based Adaptive Sampling - `get_chart_data_sampled(roast_id, target_points)` - CORRECTED**

```sql
CREATE OR REPLACE FUNCTION get_chart_data_sampled(
    roast_id_param INTEGER,
    target_points INTEGER DEFAULT 400  -- Target points to stay under 1,000 total rows
)
RETURNS TABLE(
    data_type TEXT,
    time_milliseconds BIGINT,  -- CORRECTED: Return milliseconds to match metadata function
    field_name TEXT,
    value_numeric NUMERIC,
    event_string TEXT,
    category TEXT,
    subcategory TEXT
) 
LANGUAGE plpgsql
AS $$
DECLARE
    time_interval NUMERIC;
    min_time NUMERIC;
    max_time NUMERIC;
BEGIN
    -- Get time range for this roast (still in seconds for calculations)
    SELECT MIN(rt.time_seconds), MAX(rt.time_seconds)
    INTO min_time, max_time
    FROM roast_temperatures rt
    WHERE rt.roast_id = roast_id_param;
    
    -- Calculate time interval for sampling (ensures uniform distribution)
    time_interval := GREATEST(
        (max_time - min_time) / target_points::NUMERIC,
        1.0  -- Minimum 1 second intervals
    );
    
    RETURN QUERY
    -- Time-based sampled temperature data
    WITH sampled_temps AS (
        SELECT rt.*,
               FLOOR((rt.time_seconds - min_time) / time_interval) as time_bucket
        FROM roast_temperatures rt
        WHERE rt.roast_id = roast_id_param
    ),
    representative_temps AS (
        SELECT DISTINCT ON (time_bucket) *
        FROM sampled_temps
        ORDER BY time_bucket, time_seconds, temp_id
    )
    
    -- Bean temperature points
    SELECT 
        'temperature'::TEXT as data_type,
        (rt.time_seconds * 1000)::BIGINT as time_milliseconds,  -- CORRECTED: Convert to milliseconds
        'bean_temp'::TEXT as field_name,
        rt.bean_temp as value_numeric,
        NULL::TEXT as event_string,
        'temperature'::TEXT as category,
        'bean'::TEXT as subcategory
    FROM representative_temps rt
    WHERE rt.bean_temp IS NOT NULL
    
    UNION ALL
    
    -- Environmental temperature points  
    SELECT 
        'temperature'::TEXT,
        (rt.time_seconds * 1000)::BIGINT,  -- CORRECTED: Convert to milliseconds
        'environmental_temp'::TEXT,
        rt.environmental_temp,
        NULL::TEXT,
        'temperature'::TEXT,
        'environmental'::TEXT
    FROM representative_temps rt
    WHERE rt.environmental_temp IS NOT NULL
    
    UNION ALL
    
    -- RoR points
    SELECT 
        'temperature'::TEXT,
        (rt.time_seconds * 1000)::BIGINT,  -- CORRECTED: Convert to milliseconds
        'ror_bean_temp'::TEXT,
        rt.ror_bean_temp,
        NULL::TEXT,
        'temperature'::TEXT,
        'ror'::TEXT
    FROM representative_temps rt
    WHERE rt.ror_bean_temp IS NOT NULL 
      AND rt.ror_bean_temp > 0 
      AND rt.ror_bean_temp <= 50
    
    UNION ALL
    
    -- ALL control events (don't sample these - they're already sparse)
    SELECT 
        'control'::TEXT,
        (re.time_seconds * 1000)::BIGINT,  -- CORRECTED: Convert to milliseconds
        'event_value'::TEXT,
        re.event_value::NUMERIC,
        re.event_string,
        re.category,
        re.subcategory
    FROM roast_events re
    WHERE re.roast_id = roast_id_param
      AND re.event_value IS NOT NULL
      AND re.event_value ~ '^-?[0-9]+(\.[0-9]+)?(%)?$'  -- Include negatives/percentages
      
    UNION ALL
    
    -- ALL milestone events (don't sample these - they're critical)
    SELECT 
        'milestone'::TEXT,
        (re.time_seconds * 1000)::BIGINT,  -- CORRECTED: Convert to milliseconds
        'milestone'::TEXT,
        NULL::NUMERIC,
        re.event_string,
        re.category,
        re.subcategory
    FROM roast_events re
    WHERE re.roast_id = roast_id_param
      AND re.category = 'milestone'
    
    ORDER BY time_milliseconds, data_type;  -- CORRECTED: Order by milliseconds
END;
$$;
```

### 2. Database Indexing Strategy

#### Current Index Analysis Required

**Diagnostic Queries**:
```sql
-- Check existing indexes
SELECT schemaname, tablename, indexname, indexdef 
FROM pg_indexes 
WHERE tablename IN ('roast_temperatures', 'roast_events');

-- Analyze query performance  
EXPLAIN ANALYZE 
SELECT * FROM roast_temperatures 
WHERE roast_id = 287 
ORDER BY time_seconds;

-- Check for sequential scans
SELECT schemaname, tablename, seq_scan, seq_tup_read, idx_scan, idx_tup_fetch
FROM pg_stat_user_tables 
WHERE tablename IN ('roast_temperatures', 'roast_events');
```

#### Proposed Optimized Indexes (Schema-Corrected)

```sql
-- Primary composite indexes for main query patterns
CREATE INDEX IF NOT EXISTS idx_roast_temperatures_roast_time_composite
ON roast_temperatures(roast_id, time_seconds, temp_id) 
INCLUDE (bean_temp, environmental_temp, ror_bean_temp);

-- Specialized index for time-based sampling queries  
CREATE INDEX IF NOT EXISTS idx_roast_temperatures_sampling
ON roast_temperatures(roast_id, temp_id, time_seconds)
WHERE bean_temp IS NOT NULL OR environmental_temp IS NOT NULL;

-- Event queries optimization
CREATE INDEX IF NOT EXISTS idx_roast_events_roast_category_time
ON roast_events(roast_id, category, time_seconds)
INCLUDE (event_string, event_value);

-- Control events specific index (updated regex)
CREATE INDEX IF NOT EXISTS idx_roast_events_controls_optimized  
ON roast_events(roast_id, time_seconds, event_string)
WHERE event_value IS NOT NULL 
  AND event_value ~ '^-?[0-9]+(\.[0-9]+)?(%)?$';

-- Milestone events specific index
CREATE INDEX IF NOT EXISTS idx_roast_events_milestones_optimized
ON roast_events(roast_id, event_string, time_seconds)
WHERE category = 'milestone';

-- Charge time lookup optimization
CREATE INDEX IF NOT EXISTS idx_roast_events_charge_lookup
ON roast_events(roast_id, time_seconds)
WHERE event_string = 'charge';
```

### 3. API Layer Simplification

#### Revised API Implementation (Frontend-Focused)

**`/api/roast-chart-data/+server.ts`** (Simplified, Raw Data):

```typescript
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export interface RawChartData {
    rawData: Array<{
        data_type: 'temperature' | 'milestone' | 'control';
        time_seconds: number;
        field_name: string;
        value_numeric: number | null;
        event_string: string | null;
        category: string;
        subcategory: string;
    }>;
    metadata: {
        dataPoints: number;
        roastDurationMinutes: number;
        sampleRate: number;
        performanceMetrics: {
            dbQueryTime: number;
            processingTime: number;
            totalApiTime: number;
        };
    };
}

// Frontend formatting utilities (will be moved to frontend)
export function formatDisplayName(eventString: string): string {
    return eventString
        .split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
}

export const GET: RequestHandler = async ({ url, locals }) => {
    const startTime = performance.now();
    const { safeGetSession, supabase } = locals;
    const { user } = await safeGetSession();

    if (!user) {
        return json({ error: 'Authentication required' }, { status: 401 });
    }

    const roastId = url.searchParams.get('roastId');
    if (!roastId || isNaN(parseInt(roastId))) {
        return json({ error: 'Valid roastId parameter required' }, { status: 400 });
    }

    const roastIdNum = parseInt(roastId);

    try {
        const dbQueryStart = performance.now();
        
        // First, calculate adaptive sample rate for Supabase limits
        const { data: sampleRateData, error: sampleError } = await supabase.rpc(
            'get_adaptive_sample_rate', 
            { roast_id_param: roastIdNum, max_rows: 800 }
        );
        
        if (sampleError) {
            console.error('Error calculating sample rate:', sampleError);
            return json({ error: 'Failed to calculate sampling rate' }, { status: 500 });
        }
        
        const sampleRate = sampleRateData || 1;
        console.log(`Using adaptive sample rate: ${sampleRate} for roast ${roastIdNum}`);
        
        // Get raw data with adaptive sampling
        const [{ data: chartData, error: dataError }, { data: metadata, error: metaError }] = 
            await Promise.all([
                supabase.rpc('get_chart_data_raw', { 
                    roast_id_param: roastIdNum, 
                    sample_rate: sampleRate 
                }),
                supabase.rpc('get_chart_metadata', { roast_id_param: roastIdNum })
            ]);

        const dbQueryTime = performance.now() - dbQueryStart;

        if (dataError || metaError) {
            console.error('Database query error:', { dataError, metaError });
            return json({ error: 'Failed to fetch chart data' }, { status: 500 });
        }

        const processingStart = performance.now();
        
        // Minimal processing - just package the raw data
        const responseData: RawChartData = {
            rawData: chartData || [],
            metadata: {
                dataPoints: metadata?.[0]?.total_data_points || 0,
                roastDurationMinutes: metadata?.[0]?.roast_duration_minutes || 0,
                sampleRate,
                performanceMetrics: {
                    dbQueryTime,
                    processingTime: 0,
                    totalApiTime: 0
                }
            }
        };
        
        const processingTime = performance.now() - processingStart;
        const totalApiTime = performance.now() - startTime;

        // Add performance metrics
        responseData.metadata.performanceMetrics.processingTime = processingTime;
        responseData.metadata.performanceMetrics.totalApiTime = totalApiTime;

        console.log(`Raw chart data API: ${chartData?.length || 0} rows, ${dbQueryTime.toFixed(2)}ms DB, sample rate: ${sampleRate}`);

        return json(responseData);

    } catch (error) {
        console.error('Error fetching raw chart data:', error);
        return json({ error: 'Failed to process chart data' }, { status: 500 });
    }
};
```

### 4. Frontend Integration Updates

#### Updated `loadSavedRoastData()` Function (Frontend Data Formatting)

```typescript
// In RoastChartInterface.svelte

// Frontend formatting utility - visible and maintainable
function formatDisplayName(eventString: string): string {
    return eventString
        .split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
}

// Frontend control mapping - question: do we really need heat/fan conversions?
function getControlMapping(eventString: string) {
    // TODO: Evaluate if these conversions are actually necessary
    // Current mapping preserves existing chart functionality
    switch (eventString) {
        case 'burner':
        case 'heat_setting':
            return 'heat';
        case 'air': 
        case 'fan_setting':
            return 'fan';
        default:
            return eventString; // Use raw event_string if no mapping needed
    }
}

async function loadSavedRoastData(roastId: number) {
    try {
        const fetchStart = performance.now();
        
        // Single API call to raw data endpoint
        const response = await fetch(`/api/roast-chart-data?roastId=${roastId}`);
        if (!response.ok) {
            throw new Error(`Failed to load roast data: ${response.status}`);
        }
        
        const { rawData, metadata }: RawChartData = await response.json();
        const fetchTime = performance.now() - fetchStart;
        
        console.log('=== RAW DATA LOAD (Frontend Processing) ===', {
            roastId,
            fetchTime: `${fetchTime.toFixed(2)}ms`,
            dbQueryTime: `${metadata.performanceMetrics.dbQueryTime.toFixed(2)}ms`,
            rawDataRows: rawData.length,
            sampleRate: metadata.sampleRate,
            totalDataPoints: metadata.dataPoints
        });

        // Frontend data processing - all logic visible here
        const processingStart = performance.now();
        
        // Group raw data into chart structures
        const temperatures = { beanTemp: [], envTemp: [], ror: [] };
        const controls = new Map<string, Array<{ time: number; value: number }>>();
        const milestones = [];
        
        for (const row of rawData) {
            const timeMs = row.time_seconds * 1000; // Convert to milliseconds for D3
            
            if (row.data_type === 'temperature' && row.value_numeric !== null) {
                const point = { time: timeMs, value: row.value_numeric };
                
                if (row.field_name === 'bean_temp') {
                    temperatures.beanTemp.push(point);
                } else if (row.field_name === 'environmental_temp') {
                    temperatures.envTemp.push(point);
                } else if (row.field_name === 'ror_bean_temp') {
                    temperatures.ror.push(point);
                }
                
            } else if (row.data_type === 'control' && row.value_numeric !== null && row.event_string) {
                const point = { time: timeMs, value: row.value_numeric };
                const controlType = getControlMapping(row.event_string);
                
                if (!controls.has(controlType)) {
                    controls.set(controlType, []);
                }
                controls.get(controlType)!.push(point);
                
            } else if (row.data_type === 'milestone' && row.event_string) {
                milestones.push({
                    time: timeMs,
                    name: row.event_string,
                    displayName: formatDisplayName(row.event_string) // Dynamic formatting
                });
            }
        }
        
        // Convert to existing chart data structures (minimally)
        savedTemperatureEntries = convertToTemperatureEntries(temperatures);
        savedEventEntries = convertToEventEntries(milestones, roastId);
        
        // Convert controls to savedEventValueSeries format for chart rendering
        savedEventValueSeries = [];
        
        for (const [controlType, values] of controls) {
            if (values.length > 0) {
                // Map control types back to original event_string for chart
                const eventString = controlType === 'heat' ? 'burner' : 
                                  controlType === 'fan' ? 'air' : controlType;
                
                savedEventValueSeries.push({
                    event_string: eventString,
                    category: 'control',
                    values: values.map(p => ({ 
                        time_seconds: p.time / 1000, 
                        value: p.value 
                    })),
                    value_range: {
                        min: Math.min(...values.map(p => p.value)),
                        max: Math.max(...values.map(p => p.value)),
                        detected_scale: 'percentage'
                    }
                });
            }
        }

        // Set milestone markers for chart using formatted display names
        $roastEvents = milestones.map(milestone => ({
            time: milestone.time,
            name: milestone.displayName
        }));
        
        const processingTime = performance.now() - processingStart;
        
        console.log('Frontend processing completed:', {
            processingTime: `${processingTime.toFixed(2)}ms`,
            temperaturePoints: temperatures.beanTemp.length + temperatures.envTemp.length + temperatures.ror.length,
            controlSeries: savedEventValueSeries.length,
            milestoneCount: milestones.length
        });

    } catch (error) {
        console.error('Error loading raw roast data:', error);
        // Fallback to original service if needed
        await loadSavedRoastDataFallback(roastId);
    }
}
```

### 5. Performance Measurement & Validation

#### Metrics Collection Plan

**Database Performance**:
```sql
-- Before optimization baseline
EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)  
SELECT rt.* FROM roast_temperatures rt WHERE rt.roast_id = 287;

-- After optimization measurement
EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
SELECT * FROM get_chart_data_optimized(287);
```

**API Performance Monitoring**:
```typescript
// Built into optimized API response
interface PerformanceMetrics {
    dbQueryTime: number;        // Database execution time
    processingTime: number;     // Data transformation time  
    totalApiTime: number;       // Complete request cycle
    networkPayloadSize: number; // Response size in bytes
}
```

**Frontend Performance**:
```typescript
// Chart rendering performance
const renderStart = performance.now();
updateChart(processedData);
const renderTime = performance.now() - renderStart;

console.log('Chart render performance:', {
    dataPoints: processedData.length,
    renderTime: `${renderTime.toFixed(2)}ms`,
    renderRate: `${(processedData.length / renderTime * 1000).toFixed(0)} points/sec`
});
```

#### Expected Performance Improvements

**Database Layer**:
- Query count: 4+ queries → 2 RPC calls (**80% reduction**)
- Query execution time: ~150ms → ~30ms (**80% improvement**)
- Network round trips: 4+ → 2 (**50% reduction**)

**API Layer**:
- Response time: ~200ms → ~80ms (**60% improvement**) 
- Data processing: Complex transforms → Simple grouping (**70% reduction**)
- Memory usage: Multiple copies → Single pass (**50% reduction**)

**Frontend Layer**:
- Data loading: Multiple format conversions → Direct usage (**70% reduction**)
- Chart updates: Complex merging → Optimized rendering (**40% improvement**)

### 6. Revised Implementation Plan

#### Phase 1: Database Functions (2 days)
**Day 1:**
- Create `get_chart_data_raw()` RPC function (returns raw data, no transformations)
- Implement `get_chart_metadata()` function for ranges/configs
- Add `get_adaptive_sample_rate()` with Supabase row limit logic

**Day 2:**
- Add optimized database indexes for new query patterns
- Test adaptive sampling with large datasets (ensure < 1,000 rows)
- Performance baseline with existing system

#### Phase 2: API Simplification (1 day)  
**Day 3:**
- Update `/api/roast-chart-data/+server.ts` to return raw data only
- Implement adaptive sampling integration
- Remove all data transformation logic from API
- Add performance metrics collection

#### Phase 3: Frontend Data Processing (2 days)
**Day 4:**
- Move all formatting logic to `loadSavedRoastData()` function
- Implement dynamic `formatDisplayName()` (no hard-coded translations)
- Question necessity of heat/fan mapping conversions

**Day 5:**
- Test end-to-end data flow with raw data approach
- Validate chart rendering with frontend-processed data
- Compare performance: frontend vs backend processing

#### Phase 4: Optimization & Validation (1 day)
**Day 6:**
- Performance testing and comparison with original system
- Validate adaptive sampling stays under Supabase limits
- Documentation of visible frontend logic

**Total Timeline: 6 days**

### 7. Critical Risk Analysis & Mitigation

#### A. **Sampling Strategy Risks** 🚨

**Risk**: ID-based sampling (`id % sample_rate`) fails with:
- Non-sequential IDs due to deletions/imports
- Uneven time distribution 
- Misaligned temperature vs event timing

**✅ Solution**: Time-based sampling with buckets
- Uniform time intervals ensure consistent chart appearance
- Preserve ALL control/milestone events (they're sparse)
- Use representative temperature points per time bucket

#### B. **Index Performance Impact** ⚠️

**Risk**: Creating 6-7 new indexes simultaneously could:
- Slow down roast data inserts during live sessions
- Lock tables during index creation
- Increase storage overhead significantly

**✅ Mitigation Strategy**:
```sql
-- Phase 1: Essential indexes only (2-3 most impactful)
CREATE INDEX CONCURRENTLY idx_roast_temperatures_time_composite
ON roast_temperatures(roast_id, time_seconds) 
INCLUDE (bean_temp, environmental_temp);

CREATE INDEX CONCURRENTLY idx_roast_events_category_time  
ON roast_events(roast_id, category, time_seconds);

-- Phase 2: Measure performance, add remaining indexes if needed
-- Use CONCURRENTLY to avoid table locks
```

#### C. **Heat/Fan Mapping Strategy** 🔧

**Configurable Approach**:
```typescript
// Frontend configuration - visible and adjustable
const CONTROL_MAPPING = {
    useSimplified: true,  // User preference
    mappings: {
        'burner': 'heat',
        'air': 'fan'
    }
};

function getControlDisplayName(eventString: string): string {
    return CONTROL_MAPPING.useSimplified 
        ? CONTROL_MAPPING.mappings[eventString] || eventString
        : eventString;
}
```

#### D. **Supabase Payload Limits** 📊

**Risk**: Even with <1,000 rows, JSON payload size could exceed limits

**✅ Testing Strategy**:
```sql
-- Test with largest known roast
SELECT 
    COUNT(*) as row_count,
    pg_size_pretty(
        pg_total_relation_size('roast_temperatures'::regclass) + 
        pg_total_relation_size('roast_events'::regclass)
    ) as table_sizes
FROM get_chart_data_sampled(287, 400);  -- Test with roast 287
```

**Fallback Plan**: Progressive loading if needed
```typescript
// Frontend fallback for oversized responses
async function loadChartDataWithFallback(roastId: number) {
    try {
        return await loadFullChartData(roastId);
    } catch (error) {
        if (error.message.includes('payload')) {
            console.warn('Payload too large, using progressive loading');
            return await loadProgressiveChartData(roastId);
        }
        throw error;
    }
}
```

#### E. **Chart Bounds Guarantee** 📈

**Problem**: Sampled data might not include min/max values

**✅ Solution**: Metadata function includes bounds
```sql
-- Always include actual min/max in metadata
SELECT 
    MIN(bean_temp) as temp_min,
    MAX(bean_temp) as temp_max,
    MIN(time_seconds) as time_min, 
    MAX(time_seconds) as time_max
FROM roast_temperatures 
WHERE roast_id = roast_id_param;
```

**Frontend Implementation**:
```typescript
// Ensure chart bounds include all data
const chartBounds = {
    x: [metadata.time_min * 1000, metadata.time_max * 1000],
    y: [metadata.temp_min - 10, metadata.temp_max + 10],  // Add padding
};
```

#### F. **Event Value Parsing Coverage** 🔍

**Current regex is too restrictive**: `^[0-9]+(\.[0-9]+)?$`

**✅ Enhanced parsing**:
```sql
-- Support negatives, decimals, percentages
WHERE re.event_value ~ '^-?[0-9]+(\.[0-9]+)?(%)?$'

-- With validation logging
AND CASE 
    WHEN re.event_value !~ '^-?[0-9]+(\.[0-9]+)?(%)?$' THEN
        (SELECT pg_notify('invalid_event_value', 
            format('roast_id: %s, event: %s, value: %s', 
                roast_id_param, re.event_string, re.event_value)) 
         RETURNING FALSE)
    ELSE TRUE
END
```

### 7. Risk Mitigation

#### Potential Issues & Solutions

**Database Function Complexity**:
- Risk: RPC functions become maintenance burden
- Mitigation: Comprehensive test suite, clear documentation, gradual rollout

**Data Accuracy**:
- Risk: Optimized queries return different results
- Mitigation: Parallel testing, data validation, rollback capability  

**Performance Regression**:
- Risk: Optimizations don't deliver expected gains
- Mitigation: Baseline measurements, incremental optimization, fallback options

**Deployment Complexity**:
- Risk: Database migrations in production
- Mitigation: Zero-downtime deployment, feature flags, monitoring

#### Rollback Strategy

1. **Database Level**: Keep original tables/functions during transition
2. **API Level**: Feature flag to switch between old/new endpoints  
3. **Frontend Level**: Graceful fallback to original service
4. **Monitoring**: Real-time performance alerts and automatic rollback triggers

### 8. Success Criteria

#### Quantitative Metrics
- Database query time: >60% improvement
- API response time: >50% improvement  
- Frontend processing time: >40% improvement
- Memory usage: >30% reduction
- Chart render time: >25% improvement

#### Qualitative Goals
- Simplified codebase with fewer transformation layers
- Better error handling and debugging capabilities
- Improved maintainability through optimized database functions
- Enhanced monitoring and performance visibility

---

## Conclusion - Revised Approach

**Option B - Database Query Optimization with Frontend Data Processing** provides the best balance of performance improvement and code maintainability. This revised approach:

### ✅ **Addresses User Feedback**:
1. **Frontend-visible formatting logic** - All transformations visible in component code
2. **Dynamic string formatting** - No hard-coded milestone name translations  
3. **Questioned mapping necessity** - Heat/fan conversions marked for evaluation
4. **Supabase row limit compliance** - Adaptive sampling respects 1,000 row limits

### 🎯 **Core Benefits**:
1. **Database optimization** - Genuine performance improvements through fewer queries
2. **Transparent logic** - All data formatting visible in frontend codebase
3. **Maintainable approach** - Clear separation between database efficiency and data presentation
4. **Adaptive sampling** - Automatic compliance with Supabase constraints

### 🔧 **Implementation Strategy**:
- **Phase 1**: Simple SQL functions returning raw data (no transformations)
- **Phase 2**: Minimal API layer (just data retrieval + sampling)  
- **Phase 3**: Frontend processing with visible formatting logic
- **Phase 4**: Performance validation and unnecessary mapping removal

**Key Success Factors**:
1. **Database efficiency without abstraction** - Fast queries, simple results
2. **Frontend transparency** - All formatting/mapping logic clearly visible
3. **Adaptive constraints** - Automatic compliance with platform limitations
4. **Pragmatic evaluation** - Question and remove unnecessary complexity

This approach achieves genuine performance gains while keeping the codebase transparent and maintainable, directly addressing your feedback on visibility and simplicity.