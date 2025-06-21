-- =============================================================================
-- CONVERSATION USAGE TRACKING & TIER MANAGEMENT
-- Premium SaaS with Facebook/Meta Business Verification Compliance
-- =============================================================================

-- Add free tier to subscription enum
ALTER TYPE subscription_tier ADD VALUE IF NOT EXISTS 'free';

-- Usage tracking table for conversation limits
CREATE TABLE conversation_usage (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    salon_id UUID NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
    period_start DATE NOT NULL, -- Monthly billing period start
    period_end DATE NOT NULL,
    total_conversations INTEGER DEFAULT 0 NOT NULL,
    whatsapp_conversations INTEGER DEFAULT 0 NOT NULL,
    instagram_conversations INTEGER DEFAULT 0 NOT NULL,
    voice_conversations INTEGER DEFAULT 0 NOT NULL,
    business_initiated INTEGER DEFAULT 0 NOT NULL, -- For Facebook API limits
    customer_initiated INTEGER DEFAULT 0 NOT NULL,
    tier_limit INTEGER NOT NULL, -- Based on subscription tier
    upgrade_prompt_shown_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}' NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    UNIQUE(salon_id, period_start)
);

-- Business verification status for Facebook/Meta compliance
CREATE TABLE business_verification (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    salon_id UUID NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
    facebook_business_manager_id VARCHAR(255),
    whatsapp_business_account_id VARCHAR(255),
    instagram_business_account_id VARCHAR(255),
    verification_status VARCHAR(50) DEFAULT 'unverified' NOT NULL, -- unverified, pending, verified, rejected
    verification_documents JSONB DEFAULT '[]' NOT NULL,
    submitted_at TIMESTAMPTZ,
    verified_at TIMESTAMPTZ,
    rejection_reason TEXT,
    api_tier VARCHAR(50) DEFAULT 'unverified' NOT NULL, -- unverified, tier1, tier2, unlimited
    daily_conversation_limit INTEGER DEFAULT 250 NOT NULL, -- Facebook API limit
    monthly_phone_numbers INTEGER DEFAULT 2 NOT NULL, -- Phone number limit
    features_enabled JSONB DEFAULT '{}' NOT NULL, -- Voice, Instagram automation, etc.
    metadata JSONB DEFAULT '{}' NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    UNIQUE(salon_id)
);

