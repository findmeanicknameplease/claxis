import express from 'express';
import crypto from 'crypto';
import cors from 'cors';
import dotenv from 'dotenv';
import fetch from 'node-fetch';
import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';
import { createClient } from '@supabase/supabase-js';

// Load environment variables
dotenv.config();

const app = express();
app.use(express.json({ limit: '10mb' }));
app.use(cors());

const PORT = process.env.PORT || 3000;
const SERVICE_API_KEY = process.env.SERVICE_API_KEY; // For securing our service
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

// Initialize ElevenLabs client
const elevenlabs = new ElevenLabsClient({
  apiKey: ELEVENLABS_API_KEY,
});

// Initialize Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Hardcoded German voice for Phase 3.1 (we'll make this configurable in Phase 3.2)
const GERMAN_VOICE_ID = 'pNInz6obpgDQGcFmaJgB'; // Adam - Professional male German voice

// Middleware to protect our internal endpoint
const apiKeyAuth = (req, res, next) => {
  const providedKey = req.headers['x-api-key'];
  if (!SERVICE_API_KEY || providedKey === SERVICE_API_KEY) {
    return next();
  }
  res.status(401).json({ error: 'Unauthorized' });
};

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    service: 'voice-synthesis-service',
    version: '1.0.0'
  });
});

// Main synthesis endpoint
app.post('/synthesize', apiKeyAuth, async (req, res) => {
  const { text, voiceId, language, callbackUrl, idempotencyKey, salonId, testScenario } = req.body;

  // Basic validation
  if (!text || !callbackUrl || !idempotencyKey) {
    return res.status(400).json({ 
      error: 'Missing required fields', 
      required: ['text', 'callbackUrl', 'idempotencyKey'],
      received: Object.keys(req.body)
    });
  }

  // --- TEST MODE LOGIC ---
  if (testScenario) {
    console.log(`[TEST MODE] Activated with scenario: ${testScenario}`);
    res.status(202).json({ 
      status: 'processing_test', 
      message: `Test mode: ${testScenario}`,
      idempotencyKey,
      estimatedCompletionSeconds: 0.1
    });

    let mockPayload;
    switch (testScenario) {
      case 'failure_quota':
        mockPayload = { 
          status: 'failed', 
          reason: 'quota_exceeded',
          idempotencyKey,
          processingTimeMs: 100,
          errorType: 'quota_exceeded'
        };
        break;
      case 'failure_synthesis':
        mockPayload = { 
          status: 'failed', 
          reason: 'ElevenLabs API temporarily unavailable',
          idempotencyKey,
          processingTimeMs: 150,
          errorType: 'synthesis_error'
        };
        break;
      case 'failure_storage':
        mockPayload = { 
          status: 'failed', 
          reason: 'Supabase storage upload failed',
          idempotencyKey,
          processingTimeMs: 200,
          errorType: 'storage_error'
        };
        break;
      default: // 'success'
        mockPayload = { 
          status: 'success', 
          audioUrl: 'https://cdn.example.com/mock-audio.mp3',
          idempotencyKey,
          cached: false,
          processingTimeMs: 120,
          audioSizeBytes: 32000,
          characterCount: text.length
        };
    }

    // Simulate async callback with realistic delay
    setTimeout(() => {
      callbackToN8n(callbackUrl, mockPayload);
    }, 100); // Fast callback for testing

    return; // End execution here
  }
  // --- END TEST MODE LOGIC ---

  // Acknowledge the request immediately
  res.status(202).json({ 
    status: 'processing', 
    message: 'Voice synthesis request accepted',
    idempotencyKey,
    estimatedCompletionSeconds: 2
  });

  // Start async processing
  processVoiceSynthesis({
    text: text.trim(),
    voiceId: voiceId || GERMAN_VOICE_ID,
    language: language || 'de',
    callbackUrl,
    idempotencyKey,
    salonId: salonId || 'unknown'
  });
});

