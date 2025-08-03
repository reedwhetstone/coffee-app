-- Roast Data Migration Script
-- Migrates existing profile_log data to new roast_temperatures and roast_events structure
-- This script should be run AFTER the schema migration

-- ================================================================================
-- MIGRATION PHASE 1: MIGRATE TEMPERATURE DATA
-- ================================================================================

-- Insert temperature data from profile_log to roast_temperatures
INSERT INTO public.roast_temperatures (
    roast_id,
    time_seconds,
    bean_temp,
    environmental_temp,
    data_source,
    created_at
)
SELECT 
    pl.roast_id,
    COALESCE(pl.time_seconds, EXTRACT(EPOCH FROM pl.time)) as time_seconds,
    pl.bean_temp,
    pl.environmental_temp,
    COALESCE(pl.data_source, 'live') as data_source,
    NOW() as created_at
FROM public.profile_log pl
WHERE (pl.bean_temp IS NOT NULL OR pl.environmental_temp IS NOT NULL)
  AND COALESCE(pl.time_seconds, EXTRACT(EPOCH FROM pl.time)) IS NOT NULL
ORDER BY pl.roast_id, COALESCE(pl.time_seconds, EXTRACT(EPOCH FROM pl.time));

-- ================================================================================
-- MIGRATION PHASE 2: MIGRATE CONTROL EVENTS
-- ================================================================================

-- Insert fan_setting events
INSERT INTO public.roast_events (
    roast_id,
    time_seconds,
    event_type,
    event_value,
    event_string,
    category,
    subcategory,
    user_generated,
    automatic,
    created_at
)
SELECT 
    pl.roast_id,
    COALESCE(pl.time_seconds, EXTRACT(EPOCH FROM pl.time)) as time_seconds,
    1 as event_type, -- Control event type
    pl.fan_setting::TEXT as event_value,
    'fan_setting' as event_string,
    'control' as category,
    'machine_setting' as subcategory,
    false as user_generated,
    true as automatic,
    NOW() as created_at
FROM public.profile_log pl
WHERE pl.fan_setting IS NOT NULL
  AND COALESCE(pl.time_seconds, EXTRACT(EPOCH FROM pl.time)) IS NOT NULL
ORDER BY pl.roast_id, COALESCE(pl.time_seconds, EXTRACT(EPOCH FROM pl.time));

-- Insert heat_setting events
INSERT INTO public.roast_events (
    roast_id,
    time_seconds,
    event_type,
    event_value,
    event_string,
    category,
    subcategory,
    user_generated,
    automatic,
    created_at
)
SELECT 
    pl.roast_id,
    COALESCE(pl.time_seconds, EXTRACT(EPOCH FROM pl.time)) as time_seconds,
    1 as event_type, -- Control event type
    pl.heat_setting::TEXT as event_value,
    'heat_setting' as event_string,
    'control' as category,
    'machine_setting' as subcategory,
    false as user_generated,
    true as automatic,
    NOW() as created_at
FROM public.profile_log pl
WHERE pl.heat_setting IS NOT NULL
  AND COALESCE(pl.time_seconds, EXTRACT(EPOCH FROM pl.time)) IS NOT NULL
ORDER BY pl.roast_id, COALESCE(pl.time_seconds, EXTRACT(EPOCH FROM pl.time));

-- ================================================================================
-- MIGRATION PHASE 3: MIGRATE MILESTONE EVENTS (SMALLINT TO NORMALIZED)
-- ================================================================================

-- Migrate 'start' events (smallint 1 -> milestone event with NULL value)
INSERT INTO public.roast_events (
    roast_id,
    time_seconds,
    event_type,
    event_value,
    event_string,
    category,
    subcategory,
    user_generated,
    automatic,
    created_at
)
SELECT 
    pl.roast_id,
    COALESCE(pl.time_seconds, EXTRACT(EPOCH FROM pl.time)) as time_seconds,
    10 as event_type, -- Milestone event type
    NULL as event_value, -- Milestone events have NULL values
    'start' as event_string,
    'milestone' as category,
    'roast_phase' as subcategory,
    true as user_generated,
    false as automatic,
    NOW() as created_at
