-- Supabase Schema Extensions for Artisan .alog File Support
-- This file contains migrations to add support for Artisan roast profile data
-- while preserving all existing functionality

-- ================================================================================
-- ROAST PROFILES TABLE EXTENSIONS
-- ================================================================================

-- Add new columns to existing roast_profiles table for Artisan data support
-- These additions preserve all existing functionality while adding rich metadata

ALTER TABLE roast_profiles
ADD COLUMN IF NOT EXISTS title VARCHAR(255),
ADD COLUMN IF NOT EXISTS roaster_type VARCHAR(100),
ADD COLUMN IF NOT EXISTS roaster_size DECIMAL(4,2), -- in kg
ADD COLUMN IF NOT EXISTS roast_uuid VARCHAR(36),
ADD COLUMN IF NOT EXISTS weight_unit VARCHAR(5) DEFAULT 'g',
ADD COLUMN IF NOT EXISTS temperature_unit VARCHAR(1) DEFAULT 'F' CHECK (temperature_unit IN ('F', 'C')), -- F=Fahrenheit, C=Celsius

-- Milestone timings (seconds from roast start)
ADD COLUMN IF NOT EXISTS charge_time DECIMAL(8,3),
ADD COLUMN IF NOT EXISTS dry_end_time DECIMAL(8,3),
ADD COLUMN IF NOT EXISTS fc_start_time DECIMAL(8,3),
ADD COLUMN IF NOT EXISTS fc_end_time DECIMAL(8,3),
ADD COLUMN IF NOT EXISTS sc_start_time DECIMAL(8,3),
ADD COLUMN IF NOT EXISTS drop_time DECIMAL(8,3),
ADD COLUMN IF NOT EXISTS cool_time DECIMAL(8,3),

-- Milestone temperatures (unit specified by temperature_unit column, typically Fahrenheit from Artisan)
ADD COLUMN IF NOT EXISTS charge_temp DECIMAL(5,1),
ADD COLUMN IF NOT EXISTS dry_end_temp DECIMAL(5,1),
ADD COLUMN IF NOT EXISTS fc_start_temp DECIMAL(5,1),
ADD COLUMN IF NOT EXISTS fc_end_temp DECIMAL(5,1),
ADD COLUMN IF NOT EXISTS sc_start_temp DECIMAL(5,1),
ADD COLUMN IF NOT EXISTS drop_temp DECIMAL(5,1),
ADD COLUMN IF NOT EXISTS cool_temp DECIMAL(5,1),

-- Phase calculations
ADD COLUMN IF NOT EXISTS dry_percent DECIMAL(4,1), -- Drying phase %
ADD COLUMN IF NOT EXISTS maillard_percent DECIMAL(4,1), -- Maillard phase %
ADD COLUMN IF NOT EXISTS development_percent DECIMAL(4,1), -- Development phase %
ADD COLUMN IF NOT EXISTS total_roast_time DECIMAL(8,3), -- Total time in seconds
ADD COLUMN IF NOT EXISTS weight_loss_percent DECIMAL(4,1), -- Weight loss %

-- Additional Artisan metadata
ADD COLUMN IF NOT EXISTS operator VARCHAR(100),
ADD COLUMN IF NOT EXISTS organization VARCHAR(100),
ADD COLUMN IF NOT EXISTS machine_setup TEXT,
ADD COLUMN IF NOT EXISTS drum_speed VARCHAR(50),
ADD COLUMN IF NOT EXISTS ambient_temp DECIMAL(4,1),
ADD COLUMN IF NOT EXISTS ambient_humidity DECIMAL(4,1),
ADD COLUMN IF NOT EXISTS ambient_pressure DECIMAL(6,1),

-- Roast quality indicators (from Artisan defects tracking)
ADD COLUMN IF NOT EXISTS heavy_fc BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS low_fc BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS light_cut BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS dark_cut BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS drops BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS oily BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS uneven BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS tipping BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS scorching BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS divots BOOLEAN DEFAULT FALSE,

