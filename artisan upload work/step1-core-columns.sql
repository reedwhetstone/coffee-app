-- Step 1: Core column additions for Artisan support
-- Run this first to add essential columns to existing tables

-- Add core Artisan columns to roast_profiles
ALTER TABLE roast_profiles
ADD COLUMN IF NOT EXISTS title TEXT,
ADD COLUMN IF NOT EXISTS roaster_type TEXT,
ADD COLUMN IF NOT EXISTS roaster_size DECIMAL(4,2),
ADD COLUMN IF NOT EXISTS roast_uuid TEXT,
ADD COLUMN IF NOT EXISTS temperature_unit TEXT DEFAULT 'F',

-- Milestone timings
ADD COLUMN IF NOT EXISTS charge_time DECIMAL(8,3),
ADD COLUMN IF NOT EXISTS dry_end_time DECIMAL(8,3),
ADD COLUMN IF NOT EXISTS fc_start_time DECIMAL(8,3),
ADD COLUMN IF NOT EXISTS fc_end_time DECIMAL(8,3),
ADD COLUMN IF NOT EXISTS sc_start_time DECIMAL(8,3),
ADD COLUMN IF NOT EXISTS drop_time DECIMAL(8,3),
ADD COLUMN IF NOT EXISTS cool_time DECIMAL(8,3),

-- Milestone temperatures
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

-- Data source tracking
ADD COLUMN IF NOT EXISTS data_source TEXT DEFAULT 'manual';

-- Add core columns to profile_log
ALTER TABLE profile_log
ADD COLUMN IF NOT EXISTS environmental_temp DECIMAL(5,1),
ADD COLUMN IF NOT EXISTS time_seconds DECIMAL(8,3),
ADD COLUMN IF NOT EXISTS is_dry_end BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS is_fc_end BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS is_sc_start BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS is_sc_end BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS is_cool BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS data_source TEXT DEFAULT 'live';