FROM public.profile_log pl
WHERE pl.start = 1
  AND COALESCE(pl.time_seconds, EXTRACT(EPOCH FROM pl.time)) IS NOT NULL;

-- Migrate 'charge' events
INSERT INTO public.roast_events (
    roast_id,
    time_seconds,
    event_type,
    event_value,
    event_string,
    category,
    subcategory,
    user_generated,
    automatic,
    created_at
)
SELECT 
    pl.roast_id,
    COALESCE(pl.time_seconds, EXTRACT(EPOCH FROM pl.time)) as time_seconds,
    10 as event_type,
    NULL as event_value,
    'charge' as event_string,
    'milestone' as category,
    'roast_phase' as subcategory,
    true as user_generated,
    false as automatic,
    NOW() as created_at
FROM public.profile_log pl
WHERE pl.charge = 1
  AND COALESCE(pl.time_seconds, EXTRACT(EPOCH FROM pl.time)) IS NOT NULL;

-- Migrate 'maillard' events -> 'dry_end' (normalize the naming)
INSERT INTO public.roast_events (
    roast_id,
    time_seconds,
    event_type,
    event_value,
    event_string,
    category,
    subcategory,
    user_generated,
    automatic,
    created_at
)
SELECT 
    pl.roast_id,
    COALESCE(pl.time_seconds, EXTRACT(EPOCH FROM pl.time)) as time_seconds,
    10 as event_type,
    NULL as event_value,
    'dry_end' as event_string, -- Normalize: maillard is same as dry_end
    'milestone' as category,
    'roast_phase' as subcategory,
    true as user_generated,
    false as automatic,
    NOW() as created_at
FROM public.profile_log pl
WHERE pl.maillard = 1
  AND COALESCE(pl.time_seconds, EXTRACT(EPOCH FROM pl.time)) IS NOT NULL;

-- Also migrate 'is_dry_end' boolean events (same data point as maillard)
INSERT INTO public.roast_events (
    roast_id,
    time_seconds,
    event_type,
    event_value,
    event_string,
    category,
    subcategory,
    user_generated,
    automatic,
    created_at
)
SELECT 
    pl.roast_id,
    COALESCE(pl.time_seconds, EXTRACT(EPOCH FROM pl.time)) as time_seconds,
    10 as event_type,
    NULL as event_value,
    'dry_end' as event_string,
    'milestone' as category,
    'roast_phase' as subcategory,
    true as user_generated,
    false as automatic,
    NOW() as created_at
FROM public.profile_log pl
WHERE pl.is_dry_end = true
  AND COALESCE(pl.time_seconds, EXTRACT(EPOCH FROM pl.time)) IS NOT NULL
  -- Avoid duplicates if both maillard=1 and is_dry_end=true exist
  AND NOT EXISTS (
    SELECT 1 FROM public.roast_events re 
    WHERE re.roast_id = pl.roast_id 
      AND re.time_seconds = COALESCE(pl.time_seconds, EXTRACT(EPOCH FROM pl.time))
      AND re.event_string = 'dry_end'
  );

-- Migrate 'fc_start' events
INSERT INTO public.roast_events (
    roast_id,
    time_seconds,
    event_type,
    event_value,
    event_string,
    category,
    subcategory,
    user_generated,
    automatic,
    created_at
)
SELECT 
    pl.roast_id,
    COALESCE(pl.time_seconds, EXTRACT(EPOCH FROM pl.time)) as time_seconds,
    10 as event_type,
    NULL as event_value,
    'fc_start' as event_string,
    'milestone' as category,
    'roast_phase' as subcategory,
    true as user_generated,
    false as automatic,
    NOW() as created_at
FROM public.profile_log pl
WHERE pl.fc_start = 1
  AND COALESCE(pl.time_seconds, EXTRACT(EPOCH FROM pl.time)) IS NOT NULL;

