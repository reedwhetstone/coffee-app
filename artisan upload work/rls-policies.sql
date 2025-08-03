-- RLS Policies for Artisan Import Tables
-- These policies ensure users can only access their own data

-- Enable RLS on all tables
ALTER TABLE public.roast_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roast_phases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.extra_device_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.artisan_import_log ENABLE ROW LEVEL SECURITY;

-- roast_events policies (access via roast ownership)
CREATE POLICY "Users can view their own roast events" ON public.roast_events
FOR SELECT USING (
  roast_id IN (
    SELECT roast_id FROM public.roast_profiles 
    WHERE "user" = auth.uid()
  )
);

CREATE POLICY "Users can insert roast events for their roasts" ON public.roast_events
FOR INSERT WITH CHECK (
  roast_id IN (
    SELECT roast_id FROM public.roast_profiles 
    WHERE "user" = auth.uid()
  )
);

CREATE POLICY "Users can update their own roast events" ON public.roast_events
FOR UPDATE USING (
  roast_id IN (
    SELECT roast_id FROM public.roast_profiles 
    WHERE "user" = auth.uid()
  )
);

CREATE POLICY "Users can delete their own roast events" ON public.roast_events
FOR DELETE USING (
  roast_id IN (
    SELECT roast_id FROM public.roast_profiles 
    WHERE "user" = auth.uid()
  )
);

-- roast_phases policies (access via roast ownership)
CREATE POLICY "Users can view their own roast phases" ON public.roast_phases
FOR SELECT USING (
  roast_id IN (
    SELECT roast_id FROM public.roast_profiles 
    WHERE "user" = auth.uid()
  )
);

CREATE POLICY "Users can insert roast phases for their roasts" ON public.roast_phases
FOR INSERT WITH CHECK (
  roast_id IN (
    SELECT roast_id FROM public.roast_profiles 
    WHERE "user" = auth.uid()
  )
);

CREATE POLICY "Users can update their own roast phases" ON public.roast_phases
FOR UPDATE USING (
  roast_id IN (
    SELECT roast_id FROM public.roast_profiles 
    WHERE "user" = auth.uid()
  )
);

CREATE POLICY "Users can delete their own roast phases" ON public.roast_phases
FOR DELETE USING (
  roast_id IN (
    SELECT roast_id FROM public.roast_profiles 
    WHERE "user" = auth.uid()
  )
);

-- extra_device_data policies (access via roast ownership)
CREATE POLICY "Users can view their own extra device data" ON public.extra_device_data
FOR SELECT USING (
  roast_id IN (
    SELECT roast_id FROM public.roast_profiles 
    WHERE "user" = auth.uid()
  )
);

CREATE POLICY "Users can insert extra device data for their roasts" ON public.extra_device_data
FOR INSERT WITH CHECK (
  roast_id IN (
    SELECT roast_id FROM public.roast_profiles 
    WHERE "user" = auth.uid()
  )
);

CREATE POLICY "Users can update their own extra device data" ON public.extra_device_data
FOR UPDATE USING (
  roast_id IN (
    SELECT roast_id FROM public.roast_profiles 
    WHERE "user" = auth.uid()
  )
);

CREATE POLICY "Users can delete their own extra device data" ON public.extra_device_data
FOR DELETE USING (
  roast_id IN (
    SELECT roast_id FROM public.roast_profiles 
    WHERE "user" = auth.uid()
  )
);

-- artisan_import_log policies (direct user ownership)
CREATE POLICY "Users can view their own import logs" ON public.artisan_import_log
FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own import logs" ON public.artisan_import_log
FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own import logs" ON public.artisan_import_log
FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own import logs" ON public.artisan_import_log
FOR DELETE USING (user_id = auth.uid());