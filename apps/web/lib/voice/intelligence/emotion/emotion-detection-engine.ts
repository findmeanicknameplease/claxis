import { GoogleGenerativeAI } from '@google/generative-ai';
import { getUpstashClient } from '@/lib/redis/upstash-client';
import { config } from '@/lib/config';

// =============================================================================
// REAL-TIME EMOTION DETECTION ENGINE - ENTERPRISE SENTIMENT INTELLIGENCE
// =============================================================================
// Advanced emotion analysis with adaptive response generation for premium customer experience
// Multi-modal emotion detection (voice tone + text sentiment) with cultural context awareness
// Real-time customer satisfaction prediction and escalation triggers
// =============================================================================

export interface EmotionAnalysisResult {
  // Primary emotion classification
  primaryEmotion: 'joy' | 'sadness' | 'anger' | 'fear' | 'surprise' | 'disgust' | 'neutral';
  emotionConfidence: number; // 0-1
  
  // Detailed emotional state
  emotionalDimensions: {
    valence: number; // -1 (negative) to +1 (positive)
    arousal: number; // 0 (calm) to 1 (excited/agitated)
    dominance: number; // 0 (submissive) to 1 (dominant)
  };

  // Business-critical emotions
  businessEmotions: {
    satisfaction: number; // 0-1
    frustration: number; // 0-1
    interest: number; // 0-1
    urgency: number; // 0-1
    trust: number; // 0-1
    confusion: number; // 0-1
  };

  // Voice-specific indicators
  voiceEmotionIndicators: {
    pitch: 'low' | 'normal' | 'high' | 'variable';
    pace: 'slow' | 'normal' | 'fast' | 'variable';
    volume: 'quiet' | 'normal' | 'loud';
    stability: 'stable' | 'trembling' | 'shaky';
  };

  // Text sentiment analysis
  textSentiment: {
    sentiment: 'positive' | 'negative' | 'neutral';
    sentimentScore: number; // -1 to +1
    keyWords: string[];
    emotionalIntensity: number; // 0-1
  };

  // Cultural and linguistic context
  culturalContext: {
    language: 'de' | 'en' | 'nl' | 'fr';
    culturalNorms: string[];
    communicationStyle: 'direct' | 'indirect' | 'formal' | 'casual';
  };
}

export interface AdaptiveResponse {
  // Response strategy
  responseStrategy: 'empathetic' | 'professional' | 'enthusiastic' | 'calming' | 'urgent';
  adaptations: {
    tone: 'warm' | 'neutral' | 'formal' | 'energetic';
    pace: 'slower' | 'normal' | 'faster';
    language: 'simplified' | 'standard' | 'detailed';
    approach: 'solution_focused' | 'relationship_building' | 'information_gathering';
  };

  // Suggested responses
  suggestedResponses: {
    primary: string;
    alternative: string;
    escalation?: string;
  };

  // Escalation triggers
  escalationRequired: boolean;
  escalationReason?: string;
  escalationUrgency: 'low' | 'medium' | 'high' | 'critical';

  // Customer experience optimization
  experienceOptimization: {
    satisfactionPrediction: number; // 0-1
    retentionRisk: number; // 0-1
    upsellReadiness: number; // 0-1
    recommendedActions: string[];
  };
}

export interface EmotionalJourney {
  sessionId: string;
  customerId?: string;
  
  // Journey tracking
  emotionalProgression: {
    timestamp: Date;
    emotion: EmotionAnalysisResult;
    trigger?: string;
    context: string;
  }[];

  // Journey analytics
  journeyMetrics: {
    startEmotion: string;
    currentEmotion: string;
    emotionalVolatility: number; // How much emotions change
    satisfactionTrend: 'improving' | 'stable' | 'declining';
    keyEmotionalMoments: string[];
  };

  // Predictive insights
  predictions: {
    likelyOutcome: 'satisfied' | 'neutral' | 'dissatisfied' | 'escalation';
    confidenceScore: number;
    recommendedInterventions: string[];
  };
}

class EmotionDetectionEngine {
  private genAI: GoogleGenerativeAI;
  private model: any;
  private redis: ReturnType<typeof getUpstashClient>;

  constructor() {
    this.genAI = new GoogleGenerativeAI(config.GEMINI_API_KEY || '');
    this.model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    this.redis = getUpstashClient();
  }

  // =============================================================================
  // REAL-TIME EMOTION ANALYSIS
  // =============================================================================

