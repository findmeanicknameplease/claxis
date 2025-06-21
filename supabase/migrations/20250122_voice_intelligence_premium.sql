-- =============================================================================
-- VOICE INTELLIGENCE PREMIUM FEATURES - DATABASE SCHEMA EXTENSION
-- =============================================================================
-- Advanced AI capabilities for €299.99/month premium tier
-- Customer memory, intent analytics, voice biometrics, emotion tracking
-- Business intelligence and predictive analytics for enterprise customers
-- EU GDPR compliant with advanced privacy controls and audit logging
-- =============================================================================

-- Customer conversation memory with AI-powered insights
CREATE TABLE IF NOT EXISTS customer_conversation_memory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL,
    salon_id UUID NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
    
    -- Conversation context
    conversation_summary TEXT NOT NULL,
    key_insights JSONB DEFAULT '[]'::jsonb,
    extracted_info JSONB DEFAULT '{}'::jsonb,
    
    -- Customer intelligence
    communication_style VARCHAR(50) CHECK (communication_style IN ('formal', 'casual', 'friendly', 'business')) DEFAULT 'friendly',
    preferred_language VARCHAR(5) CHECK (preferred_language IN ('de', 'en', 'nl', 'fr')) DEFAULT 'de',
    emotional_state VARCHAR(50) CHECK (emotional_state IN ('positive', 'neutral', 'negative', 'frustrated')) DEFAULT 'neutral',
    
    -- Service and appointment patterns
    service_preferences JSONB DEFAULT '[]'::jsonb,
    appointment_patterns JSONB DEFAULT '{
        "preferredTimes": [],
        "frequencyDays": 30,
        "totalAppointments": 0
    }'::jsonb,
    
    -- Quality and satisfaction
    satisfaction_score INTEGER CHECK (satisfaction_score BETWEEN 1 AND 5),
    resolution_status VARCHAR(20) CHECK (resolution_status IN ('resolved', 'pending', 'escalated')) DEFAULT 'pending',
    follow_up_required BOOLEAN DEFAULT false,
    
    -- Session tracking
    session_id VARCHAR(255) NOT NULL,
    conversation_timestamp TIMESTAMPTZ DEFAULT now(),
    
    -- Audit and compliance
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    deleted_at TIMESTAMPTZ, -- Soft delete for GDPR
    
    -- Indexes for performance
    INDEX idx_customer_memory_customer (customer_id),
    INDEX idx_customer_memory_salon (salon_id),
    INDEX idx_customer_memory_session (session_id),
    INDEX idx_customer_memory_timestamp (conversation_timestamp DESC)
);

-- Customer intelligence profiles for predictive analytics
CREATE TABLE IF NOT EXISTS customer_intelligence_profiles (
    customer_id UUID PRIMARY KEY,
    salon_id UUID NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
    phone_number_hash VARCHAR(255), -- Anonymized phone identifier
    
    -- Aggregated insights
    total_interactions INTEGER DEFAULT 0,
    average_satisfaction DECIMAL(3,2) DEFAULT 0,
    lifetime_value DECIMAL(10,2) DEFAULT 0,
    loyalty_score INTEGER CHECK (loyalty_score BETWEEN 1 AND 10) DEFAULT 5,
    preferred_services JSONB DEFAULT '[]'::jsonb,
    
    -- Communication profile
    communication_preferences JSONB DEFAULT '{
        "preferredStyle": "friendly",
        "responseTime": 4,
        "interruptionTolerance": "medium",
        "complexityLevel": "standard"
    }'::jsonb,
    
    -- Behavioral patterns
    behavior_patterns JSONB DEFAULT '{
        "callFrequency": 0,
        "appointmentPatterns": {
            "averageBookingInterval": 30,
            "seasonalPreferences": [],
            "serviceProgression": []
        },
        "emotionalJourney": {
            "typicalStartEmotion": "neutral",
            "emotionalVolatility": 0,
            "satisfactionTrend": "stable"
        }
    }'::jsonb,
    
    -- Predictive insights
    predictions JSONB DEFAULT '{
        "churnProbability": 0.3,
        "nextAppointmentLikelihood": 0.5,
        "upsellPotential": 0.3,
        "lifetimeValuePrediction": 500,
        "recommendedActions": []
    }'::jsonb,
    
    -- Customer segmentation
    customer_segment VARCHAR(20) CHECK (customer_segment IN ('high_value', 'regular', 'at_risk', 'new', 'churned')) DEFAULT 'new',
    segment_characteristics JSONB DEFAULT '[]'::jsonb,
    
    -- Privacy and compliance
    data_retention_until TIMESTAMPTZ DEFAULT (now() + INTERVAL '1 year'),
    consent_level VARCHAR(20) CHECK (consent_level IN ('basic', 'analytics', 'marketing')) DEFAULT 'analytics',
    anonymization_requested BOOLEAN DEFAULT false,
    
    -- Audit timestamps
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    
    -- Indexes
    INDEX idx_customer_profiles_salon (salon_id),
    INDEX idx_customer_profiles_segment (customer_segment),
    INDEX idx_customer_profiles_loyalty (loyalty_score DESC),
    INDEX idx_customer_profiles_value (lifetime_value DESC)
);

