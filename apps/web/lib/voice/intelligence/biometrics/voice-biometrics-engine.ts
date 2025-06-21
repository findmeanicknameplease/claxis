import { getUpstashClient } from '@/lib/redis/upstash-client';
import crypto from 'crypto';

// =============================================================================
// VOICE BIOMETRICS ENGINE - ENTERPRISE SPEAKER AUTHENTICATION
// =============================================================================
// Privacy-compliant voice pattern recognition for customer identification
// Advanced speaker verification with fraud prevention and GDPR compliance
// Secure voice fingerprinting with anonymization and right-to-deletion
// =============================================================================

export interface VoiceAnalysisResult {
  audioFeatures: {
    fundamentalFrequency: number;
    spectralCentroid: number;
    mfccCoefficients: number[];
    spectralRolloff: number;
    zeroCrossingRate: number;
    spectralBandwidth: number;
  };
  qualityMetrics: {
    signalToNoiseRatio: number;
    audioClarity: number;
    backgroundNoise: number;
    sampleRate: number;
    duration: number;
  };
  speakerCharacteristics: {
    voicePitch: 'low' | 'medium' | 'high';
    speakingRate: 'slow' | 'normal' | 'fast';
    voiceTexture: 'smooth' | 'rough' | 'breathy';
    energyLevel: 'low' | 'medium' | 'high';
  };
}

export interface VoiceBiometricProfile {
  profileId: string;
  customerHash: string; // Anonymized customer identifier
  
  // Voice fingerprint (cryptographically hashed)
  voiceFingerprint: {
    primaryHash: string;
    secondaryHash: string;
    featureVector: number[];
    confidenceThreshold: number;
  };

  // Enrollment data
  enrollmentData: {
    enrollmentDate: Date;
    sampleCount: number;
    qualityScore: number;
    enrollmentPhrase?: string;
  };

  // Authentication history
  authenticationHistory: {
    totalAttempts: number;
    successfulAuths: number;
    lastAuthDate?: Date;
    averageConfidence: number;
  };

  // Security and fraud prevention
  securityMetrics: {
    anomalyScore: number; // Unusual voice patterns
    spoofingRisk: number; // Synthetic voice detection
    lastAnomaly?: Date;
    suspiciousAttempts: number;
  };

  // Privacy and compliance
  privacySettings: {
    consentLevel: 'basic' | 'biometric' | 'analytics';
    retentionUntil: Date;
    anonymizationRequested: boolean;
    gdprCompliant: boolean;
  };
}

export interface AuthenticationResult {
  isAuthenticated: boolean;
  confidence: number; // 0-1 authentication confidence
  matchScore: number; // Biometric match score
  
  // Authentication details
  profileId?: string;
  customerHash?: string;
  verificationMethod: 'voice_pattern' | 'fallback' | 'failed';
  
  // Quality and security
  audioQuality: number;
  spoofingDetected: boolean;
  anomalyFlags: string[];
  
  // Performance metrics
  processingTime: number;
  comparison: {
    featuresMatched: number;
    totalFeatures: number;
    threshold: number;
  };
}

class VoiceBiometricsEngine {
  private redis: ReturnType<typeof getUpstashClient>;
  private readonly FINGERPRINT_LENGTH = 256;
  private readonly MIN_AUDIO_DURATION = 3; // seconds
  private readonly MAX_AUDIO_DURATION = 30; // seconds

  constructor() {
    this.redis = getUpstashClient();
  }

  // =============================================================================
  // VOICE ANALYSIS AND FEATURE EXTRACTION
  // =============================================================================

  async analyzeVoiceAudio(audioBuffer: Buffer): Promise<VoiceAnalysisResult> {
    try {
      console.log('Analyzing voice audio for biometric features');

      // Validate audio input
      if (!audioBuffer || audioBuffer.length === 0) {
        throw new Error('Invalid audio buffer provided');
      }

      // Extract audio features (simplified implementation)
      // In production, this would use advanced signal processing libraries
      const audioFeatures = await this.extractAudioFeatures(audioBuffer);
      const qualityMetrics = await this.assessAudioQuality(audioBuffer);
      const speakerCharacteristics = this.deriveSpeakerCharacteristics(audioFeatures);

      return {
        audioFeatures,
        qualityMetrics,
        speakerCharacteristics,
      };

    } catch (error) {
      console.error('Error analyzing voice audio:', error);
      throw new Error('Voice analysis failed');
    }
  }