async function processVoiceSynthesis({ text, voiceId, language, callbackUrl, idempotencyKey, salonId }) {
  const startTime = Date.now();
  
  try {
    console.log(`[${idempotencyKey}] Starting voice synthesis for salon ${salonId}`);
    console.log(`[${idempotencyKey}] Text: "${text}" (${text.length} chars)`);
    console.log(`[${idempotencyKey}] Voice: ${voiceId}, Language: ${language}`);

    // 1. Generate cache key for deduplication
    const cacheKey = crypto.createHash('sha256')
      .update(`${text}_${voiceId}_${language}`)
      .digest('hex');
    const fileName = `${cacheKey}.mp3`;

    console.log(`[${idempotencyKey}] Cache key: ${cacheKey}`);

    // 2. Check if file already exists in Supabase Storage (simple caching)
    const { data: existingFile, error: checkError } = await supabase.storage
      .from('voice-synthesis-temp')
      .list('', {
        search: fileName
      });

    if (!checkError && existingFile && existingFile.length > 0) {
      console.log(`[${idempotencyKey}] Cache hit! File already exists: ${fileName}`);
      
      // Generate signed URL for existing file
      const { data: signedUrlData, error: urlError } = await supabase.storage
        .from('voice-synthesis-temp')
        .createSignedUrl(fileName, 600); // 10 minutes

      if (!urlError && signedUrlData?.signedUrl) {
        const processingTime = Date.now() - startTime;
        console.log(`[${idempotencyKey}] Cache hit completed in ${processingTime}ms`);
        
        await callbackToN8n(callbackUrl, {
          status: 'success',
          audioUrl: signedUrlData.signedUrl,
          idempotencyKey,
          cached: true,
          processingTimeMs: processingTime
        });
        return;
      }
    }

    console.log(`[${idempotencyKey}] Cache miss - generating new audio with ElevenLabs`);

    // 3. Call ElevenLabs API for voice synthesis using streaming
    const audioStream = await elevenlabs.textToSpeech.convertAsStream(voiceId, {
      text,
      model_id: 'eleven_flash_v2_5', // Fastest model for Phase 3.1
      voice_settings: {
        stability: 0.75,
        similarity_boost: 0.8,
        style: 0.0,
        use_speaker_boost: false
      }
    });

    console.log(`[${idempotencyKey}] ElevenLabs stream received, processing audio...`);

    // 4. Convert stream to buffer (required for Supabase upload)
    const chunks = [];
    for await (const chunk of audioStream) {
      chunks.push(chunk);
    }
    const audioBuffer = Buffer.concat(chunks);

    const synthesisTime = Date.now() - startTime;
    console.log(`[${idempotencyKey}] Audio synthesis completed in ${synthesisTime}ms, buffer size: ${audioBuffer.length} bytes`);

    // 5. Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('voice-synthesis-temp')
      .upload(fileName, audioBuffer, {
        contentType: 'audio/mpeg',
        cacheControl: '3600', // 1 hour cache
        upsert: false // Don't overwrite if exists
      });

    if (uploadError) {
      throw new Error(`Supabase upload failed: ${uploadError.message}`);
    }

    console.log(`[${idempotencyKey}] File uploaded to Supabase: ${uploadData?.path}`);

    // 6. Generate signed URL for the uploaded file
    const { data: signedUrlData, error: urlError } = await supabase.storage
      .from('voice-synthesis-temp')
      .createSignedUrl(fileName, 600); // 10 minutes expiry

    if (urlError || !signedUrlData?.signedUrl) {
      throw new Error(`Failed to generate signed URL: ${urlError?.message || 'Unknown error'}`);
    }

    const totalProcessingTime = Date.now() - startTime;
    console.log(`[${idempotencyKey}] SUCCESS: Total processing time ${totalProcessingTime}ms`);
    console.log(`[${idempotencyKey}] Signed URL: ${signedUrlData.signedUrl}`);

    // 7. Call back to n8n with success
    await callbackToN8n(callbackUrl, {
      status: 'success',
      audioUrl: signedUrlData.signedUrl,
      idempotencyKey,
      cached: false,
      processingTimeMs: totalProcessingTime,
      audioSizeBytes: audioBuffer.length,
      characterCount: text.length
    });

  } catch (error) {
    const totalProcessingTime = Date.now() - startTime;
    console.error(`[${idempotencyKey}] ERROR after ${totalProcessingTime}ms:`, error);

    // 8. Call back to n8n with failure
    await callbackToN8n(callbackUrl, {
      status: 'failed',
      reason: error.message || 'unknown_error',
      idempotencyKey,
      processingTimeMs: totalProcessingTime,
      errorType: getErrorType(error)
    });
  }
}

async function callbackToN8n(callbackUrl, payload) {
  try {
    const response = await fetch(callbackUrl, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'User-Agent': 'VoiceSynthesisService/1.0.0'
      },
      body: JSON.stringify({
        ...payload,
        timestamp: new Date().toISOString(),
        service: 'voice-synthesis-service'
      }),
      timeout: 10000 // 10 second timeout
    });

    if (!response.ok) {
      console.error(`Callback failed: ${response.status} ${response.statusText}`);
      console.error('Response:', await response.text());
    } else {
      console.log(`[${payload.idempotencyKey}] Callback successful: ${response.status}`);
    }
  } catch (error) {
    console.error(`[${payload.idempotencyKey}] Callback error:`, error);
  }
}

function getErrorType(error) {
  if (error.message?.includes('quota') || error.message?.includes('limit')) {
    return 'quota_exceeded';
  }
  if (error.message?.includes('timeout')) {
    return 'timeout';
  }
  if (error.message?.includes('unauthorized') || error.message?.includes('authentication')) {
    return 'authentication_error';
  }
  if (error.message?.includes('Supabase')) {
    return 'storage_error';
  }
  if (error.message?.includes('ElevenLabs') || error.message?.includes('API')) {
    return 'synthesis_error';
  }
  return 'unknown_error';
}

// Error handling for uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

app.listen(PORT, () => {
  console.log(`🎙️  VoiceSynthesisService v1.0.0 listening on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🔐 API Key protection: ${SERVICE_API_KEY ? 'ENABLED' : 'DISABLED'}`);
  console.log(`🎵 ElevenLabs: ${ELEVENLABS_API_KEY ? 'CONFIGURED' : 'NOT CONFIGURED'}`);
  console.log(`💾 Supabase: ${SUPABASE_URL ? 'CONFIGURED' : 'NOT CONFIGURED'}`);
});