-- Voice biometric profiles for speaker authentication
CREATE TABLE IF NOT EXISTS voice_biometric_profiles (
    profile_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_hash VARCHAR(255) NOT NULL, -- Anonymized customer identifier
    salon_id UUID NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
    
    -- Voice fingerprint (cryptographically hashed)
    voice_fingerprint_primary_hash VARCHAR(255) NOT NULL,
    voice_fingerprint_secondary_hash VARCHAR(255) NOT NULL,
    feature_vector JSONB NOT NULL, -- Encrypted voice features
    confidence_threshold DECIMAL(3,2) DEFAULT 0.75,
    
    -- Enrollment data
    enrollment_date TIMESTAMPTZ DEFAULT now(),
    sample_count INTEGER DEFAULT 0,
    quality_score DECIMAL(3,2) DEFAULT 0,
    enrollment_phrase TEXT,
    
    -- Authentication history
    total_auth_attempts INTEGER DEFAULT 0,
    successful_auths INTEGER DEFAULT 0,
    last_auth_date TIMESTAMPTZ,
    average_confidence DECIMAL(3,2) DEFAULT 0,
    
    -- Security metrics
    anomaly_score DECIMAL(3,2) DEFAULT 0,
    spoofing_risk DECIMAL(3,2) DEFAULT 0,
    suspicious_attempts INTEGER DEFAULT 0,
    last_anomaly_date TIMESTAMPTZ,
    
    -- Privacy settings
    consent_level VARCHAR(20) CHECK (consent_level IN ('basic', 'biometric', 'analytics')) DEFAULT 'biometric',
    retention_until TIMESTAMPTZ DEFAULT (now() + INTERVAL '1 year'),
    anonymization_requested BOOLEAN DEFAULT false,
    gdpr_compliant BOOLEAN DEFAULT true,
    
    -- Audit timestamps
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    
    -- Indexes
    INDEX idx_voice_biometric_customer (customer_hash),
    INDEX idx_voice_biometric_salon (salon_id),
    INDEX idx_voice_biometric_enrollment (enrollment_date DESC),
    UNIQUE INDEX idx_voice_biometric_unique (customer_hash, salon_id)
);

-- Advanced intent recognition analytics
CREATE TABLE IF NOT EXISTS intent_recognition_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id VARCHAR(255) NOT NULL,
    salon_id UUID NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
    customer_id UUID,
    
    -- Intent analysis
    user_input TEXT NOT NULL,
    recognized_intent VARCHAR(100) NOT NULL,
    intent_confidence DECIMAL(3,2) DEFAULT 0,
    sub_intents JSONB DEFAULT '[]'::jsonb,
    
    -- Business context
    business_category VARCHAR(50) CHECK (business_category IN ('booking', 'service_inquiry', 'support', 'complaint', 'upsell_opportunity')) NOT NULL,
    urgency_level VARCHAR(20) CHECK (urgency_level IN ('low', 'medium', 'high', 'critical')) DEFAULT 'low',
    emotional_tone VARCHAR(20) CHECK (emotional_tone IN ('positive', 'neutral', 'negative', 'frustrated', 'excited')) DEFAULT 'neutral',
    
    -- Extracted entities
    extracted_entities JSONB DEFAULT '{
        "services": [],
        "dateTime": {},
        "customerInfo": {},
        "preferences": {}
    }'::jsonb,
    
    -- Conversation flow
    conversation_stage VARCHAR(50) CHECK (conversation_stage IN ('greeting', 'needs_assessment', 'information_gathering', 'decision_making', 'closing')) DEFAULT 'needs_assessment',
    next_recommended_action TEXT,
    suggested_responses JSONB DEFAULT '[]'::jsonb,
    
    -- Upselling intelligence
    upsell_opportunities JSONB DEFAULT '[]'::jsonb,
    
    -- Quality metrics
    processing_time_ms INTEGER,
    language VARCHAR(5) DEFAULT 'de',
    
    -- Timestamps
    timestamp TIMESTAMPTZ DEFAULT now(),
    
    -- Indexes
    INDEX idx_intent_analytics_session (session_id),
    INDEX idx_intent_analytics_salon (salon_id),
    INDEX idx_intent_analytics_intent (recognized_intent),
    INDEX idx_intent_analytics_category (business_category),
    INDEX idx_intent_analytics_timestamp (timestamp DESC)
);