-- Migrate 'fc_rolling' events
INSERT INTO public.roast_events (
    roast_id,
    time_seconds,
    event_type,
    event_value,
    event_string,
    category,
    subcategory,
    user_generated,
    automatic,
    created_at
)
SELECT 
    pl.roast_id,
    COALESCE(pl.time_seconds, EXTRACT(EPOCH FROM pl.time)) as time_seconds,
    10 as event_type,
    NULL as event_value,
    'fc_rolling' as event_string,
    'milestone' as category,
    'roast_phase' as subcategory,
    true as user_generated,
    false as automatic,
    NOW() as created_at
FROM public.profile_log pl
WHERE pl.fc_rolling = 1
  AND COALESCE(pl.time_seconds, EXTRACT(EPOCH FROM pl.time)) IS NOT NULL;

-- Migrate 'fc_end' events (both smallint and boolean)
INSERT INTO public.roast_events (
    roast_id,
    time_seconds,
    event_type,
    event_value,
    event_string,
    category,
    subcategory,
    user_generated,
    automatic,
    created_at
)
SELECT 
    pl.roast_id,
    COALESCE(pl.time_seconds, EXTRACT(EPOCH FROM pl.time)) as time_seconds,
    10 as event_type,
    NULL as event_value,
    'fc_end' as event_string,
    'milestone' as category,
    'roast_phase' as subcategory,
    true as user_generated,
    false as automatic,
    NOW() as created_at
FROM public.profile_log pl
WHERE (pl.fc_end = 1 OR pl.is_fc_end = true)
  AND COALESCE(pl.time_seconds, EXTRACT(EPOCH FROM pl.time)) IS NOT NULL;

-- Migrate 'sc_start' events (both smallint and boolean)
INSERT INTO public.roast_events (
    roast_id,
    time_seconds,
    event_type,
    event_value,
    event_string,
    category,
    subcategory,
    user_generated,
    automatic,
    created_at
)
SELECT 
    pl.roast_id,
    COALESCE(pl.time_seconds, EXTRACT(EPOCH FROM pl.time)) as time_seconds,
    10 as event_type,
    NULL as event_value,
    'sc_start' as event_string,
    'milestone' as category,
    'roast_phase' as subcategory,
    true as user_generated,
    false as automatic,
    NOW() as created_at
FROM public.profile_log pl
WHERE (pl.sc_start = 1 OR pl.is_sc_start = true)
  AND COALESCE(pl.time_seconds, EXTRACT(EPOCH FROM pl.time)) IS NOT NULL;

-- Migrate 'sc_end' events
INSERT INTO public.roast_events (
    roast_id,
    time_seconds,
    event_type,
    event_value,
    event_string,
    category,
    subcategory,
    user_generated,
    automatic,
    created_at
)
SELECT 
    pl.roast_id,
    COALESCE(pl.time_seconds, EXTRACT(EPOCH FROM pl.time)) as time_seconds,
    10 as event_type,
    NULL as event_value,
    'sc_end' as event_string,
    'milestone' as category,
    'roast_phase' as subcategory,
    true as user_generated,
    false as automatic,
    NOW() as created_at
FROM public.profile_log pl
WHERE pl.is_sc_end = true
  AND COALESCE(pl.time_seconds, EXTRACT(EPOCH FROM pl.time)) IS NOT NULL;

-- Migrate 'drop' events
INSERT INTO public.roast_events (
    roast_id,
    time_seconds,
    event_type,
    event_value,
    event_string,
    category,
    subcategory,
    user_generated,
    automatic,
    created_at
)
SELECT 
    pl.roast_id,
    COALESCE(pl.time_seconds, EXTRACT(EPOCH FROM pl.time)) as time_seconds,
    10 as event_type,
    NULL as event_value,
    'drop' as event_string,
    'milestone' as category,
    'roast_phase' as subcategory,
    true as user_generated,
    false as automatic,
    NOW() as created_at
