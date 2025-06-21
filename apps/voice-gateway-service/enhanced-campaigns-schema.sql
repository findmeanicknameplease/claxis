-- =============================================================================
-- ENHANCED VOICE AGENT CAMPAIGNS SCHEMA - BullMQ Integration
-- =============================================================================
-- Evolved schema for seamless integration with BullMQ campaign engine
-- Supports modern campaign types, voice configuration, and job queue management
-- =============================================================================

-- Drop existing constraints and add new ones for enhanced campaign types
DO $$
BEGIN
    -- Drop existing campaign_type constraint
    IF EXISTS (
        SELECT 1 FROM information_schema.constraint_column_usage 
        WHERE table_name = 'voice_agent_campaigns' 
        AND constraint_name LIKE '%campaign_type%'
    ) THEN
        ALTER TABLE voice_agent_campaigns DROP CONSTRAINT IF EXISTS voice_agent_campaigns_campaign_type_check;
    END IF;
END $$;

-- Add new enhanced campaign_type constraint matching BullMQ queues
ALTER TABLE voice_agent_campaigns 
ADD CONSTRAINT voice_agent_campaigns_campaign_type_check 
CHECK (campaign_type IN (
    'REVIEW_REQUEST',      -- Post-service review collection
    'REACTIVATION',        -- Win-back inactive customers  
    'FOLLOW_UP',           -- Post-service follow-up calls
    'PROMOTIONAL',         -- Marketing and special offers
    'MISSED_CALL_CALLBACK', -- Automatic missed call responses
    'APPOINTMENT_REMINDER', -- Upcoming appointment reminders
    'CUSTOMER_SURVEY',      -- Satisfaction and feedback surveys
    'SERVICE_CONFIRMATION'  -- Booking and service confirmations
));

-- Add new columns for BullMQ integration and voice configuration
DO $$
BEGIN
    -- Voice configuration for multilingual support
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'voice_agent_campaigns' 
        AND column_name = 'voice_config'
    ) THEN
        ALTER TABLE voice_agent_campaigns 
        ADD COLUMN voice_config JSONB DEFAULT '{
            "language": "nl",
            "voice_id": "auto",
            "speed": 1.0,
            "personality": "friendly",
            "cultural_context": "auto"
        }';
    END IF;

    -- BullMQ queue configuration
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'voice_agent_campaigns' 
        AND column_name = 'queue_config'
    ) THEN
        ALTER TABLE voice_agent_campaigns 
        ADD COLUMN queue_config JSONB DEFAULT '{
            "priority": 0,
            "delay_minutes": 0,
            "retry_attempts": 3,
            "retry_backoff": "exponential",
            "job_timeout_minutes": 10
        }';
    END IF;

    -- Enhanced targeting criteria
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'voice_agent_campaigns' 
        AND column_name = 'advanced_targeting'
    ) THEN
        ALTER TABLE voice_agent_campaigns 
        ADD COLUMN advanced_targeting JSONB DEFAULT '{
            "customer_segments": [],
            "service_categories": [],
            "spending_tiers": [],
            "last_visit_range": {"min_days": 0, "max_days": 365},
            "preferred_languages": [],
            "geographic_areas": [],
            "consent_types": []
        }';
    END IF;

    -- Personalization and AI context
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'voice_agent_campaigns' 
        AND column_name = 'personalization_config'
    ) THEN
        ALTER TABLE voice_agent_campaigns 
        ADD COLUMN personalization_config JSONB DEFAULT '{
            "use_customer_name": true,
            "reference_last_service": true,
            "include_service_history": false,
            "mention_preferences": true,
            "custom_greeting": null,
            "dynamic_script_variables": []
        }';
    END IF;

    -- Campaign success metrics and goals
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'voice_agent_campaigns' 
        AND column_name = 'success_metrics'
    ) THEN
        ALTER TABLE voice_agent_campaigns 
        ADD COLUMN success_metrics JSONB DEFAULT '{
            "target_response_rate": 0.15,
            "target_conversion_rate": 0.10,
            "max_cost_per_conversion": 25.00,
            "success_actions": ["booking_made", "positive_response", "information_provided"]
        }';
    END IF;

    -- Integration with external systems
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'voice_agent_campaigns' 
        AND column_name = 'integration_config'
    ) THEN
        ALTER TABLE voice_agent_campaigns 
        ADD COLUMN integration_config JSONB DEFAULT '{
            "trigger_webhooks": [],
            "external_system_sync": false,
            "n8n_workflow_id": null,
            "pos_system_integration": false,
            "calendar_integration": false
        }';
    END IF;

    -- Campaign execution tracking
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'voice_agent_campaigns' 
        AND column_name = 'execution_stats'
    ) THEN
        ALTER TABLE voice_agent_campaigns 
        ADD COLUMN execution_stats JSONB DEFAULT '{
            "jobs_queued": 0,
            "jobs_processing": 0,
            "jobs_completed": 0,
            "jobs_failed": 0,
            "total_call_duration_minutes": 0,
            "average_call_duration": 0,
            "last_execution_at": null,
            "next_scheduled_execution": null
        }';
    END IF;
