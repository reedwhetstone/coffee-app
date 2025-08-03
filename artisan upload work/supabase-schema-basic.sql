-- Basic Supabase Schema Extensions for Artisan .alog File Support
-- Simplified version to avoid function/trigger issues

-- ================================================================================
-- ROAST PROFILES TABLE EXTENSIONS
-- ================================================================================

-- Add new columns to existing roast_profiles table for Artisan data support
ALTER TABLE roast_profiles
ADD COLUMN IF NOT EXISTS title VARCHAR(255),
ADD COLUMN IF NOT EXISTS roaster_type VARCHAR(100),
ADD COLUMN IF NOT EXISTS roaster_size DECIMAL(4,2), -- in kg
ADD COLUMN IF NOT EXISTS roast_uuid VARCHAR(36),
ADD COLUMN IF NOT EXISTS weight_unit VARCHAR(5) DEFAULT 'g',
ADD COLUMN IF NOT EXISTS temperature_unit VARCHAR(1) DEFAULT 'F' CHECK (temperature_unit IN ('F', 'C')),

-- Milestone timings (seconds from roast start)
ADD COLUMN IF NOT EXISTS charge_time DECIMAL(8,3),
ADD COLUMN IF NOT EXISTS dry_end_time DECIMAL(8,3),
ADD COLUMN IF NOT EXISTS fc_start_time DECIMAL(8,3),
ADD COLUMN IF NOT EXISTS fc_end_time DECIMAL(8,3),
ADD COLUMN IF NOT EXISTS sc_start_time DECIMAL(8,3),
ADD COLUMN IF NOT EXISTS drop_time DECIMAL(8,3),
ADD COLUMN IF NOT EXISTS cool_time DECIMAL(8,3),

-- Milestone temperatures (unit specified by temperature_unit column)
ADD COLUMN IF NOT EXISTS charge_temp DECIMAL(5,1),
ADD COLUMN IF NOT EXISTS dry_end_temp DECIMAL(5,1),
ADD COLUMN IF NOT EXISTS fc_start_temp DECIMAL(5,1),
ADD COLUMN IF NOT EXISTS fc_end_temp DECIMAL(5,1),
ADD COLUMN IF NOT EXISTS sc_start_temp DECIMAL(5,1),
ADD COLUMN IF NOT EXISTS drop_temp DECIMAL(5,1),
ADD COLUMN IF NOT EXISTS cool_temp DECIMAL(5,1),

-- Phase calculations
ADD COLUMN IF NOT EXISTS dry_percent DECIMAL(4,1),
ADD COLUMN IF NOT EXISTS maillard_percent DECIMAL(4,1),
ADD COLUMN IF NOT EXISTS development_percent DECIMAL(4,1),
ADD COLUMN IF NOT EXISTS total_roast_time DECIMAL(8,3),
ADD COLUMN IF NOT EXISTS weight_loss_percent DECIMAL(4,1),

-- Additional Artisan metadata
ADD COLUMN IF NOT EXISTS operator VARCHAR(100),
ADD COLUMN IF NOT EXISTS organization VARCHAR(100),
ADD COLUMN IF NOT EXISTS machine_setup TEXT,
ADD COLUMN IF NOT EXISTS drum_speed VARCHAR(50),
ADD COLUMN IF NOT EXISTS ambient_temp DECIMAL(4,1),
ADD COLUMN IF NOT EXISTS ambient_humidity DECIMAL(4,1),
ADD COLUMN IF NOT EXISTS ambient_pressure DECIMAL(6,1),

-- Roast quality indicators
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
ADD COLUMN IF NOT EXISTS cupping_score DECIMAL(4,2);

-- ================================================================================
-- PROFILE LOG TABLE EXTENSIONS  
-- ================================================================================

-- Add new columns to existing profile_log table
ALTER TABLE profile_log
ADD COLUMN IF NOT EXISTS environmental_temp DECIMAL(5,1), -- ET sensor
ADD COLUMN IF NOT EXISTS ambient_temp DECIMAL(5,1),
ADD COLUMN IF NOT EXISTS inlet_temp DECIMAL(5,1),
ADD COLUMN IF NOT EXISTS time_seconds DECIMAL(8,3),
ADD COLUMN IF NOT EXISTS damper_setting DECIMAL(4,1),
ADD COLUMN IF NOT EXISTS air_flow DECIMAL(4,1),
ADD COLUMN IF NOT EXISTS pressure DECIMAL(4,1),
ADD COLUMN IF NOT EXISTS is_dry_end BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS is_fc_end BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS is_sc_start BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS is_sc_end BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS is_cool BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS data_source VARCHAR(20) DEFAULT 'live' CHECK (data_source IN ('live', 'artisan_import', 'manual')),
ADD COLUMN IF NOT EXISTS data_quality VARCHAR(20) DEFAULT 'good' CHECK (data_quality IN ('good', 'interpolated', 'estimated', 'poor')),
ADD COLUMN IF NOT EXISTS ror_et DECIMAL(5,2),
ADD COLUMN IF NOT EXISTS ror_bt DECIMAL(5,2);

-- ================================================================================
-- NEW TABLE: ARTISAN IMPORT LOG
-- ================================================================================

