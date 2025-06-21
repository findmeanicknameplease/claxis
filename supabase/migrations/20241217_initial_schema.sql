-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_cron";

-- Custom types
CREATE TYPE subscription_tier AS ENUM ('professional', 'enterprise');
CREATE TYPE booking_status AS ENUM ('pending', 'confirmed', 'cancelled', 'completed', 'no_show');
CREATE TYPE service_window_status AS ENUM ('available', 'reserved', 'booked', 'blocked');
CREATE TYPE conversation_status AS ENUM ('active', 'resolved', 'escalated', 'archived');
CREATE TYPE message_channel AS ENUM ('whatsapp', 'instagram', 'web');
CREATE TYPE workflow_status AS ENUM ('active', 'paused', 'error');

-- Salons table (main tenant table)
CREATE TABLE salons (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    business_name VARCHAR(255) NOT NULL,
    owner_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(50) NOT NULL,
    whatsapp_number VARCHAR(50),
    instagram_handle VARCHAR(100),
    address JSONB NOT NULL, -- {street, city, state, postal_code, country}
    timezone VARCHAR(50) DEFAULT 'Europe/Berlin' NOT NULL,
    subscription_tier subscription_tier DEFAULT 'professional' NOT NULL,
    subscription_status VARCHAR(50) DEFAULT 'active' NOT NULL,
    trial_ends_at TIMESTAMPTZ,
    settings JSONB DEFAULT '{}' NOT NULL, -- Salon-specific settings
    metadata JSONB DEFAULT '{}' NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    deleted_at TIMESTAMPTZ
);

-- Staff members
CREATE TABLE staff_members (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    salon_id UUID NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(50),
    role VARCHAR(100) NOT NULL, -- hairdresser, colorist, nail_tech, etc.
    is_owner BOOLEAN DEFAULT false NOT NULL,
    availability JSONB DEFAULT '{}' NOT NULL, -- Weekly schedule
    services JSONB DEFAULT '[]' NOT NULL, -- Array of service IDs
    commission_rate DECIMAL(5,2) DEFAULT 0,
    is_active BOOLEAN DEFAULT true NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    UNIQUE(salon_id, email)
);

-- Services offered by salons
CREATE TABLE services (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    salon_id UUID NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    duration_minutes INTEGER NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    category VARCHAR(100) NOT NULL, -- hair, nails, facial, etc.
    requires_consultation BOOLEAN DEFAULT false NOT NULL,
    is_active BOOLEAN DEFAULT true NOT NULL,
    metadata JSONB DEFAULT '{}' NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    UNIQUE(salon_id, name)
);

-- Customers
CREATE TABLE customers (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    salon_id UUID NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(50) NOT NULL,
    email VARCHAR(255),
    preferred_language VARCHAR(10) DEFAULT 'de' NOT NULL,
    preferred_channel message_channel DEFAULT 'whatsapp' NOT NULL,
    notes TEXT,
    tags JSONB DEFAULT '[]' NOT NULL, -- VIP, regular, etc.
    last_visit_at TIMESTAMPTZ,
    total_spent DECIMAL(10,2) DEFAULT 0 NOT NULL,
    visit_count INTEGER DEFAULT 0 NOT NULL,
    metadata JSONB DEFAULT '{}' NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    UNIQUE(salon_id, phone)
);

-- Service windows (available time slots)
CREATE TABLE service_windows (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    salon_id UUID NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
    staff_member_id UUID NOT NULL REFERENCES staff_members(id) ON DELETE CASCADE,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    status service_window_status DEFAULT 'available' NOT NULL,
    booking_id UUID,
    price_adjustment DECIMAL(5,2) DEFAULT 0, -- Dynamic pricing
    metadata JSONB DEFAULT '{}' NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    CONSTRAINT valid_time_window CHECK (end_time > start_time)
);

-- Bookings
CREATE TABLE bookings (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    salon_id UUID NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    staff_member_id UUID NOT NULL REFERENCES staff_members(id) ON DELETE CASCADE,
    service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    service_window_id UUID REFERENCES service_windows(id),
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    status booking_status DEFAULT 'pending' NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    deposit_amount DECIMAL(10,2) DEFAULT 0,
    notes TEXT,
    reminder_sent_at TIMESTAMPTZ,
    confirmed_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    cancellation_reason TEXT,
    metadata JSONB DEFAULT '{}' NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Conversations (WhatsApp/Instagram threads)
CREATE TABLE conversations (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    salon_id UUID NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    channel message_channel NOT NULL,
    external_id VARCHAR(255) NOT NULL, -- WhatsApp/Instagram thread ID
    status conversation_status DEFAULT 'active' NOT NULL,
    assigned_to UUID REFERENCES staff_members(id) ON DELETE SET NULL,
    last_message_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}' NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    UNIQUE(salon_id, channel, external_id)
);

