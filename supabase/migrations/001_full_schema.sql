-- =============================================================================
-- Purveyors.io Full Schema Migration
-- Generated from prod OpenAPI spec + schema.sql
-- Run this in the dev project SQL Editor
-- =============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA public;

-- =============================================================================
-- Custom Types
-- =============================================================================

DO $$ BEGIN
  CREATE TYPE public.user_role AS ENUM ('viewer', 'member', 'admin', 'api_viewer', 'api_member', 'api_enterprise');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- =============================================================================
-- Tables
-- =============================================================================

-- user_roles: Central user table, FK'd from auth.users
CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid NOT NULL,
  role public.user_role NOT NULL DEFAULT 'viewer'::public.user_role,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  email text,
  name text,
  user_role text[] NOT NULL DEFAULT '{viewer}'::text[],
  CONSTRAINT user_roles_pkey PRIMARY KEY (id),
  CONSTRAINT user_roles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- coffee_catalog: Master coffee data (scraped + user-entered)
CREATE TABLE IF NOT EXISTS public.coffee_catalog (
  id integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  name text NOT NULL,
  score_value numeric,
  arrival_date text,
  region text,
  processing text,
  drying_method text,
  roast_recs text,
  lot_size text,
  bag_size text,
  packaging text,
  cultivar_detail text,
  grade text,
  appearance text,
  description_short text,
  farm_notes text,
  type character varying,
  description_long text,
  link text,
  cost_lb numeric,
  last_updated date,
  source text,
  stocked boolean,
  cupping_notes text,
  unstocked_date date,
  stocked_date date,
  ai_description text,
  ai_tasting_notes jsonb,
  public_coffee boolean DEFAULT true,
  coffee_user uuid,
  country text,
  continent text,
  CONSTRAINT coffee_catalog_pkey PRIMARY KEY (id)
);

-- coffee_chunks: Vector embeddings for RAG search
CREATE TABLE IF NOT EXISTS public.coffee_chunks (
  id text NOT NULL,
  coffee_id integer,
  chunk_type text NOT NULL,
  content text NOT NULL,
  metadata jsonb NOT NULL,
  embedding vector(1536) NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT coffee_chunks_pkey PRIMARY KEY (id),
  CONSTRAINT coffee_chunks_coffee_id_fkey FOREIGN KEY (coffee_id) REFERENCES public.coffee_catalog(id) ON DELETE CASCADE
);

-- green_coffee_inv: User's personal coffee inventory
CREATE TABLE IF NOT EXISTS public.green_coffee_inv (
  id integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  rank integer,
  notes text,
  purchase_date date,
  purchased_qty_lbs integer,
  bean_cost numeric,
  tax_ship_cost numeric,
  last_updated character varying,
  "user" uuid,
  catalog_id integer,
  stocked boolean DEFAULT true,
  cupping_notes jsonb,
  CONSTRAINT green_coffee_inv_pkey PRIMARY KEY (id),
  CONSTRAINT green_coffee_inv_user_fkey FOREIGN KEY ("user") REFERENCES public.user_roles(id),
  CONSTRAINT green_coffee_inv_catalog_id_fkey FOREIGN KEY (catalog_id) REFERENCES public.coffee_catalog(id)
);

-- roast_profiles: Roasting session data
CREATE TABLE IF NOT EXISTS public.roast_profiles (
  roast_id integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  batch_name character varying NOT NULL,
  coffee_id integer NOT NULL,
  coffee_name character varying NOT NULL,
  roast_date date NOT NULL,
  oz_in numeric,
  oz_out numeric,
  roast_notes character varying,
  roast_targets character varying,
  last_updated character varying,
  "user" uuid,
  roaster_type text,
  roaster_size numeric,
  roast_uuid text,
  temperature_unit text DEFAULT 'F'::text,
  charge_time numeric,
  dry_end_time numeric,
  fc_start_time numeric,
  fc_end_time numeric,
  sc_start_time numeric,
  drop_time numeric,
  cool_time numeric,
  charge_temp numeric,
  dry_end_temp numeric,
  fc_start_temp numeric,
  fc_end_temp numeric,
  sc_start_temp numeric,
  drop_temp numeric,
  cool_temp numeric,
  dry_percent numeric,
  maillard_percent numeric,
  development_percent numeric,
  total_roast_time numeric,
  data_source text DEFAULT 'manual'::text,
  chart_z_max numeric,
  chart_z_min numeric,
  chart_y_max numeric,
  chart_y_min numeric,
  chart_x_max numeric,
  chart_x_min numeric,
  tp_time numeric,
  tp_temp numeric,
  dry_phase_ror numeric,
  mid_phase_ror numeric,
  finish_phase_ror numeric,
  total_ror numeric,
  auc numeric,
  weight_loss_percent numeric,
  dry_phase_delta_temp numeric,
  CONSTRAINT roast_profiles_pkey PRIMARY KEY (roast_id),
  CONSTRAINT roast_profiles_user_fkey FOREIGN KEY ("user") REFERENCES public.user_roles(id),
  CONSTRAINT roast_profiles_coffee_id_fkey FOREIGN KEY (coffee_id) REFERENCES public.green_coffee_inv(id)
);

