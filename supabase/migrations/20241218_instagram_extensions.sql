-- =============================================================================
-- INSTAGRAM GRAPH API EXTENSIONS
-- =============================================================================

-- Add Instagram-specific fields to conversations table
ALTER TABLE conversations 
ADD COLUMN instagram_thread_id VARCHAR(255),
ADD COLUMN instagram_media_id VARCHAR(255),
ADD COLUMN instagram_comment_id VARCHAR(255);

-- Add Instagram-specific fields to messages table  
ALTER TABLE messages
ADD COLUMN instagram_message_id VARCHAR(255),
ADD COLUMN instagram_comment_parent_id VARCHAR(255),
ADD COLUMN instagram_media_url VARCHAR(500),
ADD COLUMN ai_analysis JSONB DEFAULT '{}' NOT NULL;

-- Instagram events tracking table
CREATE TABLE instagram_events (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    salon_id UUID NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL, -- comment, dm, mention, story_reply
    user_id VARCHAR(255) NOT NULL, -- Instagram user ID
    username VARCHAR(255), -- Instagram username
    content TEXT,
    media_id VARCHAR(255), -- Instagram media ID
    comment_id VARCHAR(255), -- Instagram comment ID
    thread_id VARCHAR(255), -- Instagram DM thread ID
    parent_comment_id VARCHAR(255), -- For comment replies
    analysis JSONB DEFAULT '{}' NOT NULL, -- AI analysis results
    response_sent BOOLEAN DEFAULT false NOT NULL,
    response_content TEXT,
    booking_intent_score DECIMAL(3,2), -- 0.00 to 1.00
    processed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Instagram automation rules
CREATE TABLE instagram_automation_rules (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    salon_id UUID NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
    rule_name VARCHAR(255) NOT NULL,
    trigger_type VARCHAR(50) NOT NULL, -- comment_keyword, dm_received, mention
    trigger_conditions JSONB DEFAULT '{}' NOT NULL, -- Keywords, patterns, etc.
    action_type VARCHAR(50) NOT NULL, -- reply_comment, send_dm, create_booking_lead
    action_config JSONB DEFAULT '{}' NOT NULL, -- Response templates, etc.
    is_active BOOLEAN DEFAULT true NOT NULL,
    priority INTEGER DEFAULT 1 NOT NULL, -- For rule ordering
    execution_count INTEGER DEFAULT 0 NOT NULL,
    last_executed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    UNIQUE(salon_id, rule_name)
);

-- Instagram insights and analytics
CREATE TABLE instagram_analytics (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    salon_id UUID NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    comments_received INTEGER DEFAULT 0 NOT NULL,
    comments_with_booking_intent INTEGER DEFAULT 0 NOT NULL,
    dms_received INTEGER DEFAULT 0 NOT NULL,
    dms_responded_to INTEGER DEFAULT 0 NOT NULL,
    bookings_generated INTEGER DEFAULT 0 NOT NULL,
    response_time_avg_minutes DECIMAL(8,2),
    engagement_rate DECIMAL(5,2), -- Percentage
    conversion_rate DECIMAL(5,2), -- Comments to bookings
    cost_per_interaction DECIMAL(8,4), -- AI processing costs
    metadata JSONB DEFAULT '{}' NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    UNIQUE(salon_id, date)
);

-- Instagram media tracking for post analysis
CREATE TABLE instagram_media (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    salon_id UUID NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
    media_id VARCHAR(255) NOT NULL, -- Instagram media ID
    media_type VARCHAR(50) NOT NULL, -- IMAGE, VIDEO, CAROUSEL_ALBUM
    media_url VARCHAR(500),
    permalink VARCHAR(500),
    caption TEXT,
    hashtags JSONB DEFAULT '[]' NOT NULL, -- Array of hashtags
    mentions JSONB DEFAULT '[]' NOT NULL, -- Array of @mentions
    like_count INTEGER DEFAULT 0,
    comment_count INTEGER DEFAULT 0,
    engagement_rate DECIMAL(5,2),
    booking_inquiries_count INTEGER DEFAULT 0,
    ai_content_analysis JSONB DEFAULT '{}' NOT NULL, -- Services mentioned, etc.
    posted_at TIMESTAMPTZ,
    analyzed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    UNIQUE(salon_id, media_id)
);

-- Create indexes for Instagram tables
CREATE INDEX idx_conversations_instagram_thread ON conversations(instagram_thread_id) WHERE instagram_thread_id IS NOT NULL;
CREATE INDEX idx_conversations_instagram_media ON conversations(instagram_media_id) WHERE instagram_media_id IS NOT NULL;
CREATE INDEX idx_messages_instagram_id ON messages(instagram_message_id) WHERE instagram_message_id IS NOT NULL;
CREATE INDEX idx_instagram_events_salon_type ON instagram_events(salon_id, event_type);
CREATE INDEX idx_instagram_events_user ON instagram_events(user_id);
CREATE INDEX idx_instagram_events_media ON instagram_events(media_id) WHERE media_id IS NOT NULL;
CREATE INDEX idx_instagram_events_booking_intent ON instagram_events(booking_intent_score) WHERE booking_intent_score > 0.5;
CREATE INDEX idx_instagram_automation_salon_active ON instagram_automation_rules(salon_id, is_active);
CREATE INDEX idx_instagram_analytics_salon_date ON instagram_analytics(salon_id, date);
CREATE INDEX idx_instagram_media_salon_posted ON instagram_media(salon_id, posted_at);
CREATE INDEX idx_instagram_media_engagement ON instagram_media(engagement_rate) WHERE engagement_rate IS NOT NULL;

-- Add Instagram configuration to salons metadata
UPDATE salons SET settings = jsonb_set(
    settings, 
    '{instagram}', 
    '{
        "auto_reply_enabled": true,
        "booking_intent_threshold": 0.7,
        "response_templates": {
            "de": "Vielen Dank für Ihr Interesse! Schreiben Sie uns eine DM für weitere Informationen.",
            "en": "Thank you for your interest! Send us a DM for more information.",
            "nl": "Bedankt voor je interesse! Stuur ons een DM voor meer informatie.",
            "fr": "Merci de votre intérêt! Envoyez-nous un DM pour plus d\'informations."
        },
        "working_hours": {
            "enabled": true,
            "timezone": "Europe/Berlin",
            "schedule": {
                "monday": {"start": "09:00", "end": "18:00"},
                "tuesday": {"start": "09:00", "end": "18:00"},
                "wednesday": {"start": "09:00", "end": "18:00"},
                "thursday": {"start": "09:00", "end": "18:00"},
                "friday": {"start": "09:00", "end": "18:00"},
                "saturday": {"start": "09:00", "end": "16:00"},
                "sunday": {"closed": true}
            }
        }
    }'
) WHERE settings->'instagram' IS NULL;