FROM public.profile_log pl
WHERE pl.drop = 1
  AND COALESCE(pl.time_seconds, EXTRACT(EPOCH FROM pl.time)) IS NOT NULL;

-- Migrate 'end' events -> 'cool'
INSERT INTO public.roast_events (
    roast_id,
    time_seconds,
    event_type,
    event_value,
    event_string,
    category,
    subcategory,
    user_generated,
    automatic,
    created_at
)
SELECT 
    pl.roast_id,
    COALESCE(pl.time_seconds, EXTRACT(EPOCH FROM pl.time)) as time_seconds,
    10 as event_type,
    NULL as event_value,
    'cool' as event_string, -- Normalize: end -> cool
    'milestone' as category,
    'roast_phase' as subcategory,
    true as user_generated,
    false as automatic,
    NOW() as created_at
FROM public.profile_log pl
WHERE (pl.end = 1 OR pl.is_cool = true)
  AND COALESCE(pl.time_seconds, EXTRACT(EPOCH FROM pl.time)) IS NOT NULL;

-- ================================================================================
-- MIGRATION PHASE 4: UPDATE ROAST_PROFILES TIME NORMALIZATION
-- ================================================================================

-- Ensure all time fields in roast_profiles use time_seconds format
UPDATE public.roast_profiles
SET 
    charge_time = COALESCE(charge_time, 0),
    dry_end_time = COALESCE(dry_end_time, 0),
    fc_start_time = COALESCE(fc_start_time, 0),
    fc_end_time = COALESCE(fc_end_time, 0),
    sc_start_time = COALESCE(sc_start_time, 0),
    drop_time = COALESCE(drop_time, 0),
    cool_time = COALESCE(cool_time, 0)
WHERE data_source IN ('manual', 'live');

-- ================================================================================
-- MIGRATION PHASE 5: VERIFICATION QUERIES
-- ================================================================================

-- Count migrated records
SELECT 
    'Temperature Records' as migration_type,
    COUNT(*) as migrated_count
FROM public.roast_temperatures

UNION ALL

SELECT 
    'Control Events' as migration_type,
    COUNT(*) as migrated_count
FROM public.roast_events
WHERE category = 'control'

UNION ALL

SELECT 
    'Milestone Events' as migration_type,
    COUNT(*) as migrated_count
FROM public.roast_events
WHERE category = 'milestone'

UNION ALL

SELECT 
    'Original Profile Logs' as migration_type,
    COUNT(*) as migrated_count
FROM public.profile_log;

-- Check for roasts with data in both old and new structure
SELECT 
    rp.roast_id,
    rp.batch_name,
    rp.roast_date,
    COUNT(pl.log_id) as old_logs,
    COUNT(rt.temp_id) as new_temps,
    COUNT(re.event_id) as new_events
FROM public.roast_profiles rp
LEFT JOIN public.profile_log pl ON rp.roast_id = pl.roast_id
LEFT JOIN public.roast_temperatures rt ON rp.roast_id = rt.roast_id
LEFT JOIN public.roast_events re ON rp.roast_id = re.roast_id
GROUP BY rp.roast_id, rp.batch_name, rp.roast_date
HAVING COUNT(pl.log_id) > 0 -- Only show roasts that had old data
ORDER BY rp.roast_date DESC
LIMIT 10;

-- ================================================================================
-- MIGRATION COMPLETE
-- ================================================================================

-- Migration Summary:
-- 1. ✅ Temperature data migrated to roast_temperatures with automatic RoR calculation
-- 2. ✅ Control settings (fan/heat) migrated to roast_events as TEXT values
-- 3. ✅ Boolean milestone events normalized to roast_events with NULL values
-- 4. ✅ Duplicate events (maillard/is_dry_end) consolidated to single 'dry_end' events
-- 5. ✅ Time normalization maintained across all tables
-- 6. ✅ Data source tracking preserved

-- Next Steps:
-- 1. Update APIs to read from new table structure
-- 2. Test chart functionality with new data
-- 3. Update live recording to write to new tables
-- 4. After verification, profile_log table can be safely dropped