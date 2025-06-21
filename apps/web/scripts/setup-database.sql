-- =============================================================================
-- PREMIUM SAAS DATABASE SETUP SCRIPT
-- =============================================================================
-- Execute this script in Supabase SQL Editor to create all required tables
-- for the €299.99/month premium tier with enterprise features
-- EU-compliant design with GDPR considerations (Frankfurt region)
-- =============================================================================

-- Drop existing tables if they exist (for clean setup)
DROP TABLE IF EXISTS queue_job_logs CASCADE;
DROP TABLE IF EXISTS ai_conversations CASCADE;
DROP TABLE IF EXISTS instagram_interactions CASCADE;
DROP TABLE IF EXISTS whatsapp_messages CASCADE;

-- Drop existing functions and views
DROP VIEW IF EXISTS daily_message_stats CASCADE;
DROP VIEW IF EXISTS ai_model_performance CASCADE;
DROP VIEW IF EXISTS queue_health_metrics CASCADE;
DROP FUNCTION IF EXISTS cleanup_old_queue_logs() CASCADE;
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;
DROP FUNCTION IF EXISTS delete_customer_data(VARCHAR) CASCADE;

-- =============================================================================
-- WHATSAPP MESSAGE TRACKING
-- =============================================================================

CREATE TABLE whatsapp_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- WhatsApp identifiers (unique constraint for idempotency)
    whatsapp_message_id VARCHAR(255) UNIQUE NOT NULL,
    conversation_id VARCHAR(255),
    
    -- Salon and customer identifiers  
    salon_id UUID, -- Will be mapped from salon_phone_id lookup
    salon_phone_id VARCHAR(255) NOT NULL, -- WhatsApp Business phone number ID
    customer_phone VARCHAR(50) NOT NULL,
    
    -- Message details
    direction VARCHAR(3) CHECK (direction IN ('in', 'out')) NOT NULL,
    message_type VARCHAR(50) NOT NULL, -- text, image, voice, document, template
    status VARCHAR(20) DEFAULT 'received' NOT NULL, -- received, sent, delivered, read, failed
    body TEXT,
    
    -- Raw data and metadata (JSONB for flexibility)
    raw_payload JSONB NOT NULL,
    metadata JSONB DEFAULT '{}',
    
    -- Status tracking timestamps
    received_at TIMESTAMPTZ NOT NULL,
    sent_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    read_at TIMESTAMPTZ,
    failed_at TIMESTAMPTZ,
    processed_at TIMESTAMPTZ,
    
    -- Audit fields
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Soft delete for GDPR compliance
    deleted_at TIMESTAMPTZ
);

-- Performance indexes for premium SaaS queries
CREATE INDEX idx_whatsapp_messages_salon_id ON whatsapp_messages(salon_id);
CREATE INDEX idx_whatsapp_messages_customer_phone ON whatsapp_messages(customer_phone);
CREATE INDEX idx_whatsapp_messages_conversation_id ON whatsapp_messages(conversation_id);
CREATE INDEX idx_whatsapp_messages_status ON whatsapp_messages(status);
CREATE INDEX idx_whatsapp_messages_created_at ON whatsapp_messages(created_at DESC);
CREATE INDEX idx_whatsapp_messages_direction_status ON whatsapp_messages(direction, status);

-- =============================================================================
-- AI CONVERSATION ANALYSIS
-- =============================================================================

CREATE TABLE ai_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Links to message tracking
    conversation_id UUID REFERENCES whatsapp_messages(id) ON DELETE CASCADE,
    salon_id UUID, -- Will be mapped from salon context
    
    -- AI analysis results
    intent VARCHAR(50) NOT NULL, -- booking, question, complaint, compliment, other
    confidence DECIMAL(3,2) CHECK (confidence >= 0 AND confidence <= 1),
    entities JSONB DEFAULT '{}', -- service, datetime, customer_name, etc.
    language VARCHAR(5) NOT NULL, -- de, en, nl, fr
    
    -- Model and performance tracking
    model_used VARCHAR(50) NOT NULL, -- flash, flash-lite, vision
    processing_time_ms INTEGER,
    cost_estimate_cents INTEGER, -- Track AI costs for optimization
    
    -- Response generation
    suggested_response TEXT,
    response_sent BOOLEAN DEFAULT FALSE,
    requires_human BOOLEAN DEFAULT FALSE,
    
    -- Audit fields
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for AI analytics and optimization
CREATE INDEX idx_ai_conversations_salon_id ON ai_conversations(salon_id);
CREATE INDEX idx_ai_conversations_intent ON ai_conversations(intent);
CREATE INDEX idx_ai_conversations_model_used ON ai_conversations(model_used);
CREATE INDEX idx_ai_conversations_created_at ON ai_conversations(created_at DESC);
CREATE INDEX idx_ai_conversations_requires_human ON ai_conversations(requires_human);

