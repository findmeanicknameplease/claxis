'use client';

import { useState, useEffect, useCallback } from 'react';
import { getWebSocketManager, RealtimeEvent, VoiceAgentEvent } from '@/lib/realtime/websocket-manager';

export interface VoiceAgentStatus {
  isOnline: boolean;
  currentCalls: number;
  totalCallsToday: number;
  averageResponseTime: number;
  successRate: number;
  activeLanguage: string;
  isConnected: boolean;
  lastUpdate: Date | null;
}

export interface VoiceAgentMetrics {
  callsThisHour: number;
  callsToday: number;
  callsThisWeek: number;
  avgResponseTime: number;
  successRate: number;
  spamBlocked: number;
  busyHours: Array<{ hour: number; count: number }>;
}

const initialStatus: VoiceAgentStatus = {
  isOnline: false,
  currentCalls: 0,
  totalCallsToday: 0,
  averageResponseTime: 0,
  successRate: 0,
  activeLanguage: 'de',
  isConnected: false,
  lastUpdate: null,
};

export function useVoiceAgentStatus() {
  const [status, setStatus] = useState<VoiceAgentStatus>(initialStatus);
  const [metrics, setMetrics] = useState<VoiceAgentMetrics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const handleVoiceAgentEvent = useCallback((event: RealtimeEvent) => {
    setError(null);
    
    // Type guard to ensure this is a voice agent event
    if (event.type !== 'voice_agent_status' && event.type !== 'call_started' && event.type !== 'call_ended' && event.type !== 'call_progress') {
      return;
    }
    
    const voiceEvent = event as VoiceAgentEvent;
    
    switch (voiceEvent.type) {
      case 'voice_agent_status':
        setStatus(prev => ({
          ...prev,
          isOnline: voiceEvent.payload.status === 'online',
          currentCalls: voiceEvent.payload.currentCalls,
          averageResponseTime: voiceEvent.payload.responseTime || prev.averageResponseTime,
          activeLanguage: voiceEvent.payload.language || prev.activeLanguage,
          isConnected: true,
          lastUpdate: new Date(),
        }));
        setIsLoading(false);
        break;

      case 'call_started':
        setStatus(prev => ({
          ...prev,
          currentCalls: prev.currentCalls + 1,
          totalCallsToday: prev.totalCallsToday + 1,
          lastUpdate: new Date(),
        }));
        break;

      case 'call_ended':
        setStatus(prev => ({
          ...prev,
          currentCalls: Math.max(0, prev.currentCalls - 1),
          lastUpdate: new Date(),
        }));
        break;

      case 'call_progress':
        setStatus(prev => ({
          ...prev,
          averageResponseTime: event.payload.responseTime || prev.averageResponseTime,
          lastUpdate: new Date(),
        }));
        break;
    }
  }, []);

  const fetchInitialMetrics = useCallback(async () => {
    try {
      const response = await fetch('/api/voice-agent/metrics');
      if (response.ok) {
        const data = await response.json();
        setMetrics(data);
        setStatus(prev => ({
          ...prev,
          totalCallsToday: data.callsToday,
          averageResponseTime: data.avgResponseTime,
          successRate: data.successRate,
        }));
      }
    } catch (error) {
      console.error('Failed to fetch initial metrics:', error);
      setError('Failed to load voice agent metrics');
    }
  }, []);

  useEffect(() => {
    const wsManager = getWebSocketManager();
    
    // Subscribe to voice agent events
    const unsubscribeStatus = wsManager.subscribe('voice_agent_status', handleVoiceAgentEvent);
    const unsubscribeCallStart = wsManager.subscribe('call_started', handleVoiceAgentEvent);
    const unsubscribeCallEnd = wsManager.subscribe('call_ended', handleVoiceAgentEvent);
    const unsubscribeCallProgress = wsManager.subscribe('call_progress', handleVoiceAgentEvent);

    // Connect WebSocket
    wsManager.connect()
      .then(() => {
        setStatus(prev => ({ ...prev, isConnected: true }));
        fetchInitialMetrics();
        
        // Request current status
        wsManager.send({
          type: 'request_voice_agent_status',
          payload: {},
        });
      })
      .catch((error) => {
        console.error('WebSocket connection failed:', error);
        setError('Failed to connect to real-time updates');
        setIsLoading(false);
      });

    return () => {
      unsubscribeStatus();
      unsubscribeCallStart();
      unsubscribeCallEnd();
      unsubscribeCallProgress();
    };
  }, [handleVoiceAgentEvent, fetchInitialMetrics]);

  const refreshMetrics = useCallback(async () => {
    await fetchInitialMetrics();
  }, [fetchInitialMetrics]);

  const toggleVoiceAgent = useCallback(async (enabled: boolean) => {
    try {
      const response = await fetch('/api/voice-agent/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled }),
      });

      if (!response.ok) {
        throw new Error('Failed to toggle voice agent');
      }

      // Optimistic update
      setStatus(prev => ({
        ...prev,
        isOnline: enabled,
        lastUpdate: new Date(),
      }));
    } catch (error) {
      console.error('Failed to toggle voice agent:', error);
      setError('Failed to toggle voice agent');
    }
  }, []);

  const changeLanguage = useCallback(async (language: string) => {
    try {
      const response = await fetch('/api/voice-agent/language', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language }),
      });

      if (!response.ok) {
        throw new Error('Failed to change language');
      }

      setStatus(prev => ({
        ...prev,
        activeLanguage: language,
        lastUpdate: new Date(),
      }));
    } catch (error) {
      console.error('Failed to change language:', error);
      setError('Failed to change language');
    }
  }, []);

  return {
    status,
    metrics,
    error,
    isLoading,
    refreshMetrics,
    toggleVoiceAgent,
    changeLanguage,
  };
}