-- Emotion detection and analysis tracking
CREATE TABLE IF NOT EXISTS emotion_analysis_tracking (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id VARCHAR(255) NOT NULL,
    salon_id UUID NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
    customer_id UUID,
    
    -- Emotion classification
    primary_emotion VARCHAR(20) CHECK (primary_emotion IN ('joy', 'sadness', 'anger', 'fear', 'surprise', 'disgust', 'neutral')) NOT NULL,
    emotion_confidence DECIMAL(3,2) DEFAULT 0,
    
    -- Emotional dimensions
    valence DECIMAL(3,2) CHECK (valence BETWEEN -1 AND 1) DEFAULT 0, -- negative to positive
    arousal DECIMAL(3,2) CHECK (arousal BETWEEN 0 AND 1) DEFAULT 0.5, -- calm to excited
    dominance DECIMAL(3,2) CHECK (dominance BETWEEN 0 AND 1) DEFAULT 0.5, -- submissive to dominant
    
    -- Business emotions
    satisfaction_score DECIMAL(3,2) CHECK (satisfaction_score BETWEEN 0 AND 1) DEFAULT 0.5,
    frustration_score DECIMAL(3,2) CHECK (frustration_score BETWEEN 0 AND 1) DEFAULT 0,
    interest_score DECIMAL(3,2) CHECK (interest_score BETWEEN 0 AND 1) DEFAULT 0.5,
    urgency_score DECIMAL(3,2) CHECK (urgency_score BETWEEN 0 AND 1) DEFAULT 0,
    trust_score DECIMAL(3,2) CHECK (trust_score BETWEEN 0 AND 1) DEFAULT 0.5,
    confusion_score DECIMAL(3,2) CHECK (confusion_score BETWEEN 0 AND 1) DEFAULT 0,
    
    -- Voice emotion indicators
    voice_pitch VARCHAR(20) CHECK (voice_pitch IN ('low', 'normal', 'high', 'variable')) DEFAULT 'normal',
    voice_pace VARCHAR(20) CHECK (voice_pace IN ('slow', 'normal', 'fast', 'variable')) DEFAULT 'normal',
    voice_volume VARCHAR(20) CHECK (voice_volume IN ('quiet', 'normal', 'loud')) DEFAULT 'normal',
    voice_stability VARCHAR(20) CHECK (voice_stability IN ('stable', 'trembling', 'shaky')) DEFAULT 'stable',
    
    -- Text sentiment
    text_sentiment VARCHAR(20) CHECK (text_sentiment IN ('positive', 'negative', 'neutral')) DEFAULT 'neutral',
    sentiment_score DECIMAL(3,2) CHECK (sentiment_score BETWEEN -1 AND 1) DEFAULT 0,
    emotional_keywords JSONB DEFAULT '[]'::jsonb,
    emotional_intensity DECIMAL(3,2) CHECK (emotional_intensity BETWEEN 0 AND 1) DEFAULT 0.5,
    
    -- Cultural context
    language VARCHAR(5) DEFAULT 'de',
    cultural_norms JSONB DEFAULT '[]'::jsonb,
    communication_style VARCHAR(20) CHECK (communication_style IN ('direct', 'indirect', 'formal', 'casual')) DEFAULT 'direct',
    
    -- Analysis context
    user_input TEXT,
    conversation_context TEXT,
    processing_time_ms INTEGER,
    
    -- Timestamps
    timestamp TIMESTAMPTZ DEFAULT now(),
    
    -- Indexes
    INDEX idx_emotion_tracking_session (session_id),
    INDEX idx_emotion_tracking_salon (salon_id),
    INDEX idx_emotion_tracking_emotion (primary_emotion),
    INDEX idx_emotion_tracking_satisfaction (satisfaction_score DESC),
    INDEX idx_emotion_tracking_timestamp (timestamp DESC)
);