-- roast_temperatures: Time-series temperature data
CREATE TABLE IF NOT EXISTS public.roast_temperatures (
  temp_id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  roast_id integer NOT NULL,
  time_seconds numeric NOT NULL,
  bean_temp numeric,
  environmental_temp numeric,
  ambient_temp numeric,
  inlet_temp numeric,
  ror_bean_temp numeric,
  data_source text DEFAULT 'live'::text CHECK (data_source = ANY (ARRAY['live'::text, 'artisan_import'::text, 'manual'::text])),
  data_quality text DEFAULT 'good'::text CHECK (data_quality = ANY (ARRAY['good'::text, 'interpolated'::text, 'estimated'::text, 'poor'::text])),
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT roast_temperatures_pkey PRIMARY KEY (temp_id),
  CONSTRAINT roast_temperatures_roast_id_fkey FOREIGN KEY (roast_id) REFERENCES public.roast_profiles(roast_id) ON DELETE CASCADE
);

-- roast_events: Milestones, controls, machine settings
CREATE TABLE IF NOT EXISTS public.roast_events (
  event_id integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  roast_id integer NOT NULL,
  time_seconds numeric NOT NULL,
  event_type integer NOT NULL,
  event_value text,
  event_string text,
  category text,
  subcategory text,
  user_generated boolean DEFAULT false,
  automatic boolean DEFAULT true,
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT roast_events_pkey PRIMARY KEY (event_id),
  CONSTRAINT roast_events_roast_id_fkey FOREIGN KEY (roast_id) REFERENCES public.roast_profiles(roast_id) ON DELETE CASCADE
);

-- sales: Roasted coffee sales tracking
CREATE TABLE IF NOT EXISTS public.sales (
  id integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  green_coffee_inv_id integer NOT NULL,
  oz_sold integer NOT NULL,
  price numeric NOT NULL,
  buyer character varying NOT NULL,
  batch_name text,
  sell_date date NOT NULL,
  purchase_date date NOT NULL,
  "user" uuid,
  CONSTRAINT sales_pkey PRIMARY KEY (id),
  CONSTRAINT sales_green_coffee_inv_id_fkey FOREIGN KEY (green_coffee_inv_id) REFERENCES public.green_coffee_inv(id),
  CONSTRAINT sales_user_fkey FOREIGN KEY ("user") REFERENCES public.user_roles(id)
);

-- artisan_import_log: Artisan roast file import tracking
CREATE TABLE IF NOT EXISTS public.artisan_import_log (
  import_id integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  user_id uuid NOT NULL,
  roast_id integer,
  filename text,
  file_size integer,
  artisan_version text,
  import_timestamp timestamp with time zone DEFAULT now(),
  total_data_points integer,
  processing_status text DEFAULT 'success'::text,
  processing_messages text[],
  original_data jsonb,
  CONSTRAINT artisan_import_log_pkey PRIMARY KEY (import_id)
);

-- api_keys: User API keys for external access
CREATE TABLE IF NOT EXISTS public.api_keys (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  key_hash text NOT NULL UNIQUE,
  name text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  last_used_at timestamp with time zone,
  is_active boolean DEFAULT true,
  permissions jsonb DEFAULT '{}'::jsonb,
  CONSTRAINT api_keys_pkey PRIMARY KEY (id),
  CONSTRAINT api_keys_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.user_roles(id)
);

