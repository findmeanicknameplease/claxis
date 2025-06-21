-- =============================================================================
-- CALENDAR INTEGRATION EXTENSIONS
-- =============================================================================
-- Database schema for Google Calendar + Outlook Calendar integration
-- Supports multi-provider calendar management for salon booking automation
-- =============================================================================

-- Calendar Connections
-- Stores OAuth credentials and configuration for calendar providers
CREATE TABLE IF NOT EXISTS calendar_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    salon_id UUID NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
    provider TEXT NOT NULL CHECK (provider IN ('google', 'outlook')),
    calendar_id TEXT NOT NULL,
    name TEXT NOT NULL,
    staff_member TEXT,
    
    -- OAuth credentials (encrypted)
    access_token TEXT NOT NULL,
    refresh_token TEXT,
    token_expires_at TIMESTAMPTZ,
    
    -- Configuration
    is_primary BOOLEAN DEFAULT false,
    active BOOLEAN DEFAULT true,
    timezone TEXT DEFAULT 'Europe/Berlin',
    
    -- Business hours configuration
    business_hours JSONB DEFAULT '{}',
    
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    
    UNIQUE(salon_id, provider, calendar_id)
);

-- Calendar Events
-- Stores unified calendar events across all providers
CREATE TABLE IF NOT EXISTS calendar_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    salon_id UUID NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
    connection_id UUID NOT NULL REFERENCES calendar_connections(id) ON DELETE CASCADE,
    
    -- Event identifiers
    external_event_id TEXT NOT NULL, -- ID from Google/Outlook
    provider TEXT NOT NULL CHECK (provider IN ('google', 'outlook')),
    
    -- Event details
    title TEXT NOT NULL,
    description TEXT,
    start_datetime TIMESTAMPTZ NOT NULL,
    end_datetime TIMESTAMPTZ NOT NULL,
    timezone TEXT DEFAULT 'Europe/Berlin',
    location TEXT,
    
    -- Booking information
    customer_id UUID REFERENCES customers(id),
    service_name TEXT,
    service_duration_minutes INTEGER,
    staff_member TEXT,
    
    -- Event status
    status TEXT DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'tentative', 'cancelled')),
    show_as TEXT DEFAULT 'busy' CHECK (show_as IN ('free', 'busy', 'tentative', 'oof', 'workingElsewhere')),
    
    -- Attendees
    attendees JSONB DEFAULT '[]',
    
    -- Online meeting details
    has_online_meeting BOOLEAN DEFAULT false,
    online_meeting_url TEXT,
    
    -- Sync information
    last_synced_at TIMESTAMPTZ DEFAULT now(),
    sync_status TEXT DEFAULT 'synced' CHECK (sync_status IN ('synced', 'pending', 'error')),
    
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    
    UNIQUE(connection_id, external_event_id)
);

-- Calendar Sync Status
-- Tracks synchronization status for each calendar connection
CREATE TABLE IF NOT EXISTS calendar_sync_status (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    connection_id UUID NOT NULL REFERENCES calendar_connections(id) ON DELETE CASCADE,
    
    -- Sync information
    last_full_sync TIMESTAMPTZ,
    last_incremental_sync TIMESTAMPTZ,
    next_sync_scheduled TIMESTAMPTZ,
    
    -- Sync statistics
    events_synced INTEGER DEFAULT 0,
    sync_errors INTEGER DEFAULT 0,
    last_error_message TEXT,
    last_error_at TIMESTAMPTZ,
    
    -- Health status
    status TEXT DEFAULT 'healthy' CHECK (status IN ('healthy', 'warning', 'error', 'disabled')),
    
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    
    UNIQUE(connection_id)
);

