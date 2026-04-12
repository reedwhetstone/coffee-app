CREATE TABLE IF NOT EXISTS public.billing_subscriptions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  stripe_customer_id text NOT NULL,
  stripe_subscription_id text NOT NULL,
  stripe_subscription_item_id text NOT NULL UNIQUE,
  stripe_price_id text NOT NULL,
  product_family text NOT NULL,
  product_key text NOT NULL,
  status text NOT NULL,
  current_period_end timestamp with time zone,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT billing_subscriptions_pkey PRIMARY KEY (id),
  CONSTRAINT billing_subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

ALTER TABLE public.billing_subscriptions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'billing_subscriptions'
      AND policyname = 'Users can view own billing subscriptions'
  ) THEN
    CREATE POLICY "Users can view own billing subscriptions" ON public.billing_subscriptions
      FOR SELECT USING (auth.uid() = user_id);
  END IF;
END
$$;

GRANT SELECT ON public.billing_subscriptions TO authenticated;