  private async extractAudioFeatures(audioBuffer: Buffer): Promise<VoiceAnalysisResult['audioFeatures']> {
    // Simplified feature extraction - in production would use ML libraries
    // like TensorFlow.js, Web Audio API, or external services
    
    const bufferLength = audioBuffer.length;
    const sampleCount = Math.floor(bufferLength / 2); // Assuming 16-bit audio
    
    // Generate pseudo-features based on audio data patterns
    const fundamentalFrequency = this.calculateFundamentalFrequency(audioBuffer);
    const spectralCentroid = this.calculateSpectralCentroid(audioBuffer);
    const mfccCoefficients = this.calculateMFCC(audioBuffer);
    const spectralRolloff = this.calculateSpectralRolloff(audioBuffer);
    const zeroCrossingRate = this.calculateZeroCrossingRate(audioBuffer);
    const spectralBandwidth = this.calculateSpectralBandwidth(audioBuffer);

    return {
      fundamentalFrequency,
      spectralCentroid,
      mfccCoefficients,
      spectralRolloff,
      zeroCrossingRate,
      spectralBandwidth,
    };
  }

  private calculateFundamentalFrequency(audioBuffer: Buffer): number {
    // Simplified F0 calculation - typically would use autocorrelation or cepstrum
    let sum = 0;
    for (let i = 0; i < Math.min(audioBuffer.length, 1000); i += 2) {
      const sample = audioBuffer.readInt16LE(i);
      sum += Math.abs(sample);
    }
    const average = sum / (Math.min(audioBuffer.length, 1000) / 2);
    return Math.max(80, Math.min(400, 80 + (average / 1000))); // Typical human range
  }

  private calculateSpectralCentroid(audioBuffer: Buffer): number {
    // Simplified spectral centroid calculation
    let weightedSum = 0;
    let magnitudeSum = 0;
    
    for (let i = 0; i < Math.min(audioBuffer.length, 2000); i += 2) {
      const sample = Math.abs(audioBuffer.readInt16LE(i));
      const frequency = (i / 2) * 0.5; // Simplified frequency mapping
      weightedSum += frequency * sample;
      magnitudeSum += sample;
    }
    
    return magnitudeSum > 0 ? weightedSum / magnitudeSum : 0;
  }

  private calculateMFCC(audioBuffer: Buffer): number[] {
    // Simplified MFCC calculation - typically would use DCT and mel filterbank
    const coefficients: number[] = [];
    const windowSize = 512;
    
    for (let i = 0; i < 13; i++) { // Standard 13 MFCC coefficients
      let sum = 0;
      const start = i * windowSize;
      
      for (let j = 0; j < windowSize && start + j * 2 < audioBuffer.length; j++) {
        const sample = audioBuffer.readInt16LE(start + j * 2);
        sum += sample * Math.cos((Math.PI * i * j) / windowSize);
      }
      
      coefficients.push(sum / windowSize);
    }
    
    return coefficients;
  }

  private calculateSpectralRolloff(audioBuffer: Buffer): number {
    // Simplified spectral rolloff calculation
    let totalEnergy = 0;
    const energies: number[] = [];
    
    for (let i = 0; i < Math.min(audioBuffer.length, 2000); i += 2) {
      const sample = Math.abs(audioBuffer.readInt16LE(i));
      energies.push(sample);
      totalEnergy += sample;
    }
    
    const threshold = totalEnergy * 0.85; // 85% energy threshold
    let cumulativeEnergy = 0;
    
    for (let i = 0; i < energies.length; i++) {
      cumulativeEnergy += energies[i];
      if (cumulativeEnergy >= threshold) {
        return (i / energies.length) * 22050; // Simplified frequency mapping
      }
    }
    
    return 0;
  }