-- api_usage: API usage tracking
CREATE TABLE IF NOT EXISTS public.api_usage (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  api_key_id uuid,
  endpoint text NOT NULL,
  "timestamp" timestamp with time zone DEFAULT now(),
  response_time_ms integer,
  status_code integer,
  user_agent text,
  ip_address inet,
  CONSTRAINT api_usage_pkey PRIMARY KEY (id),
  CONSTRAINT api_usage_api_key_id_fkey FOREIGN KEY (api_key_id) REFERENCES public.api_keys(id)
);

-- stripe_customers: Stripe customer mapping
CREATE TABLE IF NOT EXISTS public.stripe_customers (
  id uuid NOT NULL DEFAULT extensions.uuid_generate_v4(),
  user_id uuid NOT NULL UNIQUE,
  customer_id text NOT NULL UNIQUE,
  email text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT stripe_customers_pkey PRIMARY KEY (id),
  CONSTRAINT stripe_customers_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);

-- stripe_session_processing: Stripe checkout session tracking
CREATE TABLE IF NOT EXISTS public.stripe_session_processing (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  session_id text NOT NULL,
  user_id uuid NOT NULL,
  status text NOT NULL CHECK (status = ANY (ARRAY['processing'::text, 'completed'::text, 'failed'::text])),
  role_updated boolean DEFAULT false,
  error_message text,
  started_at timestamp with time zone DEFAULT now(),
  completed_at timestamp with time zone,
  CONSTRAINT stripe_session_processing_pkey PRIMARY KEY (id),
  CONSTRAINT stripe_session_processing_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);

-- role_audit_logs: Role change audit trail
CREATE TABLE IF NOT EXISTS public.role_audit_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  old_role text,
  new_role text NOT NULL,
  trigger_type text NOT NULL CHECK (trigger_type = ANY (ARRAY['checkout_success'::text, 'webhook_processing'::text, 'manual_verification'::text, 'admin_change'::text])),
  stripe_customer_id text,
  stripe_subscription_id text,
  session_id text,
  metadata jsonb,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT role_audit_logs_pkey PRIMARY KEY (id),
  CONSTRAINT role_audit_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);

-- shared_links: Shareable resource links
CREATE TABLE IF NOT EXISTS public.shared_links (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  share_token text NOT NULL UNIQUE,
  resource_type text NOT NULL,
  resource_id text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  expires_at timestamp with time zone,
  is_active boolean DEFAULT true,
  CONSTRAINT shared_links_pkey PRIMARY KEY (id),
  CONSTRAINT shared_links_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);

-- workspaces: AI chat workspaces
CREATE TABLE IF NOT EXISTS public.workspaces (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  title text NOT NULL DEFAULT 'New Workspace',
  type text NOT NULL DEFAULT 'general',
  context_summary text DEFAULT '',
  canvas_state jsonb,
  last_accessed_at timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT workspaces_pkey PRIMARY KEY (id),
  CONSTRAINT workspaces_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.user_roles(id) ON DELETE CASCADE
);

-- workspace_messages: Chat message history
CREATE TABLE IF NOT EXISTS public.workspace_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  workspace_id uuid,
  role text NOT NULL,
  content text NOT NULL,
  parts jsonb,
  canvas_mutations jsonb,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT workspace_messages_pkey PRIMARY KEY (id),
  CONSTRAINT workspace_messages_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE
);

-- user_ai_context: AI context summaries per user
CREATE TABLE IF NOT EXISTS public.user_ai_context (
  user_id uuid NOT NULL,
  global_summary text DEFAULT '',
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT user_ai_context_pkey PRIMARY KEY (user_id),
  CONSTRAINT user_ai_context_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.user_roles(id) ON DELETE CASCADE
);

-- =============================================================================
-- Indexes (including missing ones from audit)
-- =============================================================================

-- Critical performance indexes for high-volume tables
CREATE INDEX IF NOT EXISTS idx_roast_temperatures_roast_id ON public.roast_temperatures(roast_id);
CREATE INDEX IF NOT EXISTS idx_roast_temperatures_roast_time ON public.roast_temperatures(roast_id, time_seconds);
CREATE INDEX IF NOT EXISTS idx_roast_events_roast_id ON public.roast_events(roast_id);
CREATE INDEX IF NOT EXISTS idx_roast_events_roast_time ON public.roast_events(roast_id, time_seconds);

