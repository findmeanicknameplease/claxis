-- =============================================================================
-- VOICE AGENT PREMIUM FEATURES - DATABASE SCHEMA
-- =============================================================================
-- Enterprise voice agent system for €299.99/month premium tier
-- Comprehensive call tracking, AI conversation analytics, and business intelligence
-- EU GDPR compliant with data residency and audit logging
-- =============================================================================

-- Voice calls comprehensive tracking
CREATE TABLE IF NOT EXISTS voice_calls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    salon_id UUID NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
    
    -- Call identification
    twilio_call_sid VARCHAR(255) UNIQUE NOT NULL,
    session_id VARCHAR(255), -- Voice Gateway session ID
    
    -- Call details
    phone_number VARCHAR(50) NOT NULL,
    caller_name VARCHAR(255),
    caller_location JSONB, -- city, state, country
    direction VARCHAR(10) CHECK (direction IN ('inbound', 'outbound')) NOT NULL,
    
    -- Call lifecycle
    status VARCHAR(20) NOT NULL, -- initiated, ringing, answered, completed, failed, busy, no-answer
    initiated_at TIMESTAMPTZ DEFAULT now(),
    answered_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    duration_seconds INTEGER,
    
    -- AI conversation data
    ai_conversation_id VARCHAR(255),
    language VARCHAR(5) DEFAULT 'de',
    conversation_style VARCHAR(50) DEFAULT 'professional_friendly',
    
    -- Business intelligence
    call_type VARCHAR(50), -- appointment_reminder, missed_call_callback, marketing, emergency
    call_intent VARCHAR(100), -- booking_intent, service_inquiry, urgent_request, general
    booking_created BOOLEAN DEFAULT false,
    booking_id UUID REFERENCES bookings(id),
    follow_up_required BOOLEAN DEFAULT false,
    customer_satisfaction_score INTEGER CHECK (customer_satisfaction_score BETWEEN 1 AND 5),
    
    -- Audio and transcription
    transcript JSONB, -- Full conversation transcript with turns
    conversation_summary TEXT, -- AI-generated summary
    sentiment VARCHAR(20), -- positive, neutral, negative
    conversation_metadata JSONB, -- interrupt count, extracted info, etc.
    
    -- Quality and performance metrics
    audio_quality JSONB, -- MOS score, jitter, RTT
    ai_response_time_avg_ms INTEGER,
    conversation_turns_count INTEGER DEFAULT 0,
    interruption_count INTEGER DEFAULT 0,
    
    -- Cost tracking
    twilio_cost_cents INTEGER,
    elevenlabs_cost_cents INTEGER,
    total_cost_cents INTEGER GENERATED ALWAYS AS (
        COALESCE(twilio_cost_cents, 0) + COALESCE(elevenlabs_cost_cents, 0)
    ) STORED,
    
    -- Spam and security
    spam_risk_score DECIMAL(3,2),
    blocked_as_spam BOOLEAN DEFAULT false,
    spam_reason TEXT,
    
    -- GDPR and audit
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    deleted_at TIMESTAMPTZ, -- Soft delete for GDPR
    
    -- Indexes for performance
    INDEX idx_voice_calls_salon_created (salon_id, created_at DESC),
    INDEX idx_voice_calls_phone (phone_number),
    INDEX idx_voice_calls_status (status),
    INDEX idx_voice_calls_date (DATE(created_at)),
    INDEX idx_voice_calls_booking (booking_id) WHERE booking_id IS NOT NULL
);

