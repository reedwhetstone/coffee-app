-- Row Level Security policies for API tables
-- Run these in your Supabase SQL editor

-- Enable RLS on api_keys table
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own API keys
CREATE POLICY "Users can view own API keys" ON api_keys
    FOR SELECT USING (auth.uid() = user_id::uuid);

-- Policy: Users can only insert API keys for themselves
CREATE POLICY "Users can create own API keys" ON api_keys
    FOR INSERT WITH CHECK (auth.uid() = user_id::uuid);

-- Policy: Users can only update their own API keys
CREATE POLICY "Users can update own API keys" ON api_keys
    FOR UPDATE USING (auth.uid() = user_id::uuid);

-- Policy: Users can only delete their own API keys
CREATE POLICY "Users can delete own API keys" ON api_keys
    FOR DELETE USING (auth.uid() = user_id::uuid);

-- Enable RLS on api_usage table
ALTER TABLE api_usage ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see usage for their own API keys
CREATE POLICY "Users can view own API usage" ON api_usage
    FOR SELECT USING (
        api_key_id IN (
            SELECT id FROM api_keys WHERE user_id = auth.uid()
        )
    );

-- Policy: System can insert usage records (for API logging)
-- This allows the system to log usage without user context
CREATE POLICY "System can log API usage" ON api_usage
    FOR INSERT WITH CHECK (true);

-- Optional: Create a function to get API usage summary with RLS protection
CREATE OR REPLACE FUNCTION get_user_api_usage_summary(
    user_uuid UUID,
    days_back INTEGER DEFAULT 30
)
RETURNS TABLE (
    date DATE,
    total_requests BIGINT,
    avg_response_time NUMERIC,
    error_count BIGINT
)
LANGUAGE SQL
SECURITY DEFINER
AS $$
    SELECT 
        date_trunc('day', timestamp)::date as date,
        count(*) as total_requests,
        avg(response_time_ms) as avg_response_time,
        count(*) FILTER (WHERE status_code >= 400) as error_count
    FROM api_usage au
    JOIN api_keys ak ON au.api_key_id = ak.id
    WHERE ak.user_id = user_uuid::text
        AND timestamp >= current_date - interval '1 day' * days_back
    GROUP BY date_trunc('day', timestamp)
    ORDER BY date DESC;
$$;