-- Catalog search indexes
CREATE INDEX IF NOT EXISTS idx_coffee_catalog_source ON public.coffee_catalog(source);
CREATE INDEX IF NOT EXISTS idx_coffee_catalog_stocked ON public.coffee_catalog(stocked);
CREATE INDEX IF NOT EXISTS idx_coffee_catalog_country ON public.coffee_catalog(country);

-- User data indexes
CREATE INDEX IF NOT EXISTS idx_green_coffee_inv_user ON public.green_coffee_inv("user");
CREATE INDEX IF NOT EXISTS idx_green_coffee_inv_catalog ON public.green_coffee_inv(catalog_id);
CREATE INDEX IF NOT EXISTS idx_roast_profiles_user ON public.roast_profiles("user");
CREATE INDEX IF NOT EXISTS idx_roast_profiles_coffee ON public.roast_profiles(coffee_id);
CREATE INDEX IF NOT EXISTS idx_sales_user ON public.sales("user");

-- Workspace indexes
CREATE INDEX IF NOT EXISTS idx_workspaces_user ON public.workspaces(user_id);
CREATE INDEX IF NOT EXISTS idx_workspace_messages_workspace ON public.workspace_messages(workspace_id);

-- API indexes
CREATE INDEX IF NOT EXISTS idx_api_keys_user ON public.api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_api_usage_key ON public.api_usage(api_key_id);

-- Vector similarity search index
CREATE INDEX IF NOT EXISTS idx_coffee_chunks_embedding ON public.coffee_chunks
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- =============================================================================
-- RPC Functions
-- =============================================================================

-- Temperature conversion utilities
CREATE OR REPLACE FUNCTION public.fahrenheit_to_celsius(temp_f numeric)
RETURNS numeric
LANGUAGE sql IMMUTABLE
AS $$
  SELECT ROUND(((temp_f - 32) * 5.0 / 9.0)::numeric, 2);
$$;

CREATE OR REPLACE FUNCTION public.celsius_to_fahrenheit(temp_c numeric)
RETURNS numeric
LANGUAGE sql IMMUTABLE
AS $$
  SELECT ROUND(((temp_c * 9.0 / 5.0) + 32)::numeric, 2);
$$;

-- Time formatting utility
CREATE OR REPLACE FUNCTION public.seconds_to_mmss(seconds numeric)
RETURNS text
LANGUAGE sql IMMUTABLE
AS $$
  SELECT LPAD(FLOOR(seconds / 60)::text, 2, '0') || ':' || LPAD((seconds::integer % 60)::text, 2, '0');
$$;

-- Chart data: raw temperature readings
CREATE OR REPLACE FUNCTION public.get_chart_data_raw(roast_id_param integer, sample_rate integer DEFAULT 1)
RETURNS TABLE(
  temp_id bigint,
  time_seconds numeric,
  bean_temp numeric,
  environmental_temp numeric,
  ror_bean_temp numeric,
  data_source text
)
LANGUAGE sql STABLE
AS $$
  SELECT temp_id, time_seconds, bean_temp, environmental_temp, ror_bean_temp, data_source
  FROM public.roast_temperatures
  WHERE roast_id = roast_id_param
  ORDER BY time_seconds;
$$;

-- Chart data: sampled for performance
CREATE OR REPLACE FUNCTION public.get_chart_data_sampled(roast_id_param integer, target_points integer DEFAULT 500)
RETURNS TABLE(
  temp_id bigint,
  time_seconds numeric,
  bean_temp numeric,
  environmental_temp numeric,
  ror_bean_temp numeric,
  data_source text
)
LANGUAGE plpgsql STABLE
AS $$
DECLARE
  total_count integer;
  sample_rate integer;
BEGIN
  SELECT COUNT(*) INTO total_count FROM public.roast_temperatures WHERE roast_id = roast_id_param;
  sample_rate := GREATEST(1, total_count / target_points);
  RETURN QUERY
    SELECT t.temp_id, t.time_seconds, t.bean_temp, t.environmental_temp, t.ror_bean_temp, t.data_source
    FROM (
      SELECT rt.*, ROW_NUMBER() OVER (ORDER BY rt.time_seconds) as rn
      FROM public.roast_temperatures rt
      WHERE rt.roast_id = roast_id_param
    ) t
    WHERE t.rn % sample_rate = 0
    ORDER BY t.time_seconds;
END;
$$;