-- Color measurements
ADD COLUMN IF NOT EXISTS whole_color INTEGER,
ADD COLUMN IF NOT EXISTS ground_color INTEGER,
ADD COLUMN IF NOT EXISTS color_system VARCHAR(50),

-- Data source tracking
ADD COLUMN IF NOT EXISTS data_source VARCHAR(20) DEFAULT 'manual' CHECK (data_source IN ('manual', 'live', 'artisan_import')),
ADD COLUMN IF NOT EXISTS artisan_version VARCHAR(20),

-- Cupping score (if available from Artisan)
ADD COLUMN IF NOT EXISTS cupping_score DECIMAL(4,2);

-- ================================================================================
-- PROFILE LOG TABLE EXTENSIONS  
-- ================================================================================

-- Add new columns to existing profile_log table for comprehensive temperature tracking
-- These preserve existing live roasting functionality while supporting Artisan imports

ALTER TABLE profile_log
-- Enhanced temperature tracking
ADD COLUMN IF NOT EXISTS environmental_temp DECIMAL(5,1), -- ET sensor (temp2 from Artisan)
ADD COLUMN IF NOT EXISTS ambient_temp DECIMAL(5,1), -- Optional third sensor
ADD COLUMN IF NOT EXISTS inlet_temp DECIMAL(5,1), -- Additional sensor support

-- Precise time tracking for imported data
ADD COLUMN IF NOT EXISTS time_seconds DECIMAL(8,3), -- Precise time from roast start

-- Additional control settings for comprehensive logging
ADD COLUMN IF NOT EXISTS damper_setting DECIMAL(4,1),
ADD COLUMN IF NOT EXISTS air_flow DECIMAL(4,1),
ADD COLUMN IF NOT EXISTS pressure DECIMAL(4,1),

-- Enhanced milestone flags for Artisan events
ADD COLUMN IF NOT EXISTS is_dry_end BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS is_fc_end BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS is_sc_start BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS is_sc_end BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS is_cool BOOLEAN DEFAULT FALSE,

-- Data source and quality tracking
ADD COLUMN IF NOT EXISTS data_source VARCHAR(20) DEFAULT 'live' CHECK (data_source IN ('live', 'artisan_import', 'manual')),
ADD COLUMN IF NOT EXISTS data_quality VARCHAR(20) DEFAULT 'good' CHECK (data_quality IN ('good', 'interpolated', 'estimated', 'poor')),

-- Rate of Rise calculation support
ADD COLUMN IF NOT EXISTS ror_et DECIMAL(5,2), -- Environmental temp RoR
ADD COLUMN IF NOT EXISTS ror_bt DECIMAL(5,2); -- Bean temp RoR

-- ================================================================================
-- NEW TABLE: ARTISAN IMPORT LOG
-- ================================================================================

-- Track import history and metadata for troubleshooting and auditing
CREATE TABLE IF NOT EXISTS artisan_import_log (
    import_id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    roast_id INTEGER REFERENCES roast_profiles(roast_id) ON DELETE CASCADE,
    
    -- Import metadata
    filename VARCHAR(255),
    file_size INTEGER,
    artisan_version VARCHAR(50),
    import_timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Data statistics
    total_data_points INTEGER,
    temperature_range_bt DECIMAL[2], -- [min, max] for bean temp
    temperature_range_et DECIMAL[2], -- [min, max] for environmental temp  
    time_range DECIMAL[2], -- [start, end] in seconds
    
    -- Processing results
    processing_status VARCHAR(20) DEFAULT 'success' CHECK (processing_status IN ('success', 'warning', 'error')),
    processing_messages TEXT[], -- Array of messages/warnings
    validation_errors TEXT[],
    
    -- Original file data (for reprocessing if needed)
    original_data JSONB,
    
    CONSTRAINT unique_roast_import UNIQUE(roast_id, import_timestamp)
);

-- ================================================================================
-- NEW TABLE: ROAST EVENTS
-- ================================================================================

