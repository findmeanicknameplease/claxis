-- =============================================================================
-- VOICE AGENT DATABASE SCHEMA FOR SUPABASE
-- =============================================================================
-- Extends existing salon automation schema with voice agent capabilities
-- Supports call logging, callback management, customer preferences
-- =============================================================================

-- Call Logs - Complete record of all voice interactions
CREATE TABLE IF NOT EXISTS call_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    
    -- Call identification
    twilio_call_sid TEXT NOT NULL UNIQUE,
    salon_id UUID REFERENCES salons(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    
    -- Call details
    phone_number TEXT NOT NULL,
    direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
    call_status TEXT NOT NULL DEFAULT 'initiated',
    duration_seconds INTEGER DEFAULT 0,
    
    -- Cost tracking
    cost_usd NUMERIC(10, 5) DEFAULT 0,
    elevenlabs_minutes NUMERIC(8, 3) DEFAULT 0,
    twilio_minutes NUMERIC(8, 3) DEFAULT 0,
    
    -- Conversation data
    transcript JSONB DEFAULT '[]',
    summary TEXT,
    outcome JSONB DEFAULT '{}',
    conversation_context JSONB DEFAULT '{}',
    
    -- Campaign tracking (for outbound calls)
    campaign_type TEXT,
    campaign_id UUID,
    
    -- Quality metrics
    customer_satisfaction_score INTEGER CHECK (customer_satisfaction_score BETWEEN 1 AND 5),
    ai_confidence_score NUMERIC(3, 2) CHECK (ai_confidence_score BETWEEN 0 AND 1),
    
    -- Metadata
    metadata JSONB DEFAULT '{}'
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_call_logs_salon_id ON call_logs(salon_id);
CREATE INDEX IF NOT EXISTS idx_call_logs_customer_id ON call_logs(customer_id);
CREATE INDEX IF NOT EXISTS idx_call_logs_created_at ON call_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_call_logs_direction ON call_logs(direction);
CREATE INDEX IF NOT EXISTS idx_call_logs_campaign_type ON call_logs(campaign_type);

-- Callback Queue - Manages automated callbacks and scheduled calls
CREATE TABLE IF NOT EXISTS callback_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    
    -- Queue details
    salon_id UUID REFERENCES salons(id) ON DELETE CASCADE,
    phone_number TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'scheduled', 'in_progress', 'completed', 'failed', 'cancelled')),
    
    -- Scheduling
    process_after TIMESTAMPTZ DEFAULT now(),
    last_attempt_at TIMESTAMPTZ,
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,
    
    -- Campaign information
    campaign_type TEXT NOT NULL,
    campaign_context JSONB DEFAULT '{}',
    customer_context JSONB DEFAULT '{}',
    
    -- Spam protection
    twilio_lookup_response JSONB,
    is_verified_safe BOOLEAN DEFAULT false,
    
    -- Outcome tracking
    final_call_sid TEXT,
    completion_status TEXT,
    notes TEXT
);

-- Indexes for callback queue
CREATE INDEX IF NOT EXISTS idx_callback_queue_salon_id ON callback_queue(salon_id);
CREATE INDEX IF NOT EXISTS idx_callback_queue_status ON callback_queue(status);
CREATE INDEX IF NOT EXISTS idx_callback_queue_process_after ON callback_queue(process_after);
CREATE INDEX IF NOT EXISTS idx_callback_queue_phone_number ON callback_queue(phone_number);

-- Customer Voice Preferences - Store customer preferences for voice interactions
CREATE TABLE IF NOT EXISTS customer_voice_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    
    customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
    salon_id UUID REFERENCES salons(id) ON DELETE CASCADE,
    
    -- Voice preferences
    preferred_language VARCHAR(5) DEFAULT 'nl',
    voice_speed NUMERIC(3, 2) DEFAULT 1.0 CHECK (voice_speed BETWEEN 0.5 AND 2.0),
    
    -- Communication preferences
    allow_voice_calls BOOLEAN DEFAULT true,
    allow_voice_followups BOOLEAN DEFAULT true,
    allow_voice_reviews BOOLEAN DEFAULT true,
    allow_voice_promotions BOOLEAN DEFAULT false,
    
    -- Optimal call times
    preferred_call_times JSONB DEFAULT '{}', -- e.g., {"monday": ["09:00-12:00", "14:00-17:00"]}
    timezone TEXT DEFAULT 'Europe/Amsterdam',
    
    -- Interaction history
    total_voice_interactions INTEGER DEFAULT 0,
    last_voice_interaction_at TIMESTAMPTZ,
    avg_call_satisfaction NUMERIC(3, 2),
    
    UNIQUE(customer_id, salon_id)
);

