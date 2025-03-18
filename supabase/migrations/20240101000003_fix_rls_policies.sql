-- Drop existing policies on stripe_customers table (if any)
DROP POLICY IF EXISTS "Service role can manage customer data" ON public.stripe_customers;
DROP POLICY IF EXISTS "Users can read their own customer data" ON public.stripe_customers;

-- Add policies that also allow insert for authenticated users
CREATE POLICY "Users can manage their own customer data"
    ON public.stripe_customers
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Allow service role full access
CREATE POLICY "Service role can manage all customer data"
    ON public.stripe_customers
    FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

-- Drop existing policies on user_roles table (if any)
DROP POLICY IF EXISTS "Service role can update user roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can read their own role" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can read all roles" ON public.user_roles;

-- Add policies for user_roles
CREATE POLICY "Users can read their own role"
    ON public.user_roles
    FOR SELECT
    USING (auth.uid() = id);

-- Allow service role full access to user_roles
CREATE POLICY "Service role can manage all user roles"
    ON public.user_roles
    FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role'); 