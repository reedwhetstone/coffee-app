-- Update RLS policies for webhook service access
-- This migration modifies existing policies or creates new ones to allow service role access for webhooks

-- First, let's create a function to check if the current role is the service role
CREATE OR REPLACE FUNCTION auth.is_service_role()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN current_setting('role', FALSE) = 'service_role';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add policy for stripe_customers table to allow service role full access
ALTER TABLE public.stripe_customers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service can manage stripe_customers" ON public.stripe_customers;
CREATE POLICY "Service can manage stripe_customers" 
ON public.stripe_customers
USING (auth.is_service_role())
WITH CHECK (auth.is_service_role());

-- Add policy for user_roles table to allow service role full access
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service can manage user_roles" ON public.user_roles;
CREATE POLICY "Service can manage user_roles" 
ON public.user_roles
USING (auth.is_service_role())
WITH CHECK (auth.is_service_role()); 