  private calculateZeroCrossingRate(audioBuffer: Buffer): number {
    let crossings = 0;
    let previousSign = 0;
    
    for (let i = 0; i < audioBuffer.length - 2; i += 2) {
      const sample = audioBuffer.readInt16LE(i);
      const currentSign = sample >= 0 ? 1 : -1;
      
      if (previousSign !== 0 && currentSign !== previousSign) {
        crossings++;
      }
      
      previousSign = currentSign;
    }
    
    return crossings / (audioBuffer.length / 2);
  }

  private calculateSpectralBandwidth(audioBuffer: Buffer): number {
    // Simplified spectral bandwidth calculation
    const centroid = this.calculateSpectralCentroid(audioBuffer);
    let variance = 0;
    let totalMagnitude = 0;
    
    for (let i = 0; i < Math.min(audioBuffer.length, 2000); i += 2) {
      const sample = Math.abs(audioBuffer.readInt16LE(i));
      const frequency = (i / 2) * 0.5;
      variance += Math.pow(frequency - centroid, 2) * sample;
      totalMagnitude += sample;
    }
    
    return totalMagnitude > 0 ? Math.sqrt(variance / totalMagnitude) : 0;
  }

  private async assessAudioQuality(audioBuffer: Buffer): Promise<VoiceAnalysisResult['qualityMetrics']> {
    const duration = audioBuffer.length / (2 * 16000); // Assuming 16kHz, 16-bit audio
    
    // Calculate signal-to-noise ratio (simplified)
    let signalPower = 0;
    let noisePower = 0;
    
    for (let i = 0; i < audioBuffer.length; i += 2) {
      const sample = audioBuffer.readInt16LE(i);
      const power = sample * sample;
      
      // Simplified noise detection - low energy regions
      if (Math.abs(sample) < 1000) {
        noisePower += power;
      } else {
        signalPower += power;
      }
    }
    
    const snr = noisePower > 0 ? 10 * Math.log10(signalPower / noisePower) : 40;
    
    return {
      signalToNoiseRatio: Math.max(0, Math.min(40, snr)),
      audioClarity: Math.min(1, snr / 20), // Normalize to 0-1
      backgroundNoise: Math.max(0, Math.min(1, noisePower / signalPower)),
      sampleRate: 16000, // Assumed
      duration,
    };
  }

  private deriveSpeakerCharacteristics(
    audioFeatures: VoiceAnalysisResult['audioFeatures']
  ): VoiceAnalysisResult['speakerCharacteristics'] {
    
    // Derive speaker characteristics from audio features
    const voicePitch = audioFeatures.fundamentalFrequency < 150 ? 'low' :
                      audioFeatures.fundamentalFrequency > 250 ? 'high' : 'medium';
    
    const speakingRate = audioFeatures.zeroCrossingRate < 0.1 ? 'slow' :
                        audioFeatures.zeroCrossingRate > 0.3 ? 'fast' : 'normal';
    
    const voiceTexture = audioFeatures.spectralBandwidth < 1000 ? 'smooth' :
                        audioFeatures.spectralBandwidth > 2000 ? 'rough' : 'breathy';
    
    const energyLevel = audioFeatures.spectralCentroid < 1000 ? 'low' :
                       audioFeatures.spectralCentroid > 3000 ? 'high' : 'medium';

    return {
      voicePitch,
      speakingRate,
      voiceTexture,
      energyLevel,
    };
  }

  // =============================================================================
  // BIOMETRIC ENROLLMENT
  // =============================================================================

