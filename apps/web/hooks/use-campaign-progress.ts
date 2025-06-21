'use client';

import { useState, useEffect, useCallback } from 'react';
import { getWebSocketManager, RealtimeEvent } from '@/lib/realtime/websocket-manager';

export interface Campaign {
  id: string;
  name: string;
  type: 'review-requests' | 'reactivation' | 'follow-up' | 'promotional' | 'missed-call-callback';
  status: 'pending' | 'running' | 'completed' | 'paused' | 'error';
  progress: number;
  totalTargets: number;
  completed: number;
  failed: number;
  successRate: number;
  estimatedCompletion: Date | null;
  createdAt: Date;
  startedAt: Date | null;
  completedAt: Date | null;
}

export interface CampaignMetrics {
  activeCampaigns: number;
  completedToday: number;
  totalCalls: number;
  averageSuccessRate: number;
  topPerformingType: string;
  recentActivity: Array<{
    campaignId: string;
    name: string;
    action: string;
    timestamp: Date;
  }>;
}

export function useCampaignProgress() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [metrics, setMetrics] = useState<CampaignMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const handleCampaignEvent = useCallback((event: RealtimeEvent) => {
    // Type guard: only handle campaign events
    if (event.type !== 'campaign_progress' && event.type !== 'campaign_completed' && event.type !== 'campaign_error') {
      return;
    }
    setError(null);
    
    switch (event.type) {
      case 'campaign_progress':
        setCampaigns(prev => 
          prev.map(campaign => 
            campaign.id === event.payload.campaignId
              ? {
                  ...campaign,
                  progress: event.payload.progress,
                  completed: event.payload.completed,
                  failed: event.payload.failed,
                  status: event.payload.status,
                  successRate: event.payload.completed / (event.payload.completed + event.payload.failed) * 100,
                }
              : campaign
          )
        );
        break;

      case 'campaign_completed':
        setCampaigns(prev => 
          prev.map(campaign => 
            campaign.id === event.payload.campaignId
              ? {
                  ...campaign,
                  status: 'completed',
                  progress: 100,
                  completed: event.payload.completed,
                  failed: event.payload.failed,
                  completedAt: new Date(),
                  successRate: event.payload.completed / (event.payload.completed + event.payload.failed) * 100,
                }
              : campaign
          )
        );
        break;

      case 'campaign_error':
        setCampaigns(prev => 
          prev.map(campaign => 
            campaign.id === event.payload.campaignId
              ? {
                  ...campaign,
                  status: 'error',
                  failed: event.payload.failed,
                }
              : campaign
          )
        );
        break;
    }
  }, []);

  const fetchCampaigns = useCallback(async () => {
    try {
      const response = await fetch('/api/campaigns');
      if (response.ok) {
        const data = await response.json();
        setCampaigns(data.campaigns || []);
        setMetrics(data.metrics || null);
      } else {
        throw new Error('Failed to fetch campaigns');
      }
    } catch (error) {
      console.error('Failed to fetch campaigns:', error);
      setError('Failed to load campaigns');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const wsManager = getWebSocketManager();
    
    // Subscribe to campaign events
    const unsubscribeProgress = wsManager.subscribe('campaign_progress', handleCampaignEvent);
    const unsubscribeCompleted = wsManager.subscribe('campaign_completed', handleCampaignEvent);
    const unsubscribeError = wsManager.subscribe('campaign_error', handleCampaignEvent);

    // Connect and fetch initial data
    wsManager.connect()
      .then(() => {
        fetchCampaigns();
      })
      .catch((error) => {
        console.error('WebSocket connection failed:', error);
        setError('Failed to connect to real-time updates');
        // Still try to fetch campaigns without real-time updates
        fetchCampaigns();
      });

    return () => {
      unsubscribeProgress();
      unsubscribeCompleted();
      unsubscribeError();
    };
  }, [handleCampaignEvent, fetchCampaigns]);

  const createCampaign = useCallback(async (campaignData: {
    name: string;
    type: Campaign['type'];
    targets: string[];
    template?: string;
    scheduleAt?: Date;
  }) => {
    try {
      const response = await fetch('/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(campaignData),
      });

      if (!response.ok) {
        throw new Error('Failed to create campaign');
      }

      const newCampaign = await response.json();
      setCampaigns(prev => [newCampaign, ...prev]);
      return newCampaign;
    } catch (error) {
      console.error('Failed to create campaign:', error);
      setError('Failed to create campaign');
      throw error;
    }
  }, []);

  const pauseCampaign = useCallback(async (campaignId: string) => {
    try {
      const response = await fetch(`/api/campaigns/${campaignId}/pause`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to pause campaign');
      }

      setCampaigns(prev => 
        prev.map(campaign => 
          campaign.id === campaignId
            ? { ...campaign, status: 'paused' }
            : campaign
        )
      );
    } catch (error) {
      console.error('Failed to pause campaign:', error);
      setError('Failed to pause campaign');
    }
  }, []);

  const resumeCampaign = useCallback(async (campaignId: string) => {
    try {
      const response = await fetch(`/api/campaigns/${campaignId}/resume`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to resume campaign');
      }

      setCampaigns(prev => 
        prev.map(campaign => 
          campaign.id === campaignId
            ? { ...campaign, status: 'running' }
            : campaign
        )
      );
    } catch (error) {
      console.error('Failed to resume campaign:', error);
      setError('Failed to resume campaign');
    }
  }, []);

  const deleteCampaign = useCallback(async (campaignId: string) => {
    try {
      const response = await fetch(`/api/campaigns/${campaignId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete campaign');
      }

      setCampaigns(prev => prev.filter(campaign => campaign.id !== campaignId));
    } catch (error) {
      console.error('Failed to delete campaign:', error);
      setError('Failed to delete campaign');
    }
  }, []);

  const refreshCampaigns = useCallback(() => {
    fetchCampaigns();
  }, [fetchCampaigns]);

  // Helper functions
  const getActiveCampaigns = useCallback(() => {
    return campaigns.filter(c => c.status === 'running' || c.status === 'pending');
  }, [campaigns]);

  const getCompletedCampaigns = useCallback(() => {
    return campaigns.filter(c => c.status === 'completed');
  }, [campaigns]);

  const getCampaignsByType = useCallback((type: Campaign['type']) => {
    return campaigns.filter(c => c.type === type);
  }, [campaigns]);

  return {
    campaigns,
    metrics,
    isLoading,
    error,
    createCampaign,
    pauseCampaign,
    resumeCampaign,
    deleteCampaign,
    refreshCampaigns,
    getActiveCampaigns,
    getCompletedCampaigns,
    getCampaignsByType,
  };
}