-- Store detailed event log from Artisan special events tracking
CREATE TABLE IF NOT EXISTS roast_events (
    event_id SERIAL PRIMARY KEY,
    roast_id INTEGER NOT NULL REFERENCES roast_profiles(roast_id) ON DELETE CASCADE,
    
    -- Event timing and identification
    time_seconds DECIMAL(8,3) NOT NULL,
    event_type INTEGER NOT NULL, -- Maps to Artisan event types
    event_value DECIMAL(8,3),
    event_string VARCHAR(100),
    
    -- Event categorization
    category VARCHAR(50), -- 'milestone', 'control_change', 'annotation', 'alarm'
    subcategory VARCHAR(50), -- 'temperature', 'fan', 'heat', 'damper', etc.
    
    -- Additional metadata
    user_generated BOOLEAN DEFAULT FALSE,
    automatic BOOLEAN DEFAULT TRUE,
    notes TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ================================================================================
-- NEW TABLE: ROAST PHASES
-- ================================================================================

-- Store calculated phase information for analysis and comparison
CREATE TABLE IF NOT EXISTS roast_phases (
    phase_id SERIAL PRIMARY KEY,
    roast_id INTEGER NOT NULL REFERENCES roast_profiles(roast_id) ON DELETE CASCADE,
    
    -- Phase identification
    phase_name VARCHAR(50) NOT NULL, -- 'drying', 'maillard', 'development', 'cooling'
    phase_order INTEGER NOT NULL, -- 1, 2, 3, 4 for sequencing
    
    -- Timing data
    start_time DECIMAL(8,3), -- seconds from roast start
    end_time DECIMAL(8,3),
    duration DECIMAL(8,3), -- calculated duration
    percentage_of_total DECIMAL(4,1), -- percentage of total roast time
    
    -- Temperature data
    start_temp DECIMAL(5,1),
    end_temp DECIMAL(5,1),
    max_temp DECIMAL(5,1),
    min_temp DECIMAL(5,1),
    avg_temp DECIMAL(5,1),
    
    -- Rate of rise statistics
    avg_ror DECIMAL(5,2),
    max_ror DECIMAL(5,2),
    min_ror DECIMAL(5,2),
    
    -- Calculation metadata
    calculation_method VARCHAR(50) DEFAULT 'artisan', -- 'artisan', 'calculated', 'manual'
    confidence_score DECIMAL(3,2) DEFAULT 1.0, -- 0.0 to 1.0
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(roast_id, phase_name)
);

-- ================================================================================
-- NEW TABLE: EXTRA DEVICE DATA
-- ================================================================================

-- Store additional sensor data from Artisan (for advanced setups)
CREATE TABLE IF NOT EXISTS extra_device_data (
    device_data_id SERIAL PRIMARY KEY,
    roast_id INTEGER NOT NULL REFERENCES roast_profiles(roast_id) ON DELETE CASCADE,
    
    -- Device identification
    device_id INTEGER NOT NULL, -- Maps to Artisan extradevices array
    device_name VARCHAR(100), -- Human readable name
    sensor_type VARCHAR(50), -- 'temperature', 'pressure', 'humidity', 'custom'
    
    -- Time series data
    time_seconds DECIMAL(8,3) NOT NULL,
    value DECIMAL(8,3),
    unit VARCHAR(20),
    
    -- Data quality
    quality VARCHAR(20) DEFAULT 'good' CHECK (quality IN ('good', 'interpolated', 'estimated', 'poor'))
);

-- ================================================================================
-- PERFORMANCE INDEXES
-- ================================================================================

-- Indexes for efficient querying of the enhanced schema

-- Roast profiles indexes for filtering and sorting
CREATE INDEX IF NOT EXISTS idx_roast_profiles_user_date ON roast_profiles(user, roast_date DESC);
CREATE INDEX IF NOT EXISTS idx_roast_profiles_coffee_roaster ON roast_profiles(coffee_id, roaster_type);
CREATE INDEX IF NOT EXISTS idx_roast_profiles_source ON roast_profiles(data_source);
CREATE INDEX IF NOT EXISTS idx_roast_profiles_uuid ON roast_profiles(roast_uuid);

-- Profile log indexes for time series queries
CREATE INDEX IF NOT EXISTS idx_profile_log_roast_time_sec ON profile_log(roast_id, time_seconds);
CREATE INDEX IF NOT EXISTS idx_profile_log_milestones ON profile_log(roast_id) WHERE (is_charge OR is_fc_start OR is_drop);
CREATE INDEX IF NOT EXISTS idx_profile_log_temps ON profile_log(roast_id, bean_temp, environmental_temp);
CREATE INDEX IF NOT EXISTS idx_profile_log_source ON profile_log(data_source);

-- Import log indexes for auditing
CREATE INDEX IF NOT EXISTS idx_artisan_import_user_date ON artisan_import_log(user_id, import_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_artisan_import_status ON artisan_import_log(processing_status);

-- Roast events indexes for event timeline queries
CREATE INDEX IF NOT EXISTS idx_roast_events_roast_time ON roast_events(roast_id, time_seconds);
CREATE INDEX IF NOT EXISTS idx_roast_events_type ON roast_events(event_type);
CREATE INDEX IF NOT EXISTS idx_roast_events_category ON roast_events(category, subcategory);

-- Roast phases indexes for analysis queries
CREATE INDEX IF NOT EXISTS idx_roast_phases_roast ON roast_phases(roast_id);
CREATE INDEX IF NOT EXISTS idx_roast_phases_name ON roast_phases(phase_name);

-- Extra device data indexes for sensor queries
CREATE INDEX IF NOT EXISTS idx_extra_device_roast_time ON extra_device_data(roast_id, time_seconds);
CREATE INDEX IF NOT EXISTS idx_extra_device_type ON extra_device_data(sensor_type);
CREATE INDEX IF NOT EXISTS idx_extra_device_id ON extra_device_data(device_id);

-- ================================================================================
-- VIEWS FOR CONVENIENCE
-- ================================================================================

-- View for complete roast profile data with all related information
CREATE OR REPLACE VIEW roast_profile_complete AS
SELECT 
    rp.*,
    gc.coffee_name,
    cc.name as catalog_name,
    cc.origin,
    cc.processing,
    cc.grade,
    ai.filename as import_filename,
    ai.artisan_version as import_artisan_version,
    ai.total_data_points
FROM roast_profiles rp
LEFT JOIN green_coffee_inv gc ON rp.coffee_id = gc.id
LEFT JOIN coffee_catalog cc ON gc.catalog_id = cc.id  
LEFT JOIN artisan_import_log ai ON rp.roast_id = ai.roast_id;

-- View for milestone summary
CREATE OR REPLACE VIEW roast_milestones AS
SELECT 
    roast_id,
    charge_time, charge_temp,
    dry_end_time, dry_end_temp,
    fc_start_time, fc_start_temp,
    fc_end_time, fc_end_temp,
    sc_start_time, sc_start_temp,
    drop_time, drop_temp,
    cool_time, cool_temp,
    total_roast_time,
    dry_percent,
    maillard_percent,
    development_percent
FROM roast_profiles
WHERE data_source = 'artisan_import' OR 
      (charge_time IS NOT NULL AND drop_time IS NOT NULL);

-- View for temperature curve data (optimized for charting)
CREATE OR REPLACE VIEW roast_temperature_curve AS
SELECT 
    pl.roast_id,
    pl.time_seconds,
    pl.bean_temp,
    pl.environmental_temp,
    pl.ambient_temp,
    pl.heat_setting,
    pl.fan_setting,
    pl.damper_setting,
    -- Milestone flags for chart markers
    CASE WHEN pl.is_charge THEN 'CHARGE'
         WHEN pl.is_dry_end THEN 'DRY END'
         WHEN pl.is_fc_start THEN 'FC START'
         WHEN pl.is_fc_end THEN 'FC END'
         WHEN pl.is_sc_start THEN 'SC START'
         WHEN pl.is_drop THEN 'DROP'
         WHEN pl.is_cool THEN 'COOL'
         ELSE NULL
    END as milestone_label
FROM profile_log pl
WHERE pl.bean_temp IS NOT NULL
ORDER BY pl.roast_id, pl.time_seconds;

-- ================================================================================
-- FUNCTIONS FOR DATA INTEGRITY
-- ================================================================================

-- Function to automatically calculate phase percentages when milestones are updated
CREATE OR REPLACE FUNCTION calculate_roast_phases()
RETURNS TRIGGER AS $$
BEGIN
    -- Only calculate if we have the required milestone times
    IF NEW.charge_time IS NOT NULL AND NEW.drop_time IS NOT NULL THEN
        -- Calculate total roast time
        NEW.total_roast_time = NEW.drop_time - NEW.charge_time;
        
        -- Calculate drying phase percentage
        IF NEW.dry_end_time IS NOT NULL AND NEW.dry_end_time > NEW.charge_time THEN
            NEW.dry_percent = ROUND(((NEW.dry_end_time - NEW.charge_time) / NEW.total_roast_time * 100)::numeric, 1);
        END IF;
        
        -- Calculate maillard phase percentage  
        IF NEW.fc_start_time IS NOT NULL AND NEW.dry_end_time IS NOT NULL AND 
           NEW.fc_start_time > NEW.dry_end_time THEN
            NEW.maillard_percent = ROUND(((NEW.fc_start_time - NEW.dry_end_time) / NEW.total_roast_time * 100)::numeric, 1);
        END IF;
        
        -- Calculate development phase percentage
        IF NEW.fc_start_time IS NOT NULL AND NEW.drop_time > NEW.fc_start_time THEN
            NEW.development_percent = ROUND(((NEW.drop_time - NEW.fc_start_time) / NEW.total_roast_time * 100)::numeric, 1);
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql VOLATILE;

-- Trigger to automatically calculate phases
CREATE TRIGGER trigger_calculate_roast_phases
    BEFORE INSERT OR UPDATE ON roast_profiles
    FOR EACH ROW
    EXECUTE FUNCTION calculate_roast_phases();

-- Function to maintain data consistency between time and time_seconds
CREATE OR REPLACE FUNCTION sync_profile_log_time()
RETURNS TRIGGER AS $$
BEGIN
    -- If time_seconds is provided but time is not, calculate time from time_seconds
    IF NEW.time_seconds IS NOT NULL AND NEW.time IS NULL THEN
        NEW.time = INTERVAL '1 second' * NEW.time_seconds;
    END IF;
    
    -- If time is provided but time_seconds is not, calculate time_seconds from time
    IF NEW.time IS NOT NULL AND NEW.time_seconds IS NULL THEN
        NEW.time_seconds = EXTRACT(EPOCH FROM NEW.time);
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql VOLATILE;

-- Trigger to sync time fields
CREATE TRIGGER trigger_sync_profile_log_time
    BEFORE INSERT OR UPDATE ON profile_log
    FOR EACH ROW
    EXECUTE FUNCTION sync_profile_log_time();

-- ================================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ================================================================================

-- Ensure new tables respect user data isolation

-- Artisan import log policies
ALTER TABLE artisan_import_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY artisan_import_log_user_policy ON artisan_import_log
    FOR ALL USING (auth.uid() = user_id);

-- Roast events policies  
ALTER TABLE roast_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY roast_events_user_policy ON roast_events
    FOR ALL USING (
        roast_id IN (
            SELECT roast_id FROM roast_profiles WHERE user = auth.uid()
        )
    );

-- Roast phases policies
ALTER TABLE roast_phases ENABLE ROW LEVEL SECURITY;

CREATE POLICY roast_phases_user_policy ON roast_phases
    FOR ALL USING (
        roast_id IN (
            SELECT roast_id FROM roast_profiles WHERE user = auth.uid()
        )
    );

-- Extra device data policies
ALTER TABLE extra_device_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY extra_device_data_user_policy ON extra_device_data
    FOR ALL USING (
        roast_id IN (
            SELECT roast_id FROM roast_profiles WHERE user = auth.uid()
        )
    );

-- ================================================================================
-- HELPER FUNCTIONS FOR ARTISAN IMPORT
-- ================================================================================

-- Function to convert Fahrenheit to Celsius (for display purposes)
-- Use this when temperature_unit = 'F' and you need Celsius display
-- Modify the temperature conversion functions to be IMMUTABLE
CREATE OR REPLACE FUNCTION fahrenheit_to_celsius(temp_f DECIMAL)
RETURNS DECIMAL AS $$
BEGIN
    IF temp_f IS NULL THEN
        RETURN NULL;
    END IF;
    RETURN ROUND(((temp_f - 32) * 5.0 / 9.0)::numeric, 1);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION celsius_to_fahrenheit(temp_c DECIMAL)
RETURNS DECIMAL AS $$
BEGIN
    IF temp_c IS NULL THEN
        RETURN NULL;
    END IF;
    RETURN ROUND(((temp_c * 9.0 / 5.0) + 32)::numeric, 1);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION seconds_to_mmss(seconds DECIMAL)
RETURNS TEXT AS $$
DECLARE
    minutes INTEGER;
    secs INTEGER;
BEGIN
    IF seconds IS NULL OR seconds < 0 THEN
        RETURN '--:--';
    END IF;
    
    minutes := FLOOR(seconds / 60);
    secs := FLOOR(seconds % 60);
    
    RETURN LPAD(minutes::text, 2, '0') || ':' || LPAD(secs::text, 2, '0');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ================================================================================
-- DATA MIGRATION AND COMPATIBILITY
-- ================================================================================

-- Update existing roast_profiles to have compatible data_source
UPDATE roast_profiles 
SET data_source = 'manual' 
WHERE data_source IS NULL;

-- Ensure existing profile_log entries have time_seconds calculated
UPDATE profile_log 
SET time_seconds = EXTRACT(EPOCH FROM time)
WHERE time_seconds IS NULL AND time IS NOT NULL;

-- Set default data_source for existing profile_log entries
UPDATE profile_log 
SET data_source = 'live' 
WHERE data_source IS NULL;

-- ================================================================================
-- COMMENTS FOR DOCUMENTATION
-- ================================================================================

COMMENT ON TABLE artisan_import_log IS 'Tracks Artisan .alog file imports with metadata and processing results';
COMMENT ON TABLE roast_events IS 'Stores detailed event timeline from Artisan special events tracking';
COMMENT ON TABLE roast_phases IS 'Calculated roast phase data for analysis and comparison';
COMMENT ON TABLE extra_device_data IS 'Additional sensor data from advanced Artisan setups';

COMMENT ON COLUMN roast_profiles.data_source IS 'Source of roast data: manual, live, or artisan_import';
COMMENT ON COLUMN roast_profiles.temperature_unit IS 'Temperature unit: F=Fahrenheit, C=Celsius (from Artisan mode field)';
COMMENT ON COLUMN roast_profiles.charge_time IS 'Time in seconds from roast start when beans are charged';
COMMENT ON COLUMN roast_profiles.total_roast_time IS 'Total roast duration from charge to drop in seconds';
COMMENT ON COLUMN roast_profiles.dry_percent IS 'Percentage of total roast time spent in drying phase';
COMMENT ON COLUMN roast_profiles.maillard_percent IS 'Percentage of total roast time spent in maillard phase';
COMMENT ON COLUMN roast_profiles.development_percent IS 'Percentage of total roast time spent in development phase';

COMMENT ON COLUMN profile_log.time_seconds IS 'Precise time from roast start in seconds (for Artisan import compatibility)';
COMMENT ON COLUMN profile_log.environmental_temp IS 'Environmental temperature (ET sensor) in Fahrenheit';
COMMENT ON COLUMN profile_log.data_source IS 'Source of log entry: live, artisan_import, or manual';