-- Emotional journey tracking for customer experience optimization
CREATE TABLE IF NOT EXISTS emotional_journeys (
    session_id VARCHAR(255) PRIMARY KEY,
    salon_id UUID NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
    customer_id UUID,
    
    -- Journey metrics
    start_emotion VARCHAR(20) DEFAULT 'neutral',
    current_emotion VARCHAR(20) DEFAULT 'neutral',
    emotional_volatility DECIMAL(3,2) DEFAULT 0,
    satisfaction_trend VARCHAR(20) CHECK (satisfaction_trend IN ('improving', 'stable', 'declining')) DEFAULT 'stable',
    key_emotional_moments JSONB DEFAULT '[]'::jsonb,
    
    -- Journey predictions
    likely_outcome VARCHAR(20) CHECK (likely_outcome IN ('satisfied', 'neutral', 'dissatisfied', 'escalation')) DEFAULT 'neutral',
    outcome_confidence DECIMAL(3,2) DEFAULT 0.5,
    recommended_interventions JSONB DEFAULT '[]'::jsonb,
    
    -- Adaptive response tracking
    response_strategy VARCHAR(20) CHECK (response_strategy IN ('empathetic', 'professional', 'enthusiastic', 'calming', 'urgent')) DEFAULT 'professional',
    adaptations_applied JSONB DEFAULT '{}'::jsonb,
    escalation_triggered BOOLEAN DEFAULT false,
    escalation_reason TEXT,
    
    -- Journey timeline
    journey_start TIMESTAMPTZ DEFAULT now(),
    journey_end TIMESTAMPTZ,
    total_duration_seconds INTEGER,
    emotion_changes_count INTEGER DEFAULT 0,
    
    -- Experience optimization
    satisfaction_prediction DECIMAL(3,2) DEFAULT 0.5,
    retention_risk DECIMAL(3,2) DEFAULT 0.3,
    upsell_readiness DECIMAL(3,2) DEFAULT 0.3,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    
    -- Indexes
    INDEX idx_emotional_journeys_salon (salon_id),
    INDEX idx_emotional_journeys_customer (customer_id),
    INDEX idx_emotional_journeys_outcome (likely_outcome),
    INDEX idx_emotional_journeys_satisfaction (satisfaction_prediction DESC)
);

-- Business intelligence analytics aggregations
CREATE TABLE IF NOT EXISTS voice_business_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    salon_id UUID NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
    analysis_date DATE NOT NULL,
    
    -- Call volume metrics
    total_calls INTEGER DEFAULT 0,
    answered_calls INTEGER DEFAULT 0,
    missed_calls INTEGER DEFAULT 0,
    average_call_duration DECIMAL(8,2) DEFAULT 0,
    call_answer_rate DECIMAL(5,2) DEFAULT 0,
    peak_call_hours JSONB DEFAULT '[]'::jsonb,
    
    -- Customer experience metrics
    average_satisfaction_score DECIMAL(3,2) DEFAULT 0,
    customer_retention_rate DECIMAL(5,2) DEFAULT 0,
    first_call_resolution_rate DECIMAL(5,2) DEFAULT 0,
    escalation_rate DECIMAL(5,2) DEFAULT 0,
    complaint_rate DECIMAL(5,2) DEFAULT 0,
    
    -- Business impact metrics
    booking_conversion_rate DECIMAL(5,2) DEFAULT 0,
    average_booking_value DECIMAL(10,2) DEFAULT 0,
    upsell_success_rate DECIMAL(5,2) DEFAULT 0,
    revenue_per_call DECIMAL(10,2) DEFAULT 0,
    cost_per_call DECIMAL(10,2) DEFAULT 0,
    net_revenue_impact DECIMAL(10,2) DEFAULT 0,
    
    -- Operational efficiency
    ai_response_time_ms INTEGER DEFAULT 0,
    system_uptime_percentage DECIMAL(5,2) DEFAULT 99.5,
    error_rate DECIMAL(5,2) DEFAULT 0,
    cost_savings_vs_human DECIMAL(10,2) DEFAULT 0,
    productivity_gain_percentage DECIMAL(5,2) DEFAULT 0,
    
    -- Quality metrics
    audio_quality_score DECIMAL(3,2) DEFAULT 0,
    transcription_accuracy DECIMAL(5,2) DEFAULT 0,
    intent_recognition_accuracy DECIMAL(5,2) DEFAULT 0,
    voice_auth_success_rate DECIMAL(5,2) DEFAULT 0,
    
    -- Customer insights
    total_customers INTEGER DEFAULT 0,
    new_customers INTEGER DEFAULT 0,
    returning_customers INTEGER DEFAULT 0,
    high_value_customers INTEGER DEFAULT 0,
    at_risk_customers INTEGER DEFAULT 0,
    
    -- ROI analysis
    monthly_roi_percentage DECIMAL(8,2) DEFAULT 0,
    payback_period_months DECIMAL(5,2) DEFAULT 0,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    
    -- Unique constraint
    UNIQUE (salon_id, analysis_date),
    
    -- Indexes
    INDEX idx_business_analytics_salon_date (salon_id, analysis_date DESC),
    INDEX idx_business_analytics_roi (monthly_roi_percentage DESC),
    INDEX idx_business_analytics_satisfaction (average_satisfaction_score DESC)
);

