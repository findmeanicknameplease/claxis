'use client';

import { useState, useEffect, useCallback } from 'react';
import { getWebSocketManager, RealtimeEvent } from '@/lib/realtime/websocket-manager';

export interface ServiceHealth {
  name: string;
  status: 'healthy' | 'degraded' | 'down';
  responseTime: number;
  errorCount: number;
  uptime: number;
  lastCheck: Date;
  description: string;
  endpoint?: string;
}

export interface SystemHealth {
  overall: 'healthy' | 'degraded' | 'down';
  services: ServiceHealth[];
  lastUpdate: Date;
  incidentCount: number;
  uptimePercentage: number;
}

const initialServices: ServiceHealth[] = [
  {
    name: 'Voice Gateway Service',
    status: 'healthy',
    responseTime: 0,
    errorCount: 0,
    uptime: 100,
    lastCheck: new Date(),
    description: 'Real-time voice processing WebSocket server',
    endpoint: '/api/health/voice-gateway',
  },
  {
    name: 'ElevenLabs API',
    status: 'healthy',
    responseTime: 0,
    errorCount: 0,
    uptime: 100,
    lastCheck: new Date(),
    description: 'Voice synthesis and conversational AI',
    endpoint: '/api/health/elevenlabs',
  },
  {
    name: 'Twilio Integration',
    status: 'healthy',
    responseTime: 0,
    errorCount: 0,
    uptime: 100,
    lastCheck: new Date(),
    description: 'Phone system and SMS connectivity',
    endpoint: '/api/health/twilio',
  },
  {
    name: 'WhatsApp Business API',
    status: 'healthy',
    responseTime: 0,
    errorCount: 0,
    uptime: 100,
    lastCheck: new Date(),
    description: 'WhatsApp messaging and webhooks',
    endpoint: '/api/health/whatsapp',
  },
  {
    name: 'Supabase Database',
    status: 'healthy',
    responseTime: 0,
    errorCount: 0,
    uptime: 100,
    lastCheck: new Date(),
    description: 'Primary database and authentication',
    endpoint: '/api/health/database',
  },
  {
    name: 'n8n Workflows',
    status: 'healthy',
    responseTime: 0,
    errorCount: 0,
    uptime: 100,
    lastCheck: new Date(),
    description: 'Automation workflow engine',
    endpoint: '/api/health/n8n',
  },
  {
    name: 'Redis Cache',
    status: 'healthy',
    responseTime: 0,
    errorCount: 0,
    uptime: 100,
    lastCheck: new Date(),
    description: 'Campaign queue and caching',
    endpoint: '/api/health/redis',
  },
];