END $$;

-- =============================================================================
-- CAMPAIGN TARGETS TABLE - Individual call job tracking
-- =============================================================================

CREATE TABLE IF NOT EXISTS campaign_targets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    
    -- Campaign and customer references
    campaign_id UUID REFERENCES voice_agent_campaigns(id) ON DELETE CASCADE,
    salon_id UUID REFERENCES salons(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    
    -- Contact information
    phone_number TEXT NOT NULL,
    customer_name TEXT,
    preferred_language VARCHAR(5) DEFAULT 'nl',
    
    -- Campaign execution details
    bullmq_job_id TEXT, -- BullMQ job ID for tracking
    job_status TEXT DEFAULT 'pending' CHECK (job_status IN (
        'pending', 'queued', 'processing', 'completed', 'failed', 'cancelled', 'skipped'
    )),
    
    -- Targeting metadata
    targeting_score NUMERIC(5, 3) DEFAULT 0, -- 0-1 score for campaign relevance
    personalization_data JSONB DEFAULT '{}',
    
    -- Execution tracking
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 2,
    last_attempt_at TIMESTAMPTZ,
    next_attempt_at TIMESTAMPTZ,
    
    -- Call results
    call_sid TEXT, -- Twilio call SID if call was made
    call_status TEXT,
    call_duration_seconds INTEGER,
    call_cost_usd NUMERIC(8, 5),
    
    -- Campaign outcomes
    outcome_type TEXT, -- e.g., 'booking_made', 'no_answer', 'not_interested'
    outcome_data JSONB DEFAULT '{}',
    conversion_value_euros NUMERIC(10, 2) DEFAULT 0,
    
    -- Metadata
    notes TEXT,
    metadata JSONB DEFAULT '{}',
    
    UNIQUE(campaign_id, phone_number)
);

-- Indexes for campaign targets
CREATE INDEX IF NOT EXISTS idx_campaign_targets_campaign_id ON campaign_targets(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_targets_salon_id ON campaign_targets(salon_id);
CREATE INDEX IF NOT EXISTS idx_campaign_targets_job_status ON campaign_targets(job_status);
CREATE INDEX IF NOT EXISTS idx_campaign_targets_next_attempt ON campaign_targets(next_attempt_at) WHERE next_attempt_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_campaign_targets_bullmq_job ON campaign_targets(bullmq_job_id) WHERE bullmq_job_id IS NOT NULL;

-- =============================================================================
-- ENHANCED CAMPAIGN TEMPLATES - Reusable campaign configurations
-- =============================================================================

CREATE TABLE IF NOT EXISTS campaign_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    
    -- Template identification
    name TEXT NOT NULL,
    description TEXT,
    campaign_type TEXT NOT NULL,
    template_category TEXT DEFAULT 'custom' CHECK (template_category IN (
        'standard', 'premium', 'custom', 'industry_specific'
    )),
    
    -- Template configuration (default values for new campaigns)
    default_voice_config JSONB DEFAULT '{}',
    default_targeting JSONB DEFAULT '{}',
    default_personalization JSONB DEFAULT '{}',
    default_queue_config JSONB DEFAULT '{}',
    
    -- Script templates
    script_template TEXT,
    script_variables JSONB DEFAULT '[]', -- List of variables for dynamic content
    
    -- Success benchmarks
    expected_response_rate NUMERIC(5, 3),
    expected_conversion_rate NUMERIC(5, 3),
    estimated_cost_per_target NUMERIC(8, 2),
    
    -- Usage tracking
    usage_count INTEGER DEFAULT 0,
    success_rate NUMERIC(5, 3),
    
    -- Template status
    is_active BOOLEAN DEFAULT true,
    is_public BOOLEAN DEFAULT false, -- Available to all salons
    
    -- Ownership
    created_by_salon_id UUID REFERENCES salons(id) ON DELETE SET NULL,
    created_by_user_id UUID,
    
    UNIQUE(name, created_by_salon_id)
);