-- Intelligence system configuration per salon
CREATE TABLE IF NOT EXISTS voice_intelligence_config (
    salon_id UUID PRIMARY KEY REFERENCES salons(id) ON DELETE CASCADE,
    
    -- Feature enablement
    memory_engine_enabled BOOLEAN DEFAULT true,
    intent_recognition_enabled BOOLEAN DEFAULT true,
    voice_biometrics_enabled BOOLEAN DEFAULT true,
    emotion_detection_enabled BOOLEAN DEFAULT true,
    business_analytics_enabled BOOLEAN DEFAULT true,
    
    -- Memory configuration
    memory_retention_days INTEGER DEFAULT 90,
    conversation_summary_enabled BOOLEAN DEFAULT true,
    customer_profiling_enabled BOOLEAN DEFAULT true,
    
    -- Intent recognition settings
    intent_confidence_threshold DECIMAL(3,2) DEFAULT 0.6,
    multilingual_intent_enabled BOOLEAN DEFAULT true,
    upsell_detection_enabled BOOLEAN DEFAULT true,
    
    -- Voice biometrics settings
    biometric_enrollment_required BOOLEAN DEFAULT false,
    voice_auth_confidence_threshold DECIMAL(3,2) DEFAULT 0.75,
    spoofing_detection_enabled BOOLEAN DEFAULT true,
    
    -- Emotion detection settings
    emotion_confidence_threshold DECIMAL(3,2) DEFAULT 0.6,
    adaptive_responses_enabled BOOLEAN DEFAULT true,
    escalation_triggers_enabled BOOLEAN DEFAULT true,
    cultural_context_enabled BOOLEAN DEFAULT true,
    
    -- Business analytics settings
    real_time_analytics_enabled BOOLEAN DEFAULT true,
    predictive_analytics_enabled BOOLEAN DEFAULT true,
    customer_segmentation_enabled BOOLEAN DEFAULT true,
    roi_tracking_enabled BOOLEAN DEFAULT true,
    
    -- Privacy and compliance
    data_anonymization_enabled BOOLEAN DEFAULT true,
    gdpr_compliance_mode BOOLEAN DEFAULT true,
    audit_logging_enabled BOOLEAN DEFAULT true,
    
    -- Performance settings
    max_concurrent_analyses INTEGER DEFAULT 10,
    analysis_timeout_seconds INTEGER DEFAULT 30,
    cache_results_enabled BOOLEAN DEFAULT true,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =============================================================================

-- Enable RLS on all intelligence tables
ALTER TABLE customer_conversation_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_intelligence_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE voice_biometric_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE intent_recognition_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE emotion_analysis_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE emotional_journeys ENABLE ROW LEVEL SECURITY;
ALTER TABLE voice_business_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE voice_intelligence_config ENABLE ROW LEVEL SECURITY;

-- Customer conversation memory policies
CREATE POLICY "Conversation memory viewable by salon members" ON customer_conversation_memory
    FOR SELECT USING (
        salon_id IN (
            SELECT salon_id FROM salon_members WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Conversation memory insertable by salon members" ON customer_conversation_memory
    FOR INSERT WITH CHECK (
        salon_id IN (
            SELECT salon_id FROM salon_members WHERE user_id = auth.uid()
        )
    );

-- Customer intelligence profiles policies
CREATE POLICY "Customer profiles viewable by salon members" ON customer_intelligence_profiles
    FOR SELECT USING (
        salon_id IN (
            SELECT salon_id FROM salon_members WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Customer profiles manageable by salon members" ON customer_intelligence_profiles
    FOR ALL USING (
        salon_id IN (
            SELECT salon_id FROM salon_members WHERE user_id = auth.uid()
        )
    );

-- Voice biometric profiles policies (more restrictive)
CREATE POLICY "Biometric profiles viewable by salon admins" ON voice_biometric_profiles
    FOR SELECT USING (
        salon_id IN (
            SELECT salon_id FROM salon_members 
            WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
        )
    );

CREATE POLICY "Biometric profiles manageable by service role" ON voice_biometric_profiles
    FOR ALL USING (auth.role() = 'service_role');

-- Intent analytics policies
CREATE POLICY "Intent analytics viewable by salon members" ON intent_recognition_analytics
    FOR SELECT USING (
        salon_id IN (
            SELECT salon_id FROM salon_members WHERE user_id = auth.uid()
        )
    );

-- Emotion tracking policies
CREATE POLICY "Emotion tracking viewable by salon members" ON emotion_analysis_tracking
    FOR SELECT USING (
        salon_id IN (
            SELECT salon_id FROM salon_members WHERE user_id = auth.uid()
        )
    );

-- Emotional journeys policies
CREATE POLICY "Emotional journeys viewable by salon members" ON emotional_journeys
    FOR SELECT USING (
        salon_id IN (
            SELECT salon_id FROM salon_members WHERE user_id = auth.uid()
        )
    );

-- Business analytics policies
CREATE POLICY "Business analytics viewable by salon members" ON voice_business_analytics
    FOR SELECT USING (
        salon_id IN (
            SELECT salon_id FROM salon_members WHERE user_id = auth.uid()
        )
    );

-- Intelligence config policies
CREATE POLICY "Intelligence config manageable by salon admins" ON voice_intelligence_config
    FOR ALL USING (
        salon_id IN (
            SELECT salon_id FROM salon_members 
            WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
        )
    );

-- =============================================================================
-- FUNCTIONS AND TRIGGERS
-- =============================================================================

-- Function to update customer intelligence profiles automatically
CREATE OR REPLACE FUNCTION update_customer_intelligence_profile()
RETURNS TRIGGER AS $$
BEGIN
    -- Update or insert customer profile based on conversation memory
    INSERT INTO customer_intelligence_profiles (
        customer_id, 
        salon_id, 
        total_interactions,
        average_satisfaction,
        lifetime_value,
        updated_at
    )
    VALUES (
        NEW.customer_id,
        NEW.salon_id,
        1,
        COALESCE(NEW.satisfaction_score, 0),
        0,
        now()
    )
    ON CONFLICT (customer_id) 
    DO UPDATE SET
        total_interactions = customer_intelligence_profiles.total_interactions + 1,
        average_satisfaction = (
            (customer_intelligence_profiles.average_satisfaction * (customer_intelligence_profiles.total_interactions - 1)) + 
            COALESCE(NEW.satisfaction_score, customer_intelligence_profiles.average_satisfaction)
        ) / customer_intelligence_profiles.total_interactions,
        updated_at = now();
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update customer profiles on new conversation memory
CREATE TRIGGER trigger_update_customer_intelligence
    AFTER INSERT ON customer_conversation_memory
    FOR EACH ROW
    EXECUTE FUNCTION update_customer_intelligence_profile();

-- Function to aggregate daily business analytics
CREATE OR REPLACE FUNCTION aggregate_daily_business_analytics()
RETURNS TRIGGER AS $$
DECLARE
    analytics_date DATE;
    salon_id_val UUID;
BEGIN
    analytics_date := DATE(NEW.created_at);
    salon_id_val := NEW.salon_id;
    
    -- Insert or update daily analytics
    INSERT INTO voice_business_analytics (
        salon_id,
        analysis_date,
        total_calls,
        answered_calls,
        average_satisfaction_score,
        updated_at
    )
    VALUES (
        salon_id_val,
        analytics_date,
        1,
        CASE WHEN NEW.resolution_status = 'resolved' THEN 1 ELSE 0 END,
        COALESCE(NEW.satisfaction_score, 0),
        now()
    )
    ON CONFLICT (salon_id, analysis_date)
    DO UPDATE SET
        total_calls = voice_business_analytics.total_calls + 1,
        answered_calls = voice_business_analytics.answered_calls + 
            CASE WHEN NEW.resolution_status = 'resolved' THEN 1 ELSE 0 END,
        average_satisfaction_score = (
            (voice_business_analytics.average_satisfaction_score * (voice_business_analytics.total_calls - 1)) +
            COALESCE(NEW.satisfaction_score, voice_business_analytics.average_satisfaction_score)
        ) / voice_business_analytics.total_calls,
        updated_at = now();
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to aggregate business analytics
CREATE TRIGGER trigger_aggregate_business_analytics
    AFTER INSERT ON customer_conversation_memory
    FOR EACH ROW
    EXECUTE FUNCTION aggregate_daily_business_analytics();

-- Function to update updated_at timestamps
CREATE OR REPLACE FUNCTION update_intelligence_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add updated_at triggers to relevant tables
CREATE TRIGGER update_customer_memory_updated_at
    BEFORE UPDATE ON customer_conversation_memory
    FOR EACH ROW EXECUTE FUNCTION update_intelligence_updated_at();

CREATE TRIGGER update_customer_profiles_updated_at
    BEFORE UPDATE ON customer_intelligence_profiles
    FOR EACH ROW EXECUTE FUNCTION update_intelligence_updated_at();

CREATE TRIGGER update_emotional_journeys_updated_at
    BEFORE UPDATE ON emotional_journeys
    FOR EACH ROW EXECUTE FUNCTION update_intelligence_updated_at();

CREATE TRIGGER update_intelligence_config_updated_at
    BEFORE UPDATE ON voice_intelligence_config
    FOR EACH ROW EXECUTE FUNCTION update_intelligence_updated_at();

-- =============================================================================
-- GDPR COMPLIANCE FUNCTIONS
-- =============================================================================

-- Function to anonymize customer intelligence data
CREATE OR REPLACE FUNCTION anonymize_customer_intelligence_data(target_customer_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    -- Anonymize conversation memory
    UPDATE customer_conversation_memory 
    SET 
        conversation_summary = 'Data anonymized per GDPR request',
        key_insights = '["Data anonymized"]'::jsonb,
        extracted_info = '{"anonymized": true}'::jsonb,
        deleted_at = now()
    WHERE customer_id = target_customer_id;
    
    -- Anonymize customer profile
    UPDATE customer_intelligence_profiles
    SET 
        phone_number_hash = 'ANONYMIZED',
        preferred_services = '[]'::jsonb,
        communication_preferences = '{"anonymized": true}'::jsonb,
        behavior_patterns = '{"anonymized": true}'::jsonb,
        predictions = '{"anonymized": true}'::jsonb,
        anonymization_requested = true
    WHERE customer_id = target_customer_id;
    
    -- Anonymize emotion tracking
    UPDATE emotion_analysis_tracking
    SET 
        user_input = 'ANONYMIZED',
        conversation_context = 'ANONYMIZED',
        emotional_keywords = '["ANONYMIZED"]'::jsonb
    WHERE customer_id = target_customer_id;
    
    -- Anonymize voice biometrics
    UPDATE voice_biometric_profiles
    SET 
        feature_vector = '{"anonymized": true}'::jsonb,
        enrollment_phrase = 'ANONYMIZED',
        anonymization_requested = true
    WHERE customer_hash IN (
        SELECT phone_number_hash FROM customer_intelligence_profiles 
        WHERE customer_id = target_customer_id
    );
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to completely delete customer intelligence data
CREATE OR REPLACE FUNCTION delete_customer_intelligence_data(target_customer_id UUID)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER := 0;
    customer_hash_val VARCHAR(255);
BEGIN
    -- Get customer hash for biometrics deletion
    SELECT phone_number_hash INTO customer_hash_val
    FROM customer_intelligence_profiles 
    WHERE customer_id = target_customer_id;
    
    -- Delete conversation memory
    DELETE FROM customer_conversation_memory WHERE customer_id = target_customer_id;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    -- Delete intent analytics
    DELETE FROM intent_recognition_analytics WHERE customer_id = target_customer_id;
    
    -- Delete emotion tracking
    DELETE FROM emotion_analysis_tracking WHERE customer_id = target_customer_id;
    
    -- Delete emotional journeys
    DELETE FROM emotional_journeys WHERE customer_id = target_customer_id;
    
    -- Delete voice biometrics if hash exists
    IF customer_hash_val IS NOT NULL THEN
        DELETE FROM voice_biometric_profiles WHERE customer_hash = customer_hash_val;
    END IF;
    
    -- Delete customer profile (cascade will handle related data)
    DELETE FROM customer_intelligence_profiles WHERE customer_id = target_customer_id;
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get customer data for GDPR export
CREATE OR REPLACE FUNCTION export_customer_intelligence_data(target_customer_id UUID)
RETURNS JSONB AS $$
DECLARE
    result JSONB;
BEGIN
    SELECT jsonb_build_object(
        'customer_profile', (
            SELECT to_jsonb(cip.*) FROM customer_intelligence_profiles cip 
            WHERE cip.customer_id = target_customer_id
        ),
        'conversation_memory', (
            SELECT jsonb_agg(to_jsonb(ccm.*)) FROM customer_conversation_memory ccm 
            WHERE ccm.customer_id = target_customer_id AND ccm.deleted_at IS NULL
        ),
        'intent_analytics', (
            SELECT jsonb_agg(to_jsonb(ira.*)) FROM intent_recognition_analytics ira 
            WHERE ira.customer_id = target_customer_id
        ),
        'emotion_tracking', (
            SELECT jsonb_agg(to_jsonb(eat.*)) FROM emotion_analysis_tracking eat 
            WHERE eat.customer_id = target_customer_id
        ),
        'emotional_journeys', (
            SELECT jsonb_agg(to_jsonb(ej.*)) FROM emotional_journeys ej 
            WHERE ej.customer_id = target_customer_id
        )
    ) INTO result;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- INITIAL DATA AND CONFIGURATION
-- =============================================================================

-- Insert default intelligence configuration for existing salons
INSERT INTO voice_intelligence_config (salon_id)
SELECT id FROM salons
WHERE id NOT IN (SELECT salon_id FROM voice_intelligence_config)
ON CONFLICT (salon_id) DO NOTHING;

-- Create indexes for performance optimization
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_conversation_memory_search 
ON customer_conversation_memory USING gin(key_insights);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_intelligence_profiles_predictions 
ON customer_intelligence_profiles USING gin(predictions);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_intent_analytics_entities 
ON intent_recognition_analytics USING gin(extracted_entities);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_emotion_keywords_search 
ON emotion_analysis_tracking USING gin(emotional_keywords);

-- =============================================================================
-- COMMENTS FOR DOCUMENTATION
-- =============================================================================

COMMENT ON TABLE customer_conversation_memory IS 'AI-powered conversation memory with customer insights and context preservation';
COMMENT ON TABLE customer_intelligence_profiles IS 'Comprehensive customer intelligence profiles for predictive analytics and personalization';
COMMENT ON TABLE voice_biometric_profiles IS 'Privacy-compliant voice biometric profiles for speaker authentication';
COMMENT ON TABLE intent_recognition_analytics IS 'Advanced intent recognition analytics with business intelligence';
COMMENT ON TABLE emotion_analysis_tracking IS 'Real-time emotion detection and sentiment analysis tracking';
COMMENT ON TABLE emotional_journeys IS 'Customer emotional journey mapping for experience optimization';
COMMENT ON TABLE voice_business_analytics IS 'Business intelligence analytics and ROI tracking';
COMMENT ON TABLE voice_intelligence_config IS 'Per-salon configuration for voice intelligence features';

COMMENT ON COLUMN customer_conversation_memory.key_insights IS 'JSONB array of AI-extracted key insights from conversations';
COMMENT ON COLUMN customer_intelligence_profiles.predictions IS 'JSONB object with churn prediction, LTV, and recommended actions';
COMMENT ON COLUMN voice_biometric_profiles.feature_vector IS 'JSONB array of encrypted voice biometric features';

-- Complete migration
SELECT 'Voice Intelligence Premium Features database schema created successfully' as result;