-- Update message_channel enum to ensure instagram is included
-- (This is already done in the initial schema, but ensuring consistency)
ALTER TYPE message_channel ADD VALUE IF NOT EXISTS 'instagram';

-- Add trigger for updating conversation last_message_at
CREATE OR REPLACE FUNCTION update_conversation_last_message()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE conversations 
    SET last_message_at = NEW.created_at,
        updated_at = NEW.created_at
    WHERE id = NEW.conversation_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_conversation_last_message_trigger
    AFTER INSERT ON messages
    FOR EACH ROW
    EXECUTE FUNCTION update_conversation_last_message();

-- Add trigger for Instagram analytics aggregation
CREATE OR REPLACE FUNCTION update_instagram_daily_analytics()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO instagram_analytics (
        salon_id, 
        date, 
        comments_received,
        comments_with_booking_intent,
        dms_received,
        bookings_generated
    )
    VALUES (
        NEW.salon_id,
        CURRENT_DATE,
        CASE WHEN NEW.event_type = 'comment' THEN 1 ELSE 0 END,
        CASE WHEN NEW.event_type = 'comment' AND NEW.booking_intent_score > 0.6 THEN 1 ELSE 0 END,
        CASE WHEN NEW.event_type = 'dm' THEN 1 ELSE 0 END,
        0 -- Bookings will be updated separately
    )
    ON CONFLICT (salon_id, date) 
    DO UPDATE SET
        comments_received = instagram_analytics.comments_received + 
            CASE WHEN NEW.event_type = 'comment' THEN 1 ELSE 0 END,
        comments_with_booking_intent = instagram_analytics.comments_with_booking_intent + 
            CASE WHEN NEW.event_type = 'comment' AND NEW.booking_intent_score > 0.6 THEN 1 ELSE 0 END,
        dms_received = instagram_analytics.dms_received + 
            CASE WHEN NEW.event_type = 'dm' THEN 1 ELSE 0 END,
        updated_at = NOW();
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER instagram_analytics_trigger
    AFTER INSERT ON instagram_events
    FOR EACH ROW
    EXECUTE FUNCTION update_instagram_daily_analytics();

-- Grant necessary permissions (adjust based on your RLS policies)
-- These would typically be handled by your existing RLS setup

COMMENT ON TABLE instagram_events IS 'Tracks all Instagram interactions for analytics and automation';
COMMENT ON TABLE instagram_automation_rules IS 'Configurable rules for automated Instagram responses';
COMMENT ON TABLE instagram_analytics IS 'Daily aggregated Instagram metrics per salon';
COMMENT ON TABLE instagram_media IS 'Instagram posts tracking for content analysis';

-- Insert default automation rules for new salons
INSERT INTO instagram_automation_rules (salon_id, rule_name, trigger_type, trigger_conditions, action_type, action_config)
SELECT 
    id as salon_id,
    'Default Booking Intent Response' as rule_name,
    'comment_keyword' as trigger_type,
    '{
        "keywords": ["book", "booking", "appointment", "termin", "buchen", "réserver", "rendez-vous", "afspraak", "boeken"],
        "min_confidence": 0.7
    }' as trigger_conditions,
    'reply_comment' as action_type,
    '{
        "template_key": "booking_interest",
        "include_dm_invitation": true,
        "track_conversion": true
    }' as action_config
FROM salons 
WHERE NOT EXISTS (
    SELECT 1 FROM instagram_automation_rules 
    WHERE instagram_automation_rules.salon_id = salons.id
);

-- Add Instagram environment variables to .env.example documentation
COMMENT ON COLUMN salons.instagram_handle IS 'Instagram business account handle (without @)';
COMMENT ON COLUMN instagram_events.booking_intent_score IS 'AI-calculated score from 0.00 to 1.00 indicating booking likelihood';
COMMENT ON COLUMN instagram_analytics.conversion_rate IS 'Percentage of comments that resulted in bookings';
COMMENT ON COLUMN instagram_media.ai_content_analysis IS 'AI analysis of post content including detected services and sentiment';
