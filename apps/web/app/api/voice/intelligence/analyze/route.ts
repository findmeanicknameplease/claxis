import { NextRequest, NextResponse } from 'next/server';
import { getConversationMemoryEngine } from '@/lib/voice/intelligence/memory/conversation-memory';
import { getAdvancedIntentEngine } from '@/lib/voice/intelligence/nlp/intent-engine';
import { getVoiceBiometricsEngine } from '@/lib/voice/intelligence/biometrics/voice-biometrics-engine';
import { getEmotionDetectionEngine } from '@/lib/voice/intelligence/emotion/emotion-detection-engine';
import { getBusinessIntelligenceEngine } from '@/lib/voice/intelligence/analytics/business-intelligence';
import { z } from 'zod';

// =============================================================================
// VOICE INTELLIGENCE ANALYSIS API - REAL-TIME AI PROCESSING
// =============================================================================
// Comprehensive voice analysis endpoint for premium €299.99/month tier
// Processes audio + text for memory, intent, emotion, and biometric analysis
// Returns actionable insights for adaptive conversation management
// =============================================================================

const AnalysisRequestSchema = z.object({
  sessionId: z.string().min(1),
  salonId: z.string().uuid(),
  customerId: z.string().uuid().optional(),
  
  // Audio and text data
  audioBase64: z.string().optional(),
  transcriptText: z.string().min(1),
  language: z.enum(['de', 'en', 'nl', 'fr']).default('de'),
  
  // Context data
  conversationContext: z.object({
    sessionId: z.string().min(1),
    turnNumber: z.number().min(1).default(1),
    previousIntents: z.array(z.string()).default([]),
    conversationHistory: z.array(z.object({
      speaker: z.enum(['user', 'agent']),
      text: z.string(),
      intent: z.string().optional(),
      timestamp: z.string(),
    })).default([]),
    customerProfile: z.object({
      previousServices: z.array(z.string()).default([]),
      communicationStyle: z.string().default('friendly'),
      loyaltyLevel: z.string().default('new'),
    }).optional(),
  }).default({
    sessionId: 'default-session',
    turnNumber: 1,
    previousIntents: [],
    conversationHistory: [],
  }),
  
  // Analysis options
  analysisOptions: z.object({
    enableMemoryAnalysis: z.boolean().default(true),
    enableIntentRecognition: z.boolean().default(true),
    enableEmotionDetection: z.boolean().default(true),
    enableVoiceBiometrics: z.boolean().default(false),
    storeResults: z.boolean().default(true),
  }).default({
    enableMemoryAnalysis: true,
    enableIntentRecognition: true,
    enableEmotionDetection: true,
    enableVoiceBiometrics: false,
    storeResults: true,
  }),
});

interface VoiceIntelligenceResult {
  analysisId: string;
  timestamp: string;
  processingTime: number;
  
  // Core analysis results
  intentAnalysis?: {
    primaryIntent: string;
    confidence: number;
    businessCategory: string;
    urgencyLevel: string;
    extractedEntities: any;
    suggestedResponses: string[];
    upsellOpportunities: any[];
  };
  
  emotionAnalysis?: {
    primaryEmotion: string;
    confidence: number;
    businessEmotions: any;
    adaptiveResponse: {
      responseStrategy: string;
      suggestedResponses: any;
      escalationRequired: boolean;
      experienceOptimization: any;
    };
  };
  
  voiceBiometrics?: {
    authenticationResult: any;
    customerIdentified: boolean;
    securityFlags: string[];
  };
  
  memoryInsights?: {
    conversationStored: boolean;
    customerContext: any;
    predictiveRecommendations: string[];
  };
  
  // Business intelligence
  businessInsights: {
    satisfactionPrediction: number;
    retentionRisk: number;
    upsellReadiness: number;
    recommendedActions: string[];
  };
  
  // Performance metrics
  qualityMetrics: {
    analysisAccuracy: number;
    responseRelevance: number;
    processingLatency: number;
  };
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    console.log('Voice intelligence analysis request received');

    // Parse and validate request
    const body = await request.json();
    const analysisRequest = AnalysisRequestSchema.parse(body);

    // Initialize analysis engines
    const memoryEngine = getConversationMemoryEngine();
    const intentEngine = getAdvancedIntentEngine();
    const emotionEngine = getEmotionDetectionEngine();
    const biometricsEngine = getVoiceBiometricsEngine();
    const businessEngine = getBusinessIntelligenceEngine();

    // Prepare audio buffer if provided
    let audioBuffer: Buffer | undefined;
    if (analysisRequest.audioBase64) {
      try {
        audioBuffer = Buffer.from(analysisRequest.audioBase64, 'base64');
      } catch (error) {
        console.error('Error decoding audio base64:', error);
      }
    }