-- Booking Requests
-- Stores calendar booking requests with conflict resolution
CREATE TABLE IF NOT EXISTS calendar_booking_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    salon_id UUID NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES customers(id),
    
    -- Request details
    service_name TEXT NOT NULL,
    service_duration_minutes INTEGER NOT NULL,
    preferred_datetime TIMESTAMPTZ NOT NULL,
    timezone TEXT DEFAULT 'Europe/Berlin',
    staff_member TEXT,
    notes TEXT,
    
    -- Customer information
    customer_name TEXT NOT NULL,
    customer_email TEXT NOT NULL,
    customer_phone TEXT,
    
    -- Booking preferences
    send_invites BOOLEAN DEFAULT true,
    create_online_meeting BOOLEAN DEFAULT false,
    preferred_provider TEXT CHECK (preferred_provider IN ('google', 'outlook')),
    
    -- Request status
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'rejected', 'cancelled')),
    
    -- Result information
    created_event_id UUID REFERENCES calendar_events(id),
    rejection_reason TEXT,
    alternative_slots JSONB DEFAULT '[]',
    
    -- Processing information
    processed_at TIMESTAMPTZ,
    processed_by TEXT, -- 'auto' or staff member ID
    
    -- Source tracking
    source_platform TEXT CHECK (source_platform IN ('whatsapp', 'instagram', 'web', 'phone', 'email')),
    source_conversation_id TEXT,
    
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Calendar Analytics
-- Tracks calendar usage and booking analytics per salon
CREATE TABLE IF NOT EXISTS calendar_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    salon_id UUID NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
    connection_id UUID REFERENCES calendar_connections(id) ON DELETE SET NULL,
    
    -- Date tracking
    date DATE NOT NULL,
    
    -- Event statistics
    total_events INTEGER DEFAULT 0,
    booking_events INTEGER DEFAULT 0,
    cancelled_events INTEGER DEFAULT 0,
    
    -- Time slot utilization
    total_available_slots INTEGER DEFAULT 0,
    booked_slots INTEGER DEFAULT 0,
    utilization_rate DECIMAL(5,4) DEFAULT 0.0000,
    
    -- Revenue tracking
    total_booking_value DECIMAL(10,2) DEFAULT 0.00,
    average_booking_value DECIMAL(10,2) DEFAULT 0.00,
    
    -- Staff performance
    staff_utilization JSONB DEFAULT '{}', -- { "staff_member": utilization_rate }
    
    -- Popular time slots
    popular_time_slots JSONB DEFAULT '[]', -- [{ "hour": 14, "bookings": 5 }]
    
    -- Booking sources
    booking_sources JSONB DEFAULT '{}', -- { "whatsapp": 10, "instagram": 5, "web": 3 }
    
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    
    UNIQUE(salon_id, connection_id, date)
);

-- =============================================================================
-- INDEXES FOR PERFORMANCE
-- =============================================================================

-- Calendar connections indexes
CREATE INDEX IF NOT EXISTS idx_calendar_connections_salon_id ON calendar_connections(salon_id);
CREATE INDEX IF NOT EXISTS idx_calendar_connections_provider ON calendar_connections(provider);
CREATE INDEX IF NOT EXISTS idx_calendar_connections_active ON calendar_connections(active) WHERE active = true;