-- =============================================================================
-- INSTAGRAM AUTOMATION TRACKING
-- =============================================================================

CREATE TABLE instagram_interactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Instagram identifiers
    instagram_interaction_id VARCHAR(255) UNIQUE NOT NULL,
    instagram_page_id VARCHAR(255) NOT NULL,
    post_id VARCHAR(255),
    comment_id VARCHAR(255),
    
    -- Salon connection
    salon_id UUID, -- Will be mapped from salon context
    
    -- Interaction details
    interaction_type VARCHAR(50) NOT NULL, -- comment, dm, mention, story_mention
    content TEXT,
    customer_username VARCHAR(255),
    
    -- AI processing results
    intent VARCHAR(50), -- booking_inquiry, price_question, compliment, other
    sentiment VARCHAR(20), -- positive, neutral, negative
    lead_score INTEGER CHECK (lead_score >= 0 AND lead_score <= 100),
    
    -- Response tracking
    auto_response_sent BOOLEAN DEFAULT FALSE,
    moved_to_whatsapp BOOLEAN DEFAULT FALSE,
    conversion_achieved BOOLEAN DEFAULT FALSE,
    
    -- Raw data
    raw_payload JSONB NOT NULL,
    
    -- Audit fields
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- Indexes for Instagram automation
CREATE INDEX idx_instagram_interactions_salon_id ON instagram_interactions(salon_id);
CREATE INDEX idx_instagram_interactions_type ON instagram_interactions(interaction_type);
CREATE INDEX idx_instagram_interactions_intent ON instagram_interactions(intent);
CREATE INDEX idx_instagram_interactions_lead_score ON instagram_interactions(lead_score DESC);
CREATE INDEX idx_instagram_interactions_created_at ON instagram_interactions(created_at DESC);

-- =============================================================================
-- QUEUE JOB MONITORING  
-- =============================================================================

CREATE TABLE queue_job_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Job identification
    job_id VARCHAR(255) NOT NULL,
    queue_name VARCHAR(100) NOT NULL, -- whatsapp-webhooks, ai-processing, instagram-automation
    job_type VARCHAR(100) NOT NULL, -- incoming_message, intent_detection, etc.
    
    -- Processing details
    status VARCHAR(20) NOT NULL, -- pending, processing, completed, failed, retrying
    priority INTEGER DEFAULT 5,
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,
    
    -- Performance tracking
    created_at TIMESTAMPTZ DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    failed_at TIMESTAMPTZ,
    processing_duration_ms INTEGER,
    
    -- Error tracking
    error_message TEXT,
    error_stack TEXT,
    
    -- Job data and results (limited for performance)
    job_data JSONB,
    result_data JSONB,
    
    -- Cleanup timestamp (jobs older than 7 days)
    expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days')
);

-- Indexes for queue monitoring
CREATE INDEX idx_queue_job_logs_status ON queue_job_logs(status);
CREATE INDEX idx_queue_job_logs_queue_name ON queue_job_logs(queue_name);
CREATE INDEX idx_queue_job_logs_created_at ON queue_job_logs(created_at DESC);
CREATE INDEX idx_queue_job_logs_expires_at ON queue_job_logs(expires_at);

-- =============================================================================
-- ROW LEVEL SECURITY (MULTI-TENANT)
-- =============================================================================

-- Enable RLS on all tables
ALTER TABLE whatsapp_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE instagram_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE queue_job_logs ENABLE ROW LEVEL SECURITY;

-- RLS policies for salon isolation (premium security)
-- Note: salon_id will be populated via lookup after salon mapping is implemented
CREATE POLICY whatsapp_messages_salon_policy ON whatsapp_messages
    FOR ALL USING (salon_id IS NULL OR salon_id = (auth.jwt() ->> 'salon_id')::UUID);

CREATE POLICY ai_conversations_salon_policy ON ai_conversations  
    FOR ALL USING (salon_id IS NULL OR salon_id = (auth.jwt() ->> 'salon_id')::UUID);

CREATE POLICY instagram_interactions_salon_policy ON instagram_interactions
    FOR ALL USING (salon_id IS NULL OR salon_id = (auth.jwt() ->> 'salon_id')::UUID);

-- Admin-only access to queue logs
CREATE POLICY queue_job_logs_admin_policy ON queue_job_logs
    FOR ALL USING (auth.jwt() ->> 'role' = 'admin');

-- =============================================================================
-- PERFORMANCE OPTIMIZATIONS
-- =============================================================================