-- Contact Consent - TCPA/GDPR compliant consent tracking for outbound campaigns
CREATE TABLE IF NOT EXISTS contact_consent (
    consent_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    
    -- Customer and salon references
    customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
    salon_id UUID REFERENCES salons(id) ON DELETE CASCADE,
    phone_number TEXT NOT NULL,
    
    -- Campaign-specific consent types
    campaign_type TEXT NOT NULL CHECK (campaign_type IN (
        'REVIEW_REQUEST', 'REACTIVATION_MARKETING', 'FOLLOW_UP_CALL', 
        'APPOINTMENT_REMINDER', 'PROMOTIONAL_OFFER', 'CUSTOMER_SURVEY',
        'MISSED_CALL_CALLBACK', 'SERVICE_CONFIRMATION'
    )),
    
    -- Consent status
    consent_status TEXT NOT NULL CHECK (consent_status IN ('OPTED_IN', 'OPTED_OUT', 'PENDING_VERIFICATION')) DEFAULT 'PENDING_VERIFICATION',
    
    -- Audit trail for compliance
    source_of_consent TEXT, -- e.g., 'WEB_CHECKOUT_FORM', 'USER_PREFERENCE_PAGE', 'VERBAL_CONFIRMATION', 'IMPORTED_LIST'
    consent_method TEXT, -- e.g., 'EXPLICIT_CHECKBOX', 'VERBAL_AGREEMENT', 'EXISTING_RELATIONSHIP'
    ip_address INET, -- Store as IP address type for better validation
    user_agent TEXT,
    consent_language VARCHAR(5) DEFAULT 'nl', -- Language in which consent was obtained
    
    -- Legal documentation
    consent_text TEXT, -- The actual consent text shown to customer
    privacy_policy_version TEXT, -- Version of privacy policy when consent obtained
    terms_version TEXT, -- Version of terms when consent obtained
    
    -- Expiration and revocation
    consent_expires_at TIMESTAMPTZ, -- For time-limited consent
    revoked_at TIMESTAMPTZ, -- When consent was withdrawn
    revocation_reason TEXT, -- Why consent was withdrawn
    
    -- Metadata
    notes TEXT, -- Additional compliance notes
    
    UNIQUE(customer_id, salon_id, phone_number, campaign_type)
);

-- Indexes for contact consent performance
CREATE INDEX IF NOT EXISTS idx_contact_consent_phone_campaign ON contact_consent(phone_number, campaign_type);
CREATE INDEX IF NOT EXISTS idx_contact_consent_customer_salon ON contact_consent(customer_id, salon_id);
CREATE INDEX IF NOT EXISTS idx_contact_consent_status ON contact_consent(consent_status);
CREATE INDEX IF NOT EXISTS idx_contact_consent_created_at ON contact_consent(created_at);