export function useSystemHealth() {
  const [health, setHealth] = useState<SystemHealth>({
    overall: 'healthy',
    services: initialServices,
    lastUpdate: new Date(),
    incidentCount: 0,
    uptimePercentage: 100,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const calculateOverallHealth = useCallback((services: ServiceHealth[]): SystemHealth['overall'] => {
    const downServices = services.filter(s => s.status === 'down').length;
    const degradedServices = services.filter(s => s.status === 'degraded').length;
    
    if (downServices > 0) return 'down';
    if (degradedServices > 1) return 'degraded';
    if (degradedServices === 1) return 'degraded';
    return 'healthy';
  }, []);

  const calculateUptimePercentage = useCallback((services: ServiceHealth[]): number => {
    const totalUptime = services.reduce((sum, service) => sum + service.uptime, 0);
    return totalUptime / services.length;
  }, []);

  const handleSystemHealthEvent = useCallback((event: RealtimeEvent) => {
    setError(null);
    
    // Type guard for system health events
    if (event.type !== 'system_health' && event.type !== 'service_status') {
      return;
    }
    
    switch (event.type) {
      case 'service_status':
        setHealth(prev => {
          const updatedServices = prev.services.map(service => 
            service.name === event.payload.service
              ? {
                  ...service,
                  status: event.payload.status,
                  responseTime: event.payload.responseTime || service.responseTime,
                  errorCount: event.payload.errorCount || service.errorCount,
                  lastCheck: new Date(),
                }
              : service
          );

          return {
            ...prev,
            services: updatedServices,
            overall: calculateOverallHealth(updatedServices),
            uptimePercentage: calculateUptimePercentage(updatedServices),
            lastUpdate: new Date(),
          };
        });
        break;

      case 'system_health':
        // Handle bulk health update
        setHealth(prev => ({
          ...prev,
          overall: event.payload.status,
          lastUpdate: new Date(),
        }));
        break;
    }
  }, [calculateOverallHealth, calculateUptimePercentage]);

  const checkServiceHealth = useCallback(async (service: ServiceHealth): Promise<ServiceHealth> => {
    if (!service.endpoint) return service;

    const startTime = Date.now();
    try {
      const response = await fetch(service.endpoint, {
        method: 'GET',
        headers: { 'Cache-Control': 'no-cache' },
      });

      const responseTime = Date.now() - startTime;
      const status = response.ok ? 'healthy' : (response.status >= 500 ? 'down' : 'degraded');

      return {
        ...service,
        status,
        responseTime,
        errorCount: response.ok ? Math.max(0, service.errorCount - 1) : service.errorCount + 1,
        lastCheck: new Date(),
        uptime: response.ok ? Math.min(100, service.uptime + 0.1) : Math.max(0, service.uptime - 1),
      };
    } catch (error) {
      return {
        ...service,
        status: 'down',
        responseTime: Date.now() - startTime,
        errorCount: service.errorCount + 1,
        lastCheck: new Date(),
        uptime: Math.max(0, service.uptime - 2),
      };
    }
  }, []);

  const checkAllServices = useCallback(async () => {
    const updatedServices = await Promise.all(
      health.services.map(service => checkServiceHealth(service))
    );

    setHealth(prev => ({
      ...prev,
      services: updatedServices,
      overall: calculateOverallHealth(updatedServices),
      uptimePercentage: calculateUptimePercentage(updatedServices),
      lastUpdate: new Date(),
    }));
  }, [health.services, checkServiceHealth, calculateOverallHealth, calculateUptimePercentage]);

  const fetchInitialHealth = useCallback(async () => {
    try {
      const response = await fetch('/api/health/system');
      if (response.ok) {
        const data = await response.json();
        setHealth(prev => ({
          ...prev,
          ...data,
          lastUpdate: new Date(),
        }));
      } else {
        // If system health endpoint fails, check individual services
        await checkAllServices();
      }
    } catch (error) {
      console.error('Failed to fetch system health:', error);
      setError('Failed to load system health');
      // Fallback to individual service checks
      await checkAllServices();
    } finally {
      setIsLoading(false);
    }
  }, [checkAllServices]);

  useEffect(() => {
    const wsManager = getWebSocketManager();
    
    // Subscribe to system health events
    const unsubscribeHealth = wsManager.subscribe('system_health', handleSystemHealthEvent);
    const unsubscribeService = wsManager.subscribe('service_status', handleSystemHealthEvent);

    // Connect and fetch initial data
    wsManager.connect()
      .then(() => {
        fetchInitialHealth();
        
        // Request current system status
        wsManager.send({
          type: 'request_system_health',
          payload: {},
        });
      })
      .catch((error) => {
        console.error('WebSocket connection failed:', error);
        setError('Failed to connect to real-time updates');
        // Still fetch initial health without real-time updates
        fetchInitialHealth();
      });

    // Set up periodic health checks (every 30 seconds)
    const healthCheckInterval = setInterval(() => {
      checkAllServices();
    }, 30000);

    return () => {
      unsubscribeHealth();
      unsubscribeService();
      clearInterval(healthCheckInterval);
    };
  }, [handleSystemHealthEvent, fetchInitialHealth, checkAllServices]);

  const refreshHealth = useCallback(() => {
    setIsLoading(true);
    fetchInitialHealth();
  }, [fetchInitialHealth]);

  const getServicesByStatus = useCallback((status: ServiceHealth['status']) => {
    return health.services.filter(service => service.status === status);
  }, [health.services]);

  const getCriticalServices = useCallback(() => {
    return health.services.filter(service => 
      service.name.includes('Voice Gateway') || 
      service.name.includes('Database') || 
      service.name.includes('n8n')
    );
  }, [health.services]);

  const getAverageResponseTime = useCallback(() => {
    const healthyServices = health.services.filter(s => s.status === 'healthy');
    if (healthyServices.length === 0) return 0;
    
    const totalResponseTime = healthyServices.reduce((sum, service) => sum + service.responseTime, 0);
    return Math.round(totalResponseTime / healthyServices.length);
  }, [health.services]);

  return {
    health,
    isLoading,
    error,
    refreshHealth,
    checkAllServices,
    getServicesByStatus,
    getCriticalServices,
    getAverageResponseTime,
  };
}