CREATE TABLE IF NOT EXISTS artisan_import_log (
    import_id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL,
    roast_id INTEGER,
    filename VARCHAR(255),
    file_size INTEGER,
    artisan_version VARCHAR(50),
    import_timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    total_data_points INTEGER,
    temperature_range_bt DECIMAL[2],
    temperature_range_et DECIMAL[2],
    time_range DECIMAL[2],
    processing_status VARCHAR(20) DEFAULT 'success' CHECK (processing_status IN ('success', 'warning', 'error')),
    processing_messages TEXT[],
    validation_errors TEXT[],
    original_data JSONB
);

-- ================================================================================
-- NEW TABLE: ROAST EVENTS
-- ================================================================================

CREATE TABLE IF NOT EXISTS roast_events (
    event_id SERIAL PRIMARY KEY,
    roast_id INTEGER NOT NULL,
    time_seconds DECIMAL(8,3) NOT NULL,
    event_type INTEGER NOT NULL,
    event_value DECIMAL(8,3),
    event_string VARCHAR(100),
    category VARCHAR(50),
    subcategory VARCHAR(50),
    user_generated BOOLEAN DEFAULT FALSE,
    automatic BOOLEAN DEFAULT TRUE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ================================================================================
-- NEW TABLE: ROAST PHASES
-- ================================================================================

CREATE TABLE IF NOT EXISTS roast_phases (
    phase_id SERIAL PRIMARY KEY,
    roast_id INTEGER NOT NULL,
    phase_name VARCHAR(50) NOT NULL,
    phase_order INTEGER NOT NULL,
    start_time DECIMAL(8,3),
    end_time DECIMAL(8,3),
    duration DECIMAL(8,3),
    percentage_of_total DECIMAL(4,1),
    start_temp DECIMAL(5,1),
    end_temp DECIMAL(5,1),
    max_temp DECIMAL(5,1),
    min_temp DECIMAL(5,1),
    avg_temp DECIMAL(5,1),
    avg_ror DECIMAL(5,2),
    max_ror DECIMAL(5,2),
    min_ror DECIMAL(5,2),
    calculation_method VARCHAR(50) DEFAULT 'artisan',
    confidence_score DECIMAL(3,2) DEFAULT 1.0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(roast_id, phase_name)
);

-- ================================================================================
-- NEW TABLE: EXTRA DEVICE DATA
-- ================================================================================

CREATE TABLE IF NOT EXISTS extra_device_data (
    device_data_id SERIAL PRIMARY KEY,
    roast_id INTEGER NOT NULL,
    device_id INTEGER NOT NULL,
    device_name VARCHAR(100),
    sensor_type VARCHAR(50),
    time_seconds DECIMAL(8,3) NOT NULL,
    value DECIMAL(8,3),
    unit VARCHAR(20),
    quality VARCHAR(20) DEFAULT 'good' CHECK (quality IN ('good', 'interpolated', 'estimated', 'poor'))
);

-- ================================================================================
-- BASIC INDEXES
-- ================================================================================

-- Essential indexes only
CREATE INDEX IF NOT EXISTS idx_roast_profiles_user_date ON roast_profiles(user, roast_date DESC);
CREATE INDEX IF NOT EXISTS idx_roast_profiles_source ON roast_profiles(data_source);
CREATE INDEX IF NOT EXISTS idx_profile_log_roast_time_sec ON profile_log(roast_id, time_seconds);
CREATE INDEX IF NOT EXISTS idx_profile_log_source ON profile_log(data_source);
CREATE INDEX IF NOT EXISTS idx_artisan_import_user_date ON artisan_import_log(user_id, import_timestamp DESC);

-- ================================================================================
-- SIMPLE HELPER FUNCTIONS
-- ================================================================================

-- Simple conversion functions
CREATE OR REPLACE FUNCTION fahrenheit_to_celsius(temp_f DECIMAL)
RETURNS DECIMAL AS $$
BEGIN
    IF temp_f IS NULL THEN RETURN NULL; END IF;
    RETURN ROUND(((temp_f - 32) * 5.0 / 9.0)::numeric, 1);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION celsius_to_fahrenheit(temp_c DECIMAL)
RETURNS DECIMAL AS $$
BEGIN
    IF temp_c IS NULL THEN RETURN NULL; END IF;
    RETURN ROUND(((temp_c * 9.0 / 5.0) + 32)::numeric, 1);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION seconds_to_mmss(seconds DECIMAL)
RETURNS TEXT AS $$
DECLARE
    minutes INTEGER;
    secs INTEGER;
BEGIN
    IF seconds IS NULL OR seconds < 0 THEN RETURN '--:--'; END IF;
    minutes := FLOOR(seconds / 60);
    secs := FLOOR(seconds % 60);
    RETURN minutes || ':' || LPAD(secs::text, 2, '0');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ================================================================================
-- DATA MIGRATION
-- ================================================================================

-- Update existing data to be compatible
UPDATE roast_profiles SET data_source = 'manual' WHERE data_source IS NULL;
UPDATE profile_log SET data_source = 'live' WHERE data_source IS NULL;
UPDATE profile_log SET time_seconds = EXTRACT(EPOCH FROM time) WHERE time_seconds IS NULL AND time IS NOT NULL;