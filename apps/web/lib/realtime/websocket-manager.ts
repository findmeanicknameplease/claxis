/**
 * WebSocket Connection Manager
 * Enterprise-grade real-time connection management with auto-reconnection
 */

export interface WebSocketMessage {
  type: string;
  payload: any;
  timestamp: number;
  salonId?: string;
}

export interface VoiceAgentEvent extends WebSocketMessage {
  type: 'voice_agent_status' | 'call_started' | 'call_ended' | 'call_progress';
  payload: {
    callId?: string;
    status: 'online' | 'offline' | 'busy' | 'idle';
    currentCalls: number;
    responseTime?: number;
    language?: string;
  };
}

export interface CampaignEvent extends WebSocketMessage {
  type: 'campaign_progress' | 'campaign_completed' | 'campaign_error';
  payload: {
    campaignId: string;
    progress: number;
    completed: number;
    failed: number;
    status: 'running' | 'completed' | 'paused' | 'error';
  };
}

export interface SystemHealthEvent extends WebSocketMessage {
  type: 'system_health' | 'service_status';
  payload: {
    service: string;
    status: 'healthy' | 'degraded' | 'down';
    responseTime?: number;
    errorCount?: number;
  };
}

export interface ConversationEvent extends WebSocketMessage {
  type: 'conversation_new' | 'conversation_updated' | 'conversation_closed';
  payload: {
    conversationId: string;
    platform: 'whatsapp' | 'instagram' | 'web';
    status: 'active' | 'resolved' | 'waiting' | 'archived';
    lastMessage?: string;
  };
}

export interface MessageEvent extends WebSocketMessage {
  type: 'message_new' | 'message_status_updated';
  payload: any; // Allow flexible payload structure for now
}

export type RealtimeEvent = VoiceAgentEvent | CampaignEvent | SystemHealthEvent | ConversationEvent | MessageEvent;

interface WebSocketConfig {
  url: string;
  protocols?: string[];
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  heartbeatInterval?: number;
}

export class WebSocketManager {
  private ws: WebSocket | null = null;
  private config: WebSocketConfig;
  private reconnectAttempts = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private listeners = new Map<string, Set<(event: RealtimeEvent) => void>>();
  private isConnecting = false;
  private lastHeartbeat = 0;
  private authToken: string | null = null;

  constructor(config: WebSocketConfig, authToken?: string) {
    this.config = {
      reconnectInterval: 1000,
      maxReconnectAttempts: 10,
      heartbeatInterval: 30000,
      ...config,
    };
    this.authToken = authToken;
  }

  setAuthToken(token: string) {
    this.authToken = token;
  }