-- =============================================================================
-- ENHANCED ANALYTICS VIEWS
-- =============================================================================

-- Campaign performance summary view
CREATE OR REPLACE VIEW campaign_performance_summary AS
SELECT 
    c.id as campaign_id,
    c.salon_id,
    c.name as campaign_name,
    c.campaign_type,
    c.status,
    c.created_at,
    
    -- Target metrics
    COUNT(ct.*) as total_targets,
    COUNT(ct.*) FILTER (WHERE ct.job_status = 'completed') as completed_calls,
    COUNT(ct.*) FILTER (WHERE ct.job_status = 'failed') as failed_calls,
    COUNT(ct.*) FILTER (WHERE ct.outcome_type IN ('booking_made', 'positive_response')) as successful_outcomes,
    
    -- Performance metrics
    ROUND(
        COUNT(ct.*) FILTER (WHERE ct.call_status = 'completed')::NUMERIC / 
        NULLIF(COUNT(ct.*) FILTER (WHERE ct.job_status IN ('completed', 'failed')), 0) * 100, 
        2
    ) as answer_rate_percent,
    
    ROUND(
        COUNT(ct.*) FILTER (WHERE ct.outcome_type IN ('booking_made', 'positive_response'))::NUMERIC / 
        NULLIF(COUNT(ct.*) FILTER (WHERE ct.job_status = 'completed'), 0) * 100, 
        2
    ) as conversion_rate_percent,
    
    -- Cost metrics
    SUM(ct.call_cost_usd) as total_cost_usd,
    SUM(ct.conversion_value_euros) as total_conversion_value_euros,
    ROUND(
        SUM(ct.call_cost_usd) / NULLIF(COUNT(ct.*) FILTER (WHERE ct.outcome_type IN ('booking_made', 'positive_response')), 0), 
        2
    ) as cost_per_conversion_usd,
    
    -- Time metrics
    AVG(ct.call_duration_seconds) as avg_call_duration_seconds,
    SUM(ct.call_duration_seconds) as total_call_duration_seconds

FROM voice_agent_campaigns c
LEFT JOIN campaign_targets ct ON c.id = ct.campaign_id
GROUP BY c.id, c.salon_id, c.name, c.campaign_type, c.status, c.created_at;

-- Daily campaign analytics view
CREATE OR REPLACE VIEW daily_campaign_analytics AS
SELECT 
    salon_id,
    campaign_id,
    DATE(created_at) as analytics_date,
    campaign_type,
    
    COUNT(*) as targets_processed,
    COUNT(*) FILTER (WHERE job_status = 'completed') as calls_completed,
    COUNT(*) FILTER (WHERE outcome_type IN ('booking_made', 'positive_response')) as successful_outcomes,
    
    SUM(call_cost_usd) as daily_cost_usd,
    SUM(conversion_value_euros) as daily_revenue_euros,
    SUM(call_duration_seconds) as total_talk_time_seconds,
    
    ROUND(AVG(targeting_score), 3) as avg_targeting_score

FROM campaign_targets
WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY salon_id, campaign_id, DATE(created_at), campaign_type
ORDER BY analytics_date DESC, salon_id, campaign_id;

-- =============================================================================
-- TRIGGERS FOR AUTOMATIC UPDATES
-- =============================================================================