-- Chart metadata
CREATE OR REPLACE FUNCTION public.get_chart_metadata(roast_id_param integer)
RETURNS TABLE(
  total_points bigint,
  min_time numeric,
  max_time numeric,
  min_temp numeric,
  max_temp numeric
)
LANGUAGE sql STABLE
AS $$
  SELECT
    COUNT(*),
    MIN(time_seconds),
    MAX(time_seconds),
    MIN(bean_temp),
    MAX(bean_temp)
  FROM public.roast_temperatures
  WHERE roast_id = roast_id_param;
$$;

-- Get temperature data for a roast
CREATE OR REPLACE FUNCTION public.get_roast_temperature_data(p_roast_id integer)
RETURNS TABLE(
  temp_id bigint,
  time_seconds numeric,
  bean_temp numeric,
  environmental_temp numeric,
  ambient_temp numeric,
  inlet_temp numeric,
  ror_bean_temp numeric,
  data_source text,
  data_quality text
)
LANGUAGE sql STABLE
AS $$
  SELECT temp_id, time_seconds, bean_temp, environmental_temp, ambient_temp, inlet_temp, ror_bean_temp, data_source, data_quality
  FROM public.roast_temperatures
  WHERE roast_id = p_roast_id
  ORDER BY time_seconds;
$$;

-- Get control events for a roast
CREATE OR REPLACE FUNCTION public.get_roast_control_events(p_roast_id integer)
RETURNS TABLE(
  event_id integer,
  time_seconds numeric,
  event_type integer,
  event_value text,
  event_string text,
  category text,
  subcategory text
)
LANGUAGE sql STABLE
AS $$
  SELECT event_id, time_seconds, event_type, event_value, event_string, category, subcategory
  FROM public.roast_events
  WHERE roast_id = p_roast_id
    AND category IN ('control', 'setting')
  ORDER BY time_seconds;
$$;

-- Get milestone events for a roast
CREATE OR REPLACE FUNCTION public.get_roast_milestone_events(p_roast_id integer)
RETURNS TABLE(
  event_id integer,
  time_seconds numeric,
  event_type integer,
  event_value text,
  event_string text,
  category text,
  subcategory text
)
LANGUAGE sql STABLE
AS $$
  SELECT event_id, time_seconds, event_type, event_value, event_string, category, subcategory
  FROM public.roast_events
  WHERE roast_id = p_roast_id
    AND category = 'milestone'
  ORDER BY time_seconds;
$$;

-- Get evenly spaced temp IDs for downsampling
CREATE OR REPLACE FUNCTION public.get_even_temp_ids(roast_id_param integer)
RETURNS TABLE(temp_id bigint)
LANGUAGE sql STABLE
AS $$
  SELECT temp_id
  FROM public.roast_temperatures
  WHERE roast_id = roast_id_param
  ORDER BY time_seconds;
$$;

-- Vector similarity search: current stocked catalog
CREATE OR REPLACE FUNCTION public.match_coffee_catalog(
  query_embedding vector(1536),
  match_threshold double precision,
  match_count integer,
  stocked_only boolean DEFAULT true
)
RETURNS TABLE(
  id integer,
  name text,
  score_value numeric,
  region text,
  processing text,
  cost_lb numeric,
  source text,
  stocked boolean,
  description_short text,
  ai_description text,
  similarity double precision
)
LANGUAGE plpgsql STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT
    cc.id, cc.name, cc.score_value, cc.region, cc.processing,
    cc.cost_lb, cc.source, cc.stocked, cc.description_short, cc.ai_description,
    1 - (cc_chunks.embedding <=> query_embedding) as similarity
  FROM public.coffee_chunks cc_chunks
  JOIN public.coffee_catalog cc ON cc.id = cc_chunks.coffee_id
  WHERE 1 - (cc_chunks.embedding <=> query_embedding) > match_threshold
    AND (NOT stocked_only OR cc.stocked = true)
  ORDER BY cc_chunks.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Vector similarity search: chunks