  async analyzeEmotion(
    audioBuffer: Buffer,
    transcriptText: string,
    language: 'de' | 'en' | 'nl' | 'fr' = 'de',
    contextData?: {
      customerHistory?: any;
      conversationStage?: string;
      previousEmotions?: string[];
    }
  ): Promise<EmotionAnalysisResult> {
    try {
      console.log(`Analyzing emotion for text: "${transcriptText.substring(0, 50)}..."`);

      // Multi-modal emotion analysis
      const voiceEmotionAnalysis = await this.analyzeVoiceEmotion(audioBuffer);
      const textSentimentAnalysis = await this.analyzeTextSentiment(transcriptText, language);
      const culturalContextAnalysis = this.analyzeCulturalContext(transcriptText, language);

      // Combine analysis results
      const combinedEmotion = this.combineEmotionAnalyses(
        voiceEmotionAnalysis,
        textSentimentAnalysis,
        contextData
      );

      // Generate business emotion scores
      const businessEmotions = await this.analyzeBusinessEmotions(
        transcriptText,
        combinedEmotion,
        language
      );

      // Create comprehensive result
      const result: EmotionAnalysisResult = {
        primaryEmotion: combinedEmotion.primaryEmotion,
        emotionConfidence: combinedEmotion.confidence,
        emotionalDimensions: combinedEmotion.dimensions,
        businessEmotions,
        voiceEmotionIndicators: voiceEmotionAnalysis.indicators,
        textSentiment: textSentimentAnalysis,
        culturalContext: culturalContextAnalysis,
      };

      // Store emotion data for learning
      await this.storeEmotionAnalysis(result, transcriptText);

      console.log(`Emotion analysis complete: ${result.primaryEmotion} (confidence: ${result.emotionConfidence})`);
      return result;

    } catch (error) {
      console.error('Error analyzing emotion:', error);
      return this.createFallbackEmotionResult(transcriptText, language);
    }
  }

  private async analyzeVoiceEmotion(audioBuffer: Buffer): Promise<{
    primaryEmotion: EmotionAnalysisResult['primaryEmotion'];
    confidence: number;
    dimensions: EmotionAnalysisResult['emotionalDimensions'];
    indicators: EmotionAnalysisResult['voiceEmotionIndicators'];
  }> {
    // Simplified voice emotion analysis - in production would use specialized audio ML models
    const audioFeatures = this.extractEmotionalAudioFeatures(audioBuffer);
    
    // Map audio features to emotions
    const emotionMapping = this.mapAudioFeaturesToEmotion(audioFeatures);
    
    return {
      primaryEmotion: emotionMapping.emotion,
      confidence: emotionMapping.confidence,
      dimensions: emotionMapping.dimensions,
      indicators: audioFeatures.indicators,
    };
  }

  private extractEmotionalAudioFeatures(audioBuffer: Buffer): {
    fundamentalFrequency: number;
    intensity: number;
    spectralCentroid: number;
    jitter: number;
    shimmer: number;
    indicators: EmotionAnalysisResult['voiceEmotionIndicators'];
  } {
    // Simplified feature extraction for emotion detection
    let f0Sum = 0;
    let intensitySum = 0;
    let sampleCount = 0;
    let f0Variance = 0;
    let previousSample = 0;
    let volumeVariation = 0;

    // Process audio samples
    for (let i = 0; i < audioBuffer.length - 1; i += 2) {
      const sample = audioBuffer.readInt16LE(i);
      const normalizedSample = sample / 32768; // Normalize to -1 to 1
      
      // Calculate intensity (RMS)
      intensitySum += normalizedSample * normalizedSample;
      
      // Estimate F0 (fundamental frequency) using simple autocorrelation approach
      if (Math.abs(sample) > 1000) { // Only count significant samples
        f0Sum += Math.abs(sample);
        sampleCount++;
      }

      // Calculate volume variation
      volumeVariation += Math.abs(sample - previousSample);
      previousSample = sample;
    }

    const avgIntensity = intensitySum / (audioBuffer.length / 2);
    const avgF0 = sampleCount > 0 ? f0Sum / sampleCount : 0;
    const avgVolumeVariation = volumeVariation / (audioBuffer.length / 2);

    // Calculate jitter and shimmer (simplified)
    const jitter = Math.min(avgVolumeVariation / 10000, 1);
    const shimmer = Math.min(avgIntensity * 100, 1);

    // Determine voice indicators
    const pitch = avgF0 < 5000 ? 'low' : avgF0 > 15000 ? 'high' : 'normal';
    const volume = avgIntensity < 0.1 ? 'quiet' : avgIntensity > 0.7 ? 'loud' : 'normal';
    const stability = jitter > 0.5 ? 'shaky' : jitter > 0.2 ? 'trembling' : 'stable';
    const pace = avgVolumeVariation > 8000 ? 'fast' : avgVolumeVariation < 3000 ? 'slow' : 'normal';

    return {
      fundamentalFrequency: avgF0,
      intensity: avgIntensity,
      spectralCentroid: avgF0 * 0.7, // Simplified spectral centroid
      jitter,
      shimmer,
      indicators: {
        pitch: pitch as EmotionAnalysisResult['voiceEmotionIndicators']['pitch'],
        pace: pace as EmotionAnalysisResult['voiceEmotionIndicators']['pace'],
        volume: volume as EmotionAnalysisResult['voiceEmotionIndicators']['volume'],
        stability: stability as EmotionAnalysisResult['voiceEmotionIndicators']['stability'],
      },
    };
  }