-- Update campaign execution stats when targets change
CREATE OR REPLACE FUNCTION update_campaign_execution_stats()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE voice_agent_campaigns SET
        execution_stats = jsonb_build_object(
            'jobs_queued', (
                SELECT COUNT(*) FROM campaign_targets 
                WHERE campaign_id = COALESCE(NEW.campaign_id, OLD.campaign_id) 
                AND job_status = 'queued'
            ),
            'jobs_processing', (
                SELECT COUNT(*) FROM campaign_targets 
                WHERE campaign_id = COALESCE(NEW.campaign_id, OLD.campaign_id) 
                AND job_status = 'processing'
            ),
            'jobs_completed', (
                SELECT COUNT(*) FROM campaign_targets 
                WHERE campaign_id = COALESCE(NEW.campaign_id, OLD.campaign_id) 
                AND job_status = 'completed'
            ),
            'jobs_failed', (
                SELECT COUNT(*) FROM campaign_targets 
                WHERE campaign_id = COALESCE(NEW.campaign_id, OLD.campaign_id) 
                AND job_status = 'failed'
            ),
            'total_call_duration_minutes', (
                SELECT COALESCE(SUM(call_duration_seconds), 0) / 60.0 FROM campaign_targets 
                WHERE campaign_id = COALESCE(NEW.campaign_id, OLD.campaign_id) 
                AND call_duration_seconds IS NOT NULL
            ),
            'last_execution_at', (
                SELECT MAX(last_attempt_at) FROM campaign_targets 
                WHERE campaign_id = COALESCE(NEW.campaign_id, OLD.campaign_id)
            )
        ),
        updated_at = now()
    WHERE id = COALESCE(NEW.campaign_id, OLD.campaign_id);
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Trigger for campaign stats updates
DROP TRIGGER IF EXISTS update_campaign_stats_trigger ON campaign_targets;
CREATE TRIGGER update_campaign_stats_trigger
    AFTER INSERT OR UPDATE OR DELETE ON campaign_targets
    FOR EACH ROW
    EXECUTE FUNCTION update_campaign_execution_stats();

-- Update template usage count
CREATE OR REPLACE FUNCTION update_template_usage_count()
RETURNS TRIGGER AS $$
BEGIN
    -- Increment usage count when a campaign is created from a template
    IF NEW.metadata ? 'template_id' THEN
        UPDATE campaign_templates 
        SET usage_count = usage_count + 1,
            updated_at = now()
        WHERE id = (NEW.metadata->>'template_id')::UUID;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for template usage tracking
DROP TRIGGER IF EXISTS update_template_usage_trigger ON voice_agent_campaigns;
CREATE TRIGGER update_template_usage_trigger
    AFTER INSERT ON voice_agent_campaigns
    FOR EACH ROW
    EXECUTE FUNCTION update_template_usage_count();

-- =============================================================================
-- SAMPLE DATA AND CONFIGURATION FUNCTIONS
-- =============================================================================

-- Function to create campaign from template
CREATE OR REPLACE FUNCTION create_campaign_from_template(
    p_template_id UUID,
    p_salon_id UUID,
    p_campaign_name TEXT,
    p_targeting_overrides JSONB DEFAULT '{}',
    p_voice_overrides JSONB DEFAULT '{}'
) RETURNS UUID AS $$
DECLARE
    v_template RECORD;
    v_campaign_id UUID;
BEGIN
    -- Get template data
    SELECT * INTO v_template FROM campaign_templates WHERE id = p_template_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Template not found: %', p_template_id;
    END IF;
    
    -- Create campaign with template defaults
    INSERT INTO voice_agent_campaigns (
        salon_id,
        name,
        campaign_type,
        status,
        voice_config,
        advanced_targeting,
        personalization_config,
        queue_config,
        campaign_script,
        metadata
    ) VALUES (
        p_salon_id,
        p_campaign_name,
        v_template.campaign_type,
        'draft',
        v_template.default_voice_config || p_voice_overrides,
        v_template.default_targeting || p_targeting_overrides,
        v_template.default_personalization,
        v_template.default_queue_config,
        v_template.script_template,
        jsonb_build_object('template_id', p_template_id, 'created_from_template', true)
    ) RETURNING id INTO v_campaign_id;
    
    RETURN v_campaign_id;
