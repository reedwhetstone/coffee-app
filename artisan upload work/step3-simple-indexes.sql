-- Step 3: Simple indexes and functions only
-- No complex WHERE clauses that might cause IMMUTABLE issues
-- Essential indexes for performance
CREATE INDEX IF NOT EXISTS idx_roast_profiles_user_date ON roast_profiles("user", roast_date);
CREATE INDEX IF NOT EXISTS idx_roast_profiles_source ON roast_profiles(data_source);
CREATE INDEX IF NOT EXISTS idx_roast_profiles_uuid ON roast_profiles(roast_uuid);

CREATE INDEX IF NOT EXISTS idx_profile_log_roast_time ON profile_log(roast_id, time_seconds);
CREATE INDEX IF NOT EXISTS idx_profile_log_source ON profile_log(data_source);

CREATE INDEX IF NOT EXISTS idx_artisan_import_user ON artisan_import_log(user_id);
CREATE INDEX IF NOT EXISTS idx_roast_events_roast ON roast_events(roast_id);
CREATE INDEX IF NOT EXISTS idx_roast_phases_roast ON roast_phases(roast_id);
CREATE INDEX IF NOT EXISTS idx_extra_device_roast ON extra_device_data(roast_id);


-- Helper functions for temperature conversion
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

-- Time formatting function  
CREATE OR REPLACE FUNCTION seconds_to_mmss(seconds DECIMAL)
RETURNS TEXT AS $$
DECLARE
    minutes INTEGER;
    secs INTEGER;
BEGIN
    IF seconds IS NULL OR seconds < 0 THEN RETURN '--:--'; END IF;
    minutes := FLOOR(seconds / 60);
    secs := FLOOR(seconds % 60);
    RETURN LPAD(minutes::text, 2, '0') || ':' || LPAD(secs::text, 2, '0');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Update existing data for compatibility
UPDATE roast_profiles SET data_source = 'manual' WHERE data_source IS NULL;
UPDATE profile_log SET data_source = 'live' WHERE data_source IS NULL;