-- Spam protection and phone validation
CREATE TABLE IF NOT EXISTS spam_phone_numbers (
    phone_number VARCHAR(50) PRIMARY KEY,
    
    -- Risk assessment
    risk_score DECIMAL(3,2) NOT NULL,
    line_type VARCHAR(50), -- mobile, landline, voip, toll-free
    carrier VARCHAR(100),
    country_code VARCHAR(5),
    
    -- Fraud indicators
    fraud_indicators JSONB,
    is_blocked BOOLEAN DEFAULT false,
    block_reason TEXT,
    
    -- Pattern tracking
    first_seen TIMESTAMPTZ DEFAULT now(),
    last_seen TIMESTAMPTZ DEFAULT now(),
    call_attempts_count INTEGER DEFAULT 0,
    successful_calls_count INTEGER DEFAULT 0,
    
    -- Auto-updating counters
    updated_at TIMESTAMPTZ DEFAULT now(),
    
    -- Indexes
    INDEX idx_spam_risk_score (risk_score),
    INDEX idx_spam_line_type (line_type),
    INDEX idx_spam_blocked (is_blocked)
);

-- Voice agent configuration per salon
CREATE TABLE IF NOT EXISTS voice_agent_config (
    salon_id UUID PRIMARY KEY REFERENCES salons(id) ON DELETE CASCADE,
    
    -- Feature enablement
    enabled BOOLEAN DEFAULT true,
    premium_features_enabled BOOLEAN DEFAULT false,
    
    -- Language and localization
    primary_language VARCHAR(5) DEFAULT 'de',
    supported_languages TEXT[] DEFAULT ARRAY['de', 'en'],
    timezone VARCHAR(50) NOT NULL DEFAULT 'Europe/Berlin',
    
    -- Business hours for voice calls
    business_hours JSONB NOT NULL DEFAULT '{
        "monday": {"open": "09:00", "close": "18:00"},
        "tuesday": {"open": "09:00", "close": "18:00"},
        "wednesday": {"open": "09:00", "close": "18:00"},
        "thursday": {"open": "09:00", "close": "18:00"},
        "friday": {"open": "09:00", "close": "18:00"},
        "saturday": {"open": "10:00", "close": "16:00"},
        "sunday": null
    }',
    
    -- AI personality and behavior
    ai_agent_id VARCHAR(255),
    voice_id VARCHAR(255),
    greeting_message TEXT,
    voice_style VARCHAR(50) DEFAULT 'professional_friendly',
    conversation_style VARCHAR(50) DEFAULT 'professional_friendly',
    
    -- Call management
    max_call_duration_seconds INTEGER DEFAULT 300,
    max_concurrent_calls INTEGER DEFAULT 3,
    enable_call_recording BOOLEAN DEFAULT false, -- GDPR compliance required
    
    -- Daily limits and quotas
    daily_call_limit INTEGER DEFAULT 100,
    monthly_call_limit INTEGER DEFAULT 2000,
    
    -- Spam protection settings
    spam_protection_enabled BOOLEAN DEFAULT true,
    spam_risk_threshold DECIMAL(3,2) DEFAULT 0.7,
    whitelist_enabled BOOLEAN DEFAULT true,
    
    -- Quality settings
    minimum_audio_quality_mos DECIMAL(3,2) DEFAULT 3.0,
    enable_quality_monitoring BOOLEAN DEFAULT true,
    
    -- Cost management
    daily_cost_limit_cents INTEGER DEFAULT 2000, -- €20 per day
    monthly_cost_limit_cents INTEGER DEFAULT 50000, -- €500 per month
    cost_alert_threshold DECIMAL(3,2) DEFAULT 0.8, -- Alert at 80%
    
    -- Audit and timestamps
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Conversation turns for detailed analytics
CREATE TABLE IF NOT EXISTS voice_conversation_turns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    voice_call_id UUID NOT NULL REFERENCES voice_calls(id) ON DELETE CASCADE,
    
    -- Turn details
    turn_number INTEGER NOT NULL,
    speaker VARCHAR(20) NOT NULL CHECK (speaker IN ('user', 'agent', 'system')),
    content TEXT NOT NULL,
    
    -- Timing and performance
    turn_started_at TIMESTAMPTZ NOT NULL,
    turn_ended_at TIMESTAMPTZ,
    processing_time_ms INTEGER,
    
    -- AI metadata
    confidence_score DECIMAL(3,2),
    detected_intent VARCHAR(100),
    extracted_entities JSONB,
    emotional_tone VARCHAR(50),
    
    -- Quality metrics
    audio_quality_mos DECIMAL(3,2),
    transcription_confidence DECIMAL(3,2),
    
    created_at TIMESTAMPTZ DEFAULT now(),
    
    -- Indexes
    INDEX idx_conversation_turns_call (voice_call_id, turn_number),
    INDEX idx_conversation_turns_intent (detected_intent) WHERE detected_intent IS NOT NULL
);

