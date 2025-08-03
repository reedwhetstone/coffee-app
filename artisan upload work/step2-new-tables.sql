-- Step 2: Create new tables for Artisan support
-- Run this after step 1 completes successfully

-- Import tracking table
CREATE TABLE IF NOT EXISTS artisan_import_log (
    import_id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL,
    roast_id INTEGER,
    filename TEXT,
    file_size INTEGER,
    artisan_version TEXT,
    import_timestamp TIMESTAMPTZ DEFAULT NOW(),
    total_data_points INTEGER,
    processing_status TEXT DEFAULT 'success',
    processing_messages TEXT[],
    original_data JSONB
);

-- Roast events table
CREATE TABLE IF NOT EXISTS roast_events (
    event_id SERIAL PRIMARY KEY,
    roast_id INTEGER NOT NULL,
    time_seconds DECIMAL(8,3) NOT NULL,
    event_type INTEGER NOT NULL,
    event_value DECIMAL(8,3),
    event_string TEXT,
    category TEXT,
    subcategory TEXT,
    user_generated BOOLEAN DEFAULT FALSE,
    automatic BOOLEAN DEFAULT TRUE,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Roast phases table
CREATE TABLE IF NOT EXISTS roast_phases (
    phase_id SERIAL PRIMARY KEY,
    roast_id INTEGER NOT NULL,
    phase_name TEXT NOT NULL,
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
    calculation_method TEXT DEFAULT 'artisan',
    confidence_score DECIMAL(3,2) DEFAULT 1.0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Extra device data table
CREATE TABLE IF NOT EXISTS extra_device_data (
    device_data_id SERIAL PRIMARY KEY,
    roast_id INTEGER NOT NULL,
    device_id INTEGER NOT NULL,
    device_name TEXT,
    sensor_type TEXT,
    time_seconds DECIMAL(8,3) NOT NULL,
    value DECIMAL(8,3),
    unit TEXT,
    quality TEXT DEFAULT 'good'
);