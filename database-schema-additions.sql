-- Database schema additions for Stripe role assignment fix
-- Run these in Supabase SQL editor

-- Table 1: Track session processing for idempotency
CREATE TABLE public.stripe_session_processing (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    session_id text NOT NULL,
    user_id uuid NOT NULL,
    status text NOT NULL CHECK (status IN ('processing', 'completed', 'failed')),
    role_updated boolean DEFAULT false,
    error_message text,
    started_at timestamp with time zone DEFAULT now(),
    completed_at timestamp with time zone,
    CONSTRAINT stripe_session_processing_pkey PRIMARY KEY (id),
    CONSTRAINT stripe_session_processing_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
    CONSTRAINT stripe_session_processing_unique UNIQUE (session_id, user_id)
);

-- Create index for performance
CREATE INDEX idx_stripe_session_processing_session_user ON public.stripe_session_processing (session_id, user_id);
CREATE INDEX idx_stripe_session_processing_status ON public.stripe_session_processing (status);

-- Table 2: Audit trail for all role changes
CREATE TABLE public.role_audit_logs (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    old_role text,
    new_role text NOT NULL,
    trigger_type text NOT NULL CHECK (trigger_type IN ('checkout_success', 'webhook_processing', 'manual_verification', 'admin_change')),
    stripe_customer_id text,
    stripe_subscription_id text,
    session_id text,
    metadata jsonb,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT role_audit_logs_pkey PRIMARY KEY (id),
    CONSTRAINT role_audit_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Create indexes for performance and monitoring queries
CREATE INDEX idx_role_audit_logs_user_id ON public.role_audit_logs (user_id);
CREATE INDEX idx_role_audit_logs_created_at ON public.role_audit_logs (created_at DESC);
CREATE INDEX idx_role_audit_logs_trigger_type ON public.role_audit_logs (trigger_type);
CREATE INDEX idx_role_audit_logs_stripe_customer ON public.role_audit_logs (stripe_customer_id);

-- Enable Row Level Security
ALTER TABLE public.stripe_session_processing ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_audit_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for stripe_session_processing
-- Users can only see their own session processing records
CREATE POLICY "Users can view own session processing" ON public.stripe_session_processing
    FOR SELECT USING (auth.uid() = user_id);

-- Service role can manage all records (for webhooks and admin operations)
CREATE POLICY "Service role can manage all session processing" ON public.stripe_session_processing
    FOR ALL USING (auth.role() = 'service_role');

-- RLS Policies for role_audit_logs  
-- Users can view their own audit logs
CREATE POLICY "Users can view own audit logs" ON public.role_audit_logs
    FOR SELECT USING (auth.uid() = user_id);

-- Service role can manage all audit logs
CREATE POLICY "Service role can manage all audit logs" ON public.role_audit_logs
    FOR ALL USING (auth.role() = 'service_role');

-- Admin users can view all audit logs (add this policy if you have admin role)
-- CREATE POLICY "Admins can view all audit logs" ON public.role_audit_logs
--     FOR SELECT USING (
--         auth.uid() IN (
--             SELECT id FROM public.user_roles WHERE role = 'admin'
--         )
--     );