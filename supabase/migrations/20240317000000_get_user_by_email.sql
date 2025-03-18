-- Create a function that allows the service role to look up a user by email
CREATE OR REPLACE FUNCTION public.get_user_by_email(email_input TEXT)
RETURNS TABLE(id uuid, email text) 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  IF (SELECT rolname FROM pg_roles WHERE rolname = current_user) IN ('service_role', 'supabase_admin', 'postgres') THEN
    RETURN QUERY 
      SELECT au.id, au.email::text
      FROM auth.users au
      WHERE au.email = email_input;
  ELSE
    RAISE EXCEPTION 'Not authorized';
  END IF;
END;
$$; 