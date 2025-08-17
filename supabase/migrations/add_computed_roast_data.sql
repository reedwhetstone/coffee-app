-- Migration: Add computed roast data columns to roast_profiles table
-- Description: Adds Artisan computed data fields for turning point, ROR metrics, and roast analytics

-- Add turning point data (TP is the lowest temperature point in roast curve)
ALTER TABLE public.roast_profiles
ADD COLUMN tp_time NUMERIC;

ALTER TABLE public.roast_profiles
ADD COLUMN tp_temp NUMERIC;

-- Add Rate of Rise (ROR) metrics for roast phase analysis
ALTER TABLE public.roast_profiles
ADD COLUMN dry_phase_ror NUMERIC;

ALTER TABLE public.roast_profiles
ADD COLUMN mid_phase_ror NUMERIC;

ALTER TABLE public.roast_profiles
ADD COLUMN finish_phase_ror NUMERIC;

ALTER TABLE public.roast_profiles
ADD COLUMN total_ror NUMERIC;

-- Add advanced roast analytics
ALTER TABLE public.roast_profiles
ADD COLUMN auc NUMERIC;

ALTER TABLE public.roast_profiles
ADD COLUMN weight_loss_percent NUMERIC;

ALTER TABLE public.roast_profiles
ADD COLUMN dry_phase_delta_temp NUMERIC;

-- Add comments to document the new columns
COMMENT ON COLUMN public.roast_profiles.tp_time IS 'Turning point time in seconds from Artisan computed data';
COMMENT ON COLUMN public.roast_profiles.tp_temp IS 'Turning point bean temperature from Artisan computed data';
COMMENT ON COLUMN public.roast_profiles.dry_phase_ror IS 'Rate of rise during drying phase from Artisan computed data';
COMMENT ON COLUMN public.roast_profiles.mid_phase_ror IS 'Rate of rise during maillard phase from Artisan computed data';
COMMENT ON COLUMN public.roast_profiles.finish_phase_ror IS 'Rate of rise during development phase from Artisan computed data';
COMMENT ON COLUMN public.roast_profiles.total_ror IS 'Overall average rate of rise from Artisan computed data';
COMMENT ON COLUMN public.roast_profiles.auc IS 'Area Under Curve calculation from Artisan computed data';
COMMENT ON COLUMN public.roast_profiles.weight_loss_percent IS 'Pre-computed weight loss percentage from Artisan computed data';
COMMENT ON COLUMN public.roast_profiles.dry_phase_delta_temp IS 'Temperature change during drying phase from Artisan computed data';