CREATE OR REPLACE FUNCTION public.match_coffee_chunks(
  query_embedding vector(1536),
  match_threshold double precision DEFAULT 0.5,
  match_count integer DEFAULT 10,
  chunk_types text[] DEFAULT NULL
)
RETURNS TABLE(
  id text,
  coffee_id integer,
  chunk_type text,
  content text,
  metadata jsonb,
  similarity double precision
)
LANGUAGE plpgsql STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT
    cc.id, cc.coffee_id, cc.chunk_type, cc.content, cc.metadata,
    1 - (cc.embedding <=> query_embedding) as similarity
  FROM public.coffee_chunks cc
  WHERE 1 - (cc.embedding <=> query_embedding) > match_threshold
    AND (chunk_types IS NULL OR cc.chunk_type = ANY(chunk_types))
  ORDER BY cc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Vector similarity search: historical (all coffees)
CREATE OR REPLACE FUNCTION public.match_coffee_historical(
  query_embedding vector(1536),
  match_threshold double precision,
  match_count integer
)
RETURNS TABLE(
  id integer,
  name text,
  score_value numeric,
  region text,
  processing text,
  cost_lb numeric,
  source text,
  stocked boolean,
  description_short text,
  ai_description text,
  similarity double precision
)
LANGUAGE plpgsql STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT
    cc.id, cc.name, cc.score_value, cc.region, cc.processing,
    cc.cost_lb, cc.source, cc.stocked, cc.description_short, cc.ai_description,
    1 - (cc_chunks.embedding <=> query_embedding) as similarity
  FROM public.coffee_chunks cc_chunks
  JOIN public.coffee_catalog cc ON cc.id = cc_chunks.coffee_id
  WHERE 1 - (cc_chunks.embedding <=> query_embedding) > match_threshold
  ORDER BY cc_chunks.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Vector similarity search: current user inventory
CREATE OR REPLACE FUNCTION public.match_coffee_current_inventory(
  query_embedding vector(1536),
  match_threshold double precision,
  match_count integer
)
RETURNS TABLE(
  id integer,
  name text,
  score_value numeric,
  region text,
  processing text,
  cost_lb numeric,
  source text,
  stocked boolean,
  description_short text,
  ai_description text,
  similarity double precision
)
LANGUAGE plpgsql STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT
    cc.id, cc.name, cc.score_value, cc.region, cc.processing,
    cc.cost_lb, cc.source, cc.stocked, cc.description_short, cc.ai_description,
    1 - (cc_chunks.embedding <=> query_embedding) as similarity
  FROM public.coffee_chunks cc_chunks
  JOIN public.coffee_catalog cc ON cc.id = cc_chunks.coffee_id
  JOIN public.green_coffee_inv gci ON gci.catalog_id = cc.id AND gci.stocked = true
  WHERE 1 - (cc_chunks.embedding <=> query_embedding) > match_threshold
  ORDER BY cc_chunks.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Basic similarity search (legacy)
CREATE OR REPLACE FUNCTION public.similarity(
  query_embedding vector(1536),
  match_threshold double precision
)
RETURNS TABLE(
  id integer,
  name text,
  description_short text,
  similarity double precision
)
LANGUAGE plpgsql STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT
    cc.id, cc.name, cc.description_short,
    1 - (cc_chunks.embedding <=> query_embedding) as similarity
  FROM public.coffee_chunks cc_chunks
  JOIN public.coffee_catalog cc ON cc.id = cc_chunks.coffee_id
  WHERE 1 - (cc_chunks.embedding <=> query_embedding) > match_threshold
  ORDER BY cc_chunks.embedding <=> query_embedding
  LIMIT 10;
END;
$$;

-- Update green coffee inventory from catalog changes
CREATE OR REPLACE FUNCTION public.update_green_coffee_from_catalog()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  -- Sync stocked status from catalog to inventory
  UPDATE public.green_coffee_inv gci
  SET stocked = cc.stocked
  FROM public.coffee_catalog cc
  WHERE gci.catalog_id = cc.id
    AND gci.stocked IS DISTINCT FROM cc.stocked;
END;
$$;

-- =============================================================================
-- Auto-create user_roles on signup trigger
-- =============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_roles (id, email, name, role, user_role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
    'viewer',
    ARRAY['viewer']
  );
  RETURN NEW;
END;
$$;

-- Drop and recreate the trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =============================================================================
-- Row Level Security
-- =============================================================================

-- Enable RLS on all user-data tables
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.green_coffee_inv ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roast_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roast_temperatures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roast_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.artisan_import_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stripe_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stripe_session_processing ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shared_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_ai_context ENABLE ROW LEVEL SECURITY;

