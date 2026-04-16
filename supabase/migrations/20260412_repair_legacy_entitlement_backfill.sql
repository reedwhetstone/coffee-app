UPDATE public.user_roles
SET api_plan = CASE
  WHEN role = 'admin'::public.user_role
    OR role = 'api_enterprise'::public.user_role
    OR COALESCE(user_role, ARRAY[]::text[]) && ARRAY['api-enterprise', 'api_enterprise']::text[]
    THEN 'enterprise'
  WHEN role = 'api_member'::public.user_role
    OR COALESCE(user_role, ARRAY[]::text[]) && ARRAY['api-member', 'api_member', 'api', 'developer', 'growth']::text[]
    THEN 'member'
  ELSE 'viewer'
END
WHERE api_plan IS NULL
   OR (
     api_plan = 'viewer'
     AND (
       role = 'admin'::public.user_role
       OR role = 'api_enterprise'::public.user_role
       OR role = 'api_member'::public.user_role
       OR COALESCE(user_role, ARRAY[]::text[]) && ARRAY[
         'api-enterprise',
         'api_enterprise',
         'api-member',
         'api_member',
         'api',
         'developer',
         'growth'
       ]::text[]
     )
   );

UPDATE public.user_roles
SET ppi_access = true
WHERE ppi_access IS DISTINCT FROM true
  AND COALESCE(user_role, ARRAY[]::text[]) && ARRAY['ppi-member']::text[];
