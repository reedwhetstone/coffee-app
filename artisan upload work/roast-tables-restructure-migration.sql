-- Roast Tables Restructuring Migration
-- Creates new roast_temperatures table and updates existing schema
-- Part of plan to normalize roast events and separate high-volume temperature data

-- ================================================================================
-- 1. CREATE NEW ROAST_TEMPERATURES TABLE
-- ================================================================================

CREATE TABLE IF NOT EXISTS public.roast_temperatures (
    temp_id BIGSERIAL PRIMARY KEY,
    roast_id INTEGER NOT NULL,
    time_seconds DECIMAL(8,3) NOT NULL,
    bean_temp DECIMAL(5,1),
    environmental_temp DECIMAL(5,1),
    ambient_temp DECIMAL(5,1),
    inlet_temp DECIMAL(5,1),
    -- Pre-calculated Rate of Rise for bean temperature only (per minute)
    -- Increased precision to handle larger RoR values safely
    ror_bean_temp DECIMAL(6,2),
    -- Data source tracking
    data_source TEXT DEFAULT 'live' CHECK (data_source IN ('live', 'artisan_import', 'manual')),
    data_quality TEXT DEFAULT 'good' CHECK (data_quality IN ('good', 'interpolated', 'estimated', 'poor')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints and indexes
    CONSTRAINT roast_temperatures_roast_id_fkey 
        FOREIGN KEY (roast_id) REFERENCES public.roast_profiles(roast_id) ON DELETE CASCADE
);

-- Performance indexes for temperature queries
CREATE INDEX IF NOT EXISTS idx_roast_temperatures_roast_time 
    ON public.roast_temperatures(roast_id, time_seconds);
CREATE INDEX IF NOT EXISTS idx_roast_temperatures_data_source 
    ON public.roast_temperatures(data_source);
CREATE INDEX IF NOT EXISTS idx_roast_temperatures_created 
    ON public.roast_temperatures(created_at);

-- ================================================================================
-- 2. UPDATE ROAST_EVENTS TABLE - CHANGE event_value TO TEXT
-- ================================================================================

-- Change event_value from numeric to text to support values like "70%", "8.5", etc.
ALTER TABLE public.roast_events 
    ALTER COLUMN event_value TYPE TEXT USING event_value::TEXT;

-- Update any existing numeric values to text format
UPDATE public.roast_events 
    SET event_value = event_value::TEXT 
    WHERE event_value IS NOT NULL;

-- Add additional indexes for event queries
CREATE INDEX IF NOT EXISTS idx_roast_events_category 
    ON public.roast_events(roast_id, category, time_seconds);
CREATE INDEX IF NOT EXISTS idx_roast_events_milestone 
    ON public.roast_events(roast_id, event_string) 
    WHERE category = 'milestone';

-- ================================================================================
-- 3. ADD CHART DISPLAY COLUMNS TO ROAST_PROFILES
-- ================================================================================

-- Add Artisan chart display settings columns
ALTER TABLE public.roast_profiles
    ADD COLUMN IF NOT EXISTS chart_z_max DECIMAL(6,2),  -- Control range max (45)
    ADD COLUMN IF NOT EXISTS chart_z_min DECIMAL(6,2),  -- Control range min (0)
    ADD COLUMN IF NOT EXISTS chart_y_max DECIMAL(6,1),  -- Temperature range max (527)
    ADD COLUMN IF NOT EXISTS chart_y_min DECIMAL(6,1),  -- Temperature range min (100)
    ADD COLUMN IF NOT EXISTS chart_x_max DECIMAL(8,3),  -- Time range max (825 seconds)
    ADD COLUMN IF NOT EXISTS chart_x_min DECIMAL(8,3);  -- Time range min (-14.66 seconds)

-- Add weight columns if not present (for Artisan compatibility)
ALTER TABLE public.roast_profiles
    ADD COLUMN IF NOT EXISTS weight_in DECIMAL(6,2),    -- Input weight in grams
    ADD COLUMN IF NOT EXISTS weight_out DECIMAL(6,2),   -- Output weight in grams
    ADD COLUMN IF NOT EXISTS weight_unit VARCHAR(5) DEFAULT 'g';

-- ================================================================================
-- 4. CREATE ROR CALCULATION FUNCTION
-- ================================================================================

-- Function to calculate Rate of Rise for bean temperature only (charge to drop period)
CREATE OR REPLACE FUNCTION calculate_ror_on_insert()
RETURNS TRIGGER AS $$
DECLARE
    prev_temp_record RECORD;
    charge_time DECIMAL;
    drop_time DECIMAL;
    time_diff DECIMAL;
    temp_diff_bt DECIMAL;
BEGIN
    -- Get charge and drop times for this roast to limit RoR calculation to active roasting period
    SELECT rp.charge_time, rp.drop_time
    INTO charge_time, drop_time
    FROM public.roast_profiles rp
    WHERE rp.roast_id = NEW.roast_id;

    -- Only calculate RoR if we're in the active roasting period (charge to drop)
    IF charge_time IS NOT NULL AND drop_time IS NOT NULL THEN
        IF NEW.time_seconds >= charge_time AND NEW.time_seconds <= drop_time THEN
            
            -- Get the previous temperature reading for this roast
            SELECT time_seconds, bean_temp
            INTO prev_temp_record
            FROM public.roast_temperatures
            WHERE roast_id = NEW.roast_id
              AND time_seconds < NEW.time_seconds
              AND time_seconds >= charge_time  -- Only look for previous readings after charge
            ORDER BY time_seconds DESC
            LIMIT 1;

            -- If we have a previous record, calculate bean temp RoR
            IF prev_temp_record IS NOT NULL THEN
                time_diff := NEW.time_seconds - prev_temp_record.time_seconds;
                
                -- Only calculate if time difference is reasonable (>= 2 seconds and < 300 seconds)
                IF time_diff >= 2 AND time_diff < 300 THEN
                    IF NEW.bean_temp IS NOT NULL AND prev_temp_record.bean_temp IS NOT NULL THEN
                        temp_diff_bt := NEW.bean_temp - prev_temp_record.bean_temp;
                        
                        -- Only calculate if temperature change is reasonable (< 100°F change)
                        IF abs(temp_diff_bt) <= 100 THEN
                            DECLARE
                                calculated_ror DECIMAL(8,4);
                            BEGIN
                                calculated_ror := (temp_diff_bt / time_diff) * 60;  -- RoR per minute
                                
                                -- Cap RoR values to reasonable limits (-999 to +999 degrees F per minute)
                                IF abs(calculated_ror) > 999 THEN
                                    NEW.ror_bean_temp := CASE 
                                        WHEN calculated_ror > 0 THEN 999.99
                                        ELSE -999.99
                                    END;
                                ELSE
                                    NEW.ror_bean_temp := calculated_ror;
                                END IF;
                            END;
                        END IF;
                    END IF;
                END IF;
            END IF;
        END IF;
    ELSE
        -- If charge/drop times not set yet, calculate RoR for all data (live recording scenario)
        SELECT time_seconds, bean_temp
        INTO prev_temp_record
        FROM public.roast_temperatures
        WHERE roast_id = NEW.roast_id
          AND time_seconds < NEW.time_seconds
        ORDER BY time_seconds DESC
        LIMIT 1;

        IF prev_temp_record IS NOT NULL THEN
            time_diff := NEW.time_seconds - prev_temp_record.time_seconds;
            
            -- Apply same validation as charge-to-drop scenario
            IF time_diff >= 2 AND time_diff < 300 THEN
                IF NEW.bean_temp IS NOT NULL AND prev_temp_record.bean_temp IS NOT NULL THEN
                    temp_diff_bt := NEW.bean_temp - prev_temp_record.bean_temp;
                    
                    -- Only calculate if temperature change is reasonable (< 100°F change)
                    IF abs(temp_diff_bt) <= 100 THEN
                        DECLARE
                            calculated_ror DECIMAL(8,4);
                        BEGIN
                            calculated_ror := (temp_diff_bt / time_diff) * 60;  -- RoR per minute
                            
                            -- Cap RoR values to reasonable limits (-999 to +999 degrees F per minute)
                            IF abs(calculated_ror) > 999 THEN
                                NEW.ror_bean_temp := CASE 
                                    WHEN calculated_ror > 0 THEN 999.99
                                    ELSE -999.99
                                END;
                            ELSE
                                NEW.ror_bean_temp := calculated_ror;
                            END IF;
                        END;
                    END IF;
                END IF;
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically calculate RoR on insert
DROP TRIGGER IF EXISTS calculate_ror_trigger ON public.roast_temperatures;
CREATE TRIGGER calculate_ror_trigger
    BEFORE INSERT ON public.roast_temperatures
    FOR EACH ROW
    EXECUTE FUNCTION calculate_ror_on_insert();

-- ================================================================================
-- 5. HELPER FUNCTIONS FOR DATA QUERIES
-- ================================================================================

-- Function to get temperature data for charting (bean temp RoR only)
CREATE OR REPLACE FUNCTION get_roast_temperature_data(p_roast_id INTEGER)
RETURNS TABLE(
    time_seconds DECIMAL(8,3),
    bean_temp DECIMAL(5,1),
    environmental_temp DECIMAL(5,1),
    ambient_temp DECIMAL(5,1),
    ror_bean_temp DECIMAL(6,2)
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        rt.time_seconds,
        rt.bean_temp,
        rt.environmental_temp,
        rt.ambient_temp,
        rt.ror_bean_temp
    FROM public.roast_temperatures rt
    WHERE rt.roast_id = p_roast_id
    ORDER BY rt.time_seconds ASC;
END;
$$ LANGUAGE plpgsql;

-- Function to get milestone events for charting
CREATE OR REPLACE FUNCTION get_roast_milestone_events(p_roast_id INTEGER)
RETURNS TABLE(
    time_seconds DECIMAL(8,3),
    event_string TEXT,
    category TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        re.time_seconds,
        re.event_string,
        re.category
    FROM public.roast_events re
    WHERE re.roast_id = p_roast_id
      AND re.category = 'milestone'
      AND re.event_value IS NULL  -- Milestone events have NULL values
    ORDER BY re.time_seconds ASC;
END;
$$ LANGUAGE plpgsql;

-- Function to get control events for charting overlays
CREATE OR REPLACE FUNCTION get_roast_control_events(p_roast_id INTEGER)
RETURNS TABLE(
    time_seconds DECIMAL(8,3),
    event_string TEXT,
    event_value TEXT,
    category TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        re.time_seconds,
        re.event_string,
        re.event_value,
        re.category
    FROM public.roast_events re
    WHERE re.roast_id = p_roast_id
      AND re.category IN ('control', 'machine')
      AND re.event_value IS NOT NULL
    ORDER BY re.time_seconds ASC;
END;
$$ LANGUAGE plpgsql;

-- ================================================================================
-- 6. PERMISSIONS AND SECURITY
-- ================================================================================

-- Grant appropriate permissions for the new table
ALTER TABLE public.roast_temperatures ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for roast_temperatures (users can only access their own data)
CREATE POLICY "roast_temperatures_user_policy" ON public.roast_temperatures
    FOR ALL USING (
        roast_id IN (
            SELECT roast_profiles.roast_id
            FROM public.roast_profiles
            WHERE roast_profiles."user" = auth.uid()
        )
    );

-- ================================================================================
-- 7. MIGRATION VERIFICATION
-- ================================================================================

-- Create a view to help verify the migration
CREATE OR REPLACE VIEW roast_data_summary AS
SELECT 
    rp.roast_id,
    rp.batch_name,
    rp.coffee_name,
    rp.roast_date,
    rp.data_source,
    COUNT(rt.temp_id) as temperature_readings,
    COUNT(CASE WHEN re.category = 'milestone' THEN 1 END) as milestone_events,
    COUNT(CASE WHEN re.category = 'control' THEN 1 END) as control_events,
    COUNT(CASE WHEN re.category = 'machine' THEN 1 END) as machine_events,
    COUNT(pl.log_id) as legacy_profile_logs
FROM public.roast_profiles rp
LEFT JOIN public.roast_temperatures rt ON rp.roast_id = rt.roast_id
LEFT JOIN public.roast_events re ON rp.roast_id = re.roast_id
LEFT JOIN public.profile_log pl ON rp.roast_id = pl.roast_id
GROUP BY rp.roast_id, rp.batch_name, rp.coffee_name, rp.roast_date, rp.data_source
ORDER BY rp.roast_date DESC;

-- ================================================================================
-- MIGRATION COMPLETE
-- ================================================================================

-- The schema is now ready for:
-- 1. Temperature data in dedicated roast_temperatures table with RoR calculation
-- 2. All events in normalized roast_events table with TEXT values
-- 3. Chart display settings stored in roast_profiles
-- 4. Helper functions for efficient data querying
-- 5. Row-level security for user data isolation

COMMENT ON TABLE public.roast_temperatures IS 'High-volume temperature and time series data with pre-calculated Rate of Rise';
COMMENT ON TABLE public.roast_events IS 'Normalized events table for milestones, controls, and machine settings (event_value as TEXT)';
COMMENT ON COLUMN public.roast_profiles.chart_z_max IS 'Chart Z-axis (control) maximum from Artisan imports';
COMMENT ON COLUMN public.roast_profiles.chart_y_max IS 'Chart Y-axis (temperature) maximum from Artisan imports';
COMMENT ON COLUMN public.roast_profiles.chart_x_max IS 'Chart X-axis (time) maximum from Artisan imports';