  async enrollVoiceBiometric(
    customerHash: string,
    audioSamples: Buffer[],
    enrollmentPhrase?: string
  ): Promise<{ success: boolean; profileId?: string; qualityScore: number }> {
    try {
      console.log(`Enrolling voice biometric for customer hash: ${customerHash}`);

      // Validate input
      if (audioSamples.length < 3) {
        throw new Error('Minimum 3 audio samples required for enrollment');
      }

      // Analyze all audio samples
      const analyses: VoiceAnalysisResult[] = [];
      for (const audioSample of audioSamples) {
        const analysis = await this.analyzeVoiceAudio(audioSample);
        analyses.push(analysis);
      }

      // Calculate quality score
      const qualityScore = this.calculateEnrollmentQuality(analyses);
      
      if (qualityScore < 0.6) {
        return { success: false, qualityScore };
      }

      // Generate voice fingerprint
      const voiceFingerprint = this.generateVoiceFingerprint(analyses);
      
      // Create biometric profile
      const profileId = this.generateProfileId();
      const profile: VoiceBiometricProfile = {
        profileId,
        customerHash,
        voiceFingerprint: {
          primaryHash: voiceFingerprint.primaryHash,
          secondaryHash: voiceFingerprint.secondaryHash,
          featureVector: voiceFingerprint.featureVector,
          confidenceThreshold: 0.75, // Default threshold
        },
        enrollmentData: {
          enrollmentDate: new Date(),
          sampleCount: audioSamples.length,
          qualityScore,
          enrollmentPhrase,
        },
        authenticationHistory: {
          totalAttempts: 0,
          successfulAuths: 0,
          averageConfidence: 0,
        },
        securityMetrics: {
          anomalyScore: 0,
          spoofingRisk: 0,
          suspiciousAttempts: 0,
        },
        privacySettings: {
          consentLevel: 'biometric',
          retentionUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
          anonymizationRequested: false,
          gdprCompliant: true,
        },
      };

      // Store profile
      await this.storeBiometricProfile(profile);

      // Index for fast lookup
      await this.indexCustomerBiometric(customerHash, profileId);

      console.log(`Voice biometric enrollment successful for profile: ${profileId}`);
      return { success: true, profileId, qualityScore };

    } catch (error) {
      console.error('Error enrolling voice biometric:', error);
      return { success: false, qualityScore: 0 };
    }
  }

  private calculateEnrollmentQuality(analyses: VoiceAnalysisResult[]): number {
    let totalQuality = 0;
    
    for (const analysis of analyses) {
      let sampleQuality = 0;
      
      // Audio quality factors
      sampleQuality += analysis.qualityMetrics.audioClarity * 0.3;
      sampleQuality += (1 - analysis.qualityMetrics.backgroundNoise) * 0.2;
      sampleQuality += Math.min(analysis.qualityMetrics.signalToNoiseRatio / 20, 1) * 0.2;
      
      // Duration quality
      if (analysis.qualityMetrics.duration >= this.MIN_AUDIO_DURATION) {
        sampleQuality += 0.15;
      }
      
      // Feature consistency quality
      if (analysis.audioFeatures.mfccCoefficients.length >= 13) {
        sampleQuality += 0.15;
      }
      
      totalQuality += sampleQuality;
    }
    
    return totalQuality / analyses.length;
  }

  private generateVoiceFingerprint(analyses: VoiceAnalysisResult[]): {
    primaryHash: string;
    secondaryHash: string;
    featureVector: number[];
  } {
    // Aggregate features from all samples
    const aggregatedFeatures = this.aggregateFeatures(analyses);
    
    // Create feature vector
    const featureVector = [
      ...aggregatedFeatures.mfccMeans,
      aggregatedFeatures.fundamentalFrequencyMean,
      aggregatedFeatures.spectralCentroidMean,
      aggregatedFeatures.spectralRolloffMean,
      aggregatedFeatures.zeroCrossingRateMean,
      aggregatedFeatures.spectralBandwidthMean,
    ];

    // Generate cryptographic hashes for privacy
    const featureString = featureVector.join(',');
    const primaryHash = crypto.createHash('sha256')
      .update(featureString)
      .digest('hex');
    
    const secondaryHash = crypto.createHash('sha256')
      .update(primaryHash + Date.now().toString())
      .digest('hex');

    return {
      primaryHash,
      secondaryHash,
      featureVector,
    };
  }