  private mapAudioFeaturesToEmotion(features: any): {
    emotion: EmotionAnalysisResult['primaryEmotion'];
    confidence: number;
    dimensions: EmotionAnalysisResult['emotionalDimensions'];
  } {
    let emotion: EmotionAnalysisResult['primaryEmotion'] = 'neutral';
    let confidence = 0.5;

    // Emotion mapping based on voice characteristics
    if (features.indicators.pitch === 'high' && features.indicators.pace === 'fast') {
      if (features.intensity > 0.6) {
        emotion = 'anger';
        confidence = 0.8;
      } else {
        emotion = 'surprise';
        confidence = 0.7;
      }
    } else if (features.indicators.pitch === 'low' && features.indicators.pace === 'slow') {
      emotion = 'sadness';
      confidence = 0.7;
    } else if (features.indicators.stability === 'shaky') {
      emotion = 'fear';
      confidence = 0.6;
    } else if (features.intensity > 0.7 && features.indicators.volume === 'loud') {
      emotion = 'joy';
      confidence = 0.8;
    }

    // Calculate emotional dimensions
    const valence = emotion === 'joy' ? 0.8 : 
                   emotion === 'sadness' ? -0.7 :
                   emotion === 'anger' ? -0.6 :
                   emotion === 'fear' ? -0.5 : 0;

    const arousal = features.intensity;
    const dominance = features.indicators.volume === 'loud' ? 0.8 : 
                     features.indicators.volume === 'quiet' ? 0.2 : 0.5;

    return {
      emotion,
      confidence,
      dimensions: { valence, arousal, dominance },
    };
  }