  connect(): Promise<void> {
    if (this.isConnecting || this.isConnected()) {
      return Promise.resolve();
    }

    this.isConnecting = true;

    return new Promise((resolve, reject) => {
      try {
        // Build WebSocket URL with JWT token for authentication
        const wsUrl = this.authToken 
          ? `${this.config.url}?token=${encodeURIComponent(this.authToken)}`
          : this.config.url;
          
        this.ws = new WebSocket(wsUrl, this.config.protocols);

        this.ws.onopen = () => {
          console.log('🔗 WebSocket connected to', this.config.url);
          this.isConnecting = false;
          this.reconnectAttempts = 0;
          this.startHeartbeat();
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const message: RealtimeEvent = JSON.parse(event.data);
            this.handleMessage(message);
          } catch (error) {
            console.error('❌ Failed to parse WebSocket message:', error);
          }
        };

        this.ws.onclose = (event) => {
          console.log('🔌 WebSocket disconnected:', event.code, event.reason);
          this.isConnecting = false;
          this.stopHeartbeat();
          
          if (!event.wasClean && this.shouldReconnect()) {
            this.scheduleReconnect();
          }
        };

        this.ws.onerror = (error) => {
          console.error('❌ WebSocket error:', error);
          this.isConnecting = false;
          reject(error);
        };

      } catch (error) {
        this.isConnecting = false;
        reject(error);
      }
    });
  }

  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    
    this.stopHeartbeat();
    
    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  subscribe(eventType: string, callback: (event: RealtimeEvent) => void): () => void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }
    
    this.listeners.get(eventType)!.add(callback);

    // Return unsubscribe function
    return () => {
      const callbacks = this.listeners.get(eventType);
      if (callbacks) {
        callbacks.delete(callback);
        if (callbacks.size === 0) {
          this.listeners.delete(eventType);
        }
      }
    };
  }

  send(message: Partial<WebSocketMessage>): boolean {
    if (!this.isConnected()) {
      console.warn('⚠️ Cannot send message: WebSocket not connected');
      return false;
    }

    try {
      const fullMessage: WebSocketMessage = {
        timestamp: Date.now(),
        ...message,
        type: message.type!,
        payload: message.payload,
      };

      this.ws!.send(JSON.stringify(fullMessage));
      return true;
    } catch (error) {
      console.error('❌ Failed to send WebSocket message:', error);
      return false;
    }
  }

  private handleMessage(message: RealtimeEvent): void {
    // Update heartbeat timestamp for ping/pong messages
    if (message.type === 'pong') {
      this.lastHeartbeat = Date.now();
      return;
    }

    // Broadcast to all listeners for this event type
    const callbacks = this.listeners.get(message.type);
    if (callbacks) {
      callbacks.forEach(callback => {
        try {
          callback(message);
        } catch (error) {
          console.error('❌ Error in WebSocket message callback:', error);
        }
      });
    }

    // Broadcast to wildcard listeners
    const wildcardCallbacks = this.listeners.get('*');
    if (wildcardCallbacks) {
      wildcardCallbacks.forEach(callback => {
        try {
          callback(message);
        } catch (error) {
          console.error('❌ Error in WebSocket wildcard callback:', error);
        }
      });
    }
  }

  private shouldReconnect(): boolean {
    return this.reconnectAttempts < this.config.maxReconnectAttempts!;
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    const delay = Math.min(
      this.config.reconnectInterval! * Math.pow(2, this.reconnectAttempts),
      30000 // Max 30 seconds
    );

    console.log(`🔄 Scheduling reconnect attempt ${this.reconnectAttempts + 1} in ${delay}ms`);

    this.reconnectTimer = setTimeout(() => {
      this.reconnectAttempts++;
      this.connect().catch(error => {
        console.error('❌ Reconnect failed:', error);
        if (this.shouldReconnect()) {
          this.scheduleReconnect();
        }
      });
    }, delay);
  }

  private startHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
    }

    this.heartbeatTimer = setInterval(() => {
      if (this.isConnected()) {
        this.send({ type: 'ping', payload: {} });
        
        // Check if we've received a pong recently
        const timeSinceHeartbeat = Date.now() - this.lastHeartbeat;
        if (timeSinceHeartbeat > this.config.heartbeatInterval! * 2) {
          console.warn('⚠️ Heartbeat timeout, reconnecting...');
          this.disconnect();
          this.scheduleReconnect();
        }
      }
    }, this.config.heartbeatInterval);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }
}

// Singleton instance for app-wide usage
let wsManager: WebSocketManager | null = null;

export function getWebSocketManager(): WebSocketManager {
  if (!wsManager) {
    const wsUrl = process.env.NODE_ENV === 'production' 
      ? 'wss://voice-gateway.gemini-salon.eu/ws'
      : 'ws://localhost:3001/ws';
      
    wsManager = new WebSocketManager({
      url: wsUrl,
      protocols: ['salon-realtime'],
      reconnectInterval: 1000,
      maxReconnectAttempts: 10,
      heartbeatInterval: 30000,
    });
  }
  
  return wsManager;
}

// Cleanup on page unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    if (wsManager) {
      wsManager.disconnect();
    }
  });
}