    // Initialize result object
    const result: VoiceIntelligenceResult = {
      analysisId: `analysis_${Date.now()}`,
      timestamp: new Date().toISOString(),
      processingTime: 0,
      businessInsights: {
        satisfactionPrediction: 0.5,
        retentionRisk: 0.3,
        upsellReadiness: 0.3,
        recommendedActions: [],
      },
      qualityMetrics: {
        analysisAccuracy: 0,
        responseRelevance: 0,
        processingLatency: 0,
      },
    };

    // Execute parallel analysis
    const analysisPromises: Promise<void>[] = [];

    // 1. Intent Recognition Analysis
    if (analysisRequest.analysisOptions.enableIntentRecognition) {
      analysisPromises.push(
        (async () => {
          try {
            // Convert timestamp strings to Date objects for intent engine
            const contextWithDates = {
              ...analysisRequest.conversationContext,
              conversationHistory: analysisRequest.conversationContext.conversationHistory.map(item => ({
                ...item,
                timestamp: new Date(item.timestamp)
              }))
            };
            
            const intentResult = await intentEngine.recognizeIntent(
              analysisRequest.transcriptText,
              analysisRequest.language,
              contextWithDates
            );

            result.intentAnalysis = {
              primaryIntent: intentResult.primaryIntent,
              confidence: intentResult.confidence,
              businessCategory: intentResult.businessCategory,
              urgencyLevel: intentResult.urgencyLevel,
              extractedEntities: intentResult.extractedEntities,
              suggestedResponses: intentResult.suggestedResponses,
              upsellOpportunities: intentResult.upsellOpportunities,
            };

          } catch (error) {
            console.error('Intent analysis error:', error);
          }
        })()
      );
    }

    // 2. Emotion Detection Analysis
    if (analysisRequest.analysisOptions.enableEmotionDetection && audioBuffer) {
      analysisPromises.push(
        (async () => {
          try {
            const emotionResult = await emotionEngine.analyzeEmotion(
              audioBuffer!,
              analysisRequest.transcriptText,
              analysisRequest.language,
              {
                customerHistory: analysisRequest.conversationContext.customerProfile,
                conversationStage: 'needs_assessment',
                previousEmotions: [],
              }
            );

            const adaptiveResponse = await emotionEngine.generateAdaptiveResponse(
              emotionResult,
              {
                intent: result.intentAnalysis?.primaryIntent,
                stage: 'needs_assessment',
                customerHistory: analysisRequest.conversationContext.customerProfile,
              }
            );

            result.emotionAnalysis = {
              primaryEmotion: emotionResult.primaryEmotion,
              confidence: emotionResult.emotionConfidence,
              businessEmotions: emotionResult.businessEmotions,
              adaptiveResponse: {
                responseStrategy: adaptiveResponse.responseStrategy,
                suggestedResponses: adaptiveResponse.suggestedResponses,
                escalationRequired: adaptiveResponse.escalationRequired,
                experienceOptimization: adaptiveResponse.experienceOptimization,
              },
            };

            // Track emotional journey
            await emotionEngine.trackEmotionalJourney(
              analysisRequest.sessionId,
              emotionResult,
              analysisRequest.transcriptText,
              result.intentAnalysis?.primaryIntent
            );

          } catch (error) {
            console.error('Emotion analysis error:', error);
          }
        })()
      );
    }

    // 3. Voice Biometrics Analysis
    if (analysisRequest.analysisOptions.enableVoiceBiometrics && audioBuffer && analysisRequest.customerId) {
      analysisPromises.push(
        (async () => {
          try {
            const biometricResult = await biometricsEngine.authenticateVoice(
              audioBuffer!,
              `customer_${analysisRequest.customerId}`
            );

            result.voiceBiometrics = {
              authenticationResult: biometricResult,
              customerIdentified: biometricResult.isAuthenticated,
              securityFlags: biometricResult.anomalyFlags,
            };

          } catch (error) {
            console.error('Voice biometrics error:', error);
          }
        })()
      );
    }

    // Wait for all analyses to complete
    await Promise.all(analysisPromises);

    // 4. Memory Analysis and Storage
    if (analysisRequest.analysisOptions.enableMemoryAnalysis && analysisRequest.customerId) {
      try {
        // Store conversation memory
        await memoryEngine.storeConversationMemory(
          analysisRequest.customerId,
          analysisRequest.sessionId,
          {
            transcript: analysisRequest.transcriptText,
            duration: 0, // Would be calculated from audio
            intent: result.intentAnalysis?.primaryIntent || 'general',
            extractedInfo: result.intentAnalysis?.extractedEntities || {},
            emotionalTone: result.emotionAnalysis?.primaryEmotion || 'neutral',
            satisfactionScore: Math.round((result.emotionAnalysis?.businessEmotions?.satisfaction || 0.5) * 5),
          }
        );

        // Get conversation context for recommendations
        const conversationContext = await memoryEngine.getConversationContext(analysisRequest.customerId);

        result.memoryInsights = {
          conversationStored: true,
          customerContext: conversationContext,
          predictiveRecommendations: conversationContext.predictiveRecommendations,
        };

      } catch (error) {
        console.error('Memory analysis error:', error);
        result.memoryInsights = {
          conversationStored: false,
          customerContext: null,
          predictiveRecommendations: [],
        };
      }
    }