-- Tier configuration for easy management
CREATE TABLE tier_limits (
    tier subscription_tier PRIMARY KEY,
    monthly_conversations INTEGER NOT NULL,
    channels JSONB NOT NULL, -- ['whatsapp', 'instagram', 'voice']
    ai_features JSONB NOT NULL, -- Available AI features
    requires_verification BOOLEAN DEFAULT false NOT NULL,
    price_monthly DECIMAL(10,2) NOT NULL,
    features JSONB DEFAULT '{}' NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Insert default tier configurations
INSERT INTO tier_limits (tier, monthly_conversations, channels, ai_features, requires_verification, price_monthly, features) VALUES
(
    'free', 
    100, 
    '["whatsapp"]'::jsonb,
    '{"model": "gemini-flash", "complexity": "basic", "templates": 3}'::jsonb,
    false,
    0.00,
    '{"support": "community", "analytics": "basic", "workflows": 3}'::jsonb
),
(
    'professional', 
    -1, -- Unlimited customer-initiated
    '["whatsapp", "instagram"]'::jsonb,
    '{"model": "gemini-flash", "complexity": "advanced", "templates": "unlimited"}'::jsonb,
    false,
    99.99,
    '{"support": "email", "analytics": "advanced", "workflows": "unlimited", "marketing": true, "win_back_campaigns": true}'::jsonb
),
(
    'enterprise', 
    -1, -- Unlimited
    '["whatsapp", "instagram", "voice"]'::jsonb,
    '{"model": "gemini-flash", "complexity": "enterprise", "templates": "unlimited"}'::jsonb,
    true,
    299.99,
    '{"support": "priority", "analytics": "enterprise", "workflows": "unlimited", "marketing": true, "voice_agent": true, "business_verification": true, "custom_voice": true}'::jsonb
);

-- Function to get current usage for a salon
CREATE OR REPLACE FUNCTION get_current_usage(salon_uuid UUID)
RETURNS JSONB AS $$
DECLARE
    current_period_start DATE;
    usage_record RECORD;
    tier_config RECORD;
    verification_info RECORD;
BEGIN
    -- Calculate current billing period (monthly)
    current_period_start := DATE_TRUNC('month', CURRENT_DATE)::DATE;
    
    -- Get salon's subscription tier
    SELECT s.subscription_tier, tl.* INTO tier_config
    FROM salons s
    JOIN tier_limits tl ON s.subscription_tier = tl.tier
    WHERE s.id = salon_uuid;
    
    -- Get or create usage record for current period
    SELECT * INTO usage_record
    FROM conversation_usage
    WHERE salon_id = salon_uuid AND period_start = current_period_start;
    
    IF NOT FOUND THEN
        INSERT INTO conversation_usage (salon_id, period_start, period_end, tier_limit)
        VALUES (salon_uuid, current_period_start, (current_period_start + INTERVAL '1 month' - INTERVAL '1 day')::DATE, tier_config.monthly_conversations)
        RETURNING * INTO usage_record;
    END IF;
    
    -- Get business verification status
    SELECT * INTO verification_info
    FROM business_verification
    WHERE salon_id = salon_uuid;
    
    -- Return comprehensive usage info
    RETURN jsonb_build_object(
        'salon_id', salon_uuid,
        'tier', tier_config.tier,
        'period_start', usage_record.period_start,
        'period_end', usage_record.period_end,
        'total_conversations', usage_record.total_conversations,
        'tier_limit', usage_record.tier_limit,
        'usage_percentage', 
            CASE 
                WHEN usage_record.tier_limit = -1 THEN 0 -- Unlimited
                ELSE ROUND((usage_record.total_conversations::DECIMAL / usage_record.tier_limit::DECIMAL) * 100, 2)
            END,
        'channels_breakdown', jsonb_build_object(
            'whatsapp', usage_record.whatsapp_conversations,
            'instagram', usage_record.instagram_conversations,
            'voice', usage_record.voice_conversations
        ),
        'facebook_api_limits', jsonb_build_object(
            'daily_limit', COALESCE(verification_info.daily_conversation_limit, 250),
            'business_initiated_today', usage_record.business_initiated,
            'verification_status', COALESCE(verification_info.verification_status, 'unverified'),
            'api_tier', COALESCE(verification_info.api_tier, 'unverified')
        ),
        'tier_features', tier_config.features,
        'upgrade_prompt_eligible', 
            CASE 
                WHEN usage_record.tier_limit = -1 THEN false -- Unlimited tiers
                WHEN usage_record.total_conversations >= (usage_record.tier_limit * 0.8) THEN true
                ELSE false
            END
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to increment conversation count
CREATE OR REPLACE FUNCTION increment_conversation_usage(
    salon_uuid UUID,
    channel_type message_channel,
    is_business_initiated BOOLEAN DEFAULT false
)
RETURNS JSONB AS $$
DECLARE
    current_period_start DATE;
    usage_record RECORD;
    tier_config RECORD;
    verification_info RECORD;
    new_count INTEGER;
BEGIN
    -- Calculate current billing period
    current_period_start := DATE_TRUNC('month', CURRENT_DATE)::DATE;
    
    -- Get salon's tier configuration
    SELECT s.subscription_tier, tl.* INTO tier_config
    FROM salons s
    JOIN tier_limits tl ON s.subscription_tier = tl.tier
    WHERE s.id = salon_uuid;
    
    -- Get current usage
    SELECT * INTO usage_record
    FROM conversation_usage
    WHERE salon_id = salon_uuid AND period_start = current_period_start;
    
    -- Create usage record if doesn't exist
    IF NOT FOUND THEN
        INSERT INTO conversation_usage (salon_id, period_start, period_end, tier_limit)
        VALUES (salon_uuid, current_period_start, (current_period_start + INTERVAL '1 month' - INTERVAL '1 day')::DATE, tier_config.monthly_conversations)
        RETURNING * INTO usage_record;
    END IF;
    
    -- Check limits before incrementing
    IF tier_config.monthly_conversations != -1 AND usage_record.total_conversations >= tier_config.monthly_conversations THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'monthly_limit_exceeded',
            'message', 'Monthly conversation limit reached. Please upgrade your plan.',
            'current_usage', usage_record.total_conversations,
            'limit', tier_config.monthly_conversations,
            'upgrade_required', true
        );
    END IF;
    
    -- Get verification info for Facebook API limits
    SELECT * INTO verification_info
    FROM business_verification
    WHERE salon_id = salon_uuid;
    
    -- Check Facebook daily limits for business-initiated messages
    IF is_business_initiated THEN
        DECLARE
            daily_limit INTEGER := COALESCE(verification_info.daily_conversation_limit, 250);
            today_business_initiated INTEGER;
        BEGIN
            SELECT business_initiated INTO today_business_initiated
            FROM conversation_usage
            WHERE salon_id = salon_uuid 
            AND period_start = current_period_start;
            
            IF today_business_initiated >= daily_limit THEN
                RETURN jsonb_build_object(
                    'success', false,
                    'error', 'facebook_daily_limit_exceeded',
                    'message', 'Facebook API daily limit reached. Business verification can increase this limit.',
                    'daily_limit', daily_limit,
                    'verification_status', COALESCE(verification_info.verification_status, 'unverified')
                );
            END IF;
        END;
    END IF;
    
    -- Increment the appropriate counters
    UPDATE conversation_usage SET
        total_conversations = total_conversations + 1,
        whatsapp_conversations = CASE WHEN channel_type = 'whatsapp' THEN whatsapp_conversations + 1 ELSE whatsapp_conversations END,
        instagram_conversations = CASE WHEN channel_type = 'instagram' THEN instagram_conversations + 1 ELSE instagram_conversations END,
        voice_conversations = CASE WHEN channel_type = 'voice' THEN voice_conversations + 1 ELSE voice_conversations END,
        business_initiated = CASE WHEN is_business_initiated THEN business_initiated + 1 ELSE business_initiated END,
        customer_initiated = CASE WHEN NOT is_business_initiated THEN customer_initiated + 1 ELSE customer_initiated END,
        updated_at = NOW()
    WHERE salon_id = salon_uuid AND period_start = current_period_start
    RETURNING total_conversations INTO new_count;
    
    RETURN jsonb_build_object(
        'success', true,
        'new_count', new_count,
        'channel', channel_type,
        'is_business_initiated', is_business_initiated
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Indexes for performance
CREATE INDEX idx_conversation_usage_salon_period ON conversation_usage(salon_id, period_start);
CREATE INDEX idx_business_verification_salon ON business_verification(salon_id);
CREATE INDEX idx_business_verification_status ON business_verification(verification_status);

-- RLS Policies
ALTER TABLE conversation_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_verification ENABLE ROW LEVEL SECURITY;
ALTER TABLE tier_limits ENABLE ROW LEVEL SECURITY;

-- Usage tracking isolation
CREATE POLICY usage_isolation ON conversation_usage
    FOR ALL USING (salon_id = auth.salon_id());

-- Business verification isolation  
CREATE POLICY verification_isolation ON business_verification
    FOR ALL USING (salon_id = auth.salon_id());

-- Tier limits are public read for all authenticated users
CREATE POLICY tier_limits_read ON tier_limits
    FOR SELECT USING (auth.role() = 'authenticated');

-- Update triggers
CREATE TRIGGER update_conversation_usage_updated_at BEFORE UPDATE ON conversation_usage
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_business_verification_updated_at BEFORE UPDATE ON business_verification
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tier_limits_updated_at BEFORE UPDATE ON tier_limits
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Monthly usage reset job (runs on 1st of each month)
SELECT cron.schedule(
    'reset-monthly-usage',
    '0 0 1 * *', -- At 00:00 on day-of-month 1
    $$
    INSERT INTO conversation_usage (salon_id, period_start, period_end, tier_limit)
    SELECT 
        s.id,
        DATE_TRUNC('month', CURRENT_DATE)::DATE,
        (DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month' - INTERVAL '1 day')::DATE,
        tl.monthly_conversations
    FROM salons s
    JOIN tier_limits tl ON s.subscription_tier = tl.tier
    WHERE s.subscription_status = 'active'
    ON CONFLICT (salon_id, period_start) DO NOTHING;
    $$
);

COMMENT ON TABLE conversation_usage IS 'Tracks monthly conversation usage per salon for billing and limits';
COMMENT ON TABLE business_verification IS 'Facebook/Meta business verification status and API limits';
COMMENT ON TABLE tier_limits IS 'Configuration for subscription tiers and their limits';
COMMENT ON FUNCTION get_current_usage(UUID) IS 'Returns comprehensive usage info for a salon including upgrade eligibility';
COMMENT ON FUNCTION increment_conversation_usage(UUID, message_channel, BOOLEAN) IS 'Safely increments conversation count with limit checking';