-- Calendar events indexes
CREATE INDEX IF NOT EXISTS idx_calendar_events_salon_id ON calendar_events(salon_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_connection_id ON calendar_events(connection_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_datetime ON calendar_events(start_datetime, end_datetime);
CREATE INDEX IF NOT EXISTS idx_calendar_events_customer_id ON calendar_events(customer_id) WHERE customer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_calendar_events_staff_member ON calendar_events(staff_member) WHERE staff_member IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_calendar_events_status ON calendar_events(status);

-- Booking requests indexes
CREATE INDEX IF NOT EXISTS idx_booking_requests_salon_id ON calendar_booking_requests(salon_id);
CREATE INDEX IF NOT EXISTS idx_booking_requests_customer_id ON calendar_booking_requests(customer_id) WHERE customer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_booking_requests_status ON calendar_booking_requests(status);
CREATE INDEX IF NOT EXISTS idx_booking_requests_datetime ON calendar_booking_requests(preferred_datetime);
CREATE INDEX IF NOT EXISTS idx_booking_requests_source ON calendar_booking_requests(source_platform, source_conversation_id);

-- Analytics indexes
CREATE INDEX IF NOT EXISTS idx_calendar_analytics_salon_id ON calendar_analytics(salon_id);
CREATE INDEX IF NOT EXISTS idx_calendar_analytics_date ON calendar_analytics(date);
CREATE INDEX IF NOT EXISTS idx_calendar_analytics_connection_id ON calendar_analytics(connection_id) WHERE connection_id IS NOT NULL;

-- =============================================================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================================================

-- Enable RLS on all calendar tables
ALTER TABLE calendar_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_sync_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_booking_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_analytics ENABLE ROW LEVEL SECURITY;

-- Calendar connections policies
CREATE POLICY "Calendar connections are viewable by salon members" ON calendar_connections
    FOR SELECT USING (
        salon_id IN (
            SELECT salon_id FROM salon_members WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Calendar connections are manageable by salon admins" ON calendar_connections
    FOR ALL USING (
        salon_id IN (
            SELECT salon_id FROM salon_members 
            WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
        )
    );

-- Calendar events policies
CREATE POLICY "Calendar events are viewable by salon members" ON calendar_events
    FOR SELECT USING (
        salon_id IN (
            SELECT salon_id FROM salon_members WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Calendar events are manageable by salon staff" ON calendar_events
    FOR ALL USING (
        salon_id IN (
            SELECT salon_id FROM salon_members 
            WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'staff')
        )
    );

-- Booking requests policies
CREATE POLICY "Booking requests are viewable by salon members" ON calendar_booking_requests
    FOR SELECT USING (
        salon_id IN (
            SELECT salon_id FROM salon_members WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Booking requests are manageable by salon staff" ON calendar_booking_requests
    FOR ALL USING (
        salon_id IN (
            SELECT salon_id FROM salon_members 
            WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'staff')
        )
    );

-- Calendar analytics policies (read-only for salon members)
CREATE POLICY "Calendar analytics are viewable by salon members" ON calendar_analytics
    FOR SELECT USING (
        salon_id IN (
            SELECT salon_id FROM salon_members WHERE user_id = auth.uid()
        )
    );

-- =============================================================================
-- TRIGGERS FOR AUTOMATIC UPDATES
-- =============================================================================

-- Update updated_at timestamps
CREATE OR REPLACE FUNCTION update_calendar_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_calendar_connections_updated_at
    BEFORE UPDATE ON calendar_connections
    FOR EACH ROW EXECUTE FUNCTION update_calendar_updated_at();

CREATE TRIGGER update_calendar_events_updated_at
    BEFORE UPDATE ON calendar_events
    FOR EACH ROW EXECUTE FUNCTION update_calendar_updated_at();

CREATE TRIGGER update_calendar_sync_status_updated_at
    BEFORE UPDATE ON calendar_sync_status
    FOR EACH ROW EXECUTE FUNCTION update_calendar_updated_at();

CREATE TRIGGER update_calendar_booking_requests_updated_at
    BEFORE UPDATE ON calendar_booking_requests
    FOR EACH ROW EXECUTE FUNCTION update_calendar_updated_at();

CREATE TRIGGER update_calendar_analytics_updated_at
    BEFORE UPDATE ON calendar_analytics
    FOR EACH ROW EXECUTE FUNCTION update_calendar_updated_at();

-- =============================================================================
-- UTILITY FUNCTIONS
-- =============================================================================

-- Function to get active calendar connections for a salon
CREATE OR REPLACE FUNCTION get_active_calendar_connections(salon_uuid UUID)
RETURNS TABLE (
    id UUID,
    provider TEXT,
    calendar_id TEXT,
    name TEXT,
    staff_member TEXT,
    is_primary BOOLEAN,
    timezone TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        cc.id,
        cc.provider,
        cc.calendar_id,
        cc.name,
        cc.staff_member,
        cc.is_primary,
        cc.timezone
    FROM calendar_connections cc
    WHERE cc.salon_id = salon_uuid 
    AND cc.active = true
    ORDER BY cc.is_primary DESC, cc.created_at ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to calculate calendar utilization for a date range
CREATE OR REPLACE FUNCTION calculate_calendar_utilization(
    salon_uuid UUID,
    start_date DATE,
    end_date DATE
)
RETURNS TABLE (
    date DATE,
    total_slots INTEGER,
    booked_slots INTEGER,
    utilization_rate DECIMAL(5,4),
    total_revenue DECIMAL(10,2)
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ca.date,
        ca.total_available_slots,
        ca.booked_slots,
        ca.utilization_rate,
        ca.total_booking_value
    FROM calendar_analytics ca
    WHERE ca.salon_id = salon_uuid
    AND ca.date BETWEEN start_date AND end_date
    ORDER BY ca.date;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- SAMPLE DATA FOR DEVELOPMENT
-- =============================================================================

-- Note: In production, calendar connections will be created through OAuth flow
-- This is just for development testing

-- Insert sample calendar analytics data structure
INSERT INTO calendar_analytics (salon_id, date, total_events, booking_events, total_available_slots, booked_slots, utilization_rate)
SELECT 
    s.id as salon_id,
    CURRENT_DATE as date,
    0 as total_events,
    0 as booking_events,
    16 as total_available_slots, -- 8 hours * 2 slots per hour
    0 as booked_slots,
    0.0000 as utilization_rate
FROM salons s
ON CONFLICT (salon_id, connection_id, date) DO NOTHING;