-- Messages
CREATE TABLE messages (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    sender_type VARCHAR(50) NOT NULL, -- customer, staff, system, ai
    sender_id UUID,
    content TEXT NOT NULL,
    message_type VARCHAR(50) DEFAULT 'text' NOT NULL, -- text, image, voice, template
    external_id VARCHAR(255), -- WhatsApp/Instagram message ID
    is_read BOOLEAN DEFAULT false NOT NULL,
    metadata JSONB DEFAULT '{}' NOT NULL, -- Store media URLs, template data, etc.
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- n8n Workflows
CREATE TABLE workflows (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    salon_id UUID NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
    n8n_workflow_id VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    trigger_type VARCHAR(100) NOT NULL, -- message_received, booking_created, etc.
    status workflow_status DEFAULT 'active' NOT NULL,
    configuration JSONB DEFAULT '{}' NOT NULL,
    error_count INTEGER DEFAULT 0 NOT NULL,
    last_error_at TIMESTAMPTZ,
    last_error_message TEXT,
    execution_count INTEGER DEFAULT 0 NOT NULL,
    last_executed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    UNIQUE(salon_id, n8n_workflow_id)
);

-- Analytics events
CREATE TABLE analytics_events (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    salon_id UUID NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
    event_type VARCHAR(100) NOT NULL,
    event_data JSONB DEFAULT '{}' NOT NULL,
    user_id UUID,
    session_id VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Create indexes for performance
CREATE INDEX idx_salons_email ON salons(email);
CREATE INDEX idx_salons_subscription ON salons(subscription_tier, subscription_status);
CREATE INDEX idx_staff_salon ON staff_members(salon_id);
CREATE INDEX idx_services_salon ON services(salon_id);
CREATE INDEX idx_customers_salon ON customers(salon_id);
CREATE INDEX idx_customers_phone ON customers(phone);
CREATE INDEX idx_service_windows_salon_time ON service_windows(salon_id, start_time);
CREATE INDEX idx_service_windows_status ON service_windows(status);
CREATE INDEX idx_bookings_salon_time ON bookings(salon_id, start_time);
CREATE INDEX idx_bookings_customer ON bookings(customer_id);
CREATE INDEX idx_bookings_status ON bookings(status);
CREATE INDEX idx_conversations_salon ON conversations(salon_id);
CREATE INDEX idx_conversations_customer ON conversations(customer_id);
CREATE INDEX idx_messages_conversation ON messages(conversation_id);
CREATE INDEX idx_messages_created ON messages(created_at);
CREATE INDEX idx_workflows_salon ON workflows(salon_id);
CREATE INDEX idx_analytics_salon_time ON analytics_events(salon_id, created_at);

-- Row Level Security (RLS) Policies
ALTER TABLE salons ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_windows ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;

-- Helper function to get current user's salon_id
CREATE OR REPLACE FUNCTION auth.salon_id() 
RETURNS UUID AS $$
BEGIN
    RETURN (
        SELECT salon_id 
        FROM staff_members 
        WHERE id = auth.uid()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RLS Policies for multi-tenancy
-- Salons: Users can only see their own salon
CREATE POLICY salon_isolation ON salons
    FOR ALL USING (id = auth.salon_id());

-- Staff members: Can only see staff from their salon
CREATE POLICY staff_isolation ON staff_members
    FOR ALL USING (salon_id = auth.salon_id());

-- Services: Can only see services from their salon
CREATE POLICY services_isolation ON services
    FOR ALL USING (salon_id = auth.salon_id());

-- Customers: Can only see customers from their salon
CREATE POLICY customers_isolation ON customers
    FOR ALL USING (salon_id = auth.salon_id());

-- Service windows: Can only see windows from their salon
CREATE POLICY service_windows_isolation ON service_windows
    FOR ALL USING (salon_id = auth.salon_id());

-- Bookings: Can only see bookings from their salon
CREATE POLICY bookings_isolation ON bookings
    FOR ALL USING (salon_id = auth.salon_id());

-- Conversations: Can only see conversations from their salon
CREATE POLICY conversations_isolation ON conversations
    FOR ALL USING (salon_id = auth.salon_id());

-- Messages: Can only see messages from conversations in their salon
CREATE POLICY messages_isolation ON messages
    FOR ALL USING (
        conversation_id IN (
            SELECT id FROM conversations WHERE salon_id = auth.salon_id()
        )
    );

-- Workflows: Can only see workflows from their salon
CREATE POLICY workflows_isolation ON workflows
    FOR ALL USING (salon_id = auth.salon_id());

-- Analytics: Can only see analytics from their salon
CREATE POLICY analytics_isolation ON analytics_events
    FOR ALL USING (salon_id = auth.salon_id());

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply update trigger to all tables with updated_at
CREATE TRIGGER update_salons_updated_at BEFORE UPDATE ON salons
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_staff_members_updated_at BEFORE UPDATE ON staff_members
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_services_updated_at BEFORE UPDATE ON services
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON customers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_service_windows_updated_at BEFORE UPDATE ON service_windows
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_bookings_updated_at BEFORE UPDATE ON bookings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_conversations_updated_at BEFORE UPDATE ON conversations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_workflows_updated_at BEFORE UPDATE ON workflows
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();