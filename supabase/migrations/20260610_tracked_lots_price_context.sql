-- Watchlist intelligence support: capture the lot price at tracking time so the
-- dashboard, market index, and catalog detail views can report movement since tracking.

ALTER TABLE public.tracked_lots
  ADD COLUMN IF NOT EXISTS price_at_tracking numeric;

COMMENT ON COLUMN public.tracked_lots.price_at_tracking IS
  'Display price per lb (price_per_lb, falling back to cost_lb) captured when the lot was tracked. Null for rows tracked before this column existed.';