  private async analyzeTextSentiment(
    text: string,
    language: string
  ): Promise<EmotionAnalysisResult['textSentiment']> {
    try {
      const sentimentPrompt = `
Analyze the sentiment and emotional content of this ${language} salon customer text:

Text: "${text}"

Provide detailed sentiment analysis in JSON format:
{
  "sentiment": "positive|negative|neutral",
  "sentimentScore": -1 to +1 numeric score,
  "keyWords": ["emotional words found"],
  "emotionalIntensity": 0 to 1 numeric intensity,
  "reasoning": "brief explanation"
}

Consider salon/beauty context and cultural communication patterns for ${language}.
Focus on customer satisfaction, frustration, excitement, concern, etc.

Return only valid JSON:`;

      const result = await this.model.generateContent(sentimentPrompt);
      const response = result.response.text().trim();
      
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          sentiment: parsed.sentiment || 'neutral',
          sentimentScore: Math.max(-1, Math.min(1, parsed.sentimentScore || 0)),
          keyWords: parsed.keyWords || [],
          emotionalIntensity: Math.max(0, Math.min(1, parsed.emotionalIntensity || 0.5)),
        };
      }

    } catch (error) {
      console.error('Error in text sentiment analysis:', error);
    }

    // Fallback sentiment analysis
    return this.performFallbackSentimentAnalysis(text, language);
  }

  private performFallbackSentimentAnalysis(
    text: string,
    language: string
  ): EmotionAnalysisResult['textSentiment'] {
    const lowerText = text.toLowerCase();
    
    // Language-specific sentiment keywords
    const sentimentKeywords = this.getSentimentKeywords(language);
    
    let positiveScore = 0;
    let negativeScore = 0;
    const foundKeywords: string[] = [];

    // Score based on keywords
    for (const [category, words] of Object.entries(sentimentKeywords)) {
      for (const word of words) {
        if (lowerText.includes(word)) {
          foundKeywords.push(word);
          if (category === 'positive') positiveScore++;
          else if (category === 'negative') negativeScore++;
        }
      }
    }

    // Determine overall sentiment
    let sentiment: 'positive' | 'negative' | 'neutral';
    let sentimentScore: number;

    if (positiveScore > negativeScore) {
      sentiment = 'positive';
      sentimentScore = Math.min(0.8, positiveScore * 0.2);
    } else if (negativeScore > positiveScore) {
      sentiment = 'negative';
      sentimentScore = Math.max(-0.8, -negativeScore * 0.2);
    } else {
      sentiment = 'neutral';
      sentimentScore = 0;
    }

    const emotionalIntensity = Math.min(1, (positiveScore + negativeScore) * 0.3);

    return {
      sentiment,
      sentimentScore,
      keyWords: foundKeywords,
      emotionalIntensity,
    };
  }

  private getSentimentKeywords(language: string): Record<string, string[]> {
    const keywordMaps = {
      de: {
        positive: ['gut', 'super', 'toll', 'fantastisch', 'zufrieden', 'perfekt', 'wunderbar', 'freue'],
        negative: ['schlecht', 'schrecklich', 'furchtbar', 'unzufrieden', 'ärgerlich', 'problem', 'beschwerde'],
        frustration: ['frustriert', 'genervt', 'ärgerlich', 'unverständlich'],
        satisfaction: ['zufrieden', 'glücklich', 'dankbar', 'begeistert'],
      },
      en: {
        positive: ['good', 'great', 'excellent', 'fantastic', 'satisfied', 'perfect', 'wonderful', 'happy'],
        negative: ['bad', 'terrible', 'awful', 'dissatisfied', 'annoying', 'problem', 'complaint'],
        frustration: ['frustrated', 'annoyed', 'irritated', 'confused'],
        satisfaction: ['satisfied', 'happy', 'grateful', 'thrilled'],
      },
      nl: {
        positive: ['goed', 'geweldig', 'uitstekend', 'fantastisch', 'tevreden', 'perfect', 'prachtig'],
        negative: ['slecht', 'verschrikkelijk', 'afschuwelijk', 'ontevreden', 'vervelend', 'probleem'],
        frustration: ['gefrustreerd', 'geïrriteerd', 'verward'],
        satisfaction: ['tevreden', 'blij', 'dankbaar'],
      },
      fr: {
        positive: ['bon', 'excellent', 'formidable', 'fantastique', 'satisfait', 'parfait', 'merveilleux'],
        negative: ['mauvais', 'terrible', 'affreux', 'insatisfait', 'ennuyeux', 'problème'],
        frustration: ['frustré', 'agacé', 'confus'],
        satisfaction: ['satisfait', 'heureux', 'reconnaissant'],
      },
    };

    return keywordMaps[language as keyof typeof keywordMaps] || keywordMaps.en;
  }

  private analyzeCulturalContext(
    text: string,
    language: string
  ): EmotionAnalysisResult['culturalContext'] {
    const lowerText = text.toLowerCase();
    
    // Cultural communication patterns
    const culturalNorms: string[] = [];
    let communicationStyle: 'direct' | 'indirect' | 'formal' | 'casual' = 'direct';

    // German cultural patterns
    if (language === 'de') {
      if (lowerText.includes('bitte') || lowerText.includes('danke')) {
        culturalNorms.push('politeness_markers');
        communicationStyle = 'formal';
      }
      if (lowerText.includes('sie')) {
        culturalNorms.push('formal_address');
      }
    }

    // English cultural patterns
    if (language === 'en') {
      if (lowerText.includes('please') || lowerText.includes('thank you')) {
        culturalNorms.push('politeness_markers');
      }
      if (lowerText.includes('hey') || lowerText.includes('hi there')) {
        communicationStyle = 'casual';
      }
    }

    // Dutch cultural patterns
    if (language === 'nl') {
      if (lowerText.includes('alstublieft') || lowerText.includes('dank je')) {
        culturalNorms.push('politeness_markers');
      }
      if (lowerText.includes('u ')) {
        communicationStyle = 'formal';
      }
    }

    // French cultural patterns
    if (language === 'fr') {
      if (lowerText.includes('s\'il vous plaît') || lowerText.includes('merci')) {
        culturalNorms.push('politeness_markers');
        communicationStyle = 'formal';
      }
      if (lowerText.includes('vous')) {
        culturalNorms.push('formal_address');
      }
    }

    // Directness indicators
    if (lowerText.includes('want') || lowerText.includes('need') || 
        lowerText.includes('möchte') || lowerText.includes('brauche')) {
      culturalNorms.push('direct_communication');
    }

    return {
      language,
      culturalNorms,
      communicationStyle,
    };
  }

  private combineEmotionAnalyses(
    voiceAnalysis: any,
    textAnalysis: EmotionAnalysisResult['textSentiment'],
    contextData?: any
  ): {
    primaryEmotion: EmotionAnalysisResult['primaryEmotion'];
    confidence: number;
    dimensions: EmotionAnalysisResult['emotionalDimensions'];
  } {
    // Weight voice and text analysis
    const voiceWeight = 0.6;
    const textWeight = 0.4;

    // Combine sentiment scores
    const combinedValence = (voiceAnalysis.dimensions.valence * voiceWeight) + 
                           (textAnalysis.sentimentScore * textWeight);

    // Determine primary emotion from combined analysis
    let primaryEmotion: EmotionAnalysisResult['primaryEmotion'];
    
    if (combinedValence > 0.5) {
      primaryEmotion = 'joy';
    } else if (combinedValence < -0.5) {
      primaryEmotion = textAnalysis.sentiment === 'negative' && 
                      voiceAnalysis.dimensions.arousal > 0.7 ? 'anger' : 'sadness';
    } else if (voiceAnalysis.primaryEmotion === 'fear' && textAnalysis.emotionalIntensity > 0.6) {
      primaryEmotion = 'fear';
    } else if (textAnalysis.sentiment === 'positive' && voiceAnalysis.dimensions.arousal > 0.6) {
      primaryEmotion = 'surprise';
    } else {
      primaryEmotion = 'neutral';
    }

    // Calculate combined confidence
    const confidence = (voiceAnalysis.confidence * voiceWeight) + 
                      (textAnalysis.emotionalIntensity * textWeight);

    return {
      primaryEmotion,
      confidence: Math.min(1, confidence),
      dimensions: {
        valence: combinedValence,
        arousal: voiceAnalysis.dimensions.arousal,
        dominance: voiceAnalysis.dimensions.dominance,
      },
    };
  }

  private async analyzeBusinessEmotions(
    text: string,
    emotionData: any,
    language: string
  ): Promise<EmotionAnalysisResult['businessEmotions']> {
    // Business emotion scoring based on text content and voice emotion
    const lowerText = text.toLowerCase();
    const businessKeywords = this.getBusinessEmotionKeywords(language);

    let satisfaction = 0.5;
    let frustration = 0;
    let interest = 0.5;
    let urgency = 0;
    let trust = 0.5;
    let confusion = 0;

    // Analyze for business emotions
    for (const [emotion, keywords] of Object.entries(businessKeywords)) {
      for (const keyword of keywords) {
        if (lowerText.includes(keyword)) {
          switch (emotion) {
            case 'satisfaction':
              satisfaction = Math.min(1, satisfaction + 0.3);
              break;
            case 'frustration':
              frustration = Math.min(1, frustration + 0.4);
              break;
            case 'interest':
              interest = Math.min(1, interest + 0.2);
              break;
            case 'urgency':
              urgency = Math.min(1, urgency + 0.5);
              break;
            case 'trust':
              trust = Math.min(1, trust + 0.2);
              break;
            case 'confusion':
              confusion = Math.min(1, confusion + 0.3);
              break;
          }
        }
      }
    }

    // Adjust based on overall emotion
    if (emotionData.primaryEmotion === 'anger') {
      frustration = Math.min(1, frustration + 0.5);
      satisfaction = Math.max(0, satisfaction - 0.3);
    } else if (emotionData.primaryEmotion === 'joy') {
      satisfaction = Math.min(1, satisfaction + 0.4);
      trust = Math.min(1, trust + 0.2);
    }

    return {
      satisfaction,
      frustration,
      interest,
      urgency,
      trust,
      confusion,
    };
  }

  private getBusinessEmotionKeywords(language: string): Record<string, string[]> {
    const keywordMaps = {
      de: {
        satisfaction: ['zufrieden', 'glücklich', 'toll', 'perfekt', 'super'],
        frustration: ['frustriert', 'ärgerlich', 'problem', 'schwierig', 'kompliziert'],
        interest: ['interessant', 'neugierig', 'mehr', 'erzählen', 'information'],
        urgency: ['dringend', 'schnell', 'sofort', 'eilig', 'heute'],
        trust: ['vertrauen', 'sicher', 'erfahrung', 'empfehlung'],
        confusion: ['verstehe nicht', 'unklar', 'verwirrt', 'was bedeutet'],
      },
      en: {
        satisfaction: ['satisfied', 'happy', 'great', 'perfect', 'excellent'],
        frustration: ['frustrated', 'annoying', 'problem', 'difficult', 'complicated'],
        interest: ['interesting', 'curious', 'more', 'tell me', 'information'],
        urgency: ['urgent', 'quickly', 'immediately', 'asap', 'today'],
        trust: ['trust', 'safe', 'experience', 'recommendation'],
        confusion: ['don\'t understand', 'unclear', 'confused', 'what does'],
      },
    };

    return keywordMaps[language as keyof typeof keywordMaps] || keywordMaps.en;
  }

  // =============================================================================
  // ADAPTIVE RESPONSE GENERATION
  // =============================================================================

  async generateAdaptiveResponse(
    emotionResult: EmotionAnalysisResult,
    conversationContext: {
      intent?: string;
      stage?: string;
      customerHistory?: any;
    }
  ): Promise<AdaptiveResponse> {
    try {
      console.log(`Generating adaptive response for emotion: ${emotionResult.primaryEmotion}`);

      // Determine response strategy
      const responseStrategy = this.determineResponseStrategy(emotionResult, conversationContext);
      
      // Generate adaptations
      const adaptations = this.generateResponseAdaptations(emotionResult, responseStrategy);
      
      // Check for escalation needs
      const escalationCheck = this.assessEscalationNeeds(emotionResult, conversationContext);
      
      // Generate suggested responses
      const suggestedResponses = await this.generateSuggestedResponses(
        emotionResult,
        responseStrategy,
        conversationContext
      );

      // Calculate experience optimization metrics
      const experienceOptimization = this.calculateExperienceOptimization(
        emotionResult,
        conversationContext
      );

      return {
        responseStrategy,
        adaptations,
        suggestedResponses,
        escalationRequired: escalationCheck.required,
        escalationReason: escalationCheck.reason,
        escalationUrgency: escalationCheck.urgency,
        experienceOptimization,
      };

    } catch (error) {
      console.error('Error generating adaptive response:', error);
      return this.createFallbackAdaptiveResponse(emotionResult);
    }
  }

  private determineResponseStrategy(
    emotion: EmotionAnalysisResult,
    context: any
  ): AdaptiveResponse['responseStrategy'] {
    // High frustration or anger
    if (emotion.businessEmotions.frustration > 0.7 || emotion.primaryEmotion === 'anger') {
      return 'empathetic';
    }

    // High satisfaction or joy
    if (emotion.businessEmotions.satisfaction > 0.7 || emotion.primaryEmotion === 'joy') {
      return 'enthusiastic';
    }

    // Fear or anxiety
    if (emotion.primaryEmotion === 'fear' || emotion.businessEmotions.confusion > 0.6) {
      return 'calming';
    }

    // Urgency detected
    if (emotion.businessEmotions.urgency > 0.6) {
      return 'urgent';
    }

    // Default professional approach
    return 'professional';
  }

  private generateResponseAdaptations(
    emotion: EmotionAnalysisResult,
    strategy: AdaptiveResponse['responseStrategy']
  ): AdaptiveResponse['adaptations'] {
    const baseAdaptations = {
      tone: 'neutral' as const,
      pace: 'normal' as const,
      language: 'standard' as const,
      approach: 'information_gathering' as const,
    };

    switch (strategy) {
      case 'empathetic':
        return {
          tone: 'warm',
          pace: 'slower',
          language: 'simplified',
          approach: 'solution_focused',
        };

      case 'enthusiastic':
        return {
          tone: 'energetic',
          pace: 'normal',
          language: 'detailed',
          approach: 'relationship_building',
        };

      case 'calming':
        return {
          tone: 'warm',
          pace: 'slower',
          language: 'simplified',
          approach: 'solution_focused',
        };

      case 'urgent':
        return {
          tone: 'formal',
          pace: 'faster',
          language: 'standard',
          approach: 'solution_focused',
        };

      default:
        return baseAdaptations;
    }
  }

  private assessEscalationNeeds(
    emotion: EmotionAnalysisResult,
    context: any
  ): { required: boolean; reason?: string; urgency: AdaptiveResponse['escalationUrgency'] } {
    
    // Critical escalation triggers
    if (emotion.businessEmotions.frustration > 0.8 && emotion.businessEmotions.satisfaction < 0.3) {
      return {
        required: true,
        reason: 'High frustration with low satisfaction - immediate intervention needed',
        urgency: 'critical',
      };
    }

    // High escalation triggers
    if (emotion.primaryEmotion === 'anger' && emotion.emotionConfidence > 0.7) {
      return {
        required: true,
        reason: 'Customer anger detected with high confidence',
        urgency: 'high',
      };
    }

    // Medium escalation triggers
    if (emotion.businessEmotions.confusion > 0.7 && emotion.businessEmotions.urgency > 0.6) {
      return {
        required: true,
        reason: 'Customer confusion with urgency - may need human assistance',
        urgency: 'medium',
      };
    }

    return { required: false, urgency: 'low' };
  }

  private async generateSuggestedResponses(
    emotion: EmotionAnalysisResult,
    strategy: AdaptiveResponse['responseStrategy'],
    context: any
  ): Promise<AdaptiveResponse['suggestedResponses']> {
    const language = emotion.culturalContext.language;
    const templates = this.getResponseTemplates(language, strategy);

    return {
      primary: templates.primary,
      alternative: templates.alternative,
      escalation: templates.escalation,
    };
  }

  private getResponseTemplates(
    language: string,
    strategy: AdaptiveResponse['responseStrategy']
  ): { primary: string; alternative: string; escalation?: string } {
    const templates = {
      de: {
        empathetic: {
          primary: 'Es tut mir wirklich leid, dass Sie sich frustriert fühlen. Ich verstehe Ihr Anliegen und bin hier, um Ihnen zu helfen.',
          alternative: 'Ich kann Ihre Frustration nachvollziehen. Lassen Sie uns gemeinsam eine Lösung finden.',
          escalation: 'Ich möchte sicherstellen, dass Sie die bestmögliche Hilfe erhalten. Darf ich Sie mit einem Kollegen verbinden?',
        },
        enthusiastic: {
          primary: 'Das ist wunderbar! Ich freue mich, dass Sie so begeistert sind. Wie kann ich Ihnen weiterhelfen?',
          alternative: 'Ihre Begeisterung ist ansteckend! Lassen Sie uns das perfekte Angebot für Sie finden.',
        },
        calming: {
          primary: 'Keine Sorge, ich bin hier, um Ihnen zu helfen. Wir finden gemeinsam eine Lösung.',
          alternative: 'Ich verstehe Ihre Bedenken. Lassen Sie mich Ihnen Schritt für Schritt helfen.',
        },
        professional: {
          primary: 'Gerne helfe ich Ihnen weiter. Was kann ich heute für Sie tun?',
          alternative: 'Ich stehe Ihnen gerne zur Verfügung. Wie kann ich Ihnen behilflich sein?',
        },
        urgent: {
          primary: 'Ich verstehe, dass dies dringend ist. Lassen Sie mich Ihnen sofort helfen.',
          alternative: 'Das ist wichtig - ich kümmere mich sofort darum.',
          escalation: 'Aufgrund der Dringlichkeit verbinde ich Sie sofort mit einem Spezialisten.',
        },
      },
      en: {
        empathetic: {
          primary: 'I\'m truly sorry that you\'re feeling frustrated. I understand your concern and I\'m here to help.',
          alternative: 'I can understand your frustration. Let\'s work together to find a solution.',
          escalation: 'I want to ensure you get the best possible help. May I connect you with a colleague?',
        },
        enthusiastic: {
          primary: 'That\'s wonderful! I\'m excited that you\'re so enthusiastic. How can I help you further?',
          alternative: 'Your enthusiasm is contagious! Let\'s find the perfect option for you.',
        },
        calming: {
          primary: 'Don\'t worry, I\'m here to help you. We\'ll find a solution together.',
          alternative: 'I understand your concerns. Let me help you step by step.',
        },
        professional: {
          primary: 'I\'d be happy to help you. What can I do for you today?',
          alternative: 'I\'m here to assist you. How may I help you?',
        },
        urgent: {
          primary: 'I understand this is urgent. Let me help you right away.',
          alternative: 'This is important - I\'ll take care of this immediately.',
          escalation: 'Due to the urgency, I\'m connecting you with a specialist right now.',
        },
      },
    };

    const langTemplates = templates[language as keyof typeof templates] || templates.en;
    return langTemplates[strategy] || langTemplates.professional;
  }

  private calculateExperienceOptimization(
    emotion: EmotionAnalysisResult,
    context: any
  ): AdaptiveResponse['experienceOptimization'] {
    
    // Predict satisfaction based on current emotional state
    const satisfactionPrediction = emotion.businessEmotions.satisfaction * 0.7 + 
                                  (emotion.emotionalDimensions.valence + 1) / 2 * 0.3;

    // Calculate retention risk
    const retentionRisk = emotion.businessEmotions.frustration * 0.6 + 
                         (1 - emotion.businessEmotions.trust) * 0.4;

    // Assess upsell readiness
    const upsellReadiness = emotion.businessEmotions.interest * 0.5 + 
                           emotion.businessEmotions.satisfaction * 0.3 +
                           (emotion.primaryEmotion === 'joy' ? 0.2 : 0);

    // Generate recommended actions
    const recommendedActions: string[] = [];
    
    if (satisfactionPrediction < 0.5) {
      recommendedActions.push('Focus on problem resolution');
      recommendedActions.push('Offer compensation or alternatives');
    }

    if (retentionRisk > 0.6) {
      recommendedActions.push('Implement retention strategy');
      recommendedActions.push('Escalate to customer success team');
    }

    if (upsellReadiness > 0.7) {
      recommendedActions.push('Present premium service options');
      recommendedActions.push('Highlight value-added services');
    }

    if (emotion.businessEmotions.confusion > 0.6) {
      recommendedActions.push('Provide clear, simple explanations');
      recommendedActions.push('Use visual aids if possible');
    }

    return {
      satisfactionPrediction: Math.max(0, Math.min(1, satisfactionPrediction)),
      retentionRisk: Math.max(0, Math.min(1, retentionRisk)),
      upsellReadiness: Math.max(0, Math.min(1, upsellReadiness)),
      recommendedActions,
    };
  }

  // =============================================================================
  // EMOTIONAL JOURNEY TRACKING
  // =============================================================================

  async trackEmotionalJourney(
    sessionId: string,
    emotion: EmotionAnalysisResult,
    context: string,
    trigger?: string
  ): Promise<void> {
    try {
      // Get existing journey
      const journey = await this.getEmotionalJourney(sessionId) || this.createNewJourney(sessionId);

      // Add current emotion to progression
      journey.emotionalProgression.push({
        timestamp: new Date(),
        emotion,
        trigger,
        context,
      });

      // Update journey metrics
      journey.journeyMetrics = this.calculateJourneyMetrics(journey.emotionalProgression);
      journey.predictions = this.generateJourneyPredictions(journey);

      // Store updated journey
      await this.storeEmotionalJourney(sessionId, journey);

    } catch (error) {
      console.error('Error tracking emotional journey:', error);
    }
  }

  private async getEmotionalJourney(sessionId: string): Promise<EmotionalJourney | null> {
    try {
      const journeyData = await this.redis.get(`emotion:journey:${sessionId}`);
      return journeyData ? JSON.parse(journeyData) : null;
    } catch (error) {
      console.error('Error getting emotional journey:', error);
      return null;
    }
  }

  private createNewJourney(sessionId: string): EmotionalJourney {
    return {
      sessionId,
      emotionalProgression: [],
      journeyMetrics: {
        startEmotion: 'neutral',
        currentEmotion: 'neutral',
        emotionalVolatility: 0,
        satisfactionTrend: 'stable',
        keyEmotionalMoments: [],
      },
      predictions: {
        likelyOutcome: 'neutral',
        confidenceScore: 0.5,
        recommendedInterventions: [],
      },
    };
  }

  private calculateJourneyMetrics(progression: EmotionalJourney['emotionalProgression']): EmotionalJourney['journeyMetrics'] {
    if (progression.length === 0) {
      return {
        startEmotion: 'neutral',
        currentEmotion: 'neutral',
        emotionalVolatility: 0,
        satisfactionTrend: 'stable',
        keyEmotionalMoments: [],
      };
    }

    const startEmotion = progression[0].emotion.primaryEmotion;
    const currentEmotion = progression[progression.length - 1].emotion.primaryEmotion;

    // Calculate emotional volatility
    let volatilitySum = 0;
    for (let i = 1; i < progression.length; i++) {
      const prev = progression[i - 1].emotion.emotionalDimensions.valence;
      const curr = progression[i].emotion.emotionalDimensions.valence;
      volatilitySum += Math.abs(curr - prev);
    }
    const emotionalVolatility = progression.length > 1 ? volatilitySum / (progression.length - 1) : 0;

    // Calculate satisfaction trend
    const satisfactionValues = progression.map(p => p.emotion.businessEmotions.satisfaction);
    let satisfactionTrend: 'improving' | 'stable' | 'declining' = 'stable';
    
    if (satisfactionValues.length >= 3) {
      const recent = satisfactionValues.slice(-3);
      const trend = recent[2] - recent[0];
      if (trend > 0.2) satisfactionTrend = 'improving';
      else if (trend < -0.2) satisfactionTrend = 'declining';
    }

    // Identify key emotional moments
    const keyMoments: string[] = [];
    for (const entry of progression) {
      if (entry.emotion.emotionConfidence > 0.8) {
        keyMoments.push(`${entry.emotion.primaryEmotion} at ${entry.timestamp.toISOString()}`);
      }
    }

    return {
      startEmotion,
      currentEmotion,
      emotionalVolatility,
      satisfactionTrend,
      keyEmotionalMoments: keyMoments.slice(-5), // Keep last 5
    };
  }

  private generateJourneyPredictions(journey: EmotionalJourney): EmotionalJourney['predictions'] {
    const recentProgression = journey.emotionalProgression.slice(-3);
    
    if (recentProgression.length === 0) {
      return {
        likelyOutcome: 'neutral',
        confidenceScore: 0.5,
        recommendedInterventions: [],
      };
    }

    const currentEmotion = recentProgression[recentProgression.length - 1].emotion;
    const avgSatisfaction = recentProgression.reduce((sum, p) => sum + p.emotion.businessEmotions.satisfaction, 0) / recentProgression.length;
    const avgFrustration = recentProgression.reduce((sum, p) => sum + p.emotion.businessEmotions.frustration, 0) / recentProgression.length;

    // Predict likely outcome
    let likelyOutcome: EmotionalJourney['predictions']['likelyOutcome'];
    let confidenceScore: number;

    if (avgSatisfaction > 0.7 && avgFrustration < 0.3) {
      likelyOutcome = 'satisfied';
      confidenceScore = 0.8;
    } else if (avgFrustration > 0.7 && avgSatisfaction < 0.3) {
      likelyOutcome = 'dissatisfied';
      confidenceScore = 0.8;
    } else if (currentEmotion.businessEmotions.frustration > 0.8) {
      likelyOutcome = 'escalation';
      confidenceScore = 0.9;
    } else {
      likelyOutcome = 'neutral';
      confidenceScore = 0.6;
    }

    // Generate recommended interventions
    const interventions: string[] = [];
    
    if (journey.journeyMetrics.emotionalVolatility > 0.5) {
      interventions.push('Stabilize conversation with consistent tone');
    }

    if (journey.journeyMetrics.satisfactionTrend === 'declining') {
      interventions.push('Implement satisfaction recovery strategy');
    }

    if (avgFrustration > 0.6) {
      interventions.push('Apply empathetic response approach');
    }

    return {
      likelyOutcome,
      confidenceScore,
      recommendedInterventions: interventions,
    };
  }

  private async storeEmotionalJourney(sessionId: string, journey: EmotionalJourney): Promise<void> {
    try {
      await this.redis.set(
        `emotion:journey:${sessionId}`,
        JSON.stringify(journey),
        { ex: 86400 } // 24 hours
      );
    } catch (error) {
      console.error('Error storing emotional journey:', error);
    }
  }

  // =============================================================================
  // UTILITY METHODS
  // =============================================================================

  private async storeEmotionAnalysis(result: EmotionAnalysisResult, text: string): Promise<void> {
    try {
      const analysisData = {
        timestamp: new Date().toISOString(),
        primaryEmotion: result.primaryEmotion,
        confidence: result.emotionConfidence,
        businessEmotions: result.businessEmotions,
        text: text.substring(0, 100), // Store first 100 chars for context
      };

      await this.redis.lpush(
        'emotion:analysis:history',
        JSON.stringify(analysisData)
      );

      // Keep last 1000 analyses
      await this.redis.ltrim('emotion:analysis:history', 0, 999);

    } catch (error) {
      console.error('Error storing emotion analysis:', error);
    }
  }

  private createFallbackEmotionResult(text: string, language: string): EmotionAnalysisResult {
    return {
      primaryEmotion: 'neutral',
      emotionConfidence: 0.3,
      emotionalDimensions: { valence: 0, arousal: 0.5, dominance: 0.5 },
      businessEmotions: {
        satisfaction: 0.5,
        frustration: 0,
        interest: 0.5,
        urgency: 0,
        trust: 0.5,
        confusion: 0,
      },
      voiceEmotionIndicators: {
        pitch: 'normal',
        pace: 'normal',
        volume: 'normal',
        stability: 'stable',
      },
      textSentiment: {
        sentiment: 'neutral',
        sentimentScore: 0,
        keyWords: [],
        emotionalIntensity: 0.3,
      },
      culturalContext: {
        language,
        culturalNorms: [],
        communicationStyle: 'direct',
      },
    };
  }

  private createFallbackAdaptiveResponse(emotion: EmotionAnalysisResult): AdaptiveResponse {
    return {
      responseStrategy: 'professional',
      adaptations: {
        tone: 'neutral',
        pace: 'normal',
        language: 'standard',
        approach: 'information_gathering',
      },
      suggestedResponses: {
        primary: 'How can I help you today?',
        alternative: 'What can I do for you?',
      },
      escalationRequired: false,
      escalationUrgency: 'low',
      experienceOptimization: {
        satisfactionPrediction: 0.5,
        retentionRisk: 0.3,
        upsellReadiness: 0.3,
        recommendedActions: ['Provide helpful assistance'],
      },
    };
  }
}

// Create singleton instance
let emotionDetectionEngine: EmotionDetectionEngine | null = null;

export function getEmotionDetectionEngine(): EmotionDetectionEngine {
  if (!emotionDetectionEngine) {
    emotionDetectionEngine = new EmotionDetectionEngine();
  }
  return emotionDetectionEngine;
}

export { EmotionDetectionEngine };
export default EmotionDetectionEngine;