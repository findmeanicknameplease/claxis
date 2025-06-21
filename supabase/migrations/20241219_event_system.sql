-- Event system for real-time integration
-- Phase 1A: Event Bus Foundation

-- Create event publishing function
CREATE OR REPLACE FUNCTION publish_event(channel text, payload json)
RETURNS void AS $$
BEGIN
  PERFORM pg_notify(channel, payload::text);
END;
$$ LANGUAGE plpgsql;

-- Create events log table for debugging and audit trail
CREATE TABLE IF NOT EXISTS system_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id uuid NOT NULL,
  event_type varchar(50) NOT NULL,
  event_data jsonb NOT NULL,
  channel varchar(50) NOT NULL DEFAULT 'service_events',
  created_at timestamp with time zone DEFAULT now(),
  processed_at timestamp with time zone,
  
  CONSTRAINT fk_salon_id FOREIGN KEY (salon_id) REFERENCES salons(id) ON DELETE CASCADE
);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_system_events_salon_id ON system_events(salon_id);
CREATE INDEX IF NOT EXISTS idx_system_events_type ON system_events(event_type);
CREATE INDEX IF NOT EXISTS idx_system_events_created_at ON system_events(created_at DESC);

-- Enable RLS on system_events
ALTER TABLE system_events ENABLE ROW LEVEL SECURITY;

-- RLS policy for system_events
CREATE POLICY tenant_isolation_events ON system_events
FOR ALL USING (salon_id::text = current_setting('app.current_salon_id', true));

-- Enhanced event publishing function with logging
CREATE OR REPLACE FUNCTION publish_event_with_log(
  p_salon_id uuid,
  p_event_type varchar(50),
  p_event_data jsonb,
  p_channel varchar(50) DEFAULT 'service_events'
)
RETURNS uuid AS $$
DECLARE
  event_id uuid;
  full_payload json;
BEGIN
  -- Insert into events log
  INSERT INTO system_events (salon_id, event_type, event_data, channel)
  VALUES (p_salon_id, p_event_type, p_event_data, p_channel)
  RETURNING id INTO event_id;
  
  -- Create full payload for notification
  full_payload := json_build_object(
    'event_id', event_id,
    'event', p_event_type,
    'salon_id', p_salon_id,
    'timestamp', extract(epoch from now()),
    'data', p_event_data
  );
  
  -- Send notification
  PERFORM pg_notify(p_channel, full_payload::text);
  
  RETURN event_id;
END;
$$ LANGUAGE plpgsql;

-- Function to mark event as processed
CREATE OR REPLACE FUNCTION mark_event_processed(p_event_id uuid)
RETURNS void AS $$
BEGIN
  UPDATE system_events 
  SET processed_at = now() 
  WHERE id = p_event_id;
END;
$$ LANGUAGE plpgsql;

-- Enhanced RLS policies for existing tables
-- (Re-create with better error handling)

-- Calls table RLS
DROP POLICY IF EXISTS tenant_isolation_policy ON calls;
CREATE POLICY tenant_isolation_calls ON calls
FOR ALL USING (salon_id::text = current_setting('app.current_salon_id', true));

-- Conversations table RLS  
DROP POLICY IF EXISTS tenant_isolation_policy ON conversations;
CREATE POLICY tenant_isolation_conversations ON conversations
FOR ALL USING (salon_id::text = current_setting('app.current_salon_id', true));

-- Campaigns table RLS
DROP POLICY IF EXISTS tenant_isolation_policy ON campaigns;
CREATE POLICY tenant_isolation_campaigns ON campaigns
FOR ALL USING (salon_id::text = current_setting('app.current_salon_id', true));

-- Performance indexes for RLS
CREATE INDEX IF NOT EXISTS idx_calls_salon_id ON calls(salon_id);
CREATE INDEX IF NOT EXISTS idx_conversations_salon_id ON conversations(salon_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_salon_id ON campaigns(salon_id);

-- Helper function to get current salon context
CREATE OR REPLACE FUNCTION get_current_salon_id()
RETURNS uuid AS $$
BEGIN
  RETURN current_setting('app.current_salon_id', true)::uuid;
EXCEPTION
  WHEN others THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;