END;
$$ LANGUAGE plpgsql;

-- Function to queue campaign targets for BullMQ processing
CREATE OR REPLACE FUNCTION queue_campaign_targets(
    p_campaign_id UUID,
    p_target_phone_numbers TEXT[] DEFAULT NULL, -- If NULL, target all eligible customers
    p_execution_delay_minutes INTEGER DEFAULT 0
) RETURNS INTEGER AS $$
DECLARE
    v_salon_id UUID;
    v_campaign RECORD;
    v_target_count INTEGER := 0;
    v_phone_number TEXT;
    v_customer RECORD;
    v_next_attempt TIMESTAMPTZ;
BEGIN
    -- Get campaign details
    SELECT * INTO v_campaign FROM voice_agent_campaigns WHERE id = p_campaign_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Campaign not found: %', p_campaign_id;
    END IF;
    
    v_salon_id := v_campaign.salon_id;
    v_next_attempt := now() + (p_execution_delay_minutes || ' minutes')::INTERVAL;
    
    -- If specific phone numbers provided, use those
    IF p_target_phone_numbers IS NOT NULL THEN
        FOREACH v_phone_number IN ARRAY p_target_phone_numbers LOOP
            -- Get customer data if available
            SELECT * INTO v_customer FROM customers 
            WHERE phone = v_phone_number AND salon_id = v_salon_id;
            
            -- Insert campaign target
            INSERT INTO campaign_targets (
                campaign_id,
                salon_id,
                customer_id,
                phone_number,
                customer_name,
                preferred_language,
                next_attempt_at,
                personalization_data
            ) VALUES (
                p_campaign_id,
                v_salon_id,
                v_customer.id,
                v_phone_number,
                COALESCE(v_customer.first_name, 'Valued Customer'),
                COALESCE(v_customer.preferred_language, 'nl'),
                v_next_attempt,
                jsonb_build_object(
                    'customer_history', COALESCE(v_customer.metadata, '{}'),
                    'targeting_reason', 'manual_selection'
                )
            ) ON CONFLICT (campaign_id, phone_number) DO NOTHING;
            
            v_target_count := v_target_count + 1;
        END LOOP;
    ELSE
        -- Auto-target based on campaign criteria (simplified logic)
        INSERT INTO campaign_targets (
            campaign_id,
            salon_id,
            customer_id,
            phone_number,
            customer_name,
            preferred_language,
            next_attempt_at,
            targeting_score,
            personalization_data
        )
        SELECT 
            p_campaign_id,
            v_salon_id,
            c.id,
            c.phone,
            COALESCE(c.first_name, 'Valued Customer'),
            COALESCE(c.preferred_language, 'nl'),
            v_next_attempt,
            0.8, -- Default targeting score
            jsonb_build_object(
                'customer_history', COALESCE(c.metadata, '{}'),
                'targeting_reason', 'automatic_criteria_match'
            )
        FROM customers c
        WHERE c.salon_id = v_salon_id
        AND c.allow_voice_calls = true
        -- Add more sophisticated targeting logic here based on advanced_targeting
        ON CONFLICT (campaign_id, phone_number) DO NOTHING;
        
        GET DIAGNOSTICS v_target_count = ROW_COUNT;
    END IF;
    
    RETURN v_target_count;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- SCHEMA MIGRATION COMPLETE
-- =============================================================================

COMMENT ON TABLE voice_agent_campaigns IS 'Enhanced campaign management with BullMQ integration, multilingual support, and advanced targeting';
COMMENT ON TABLE campaign_targets IS 'Individual call targets with BullMQ job tracking and outcome measurement';
COMMENT ON TABLE campaign_templates IS 'Reusable campaign configurations for standardized campaign creation';

-- Update schema version
INSERT INTO schema_migrations (version, description, applied_at) 
VALUES ('2024.06.18.001', 'Enhanced Voice Agent Campaigns with BullMQ Integration', now()) 
ON CONFLICT (version) DO NOTHING;