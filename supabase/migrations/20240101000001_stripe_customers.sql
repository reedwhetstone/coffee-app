-- Create stripe_customers table to map Stripe customers to Supabase users
CREATE TABLE IF NOT EXISTS public.stripe_customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    customer_id TEXT NOT NULL UNIQUE,
    email TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.stripe_customers ENABLE ROW LEVEL SECURITY;

-- Allow users to read their own customer data
CREATE POLICY "Users can read their own customer data"
    ON public.stripe_customers
    FOR SELECT
    USING (auth.uid() = user_id);

-- Allow service role to manage customer data (for webhook processing)
CREATE POLICY "Service role can manage customer data"
    ON public.stripe_customers
    FOR ALL
    USING (auth.role() = 'service_role');

-- Create a trigger to update the updated_at timestamp
CREATE TRIGGER update_stripe_customers_updated_at
    BEFORE UPDATE ON public.stripe_customers
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column(); 