-- Voice Agent Analytics - Aggregate metrics for business intelligence
CREATE TABLE IF NOT EXISTS voice_agent_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT now(),
    
    salon_id UUID REFERENCES salons(id) ON DELETE CASCADE,
    date_period DATE NOT NULL,
    period_type TEXT NOT NULL CHECK (period_type IN ('daily', 'weekly', 'monthly')),
    
    -- Call volume metrics
    total_calls INTEGER DEFAULT 0,
    inbound_calls INTEGER DEFAULT 0,
    outbound_calls INTEGER DEFAULT 0,
    answered_calls INTEGER DEFAULT 0,
    missed_calls INTEGER DEFAULT 0,
    
    -- Performance metrics
    avg_call_duration_seconds NUMERIC(8, 2) DEFAULT 0,
    total_talk_time_minutes NUMERIC(10, 2) DEFAULT 0,
    avg_customer_satisfaction NUMERIC(3, 2),
    
    -- Business outcomes
    bookings_created INTEGER DEFAULT 0,
    bookings_cancelled INTEGER DEFAULT 0,
    bookings_rescheduled INTEGER DEFAULT 0,
    revenue_generated_euros NUMERIC(10, 2) DEFAULT 0,
    
    -- Cost metrics
    total_cost_usd NUMERIC(10, 5) DEFAULT 0,
    elevenlabs_cost_usd NUMERIC(10, 5) DEFAULT 0,
    twilio_cost_usd NUMERIC(10, 5) DEFAULT 0,
    cost_per_booking_euros NUMERIC(8, 2),
    
    -- Campaign performance (for outbound)
    reactivation_calls INTEGER DEFAULT 0,
    reactivation_success_rate NUMERIC(5, 2),
    followup_calls INTEGER DEFAULT 0,
    review_calls INTEGER DEFAULT 0,
    
    UNIQUE(salon_id, date_period, period_type)
);

-- Voice Agent Campaigns - Manage automated outbound campaigns
CREATE TABLE IF NOT EXISTS voice_agent_campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    
    salon_id UUID REFERENCES salons(id) ON DELETE CASCADE,
    
    -- Campaign details
    name TEXT NOT NULL,
    campaign_type TEXT NOT NULL CHECK (campaign_type IN ('reactivation', 'followup', 'review_request', 'promotion', 'appointment_reminder')),
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'completed', 'cancelled')),
    
    -- Targeting
    target_criteria JSONB DEFAULT '{}', -- e.g., {"last_visit_days_ago": 90, "service_type": "haircut"}
    excluded_phone_numbers TEXT[] DEFAULT '{}',
    
    -- Scheduling
    start_date TIMESTAMPTZ,
    end_date TIMESTAMPTZ,
    call_schedule JSONB DEFAULT '{}', -- e.g., {"days": ["monday", "tuesday"], "hours": ["10:00-12:00", "14:00-16:00"]}
    
    -- Campaign configuration
    max_calls_per_day INTEGER DEFAULT 10,
    max_attempts_per_customer INTEGER DEFAULT 2,
    min_interval_hours INTEGER DEFAULT 24,
    
    -- Content & context
    campaign_script TEXT,
    agent_instructions TEXT,
    expected_outcomes TEXT[],
    
    -- Performance tracking
    total_targets INTEGER DEFAULT 0,
    calls_initiated INTEGER DEFAULT 0,
    calls_completed INTEGER DEFAULT 0,
    successful_outcomes INTEGER DEFAULT 0,
    total_cost_euros NUMERIC(10, 2) DEFAULT 0,
    
    -- Metadata
    created_by UUID, -- user_id
    metadata JSONB DEFAULT '{}'
);

-- Add voice agent settings to existing salons table (if not already present)
DO $$ 
BEGIN
    -- Check if voice_agent_settings column exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'salons' 
        AND column_name = 'voice_agent_settings'
    ) THEN
        ALTER TABLE salons 
        ADD COLUMN voice_agent_settings JSONB DEFAULT '{
            "enabled": false,
            "after_hours_enabled": true,
            "max_call_duration_minutes": 10,
            "personality": "friendly",
            "voice_language": "nl",
            "fallback_to_human": true,
            "cost_budget_daily_euros": 50,
            "allowed_call_types": ["inbound", "reactivation", "followup"]
        }';
    END IF;
    
    -- Check if twilio_phone_number column exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'salons' 
        AND column_name = 'twilio_phone_number'
    ) THEN
        ALTER TABLE salons 
        ADD COLUMN twilio_phone_number TEXT UNIQUE;
    END IF;
END $$;

-- Add voice preferences to existing customers table (if not already present)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'customers' 
        AND column_name = 'preferred_language'
    ) THEN
        ALTER TABLE customers 
        ADD COLUMN preferred_language VARCHAR(5) DEFAULT 'nl',
        ADD COLUMN allow_voice_calls BOOLEAN DEFAULT true,
        ADD COLUMN allow_voice_followup BOOLEAN DEFAULT true;
    END IF;