-- Voice analytics aggregations for performance
CREATE TABLE IF NOT EXISTS voice_analytics_daily (
    date DATE NOT NULL,
    salon_id UUID NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
    
    -- Call volume metrics
    total_calls INTEGER DEFAULT 0,
    inbound_calls INTEGER DEFAULT 0,
    outbound_calls INTEGER DEFAULT 0,
    answered_calls INTEGER DEFAULT 0,
    missed_calls INTEGER DEFAULT 0,
    spam_blocked_calls INTEGER DEFAULT 0,
    
    -- Duration metrics
    total_call_duration_seconds INTEGER DEFAULT 0,
    avg_call_duration_seconds DECIMAL(10,2),
    max_call_duration_seconds INTEGER DEFAULT 0,
    
    -- Cost metrics
    total_cost_cents INTEGER DEFAULT 0,
    avg_cost_per_call_cents DECIMAL(10,2),
    twilio_cost_cents INTEGER DEFAULT 0,
    elevenlabs_cost_cents INTEGER DEFAULT 0,
    
    -- Quality metrics
    avg_audio_quality_mos DECIMAL(3,2),
    avg_ai_response_time_ms INTEGER,
    total_conversation_turns INTEGER DEFAULT 0,
    avg_interruptions_per_call DECIMAL(3,2),
    
    -- Business metrics
    bookings_created INTEGER DEFAULT 0,
    booking_conversion_rate DECIMAL(5,2),
    avg_customer_satisfaction DECIMAL(3,2),
    follow_ups_required INTEGER DEFAULT 0,
    
    -- Updated timestamp
    updated_at TIMESTAMPTZ DEFAULT now(),
    
    PRIMARY KEY (date, salon_id),
    INDEX idx_voice_analytics_date (date),
    INDEX idx_voice_analytics_salon (salon_id)
);

-- Voice call queue for scheduling and callbacks
CREATE TABLE IF NOT EXISTS voice_call_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    salon_id UUID NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
    
    -- Queue details
    phone_number VARCHAR(50) NOT NULL,
    customer_name VARCHAR(255),
    call_type VARCHAR(50) NOT NULL, -- appointment_reminder, callback, marketing
    priority INTEGER DEFAULT 5 CHECK (priority BETWEEN 1 AND 10),
    
    -- Scheduling
    scheduled_at TIMESTAMPTZ,
    max_attempts INTEGER DEFAULT 3,
    current_attempts INTEGER DEFAULT 0,
    last_attempt_at TIMESTAMPTZ,
    
    -- Call context
    context_data JSONB, -- appointment info, previous conversation context
    language VARCHAR(5) DEFAULT 'de',
    
    -- Status tracking
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'scheduled', 'in_progress', 'completed', 'failed', 'cancelled')),
    result VARCHAR(50), -- answered, no_answer, busy, invalid_number
    
    -- Audit
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    completed_at TIMESTAMPTZ,
    
    INDEX idx_voice_queue_salon_status (salon_id, status),
    INDEX idx_voice_queue_scheduled (scheduled_at) WHERE status = 'scheduled',
    INDEX idx_voice_queue_priority (priority, created_at)
);

-- =============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =============================================================================

-- Enable RLS on all voice tables
ALTER TABLE voice_calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE spam_phone_numbers ENABLE ROW LEVEL SECURITY;
ALTER TABLE voice_agent_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE voice_conversation_turns ENABLE ROW LEVEL SECURITY;
ALTER TABLE voice_analytics_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE voice_call_queue ENABLE ROW LEVEL SECURITY;

