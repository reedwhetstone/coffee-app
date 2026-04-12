DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'user_roles'
      AND column_name = 'api_plan'
  ) THEN
    ALTER TABLE public.user_roles
      ADD COLUMN api_plan text;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'user_roles'
      AND column_name = 'ppi_access'
  ) THEN
    ALTER TABLE public.user_roles
      ADD COLUMN ppi_access boolean;
  END IF;

END $$;

UPDATE public.user_roles
SET role = 'viewer'::public.user_role
WHERE role IS NULL;

UPDATE public.user_roles
SET api_plan = CASE
  WHEN api_plan IN ('viewer', 'member', 'enterprise') THEN api_plan
  ELSE 'viewer'
END
WHERE api_plan IS DISTINCT FROM CASE
  WHEN api_plan IN ('viewer', 'member', 'enterprise') THEN api_plan
  ELSE 'viewer'
END;

UPDATE public.user_roles
SET ppi_access = false
WHERE ppi_access IS NULL;

UPDATE public.user_roles
SET user_role = CASE role
  WHEN 'admin'::public.user_role THEN ARRAY['admin']::text[]
  WHEN 'member'::public.user_role THEN ARRAY['member']::text[]
  ELSE ARRAY['viewer']::text[]
END
WHERE user_role IS NULL
   OR array_length(user_role, 1) IS NULL;

ALTER TABLE public.user_roles
  ALTER COLUMN role SET DEFAULT 'viewer'::public.user_role;

ALTER TABLE public.user_roles
  ALTER COLUMN role SET NOT NULL;

ALTER TABLE public.user_roles
  ALTER COLUMN api_plan SET DEFAULT 'viewer';

ALTER TABLE public.user_roles
  ALTER COLUMN api_plan SET NOT NULL;

ALTER TABLE public.user_roles
  ALTER COLUMN ppi_access SET DEFAULT false;

ALTER TABLE public.user_roles
  ALTER COLUMN ppi_access SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.user_roles'::regclass
      AND conname = 'user_roles_api_plan_check'
  ) THEN
    ALTER TABLE public.user_roles
      ADD CONSTRAINT user_roles_api_plan_check
      CHECK (api_plan = ANY (ARRAY['viewer'::text, 'member'::text, 'enterprise'::text]));
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_roles (id, email, name, role, user_role, api_plan, ppi_access)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
    'viewer',
    ARRAY['viewer'],
    'viewer',
    false
  );
  RETURN NEW;
END;
$$;