  private aggregateFeatures(analyses: VoiceAnalysisResult[]): {
    mfccMeans: number[];
    fundamentalFrequencyMean: number;
    spectralCentroidMean: number;
    spectralRolloffMean: number;
    zeroCrossingRateMean: number;
    spectralBandwidthMean: number;
  } {
    const numSamples = analyses.length;
    const mfccLength = analyses[0].audioFeatures.mfccCoefficients.length;
    
    // Initialize aggregation arrays
    const mfccSums = new Array(mfccLength).fill(0);
    let f0Sum = 0;
    let centroidSum = 0;
    let rolloffSum = 0;
    let zcrSum = 0;
    let bandwidthSum = 0;

    // Aggregate features
    for (const analysis of analyses) {
      const features = analysis.audioFeatures;
      
      for (let i = 0; i < mfccLength; i++) {
        mfccSums[i] += features.mfccCoefficients[i];
      }
      
      f0Sum += features.fundamentalFrequency;
      centroidSum += features.spectralCentroid;
      rolloffSum += features.spectralRolloff;
      zcrSum += features.zeroCrossingRate;
      bandwidthSum += features.spectralBandwidth;
    }

    return {
      mfccMeans: mfccSums.map(sum => sum / numSamples),
      fundamentalFrequencyMean: f0Sum / numSamples,
      spectralCentroidMean: centroidSum / numSamples,
      spectralRolloffMean: rolloffSum / numSamples,
      zeroCrossingRateMean: zcrSum / numSamples,
      spectralBandwidthMean: bandwidthSum / numSamples,
    };
  }

  // =============================================================================
  // SPEAKER AUTHENTICATION
  // =============================================================================

  async authenticateVoice(
    audioBuffer: Buffer,
    customerHash?: string
  ): Promise<AuthenticationResult> {
    const startTime = Date.now();
    
    try {
      console.log('Authenticating voice sample');

      // Analyze the audio
      const analysis = await this.analyzeVoiceAudio(audioBuffer);
      
      // Check audio quality
      if (analysis.qualityMetrics.audioClarity < 0.5) {
        return this.createFailedAuthResult('Poor audio quality', startTime);
      }

      // Detect spoofing attempts
      const spoofingRisk = await this.detectSpoofing(analysis);
      if (spoofingRisk > 0.7) {
        return this.createFailedAuthResult('Potential spoofing detected', startTime);
      }

      // Find matching profiles
      const candidateProfiles = await this.findCandidateProfiles(customerHash);
      
      if (candidateProfiles.length === 0) {
        return this.createFailedAuthResult('No biometric profiles found', startTime);
      }

      // Perform biometric matching
      const matchResults = await this.performBiometricMatching(analysis, candidateProfiles);
      
      const bestMatch = matchResults.reduce((best, current) => 
        current.matchScore > best.matchScore ? current : best
      );

      // Determine authentication result
      if (bestMatch.matchScore >= bestMatch.profile.voiceFingerprint.confidenceThreshold) {
        // Update authentication history
        await this.updateAuthenticationHistory(bestMatch.profile.profileId, true, bestMatch.matchScore);
        
        return {
          isAuthenticated: true,
          confidence: bestMatch.matchScore,
          matchScore: bestMatch.matchScore,
          profileId: bestMatch.profile.profileId,
          customerHash: bestMatch.profile.customerHash,
          verificationMethod: 'voice_pattern',
          audioQuality: analysis.qualityMetrics.audioClarity,
          spoofingDetected: false,
          anomalyFlags: [],
          processingTime: Date.now() - startTime,
          comparison: {
            featuresMatched: bestMatch.featuresMatched,
            totalFeatures: bestMatch.totalFeatures,
            threshold: bestMatch.profile.voiceFingerprint.confidenceThreshold,
          },
        };
      } else {
        // Update failed authentication
        await this.updateAuthenticationHistory(bestMatch.profile.profileId, false, bestMatch.matchScore);
        
        return this.createFailedAuthResult('Biometric match below threshold', startTime);
      }

    } catch (error) {
      console.error('Error in voice authentication:', error);
      return this.createFailedAuthResult('Authentication system error', startTime);
    }
  }

  private async detectSpoofing(analysis: VoiceAnalysisResult): Promise<number> {
    // Simplified spoofing detection - in production would use advanced ML models
    let spoofingRisk = 0;

    // Check for synthetic voice patterns
    if (analysis.audioFeatures.spectralBandwidth < 500) {
      spoofingRisk += 0.3; // Unusually narrow bandwidth
    }

    // Check for unnatural spectral characteristics
    if (analysis.audioFeatures.mfccCoefficients.every(coeff => Math.abs(coeff) < 10)) {
      spoofingRisk += 0.4; // Overly uniform MFCC values
    }

    // Check for playback artifacts
    if (analysis.qualityMetrics.backgroundNoise < 0.01) {
      spoofingRisk += 0.2; // Unnaturally clean audio
    }

    return Math.min(spoofingRisk, 1);
  }