-- coffee_catalog: public read, owner write
ALTER TABLE public.coffee_catalog ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public coffees are viewable by everyone" ON public.coffee_catalog
  FOR SELECT USING (public_coffee = true);
CREATE POLICY "Users can insert their own coffees" ON public.coffee_catalog
  FOR INSERT WITH CHECK (auth.uid() = coffee_user);
CREATE POLICY "Users can update their own coffees" ON public.coffee_catalog
  FOR UPDATE USING (auth.uid() = coffee_user);

-- coffee_chunks: public read for search
ALTER TABLE public.coffee_chunks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Coffee chunks are viewable by everyone" ON public.coffee_chunks
  FOR SELECT USING (true);

-- user_roles: users can read own, service role can manage
CREATE POLICY "Users can view own role" ON public.user_roles
  FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own role" ON public.user_roles
  FOR UPDATE USING (auth.uid() = id);

-- green_coffee_inv: user-owned
CREATE POLICY "Users can view own inventory" ON public.green_coffee_inv
  FOR SELECT USING (auth.uid() = "user");
CREATE POLICY "Users can insert own inventory" ON public.green_coffee_inv
  FOR INSERT WITH CHECK (auth.uid() = "user");
CREATE POLICY "Users can update own inventory" ON public.green_coffee_inv
  FOR UPDATE USING (auth.uid() = "user");
CREATE POLICY "Users can delete own inventory" ON public.green_coffee_inv
  FOR DELETE USING (auth.uid() = "user");

-- roast_profiles: user-owned
CREATE POLICY "Users can view own roasts" ON public.roast_profiles
  FOR SELECT USING (auth.uid() = "user");
CREATE POLICY "Users can insert own roasts" ON public.roast_profiles
  FOR INSERT WITH CHECK (auth.uid() = "user");
CREATE POLICY "Users can update own roasts" ON public.roast_profiles
  FOR UPDATE USING (auth.uid() = "user");
CREATE POLICY "Users can delete own roasts" ON public.roast_profiles
  FOR DELETE USING (auth.uid() = "user");

-- roast_temperatures: accessible via roast ownership
CREATE POLICY "Users can view own roast temps" ON public.roast_temperatures
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.roast_profiles rp WHERE rp.roast_id = roast_temperatures.roast_id AND rp."user" = auth.uid()
  ));
CREATE POLICY "Users can insert own roast temps" ON public.roast_temperatures
  FOR INSERT WITH CHECK (EXISTS (
    SELECT 1 FROM public.roast_profiles rp WHERE rp.roast_id = roast_temperatures.roast_id AND rp."user" = auth.uid()
  ));
CREATE POLICY "Users can delete own roast temps" ON public.roast_temperatures
  FOR DELETE USING (EXISTS (
    SELECT 1 FROM public.roast_profiles rp WHERE rp.roast_id = roast_temperatures.roast_id AND rp."user" = auth.uid()
  ));

-- roast_events: accessible via roast ownership
CREATE POLICY "Users can view own roast events" ON public.roast_events
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.roast_profiles rp WHERE rp.roast_id = roast_events.roast_id AND rp."user" = auth.uid()
  ));
CREATE POLICY "Users can insert own roast events" ON public.roast_events
  FOR INSERT WITH CHECK (EXISTS (
    SELECT 1 FROM public.roast_profiles rp WHERE rp.roast_id = roast_events.roast_id AND rp."user" = auth.uid()
  ));
CREATE POLICY "Users can delete own roast events" ON public.roast_events
  FOR DELETE USING (EXISTS (
    SELECT 1 FROM public.roast_profiles rp WHERE rp.roast_id = roast_events.roast_id AND rp."user" = auth.uid()
  ));

-- sales: user-owned
CREATE POLICY "Users can view own sales" ON public.sales
  FOR SELECT USING (auth.uid() = "user");
CREATE POLICY "Users can insert own sales" ON public.sales
  FOR INSERT WITH CHECK (auth.uid() = "user");
CREATE POLICY "Users can update own sales" ON public.sales
  FOR UPDATE USING (auth.uid() = "user");
CREATE POLICY "Users can delete own sales" ON public.sales
  FOR DELETE USING (auth.uid() = "user");

-- api_keys: user-owned
CREATE POLICY "Users can view own API keys" ON public.api_keys
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own API keys" ON public.api_keys
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own API keys" ON public.api_keys
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own API keys" ON public.api_keys
  FOR DELETE USING (auth.uid() = user_id);