-- Automatic cleanup of old queue logs (premium maintenance)
CREATE OR REPLACE FUNCTION cleanup_old_queue_logs()
RETURNS void AS $$
BEGIN
    DELETE FROM queue_job_logs 
    WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Update timestamp triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_whatsapp_messages_updated_at 
    BEFORE UPDATE ON whatsapp_messages 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ai_conversations_updated_at
    BEFORE UPDATE ON ai_conversations 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_instagram_interactions_updated_at
    BEFORE UPDATE ON instagram_interactions 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- ANALYTICS VIEWS FOR PREMIUM DASHBOARD
-- =============================================================================

-- Daily message volume by salon
CREATE OR REPLACE VIEW daily_message_stats AS
SELECT 
    salon_id,
    DATE(created_at) as date,
    COUNT(*) as total_messages,
    COUNT(*) FILTER (WHERE direction = 'in') as incoming_messages,
    COUNT(*) FILTER (WHERE direction = 'out') as outgoing_messages,
    COUNT(*) FILTER (WHERE status = 'delivered') as delivered_messages,
    COUNT(*) FILTER (WHERE status = 'read') as read_messages
FROM whatsapp_messages 
WHERE deleted_at IS NULL
GROUP BY salon_id, DATE(created_at);

-- AI model performance analytics
CREATE OR REPLACE VIEW ai_model_performance AS
SELECT 
    model_used,
    DATE(created_at) as date,
    COUNT(*) as total_requests,
    AVG(processing_time_ms) as avg_processing_time,
    AVG(confidence) as avg_confidence,
    SUM(cost_estimate_cents) as total_cost_cents
FROM ai_conversations
GROUP BY model_used, DATE(created_at);

-- Queue health metrics
CREATE OR REPLACE VIEW queue_health_metrics AS
SELECT 
    queue_name,
    DATE(created_at) as date,
    COUNT(*) as total_jobs,
    COUNT(*) FILTER (WHERE status = 'completed') as completed_jobs,
    COUNT(*) FILTER (WHERE status = 'failed') as failed_jobs,
    AVG(processing_duration_ms) as avg_processing_time,
    MAX(processing_duration_ms) as max_processing_time
FROM queue_job_logs
GROUP BY queue_name, DATE(created_at);

-- =============================================================================
-- GDPR COMPLIANCE FUNCTIONS
-- =============================================================================

-- Customer data deletion for GDPR compliance
CREATE OR REPLACE FUNCTION delete_customer_data(customer_phone_number VARCHAR(50))
RETURNS void AS $$
BEGIN
    -- Soft delete messages
    UPDATE whatsapp_messages 
    SET deleted_at = NOW(),
        body = '[DELETED]',
        raw_payload = '{"deleted": true}'
    WHERE customer_phone = customer_phone_number;
    
    -- Delete Instagram interactions
    UPDATE instagram_interactions
    SET deleted_at = NOW(),
        content = '[DELETED]',
        raw_payload = '{"deleted": true}'
    WHERE customer_username = customer_phone_number;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- COMMENTS & DOCUMENTATION
-- =============================================================================

COMMENT ON TABLE whatsapp_messages IS 'Premium SaaS WhatsApp message tracking with idempotency';
COMMENT ON TABLE ai_conversations IS 'AI analysis results for cost optimization and performance tracking';
COMMENT ON TABLE instagram_interactions IS 'Instagram automation tracking for Professional/Enterprise tiers';
COMMENT ON TABLE queue_job_logs IS 'Queue job monitoring for 99.5% uptime SLA';

COMMENT ON COLUMN whatsapp_messages.whatsapp_message_id IS 'Unique WhatsApp message ID for idempotency';
COMMENT ON COLUMN ai_conversations.model_used IS 'AI model for cost optimization (flash vs flash-lite)';
COMMENT ON COLUMN queue_job_logs.expires_at IS 'Automatic cleanup timestamp for performance';

-- =============================================================================
-- VERIFICATION QUERIES
-- =============================================================================

-- Verify tables were created successfully
SELECT 
    schemaname,
    tablename,
    tableowner
FROM pg_tables 
WHERE tablename IN ('whatsapp_messages', 'ai_conversations', 'instagram_interactions', 'queue_job_logs')
ORDER BY tablename;

-- Verify RLS is enabled
SELECT 
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables 
WHERE tablename IN ('whatsapp_messages', 'ai_conversations', 'instagram_interactions', 'queue_job_logs')
ORDER BY tablename;

-- Verify indexes were created
SELECT 
    indexname,
    tablename
FROM pg_indexes 
WHERE tablename IN ('whatsapp_messages', 'ai_conversations', 'instagram_interactions', 'queue_job_logs')
ORDER BY tablename, indexname;

SELECT 'Premium SaaS database setup completed successfully! ✅' as status;