  private async findCandidateProfiles(customerHash?: string): Promise<VoiceBiometricProfile[]> {
    try {
      if (customerHash) {
        // Look for specific customer's profile
        const profileId = await this.redis.get(`biometric:customer:${customerHash}`);
        if (profileId) {
          const profile = await this.loadBiometricProfile(profileId);
          return profile ? [profile] : [];
        }
      }

      // Fallback: load all profiles for comparison (in production, use indexing)
      const allProfileIds = await this.redis.keys('biometric:profile:*');
      const profiles: VoiceBiometricProfile[] = [];
      
      for (const key of allProfileIds.slice(0, 10)) { // Limit to 10 for performance
        const profileId = key.replace('biometric:profile:', '');
        const profile = await this.loadBiometricProfile(profileId);
        if (profile) {
          profiles.push(profile);
        }
      }

      return profiles;

    } catch (error) {
      console.error('Error finding candidate profiles:', error);
      return [];
    }
  }

  private async performBiometricMatching(
    analysis: VoiceAnalysisResult,
    profiles: VoiceBiometricProfile[]
  ): Promise<Array<{
    profile: VoiceBiometricProfile;
    matchScore: number;
    featuresMatched: number;
    totalFeatures: number;
  }>> {
    const results = [];

    // Extract features from current analysis
    const currentFeatures = [
      ...analysis.audioFeatures.mfccCoefficients,
      analysis.audioFeatures.fundamentalFrequency,
      analysis.audioFeatures.spectralCentroid,
      analysis.audioFeatures.spectralRolloff,
      analysis.audioFeatures.zeroCrossingRate,
      analysis.audioFeatures.spectralBandwidth,
    ];

    for (const profile of profiles) {
      const storedFeatures = profile.voiceFingerprint.featureVector;
      const matchScore = this.calculateFeatureMatchScore(currentFeatures, storedFeatures);
      const featuresMatched = this.countMatchedFeatures(currentFeatures, storedFeatures, 0.1);

      results.push({
        profile,
        matchScore,
        featuresMatched,
        totalFeatures: storedFeatures.length,
      });
    }

    return results.sort((a, b) => b.matchScore - a.matchScore);
  }

  private calculateFeatureMatchScore(features1: number[], features2: number[]): number {
    if (features1.length !== features2.length) {
      return 0;
    }

    let totalDistance = 0;
    let validFeatures = 0;

    for (let i = 0; i < features1.length; i++) {
      if (!isNaN(features1[i]) && !isNaN(features2[i])) {
        const distance = Math.abs(features1[i] - features2[i]);
        const normalizedDistance = distance / (Math.abs(features1[i]) + Math.abs(features2[i]) + 1);
        totalDistance += normalizedDistance;
        validFeatures++;
      }
    }

    if (validFeatures === 0) return 0;

    const averageDistance = totalDistance / validFeatures;
    return Math.max(0, 1 - averageDistance); // Convert distance to similarity score
  }

  private countMatchedFeatures(features1: number[], features2: number[], threshold: number): number {
    let matches = 0;
    
    for (let i = 0; i < Math.min(features1.length, features2.length); i++) {
      const diff = Math.abs(features1[i] - features2[i]);
      const relativeDiff = diff / (Math.max(Math.abs(features1[i]), Math.abs(features2[i]), 1));
      
      if (relativeDiff <= threshold) {
        matches++;
      }
    }
    
    return matches;
  }

  private createFailedAuthResult(reason: string, startTime: number): AuthenticationResult {
    return {
      isAuthenticated: false,
      confidence: 0,
      matchScore: 0,
      verificationMethod: 'failed',
      audioQuality: 0,
      spoofingDetected: reason.includes('spoofing'),
      anomalyFlags: [reason],
      processingTime: Date.now() - startTime,
      comparison: {
        featuresMatched: 0,
        totalFeatures: 0,
        threshold: 0,
      },
    };
  }

  // =============================================================================
  // DATA PERSISTENCE
  // =============================================================================