END $$;

-- Row Level Security (RLS) Policies
ALTER TABLE call_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE callback_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_voice_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_consent ENABLE ROW LEVEL SECURITY;
ALTER TABLE voice_agent_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE voice_agent_campaigns ENABLE ROW LEVEL SECURITY;

-- Policies for call_logs
CREATE POLICY "call_logs_salon_access" ON call_logs
    FOR ALL USING (
        salon_id IN (
            SELECT id FROM salons 
            WHERE owner_id = auth.uid()
            OR id IN (
                SELECT salon_id FROM salon_users 
                WHERE user_id = auth.uid()
            )
        )
    );

-- Policies for callback_queue
CREATE POLICY "callback_queue_salon_access" ON callback_queue
    FOR ALL USING (
        salon_id IN (
            SELECT id FROM salons 
            WHERE owner_id = auth.uid()
            OR id IN (
                SELECT salon_id FROM salon_users 
                WHERE user_id = auth.uid()
            )
        )
    );

-- Policies for customer_voice_preferences
CREATE POLICY "voice_preferences_salon_access" ON customer_voice_preferences
    FOR ALL USING (
        salon_id IN (
            SELECT id FROM salons 
            WHERE owner_id = auth.uid()
            OR id IN (
                SELECT salon_id FROM salon_users 
                WHERE user_id = auth.uid()
            )
        )
    );

-- Policies for contact_consent
CREATE POLICY "contact_consent_salon_access" ON contact_consent
    FOR ALL USING (
        salon_id IN (
            SELECT id FROM salons 
            WHERE owner_id = auth.uid()
            OR id IN (
                SELECT salon_id FROM salon_users 
                WHERE user_id = auth.uid()
            )
        )
    );

-- Policies for voice_agent_analytics
CREATE POLICY "voice_analytics_salon_access" ON voice_agent_analytics
    FOR ALL USING (
        salon_id IN (
            SELECT id FROM salons 
            WHERE owner_id = auth.uid()
            OR id IN (
                SELECT salon_id FROM salon_users 
                WHERE user_id = auth.uid()
            )
        )
    );

-- Policies for voice_agent_campaigns
CREATE POLICY "voice_campaigns_salon_access" ON voice_agent_campaigns
    FOR ALL USING (
        salon_id IN (
            SELECT id FROM salons 
            WHERE owner_id = auth.uid()
            OR id IN (
                SELECT salon_id FROM salon_users 
                WHERE user_id = auth.uid()
            )
        )
    );

-- Functions for automated analytics
CREATE OR REPLACE FUNCTION update_voice_agent_analytics()
RETURNS TRIGGER AS $$
BEGIN
    -- Update daily analytics when a call is completed
    IF NEW.call_status IN ('completed', 'no-answer', 'failed') THEN
        INSERT INTO voice_agent_analytics (
            salon_id, 
            date_period, 
            period_type,
            total_calls,
            inbound_calls,
            outbound_calls,
            answered_calls,
            missed_calls,
            total_talk_time_minutes,
            total_cost_usd
        )
        VALUES (
            NEW.salon_id,
            CURRENT_DATE,
            'daily',
            1,
            CASE WHEN NEW.direction = 'inbound' THEN 1 ELSE 0 END,
            CASE WHEN NEW.direction = 'outbound' THEN 1 ELSE 0 END,
            CASE WHEN NEW.call_status = 'completed' THEN 1 ELSE 0 END,
            CASE WHEN NEW.call_status = 'no-answer' THEN 1 ELSE 0 END,
            COALESCE(NEW.duration_seconds::NUMERIC / 60, 0),
            COALESCE(NEW.cost_usd, 0)
        )
        ON CONFLICT (salon_id, date_period, period_type)
        DO UPDATE SET
            total_calls = voice_agent_analytics.total_calls + 1,
            inbound_calls = voice_agent_analytics.inbound_calls + 
                CASE WHEN NEW.direction = 'inbound' THEN 1 ELSE 0 END,
            outbound_calls = voice_agent_analytics.outbound_calls + 
                CASE WHEN NEW.direction = 'outbound' THEN 1 ELSE 0 END,
            answered_calls = voice_agent_analytics.answered_calls + 
                CASE WHEN NEW.call_status = 'completed' THEN 1 ELSE 0 END,
            missed_calls = voice_agent_analytics.missed_calls + 
                CASE WHEN NEW.call_status = 'no-answer' THEN 1 ELSE 0 END,
            total_talk_time_minutes = voice_agent_analytics.total_talk_time_minutes + 
                COALESCE(NEW.duration_seconds::NUMERIC / 60, 0),
            total_cost_usd = voice_agent_analytics.total_cost_usd + 
                COALESCE(NEW.cost_usd, 0),
            updated_at = now();
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for automatic analytics updates
CREATE TRIGGER update_voice_analytics_trigger
    AFTER INSERT OR UPDATE ON call_logs
    FOR EACH ROW
    EXECUTE FUNCTION update_voice_agent_analytics();