    // 5. Business Intelligence Insights
    try {
      // Collect analytics data for business insights
      if (analysisRequest.analysisOptions.storeResults) {
        await businessEngine.collectCallAnalytics({
          sessionId: analysisRequest.sessionId,
          salonId: analysisRequest.salonId,
          customerId: analysisRequest.customerId,
          duration: 0, // Would be calculated from audio duration
          outcome: 'completed',
          satisfactionScore: result.emotionAnalysis?.businessEmotions?.satisfaction,
          bookingCreated: result.intentAnalysis?.primaryIntent === 'BOOKING_INTENT',
          bookingValue: undefined,
          upsellOffered: (result.intentAnalysis?.upsellOpportunities?.length || 0) > 0,
          upsellAccepted: false,
          emotionalJourney: [result.emotionAnalysis?.primaryEmotion || 'neutral'],
          costs: {
            twilioCall: 0.01,
            elevenLabsAI: 0.02,
            total: 0.03,
          },
          qualityMetrics: {
            audioQuality: audioBuffer ? 4.2 : 0,
            transcriptionAccuracy: 0.92,
            intentAccuracy: result.intentAnalysis?.confidence || 0.5,
          },
        });
      }

      // Generate business insights
      result.businessInsights = {
        satisfactionPrediction: result.emotionAnalysis?.adaptiveResponse?.experienceOptimization?.satisfactionPrediction || 0.5,
        retentionRisk: result.emotionAnalysis?.adaptiveResponse?.experienceOptimization?.retentionRisk || 0.3,
        upsellReadiness: result.emotionAnalysis?.adaptiveResponse?.experienceOptimization?.upsellReadiness || 0.3,
        recommendedActions: [
          ...(result.memoryInsights?.predictiveRecommendations || []),
          ...(result.emotionAnalysis?.adaptiveResponse?.experienceOptimization?.recommendedActions || []),
        ],
      };

    } catch (error) {
      console.error('Business intelligence error:', error);
    }

    // Calculate quality metrics
    const processingTime = Date.now() - startTime;
    result.processingTime = processingTime;
    result.qualityMetrics = {
      analysisAccuracy: calculateAnalysisAccuracy(result),
      responseRelevance: calculateResponseRelevance(result),
      processingLatency: processingTime,
    };

    console.log(`Voice intelligence analysis completed in ${processingTime}ms`);

    return NextResponse.json({
      success: true,
      result,
    });

  } catch (error) {
    console.error('Error in voice intelligence analysis:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid request format',
          details: error.errors,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Voice intelligence analysis failed',
        processingTime: Date.now() - startTime,
      },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function calculateAnalysisAccuracy(result: VoiceIntelligenceResult): number {
  let totalConfidence = 0;
  let analysisCount = 0;

  if (result.intentAnalysis) {
    totalConfidence += result.intentAnalysis.confidence;
    analysisCount++;
  }

  if (result.emotionAnalysis) {
    totalConfidence += result.emotionAnalysis.confidence;
    analysisCount++;
  }

  if (result.voiceBiometrics && result.voiceBiometrics.authenticationResult) {
    totalConfidence += result.voiceBiometrics.authenticationResult.confidence || 0;
    analysisCount++;
  }

  return analysisCount > 0 ? totalConfidence / analysisCount : 0;
}

function calculateResponseRelevance(result: VoiceIntelligenceResult): number {
  let relevanceScore = 0.5; // Base score

  // Higher relevance if multiple analyses agree
  if (result.intentAnalysis && result.emotionAnalysis) {
    const intentUrgency = result.intentAnalysis.urgencyLevel;
    const emotionFrustration = result.emotionAnalysis.businessEmotions?.frustration || 0;

    // Check for consistency between intent urgency and emotion
    if ((intentUrgency === 'high' || intentUrgency === 'critical') && emotionFrustration > 0.6) {
      relevanceScore += 0.3; // Consistent high urgency
    }

    // Check for positive sentiment alignment
    const emotionSatisfaction = result.emotionAnalysis.businessEmotions?.satisfaction || 0;
    if (result.intentAnalysis.businessCategory === 'booking' && emotionSatisfaction > 0.7) {
      relevanceScore += 0.2; // Positive booking intent
    }
  }

  // Penalty for conflicting signals
  if (result.emotionAnalysis?.adaptiveResponse?.escalationRequired && 
      result.intentAnalysis?.businessCategory === 'upsell_opportunity') {
    relevanceScore -= 0.2; // Conflicting: escalation needed but trying to upsell
  }

  return Math.max(0, Math.min(1, relevanceScore));
}