-- Voice calls access policy
CREATE POLICY "Voice calls are viewable by salon members" ON voice_calls
    FOR SELECT USING (
        salon_id IN (
            SELECT salon_id FROM salon_members WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Voice calls are insertable by salon members" ON voice_calls
    FOR INSERT WITH CHECK (
        salon_id IN (
            SELECT salon_id FROM salon_members WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Voice calls are updatable by salon members" ON voice_calls
    FOR UPDATE USING (
        salon_id IN (
            SELECT salon_id FROM salon_members WHERE user_id = auth.uid()
        )
    );

-- Spam phone numbers - global read access for protection
CREATE POLICY "Spam phone numbers are readable by authenticated users" ON spam_phone_numbers
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Spam phone numbers are manageable by service role" ON spam_phone_numbers
    FOR ALL USING (auth.role() = 'service_role');

-- Voice agent config
CREATE POLICY "Voice config is manageable by salon owners" ON voice_agent_config
    FOR ALL USING (
        salon_id IN (
            SELECT salon_id FROM salon_members 
            WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
        )
    );

-- Conversation turns
CREATE POLICY "Conversation turns are viewable by salon members" ON voice_conversation_turns
    FOR SELECT USING (
        voice_call_id IN (
            SELECT id FROM voice_calls 
            WHERE salon_id IN (
                SELECT salon_id FROM salon_members WHERE user_id = auth.uid()
            )
        )
    );

-- Analytics
CREATE POLICY "Voice analytics are viewable by salon members" ON voice_analytics_daily
    FOR SELECT USING (
        salon_id IN (
            SELECT salon_id FROM salon_members WHERE user_id = auth.uid()
        )
    );

-- Call queue
CREATE POLICY "Voice queue is manageable by salon members" ON voice_call_queue
    FOR ALL USING (
        salon_id IN (
            SELECT salon_id FROM salon_members WHERE user_id = auth.uid()
        )
    );

-- =============================================================================
-- FUNCTIONS AND TRIGGERS
-- =============================================================================

-- Update voice_analytics_daily aggregations
CREATE OR REPLACE FUNCTION update_voice_analytics_daily()
RETURNS TRIGGER AS $$
BEGIN
    -- Insert or update daily aggregation
    INSERT INTO voice_analytics_daily (date, salon_id, total_calls, updated_at)
    VALUES (DATE(NEW.created_at), NEW.salon_id, 1, now())
    ON CONFLICT (date, salon_id)
    DO UPDATE SET
        total_calls = voice_analytics_daily.total_calls + 1,
        inbound_calls = voice_analytics_daily.inbound_calls + CASE WHEN NEW.direction = 'inbound' THEN 1 ELSE 0 END,
        outbound_calls = voice_analytics_daily.outbound_calls + CASE WHEN NEW.direction = 'outbound' THEN 1 ELSE 0 END,
        answered_calls = voice_analytics_daily.answered_calls + CASE WHEN NEW.status = 'completed' THEN 1 ELSE 0 END,
        missed_calls = voice_analytics_daily.missed_calls + CASE WHEN NEW.status IN ('no-answer', 'failed') THEN 1 ELSE 0 END,
        spam_blocked_calls = voice_analytics_daily.spam_blocked_calls + CASE WHEN NEW.blocked_as_spam THEN 1 ELSE 0 END,
        total_call_duration_seconds = voice_analytics_daily.total_call_duration_seconds + COALESCE(NEW.duration_seconds, 0),
        total_cost_cents = voice_analytics_daily.total_cost_cents + COALESCE(NEW.total_cost_cents, 0),
        twilio_cost_cents = voice_analytics_daily.twilio_cost_cents + COALESCE(NEW.twilio_cost_cents, 0),
        elevenlabs_cost_cents = voice_analytics_daily.elevenlabs_cost_cents + COALESCE(NEW.elevenlabs_cost_cents, 0),
        bookings_created = voice_analytics_daily.bookings_created + CASE WHEN NEW.booking_created THEN 1 ELSE 0 END,
        follow_ups_required = voice_analytics_daily.follow_ups_required + CASE WHEN NEW.follow_up_required THEN 1 ELSE 0 END,
        updated_at = now();

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update analytics on voice call insert/update
CREATE TRIGGER trigger_update_voice_analytics_daily
    AFTER INSERT OR UPDATE ON voice_calls
    FOR EACH ROW
    EXECUTE FUNCTION update_voice_analytics_daily();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add updated_at triggers to relevant tables
CREATE TRIGGER update_voice_calls_updated_at
    BEFORE UPDATE ON voice_calls
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_voice_agent_config_updated_at
    BEFORE UPDATE ON voice_agent_config
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_voice_call_queue_updated_at
    BEFORE UPDATE ON voice_call_queue
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- GDPR COMPLIANCE FUNCTIONS
-- =============================================================================

-- Function to anonymize voice call data for GDPR compliance
CREATE OR REPLACE FUNCTION anonymize_voice_call_data(call_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE voice_calls 
    SET 
        phone_number = 'ANONYMIZED',
        caller_name = 'ANONYMIZED',
        caller_location = '{"anonymized": true}',
        transcript = '{"anonymized": true}',
        conversation_summary = 'Data anonymized per GDPR request',
        deleted_at = now()
    WHERE id = call_id;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to completely delete voice call data (right to be forgotten)
CREATE OR REPLACE FUNCTION delete_voice_call_data(customer_phone_number VARCHAR(50))
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- Delete conversation turns first (foreign key constraint)
    DELETE FROM voice_conversation_turns 
    WHERE voice_call_id IN (
        SELECT id FROM voice_calls WHERE phone_number = customer_phone_number
    );
    
    -- Delete voice calls
    DELETE FROM voice_calls WHERE phone_number = customer_phone_number;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    -- Delete from call queue
    DELETE FROM voice_call_queue WHERE phone_number = customer_phone_number;
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- INITIAL DATA AND CONFIGURATION
-- =============================================================================

-- Insert default voice agent configuration for existing salons
INSERT INTO voice_agent_config (salon_id, enabled, primary_language)
SELECT id, true, 'de'
FROM salons
WHERE id NOT IN (SELECT salon_id FROM voice_agent_config)
ON CONFLICT (salon_id) DO NOTHING;

-- Create indexes for performance optimization
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_voice_calls_conversation_search 
ON voice_calls USING gin(transcript);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_voice_calls_cost_analysis 
ON voice_calls (salon_id, created_at, total_cost_cents) 
WHERE total_cost_cents IS NOT NULL;

-- =============================================================================
-- COMMENTS FOR DOCUMENTATION
-- =============================================================================

COMMENT ON TABLE voice_calls IS 'Comprehensive tracking of all voice calls handled by the AI agent system';
COMMENT ON TABLE spam_phone_numbers IS 'Spam protection database with risk scoring and pattern analysis';
COMMENT ON TABLE voice_agent_config IS 'Per-salon configuration for voice agent behavior and limits';
COMMENT ON TABLE voice_conversation_turns IS 'Detailed conversation analysis for AI training and quality monitoring';
COMMENT ON TABLE voice_analytics_daily IS 'Daily aggregated analytics for business intelligence and reporting';
COMMENT ON TABLE voice_call_queue IS 'Scheduled callback queue with priority and retry logic';

COMMENT ON COLUMN voice_calls.transcript IS 'JSONB structure: {"turns": [{"speaker": "user|agent", "text": "...", "timestamp": "..."}]}';
COMMENT ON COLUMN voice_calls.conversation_metadata IS 'JSONB structure: {"interrupt_count": 0, "extracted_info": {...}, "quality_score": 0.95}';
COMMENT ON COLUMN voice_agent_config.business_hours IS 'JSONB structure: {"monday": {"open": "09:00", "close": "18:00"}, ...}';

-- Complete migration
SELECT 'Voice Agent Premium Features database schema created successfully' as result;