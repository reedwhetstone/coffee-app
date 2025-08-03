-- Fix for RoR Numeric Overflow Error
-- Run this script if you've already created the roast_temperatures table
-- and are encountering the "numeric field overflow" error

-- ================================================================================
-- 1. ALTER EXISTING TABLE TO INCREASE RoR FIELD PRECISION
-- ================================================================================

-- Increase ror_bean_temp precision from DECIMAL(5,2) to DECIMAL(6,2)
-- This allows values up to 9999.99 instead of 999.99
ALTER TABLE public.roast_temperatures 
ALTER COLUMN ror_bean_temp TYPE DECIMAL(6,2);

-- ================================================================================
-- 2. UPDATE THE RoR CALCULATION FUNCTION WITH BOUNDS CHECKING
-- ================================================================================

-- Drop and recreate the trigger first
DROP TRIGGER IF EXISTS calculate_ror_trigger ON public.roast_temperatures;

-- Updated function with proper bounds checking and validation
CREATE OR REPLACE FUNCTION calculate_ror_on_insert()
RETURNS TRIGGER AS $$
DECLARE
    prev_temp_record RECORD;
    charge_time DECIMAL;
    drop_time DECIMAL;
    time_diff DECIMAL;
    temp_diff_bt DECIMAL;
    calculated_ror DECIMAL(8,4);
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
            SELECT rt.time_seconds, rt.bean_temp
            INTO prev_temp_record
            FROM public.roast_temperatures rt
            WHERE rt.roast_id = NEW.roast_id
              AND rt.time_seconds < NEW.time_seconds
              AND rt.time_seconds >= charge_time  -- Only look for previous readings after charge
            ORDER BY rt.time_seconds DESC
            LIMIT 1;

            -- If we have a previous record, calculate bean temp RoR with validation
            IF prev_temp_record IS NOT NULL THEN
                time_diff := NEW.time_seconds - prev_temp_record.time_seconds;
                
                -- Only calculate if time difference is reasonable (>= 2 seconds and < 300 seconds)
                IF time_diff >= 2 AND time_diff < 300 THEN
                    IF NEW.bean_temp IS NOT NULL AND prev_temp_record.bean_temp IS NOT NULL THEN
                        temp_diff_bt := NEW.bean_temp - prev_temp_record.bean_temp;
                        
                        -- Only calculate if temperature change is reasonable (< 100°F change)
                        IF abs(temp_diff_bt) <= 100 THEN
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
                        END IF;
                    END IF;
                END IF;
            END IF;
        END IF;
    ELSE
        -- If charge/drop times not set yet, calculate RoR for all data (live recording scenario)
        SELECT rt.time_seconds, rt.bean_temp
        INTO prev_temp_record
        FROM public.roast_temperatures rt
        WHERE rt.roast_id = NEW.roast_id
          AND rt.time_seconds < NEW.time_seconds
        ORDER BY rt.time_seconds DESC
        LIMIT 1;

        IF prev_temp_record IS NOT NULL THEN
            time_diff := NEW.time_seconds - prev_temp_record.time_seconds;
            
            -- Apply same validation as charge-to-drop scenario
            IF time_diff >= 2 AND time_diff < 300 THEN
                IF NEW.bean_temp IS NOT NULL AND prev_temp_record.bean_temp IS NOT NULL THEN
                    temp_diff_bt := NEW.bean_temp - prev_temp_record.bean_temp;
                    
                    -- Only calculate if temperature change is reasonable (< 100°F change)
                    IF abs(temp_diff_bt) <= 100 THEN
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
                    END IF;
                END IF;
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate the trigger
CREATE TRIGGER calculate_ror_trigger
    BEFORE INSERT ON public.roast_temperatures
    FOR EACH ROW
    EXECUTE FUNCTION calculate_ror_on_insert();

-- ================================================================================
-- 3. CLEAN UP EXISTING INVALID RoR VALUES (OPTIONAL)
-- ================================================================================

-- If you have existing data with invalid RoR values, you can clean them up:
-- This will set extreme RoR values to the capped limits

UPDATE public.roast_temperatures 
SET ror_bean_temp = 999.99 
WHERE ror_bean_temp > 999;

UPDATE public.roast_temperatures 
SET ror_bean_temp = -999.99 
WHERE ror_bean_temp < -999;

-- Or alternatively, set extreme values to NULL if you prefer:
-- UPDATE public.roast_temperatures 
-- SET ror_bean_temp = NULL 
-- WHERE abs(ror_bean_temp) > 999;

-- ================================================================================
-- 4. VERIFICATION QUERIES
-- ================================================================================

-- Check the range of RoR values in your data
SELECT 
    MIN(ror_bean_temp) as min_ror,
    MAX(ror_bean_temp) as max_ror,
    AVG(ror_bean_temp) as avg_ror,
    COUNT(*) as total_records,
    COUNT(ror_bean_temp) as ror_calculated_records
FROM public.roast_temperatures;

-- Check for any remaining extreme values
SELECT roast_id, time_seconds, bean_temp, ror_bean_temp
FROM public.roast_temperatures 
WHERE abs(ror_bean_temp) > 999
ORDER BY abs(ror_bean_temp) DESC
LIMIT 10;

-- ================================================================================
-- MIGRATION FIX COMPLETE
-- ================================================================================

-- After running this script:
-- 1. The ror_bean_temp field can now store larger values (up to 9999.99)
-- 2. The trigger function validates data and caps extreme values
-- 3. Time differences must be >= 2 seconds to avoid division by very small numbers
-- 4. Temperature changes must be <= 100°F to ignore unrealistic spikes
-- 5. RoR values are capped at ±999.99 degrees per minute

COMMENT ON COLUMN public.roast_temperatures.ror_bean_temp IS 
'Bean temperature Rate of Rise (degrees F per minute). Calculated only during charge-to-drop period. Values capped at ±999.99.';