-- api_usage: read via key ownership
CREATE POLICY "Users can view own API usage" ON public.api_usage
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.api_keys ak WHERE ak.id = api_usage.api_key_id AND ak.user_id = auth.uid()
  ));

-- workspaces: user-owned
CREATE POLICY "Users can view own workspaces" ON public.workspaces
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own workspaces" ON public.workspaces
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own workspaces" ON public.workspaces
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own workspaces" ON public.workspaces
  FOR DELETE USING (auth.uid() = user_id);

-- workspace_messages: accessible via workspace ownership
CREATE POLICY "Users can view own workspace messages" ON public.workspace_messages
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.workspaces w WHERE w.id = workspace_messages.workspace_id AND w.user_id = auth.uid()
  ));
CREATE POLICY "Users can insert own workspace messages" ON public.workspace_messages
  FOR INSERT WITH CHECK (EXISTS (
    SELECT 1 FROM public.workspaces w WHERE w.id = workspace_messages.workspace_id AND w.user_id = auth.uid()
  ));
CREATE POLICY "Users can delete own workspace messages" ON public.workspace_messages
  FOR DELETE USING (EXISTS (
    SELECT 1 FROM public.workspaces w WHERE w.id = workspace_messages.workspace_id AND w.user_id = auth.uid()
  ));

-- user_ai_context: user-owned
CREATE POLICY "Users can view own AI context" ON public.user_ai_context
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can upsert own AI context" ON public.user_ai_context
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own AI context" ON public.user_ai_context
  FOR UPDATE USING (auth.uid() = user_id);

-- artisan_import_log: user-owned
CREATE POLICY "Users can view own imports" ON public.artisan_import_log
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own imports" ON public.artisan_import_log
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- stripe_customers: user-owned
CREATE POLICY "Users can view own stripe customer" ON public.stripe_customers
  FOR SELECT USING (auth.uid() = user_id);

-- stripe_session_processing: user-owned
CREATE POLICY "Users can view own stripe sessions" ON public.stripe_session_processing
  FOR SELECT USING (auth.uid() = user_id);

-- role_audit_logs: user-owned read
CREATE POLICY "Users can view own audit logs" ON public.role_audit_logs
  FOR SELECT USING (auth.uid() = user_id);

-- shared_links: user-owned + public read by token
CREATE POLICY "Users can view own shared links" ON public.shared_links
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own shared links" ON public.shared_links
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Anyone can view active shared links" ON public.shared_links
  FOR SELECT USING (is_active = true);

-- =============================================================================
-- Grant permissions
-- =============================================================================

-- Anon role: read public data
GRANT SELECT ON public.coffee_catalog TO anon;
GRANT SELECT ON public.coffee_chunks TO anon;
GRANT EXECUTE ON FUNCTION public.match_coffee_catalog TO anon;
GRANT EXECUTE ON FUNCTION public.match_coffee_chunks TO anon;
GRANT EXECUTE ON FUNCTION public.similarity TO anon;

-- Authenticated role: full access to own data
GRANT ALL ON public.user_roles TO authenticated;
GRANT ALL ON public.green_coffee_inv TO authenticated;
GRANT ALL ON public.roast_profiles TO authenticated;
GRANT ALL ON public.roast_temperatures TO authenticated;
GRANT ALL ON public.roast_events TO authenticated;
GRANT ALL ON public.sales TO authenticated;
GRANT ALL ON public.api_keys TO authenticated;
GRANT ALL ON public.api_usage TO authenticated;
GRANT ALL ON public.artisan_import_log TO authenticated;
GRANT ALL ON public.workspaces TO authenticated;
GRANT ALL ON public.workspace_messages TO authenticated;
GRANT ALL ON public.user_ai_context TO authenticated;
GRANT ALL ON public.shared_links TO authenticated;
GRANT SELECT ON public.coffee_catalog TO authenticated;
GRANT SELECT ON public.coffee_chunks TO authenticated;
GRANT SELECT ON public.stripe_customers TO authenticated;
GRANT SELECT ON public.stripe_session_processing TO authenticated;
GRANT SELECT ON public.role_audit_logs TO authenticated;

-- Grant sequence usage
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO anon;

-- Grant function execution
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon;