-- Function to update timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at timestamps
CREATE TRIGGER update_call_logs_updated_at BEFORE UPDATE ON call_logs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_callback_queue_updated_at BEFORE UPDATE ON callback_queue FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_customer_voice_preferences_updated_at BEFORE UPDATE ON customer_voice_preferences FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_voice_agent_campaigns_updated_at BEFORE UPDATE ON voice_agent_campaigns FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Sample data and testing functions
CREATE OR REPLACE FUNCTION test_voice_agent_setup(salon_uuid UUID)
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    -- Test call log insertion
    INSERT INTO call_logs (
        twilio_call_sid,
        salon_id,
        phone_number,
        direction,
        call_status,
        duration_seconds,
        transcript,
        summary
    ) VALUES (
        'test_call_' || gen_random_uuid()::text,
        salon_uuid,
        '+31612345678',
        'inbound',
        'completed',
        120,
        '[{"speaker": "customer", "text": "I would like to book an appointment", "timestamp": "2024-01-01T10:00:00Z"}]',
        'Customer requested appointment booking'
    );
    
    -- Check if analytics were created
    SELECT json_build_object(
        'success', true,
        'call_logged', true,
        'analytics_created', EXISTS(
            SELECT 1 FROM voice_agent_analytics 
            WHERE salon_id = salon_uuid 
            AND date_period = CURRENT_DATE
        )
    ) INTO result;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Performance monitoring views
CREATE OR REPLACE VIEW voice_agent_performance_summary AS
SELECT 
    s.id as salon_id,
    s.business_name,
    COUNT(cl.*) as total_calls,
    COUNT(cl.*) FILTER (WHERE cl.direction = 'inbound') as inbound_calls,
    COUNT(cl.*) FILTER (WHERE cl.direction = 'outbound') as outbound_calls,
    COUNT(cl.*) FILTER (WHERE cl.call_status = 'completed') as completed_calls,
    AVG(cl.duration_seconds) as avg_duration_seconds,
    SUM(cl.cost_usd) as total_cost_usd,
    COUNT(cl.*) FILTER (WHERE cl.created_at >= CURRENT_DATE - INTERVAL '7 days') as calls_last_7_days,
    COUNT(cl.*) FILTER (WHERE cl.created_at >= CURRENT_DATE - INTERVAL '30 days') as calls_last_30_days
FROM salons s
LEFT JOIN call_logs cl ON s.id = cl.salon_id
WHERE s.voice_agent_settings->>'enabled' = 'true'
GROUP BY s.id, s.business_name;

COMMENT ON VIEW voice_agent_performance_summary IS 'Real-time voice agent performance metrics per salon';

-- =============================================================================
-- SCHEMA COMPLETE
-- =============================================================================
-- This schema supports:
-- ✅ Complete call logging and analytics
-- ✅ Automated callback management with spam protection
-- ✅ Customer voice preferences and personalization
-- ✅ Campaign management for outbound calls
-- ✅ Row-level security for multi-tenant access
-- ✅ Performance monitoring and business intelligence
-- ✅ Automated analytics updates via triggers
-- =============================================================================