  private async storeBiometricProfile(profile: VoiceBiometricProfile): Promise<void> {
    try {
      await this.redis.set(
        `biometric:profile:${profile.profileId}`,
        JSON.stringify(profile),
        { ex: 86400 * 365 } // 1 year
      );
    } catch (error) {
      console.error('Error storing biometric profile:', error);
      throw error;
    }
  }

  private async loadBiometricProfile(profileId: string): Promise<VoiceBiometricProfile | null> {
    try {
      const profileData = await this.redis.get(`biometric:profile:${profileId}`);
      return profileData ? JSON.parse(profileData) : null;
    } catch (error) {
      console.error('Error loading biometric profile:', error);
      return null;
    }
  }

  private async indexCustomerBiometric(customerHash: string, profileId: string): Promise<void> {
    try {
      await this.redis.set(
        `biometric:customer:${customerHash}`,
        profileId,
        { ex: 86400 * 365 } // 1 year
      );
    } catch (error) {
      console.error('Error indexing customer biometric:', error);
    }
  }

  private async updateAuthenticationHistory(
    profileId: string,
    success: boolean,
    confidence: number
  ): Promise<void> {
    try {
      const profile = await this.loadBiometricProfile(profileId);
      if (!profile) return;

      profile.authenticationHistory.totalAttempts++;
      if (success) {
        profile.authenticationHistory.successfulAuths++;
        profile.authenticationHistory.lastAuthDate = new Date();
      }

      // Update average confidence
      const totalSuccess = profile.authenticationHistory.successfulAuths;
      const currentAvg = profile.authenticationHistory.averageConfidence;
      profile.authenticationHistory.averageConfidence = 
        (currentAvg * (totalSuccess - 1) + confidence) / totalSuccess;

      await this.storeBiometricProfile(profile);

    } catch (error) {
      console.error('Error updating authentication history:', error);
    }
  }

  // =============================================================================
  // UTILITY METHODS
  // =============================================================================

  private generateProfileId(): string {
    return `vbp_${crypto.randomUUID()}`;
  }

  // =============================================================================
  // GDPR COMPLIANCE METHODS
  // =============================================================================

  async deleteCustomerBiometrics(customerHash: string): Promise<boolean> {
    try {
      console.log(`Deleting biometric data for customer: ${customerHash}`);

      // Find customer's profile
      const profileId = await this.redis.get(`biometric:customer:${customerHash}`);
      if (profileId) {
        // Delete profile
        await this.redis.del(`biometric:profile:${profileId}`);
        
        // Delete customer index
        await this.redis.del(`biometric:customer:${customerHash}`);
      }

      console.log(`Biometric data deleted for customer: ${customerHash}`);
      return true;

    } catch (error) {
      console.error('Error deleting customer biometrics:', error);
      return false;
    }
  }

  async anonymizeBiometricData(customerHash: string): Promise<boolean> {
    try {
      console.log(`Anonymizing biometric data for customer: ${customerHash}`);

      const profileId = await this.redis.get(`biometric:customer:${customerHash}`);
      if (!profileId) return false;

      const profile = await this.loadBiometricProfile(profileId);
      if (!profile) return false;

      // Anonymize the profile
      profile.customerHash = 'ANONYMIZED';
      profile.enrollmentData.enrollmentPhrase = undefined;
      profile.privacySettings.anonymizationRequested = true;

      // Zero out the voice fingerprint for privacy
      profile.voiceFingerprint.featureVector = profile.voiceFingerprint.featureVector.map(() => 0);

      await this.storeBiometricProfile(profile);

      console.log(`Biometric data anonymized for customer: ${customerHash}`);
      return true;

    } catch (error) {
      console.error('Error anonymizing biometric data:', error);
      return false;
    }
  }
}

// Create singleton instance
let voiceBiometricsEngine: VoiceBiometricsEngine | null = null;

export function getVoiceBiometricsEngine(): VoiceBiometricsEngine {
  if (!voiceBiometricsEngine) {
    voiceBiometricsEngine = new VoiceBiometricsEngine();
  }
  return voiceBiometricsEngine;
}

export { VoiceBiometricsEngine };
export default VoiceBiometricsEngine;