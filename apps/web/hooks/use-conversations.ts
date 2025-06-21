'use client';

import { useState, useEffect, useCallback } from 'react';
import { getWebSocketManager, RealtimeEvent } from '@/lib/realtime/websocket-manager';

export interface Message {
  id: string;
  conversationId: string;
  content: string;
  type: 'text' | 'voice' | 'image' | 'document' | 'system';
  direction: 'inbound' | 'outbound';
  timestamp: Date;
  status: 'sent' | 'delivered' | 'read' | 'failed';
  channel: 'whatsapp' | 'instagram' | 'voice' | 'system';
  metadata?: {
    voiceUrl?: string;
    voiceDuration?: number;
    imageUrl?: string;
    documentUrl?: string;
    transcription?: string;
    sentiment?: 'positive' | 'neutral' | 'negative';
    aiConfidence?: number;
  };
}

export interface Conversation {
  id: string;
  customerId: string;
  customerName: string;
  customerPhone?: string;
  customerAvatar?: string;
  channel: 'whatsapp' | 'instagram' | 'voice';
  status: 'active' | 'waiting' | 'resolved' | 'archived';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  assignedTo?: string;
  tags: string[];
  lastMessage: Message;
  unreadCount: number;
  createdAt: Date;
  updatedAt: Date;
  summary?: string;
  sentiment: 'positive' | 'neutral' | 'negative';
  bookingIntent?: {
    confidence: number;
    serviceType?: string;
    preferredDateTime?: Date;
    extractedInfo?: Record<string, any>;
  };
}

export interface ConversationFilters {
  channel?: 'whatsapp' | 'instagram' | 'voice' | 'all';
  status?: 'active' | 'waiting' | 'resolved' | 'archived' | 'all';
  priority?: 'low' | 'medium' | 'high' | 'urgent' | 'all';
  assignedTo?: string | 'unassigned' | 'all';
  hasUnread?: boolean;
  search?: string;
}

export function useConversations() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Record<string, Message[]>>({});
  const [filters, setFilters] = useState<ConversationFilters>({ channel: 'all', status: 'all' });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);

  const handleConversationEvent = useCallback((event: RealtimeEvent) => {
    setError(null);
    
    switch (event.type) {
      case 'conversation_new':
        setConversations(prev => [event.payload as unknown as Conversation, ...prev]);
        break;

      case 'conversation_updated':
        setConversations(prev => 
          prev.map(conv => 
            conv.id === event.payload.conversationId ? { 
              ...conv, 
              status: event.payload.status === 'resolved' ? 'resolved' : conv.status 
            } : conv
          )
        );
        break;

      case 'message_new':
        const newMessage = event.payload as Message;
        setMessages(prev => ({
          ...prev,
          [newMessage.conversationId]: [
            ...(prev[newMessage.conversationId] || []),
            newMessage
          ]
        }));
        
        // Update conversation with latest message
        setConversations(prev => 
          prev.map(conv => 
            conv.id === newMessage.conversationId
              ? {
                  ...conv,
                  lastMessage: newMessage,
                  updatedAt: newMessage.timestamp,
                  unreadCount: newMessage.direction === 'inbound' ? conv.unreadCount + 1 : conv.unreadCount
                }
              : conv
          )
        );
        break;

      case 'message_status_updated':
        const { messageId, status } = event.payload as { messageId: string; status: string };
        setMessages(prev => {
          const updated = { ...prev };
          Object.keys(updated).forEach(conversationId => {
            updated[conversationId] = (updated[conversationId] || []).map(msg =>
              msg.id === messageId ? { ...msg, status: status as Message['status'] } : msg
            );
          });
          return updated;
        });
        break;
    }
  }, []);

  const fetchConversations = useCallback(async () => {
    try {
      const queryParams = new URLSearchParams();
      if (filters.channel && filters.channel !== 'all') queryParams.set('channel', filters.channel);
      if (filters.status && filters.status !== 'all') queryParams.set('status', filters.status);
      if (filters.priority && filters.priority !== 'all') queryParams.set('priority', filters.priority);
      if (filters.assignedTo && filters.assignedTo !== 'all') queryParams.set('assignedTo', filters.assignedTo);
      if (filters.hasUnread) queryParams.set('hasUnread', 'true');
      if (filters.search) queryParams.set('search', filters.search);

      const response = await fetch(`/api/conversations?${queryParams}`);
      if (response.ok) {
        const data = await response.json();
        setConversations(data.conversations || []);
      } else {
        throw new Error('Failed to fetch conversations');
      }
    } catch (error) {
      console.error('Failed to fetch conversations:', error);
      setError('Failed to load conversations');
    } finally {
      setIsLoading(false);
    }
  }, [filters]);

  const fetchMessages = useCallback(async (conversationId: string) => {
    try {
      const response = await fetch(`/api/conversations/${conversationId}/messages`);
      if (response.ok) {
        const data = await response.json();
        setMessages(prev => ({
          ...prev,
          [conversationId]: data.messages || []
        }));
      }
    } catch (error) {
      console.error('Failed to fetch messages:', error);
    }
  }, []);

  useEffect(() => {
    const wsManager = getWebSocketManager();
    
    // Subscribe to conversation events
    const unsubscribeConversationNew = wsManager.subscribe('conversation_new', handleConversationEvent);
    const unsubscribeConversationUpdated = wsManager.subscribe('conversation_updated', handleConversationEvent);
    const unsubscribeMessageNew = wsManager.subscribe('message_new', handleConversationEvent);
    const unsubscribeMessageStatus = wsManager.subscribe('message_status_updated', handleConversationEvent);

    // Connect and fetch initial data
    wsManager.connect()
      .then(() => {
        fetchConversations();
      })
      .catch((error) => {
        console.error('WebSocket connection failed:', error);
        setError('Failed to connect to real-time updates');
        fetchConversations();
      });

    return () => {
      unsubscribeConversationNew();
      unsubscribeConversationUpdated();
      unsubscribeMessageNew();
      unsubscribeMessageStatus();
    };
  }, [handleConversationEvent, fetchConversations]);

  // Fetch messages when conversation is selected
  useEffect(() => {
    if (selectedConversation && !messages[selectedConversation]) {
      fetchMessages(selectedConversation);
    }
  }, [selectedConversation, messages, fetchMessages]);

  const sendMessage = useCallback(async (conversationId: string, content: string, type: Message['type'] = 'text') => {
    try {
      const response = await fetch(`/api/conversations/${conversationId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, type }),
      });

      if (!response.ok) {
        throw new Error('Failed to send message');
      }

      const newMessage = await response.json();
      
      // Optimistic update
      setMessages(prev => ({
        ...prev,
        [conversationId]: [...(prev[conversationId] || []), newMessage]
      }));

      return newMessage;
    } catch (error) {
      console.error('Failed to send message:', error);
      setError('Failed to send message');
      throw error;
    }
  }, []);

  const markAsRead = useCallback(async (conversationId: string) => {
    try {
      const response = await fetch(`/api/conversations/${conversationId}/read`, {
        method: 'POST',
      });

      if (response.ok) {
        setConversations(prev => 
          prev.map(conv => 
            conv.id === conversationId ? { ...conv, unreadCount: 0 } : conv
          )
        );
      }
    } catch (error) {
      console.error('Failed to mark as read:', error);
    }
  }, []);

  const updateConversationStatus = useCallback(async (conversationId: string, status: Conversation['status']) => {
    try {
      const response = await fetch(`/api/conversations/${conversationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });

      if (response.ok) {
        setConversations(prev => 
          prev.map(conv => 
            conv.id === conversationId ? { ...conv, status } : conv
          )
        );
      }
    } catch (error) {
      console.error('Failed to update conversation status:', error);
      setError('Failed to update conversation');
    }
  }, []);

  const assignConversation = useCallback(async (conversationId: string, assignedTo: string) => {
    try {
      const response = await fetch(`/api/conversations/${conversationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignedTo }),
      });

      if (response.ok) {
        setConversations(prev => 
          prev.map(conv => 
            conv.id === conversationId ? { ...conv, assignedTo } : conv
          )
        );
      }
    } catch (error) {
      console.error('Failed to assign conversation:', error);
      setError('Failed to assign conversation');
    }
  }, []);

  const addTags = useCallback(async (conversationId: string, tags: string[]) => {
    try {
      const response = await fetch(`/api/conversations/${conversationId}/tags`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tags }),
      });

      if (response.ok) {
        setConversations(prev => 
          prev.map(conv => 
            conv.id === conversationId 
              ? { ...conv, tags: [...new Set([...conv.tags, ...tags])] }
              : conv
          )
        );
      }
    } catch (error) {
      console.error('Failed to add tags:', error);
      setError('Failed to add tags');
    }
  }, []);

  // Helper functions
  const getFilteredConversations = useCallback(() => {
    return conversations.filter(conv => {
      if (filters.channel && filters.channel !== 'all' && conv.channel !== filters.channel) return false;
      if (filters.status && filters.status !== 'all' && conv.status !== filters.status) return false;
      if (filters.priority && filters.priority !== 'all' && conv.priority !== filters.priority) return false;
      if (filters.assignedTo && filters.assignedTo !== 'all') {
        if (filters.assignedTo === 'unassigned' && conv.assignedTo) return false;
        if (filters.assignedTo !== 'unassigned' && conv.assignedTo !== filters.assignedTo) return false;
      }
      if (filters.hasUnread && conv.unreadCount === 0) return false;
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        if (!conv.customerName.toLowerCase().includes(searchLower) &&
            !conv.lastMessage.content.toLowerCase().includes(searchLower)) return false;
      }
      return true;
    });
  }, [conversations, filters]);

  const getConversationById = useCallback((id: string) => {
    return conversations.find(conv => conv.id === id);
  }, [conversations]);

  const getUnreadCount = useCallback(() => {
    return conversations.reduce((sum, conv) => sum + conv.unreadCount, 0);
  }, [conversations]);

  return {
    conversations: getFilteredConversations(),
    allConversations: conversations,
    messages,
    filters,
    isLoading,
    error,
    selectedConversation,
    setFilters,
    setSelectedConversation,
    sendMessage,
    markAsRead,
    updateConversationStatus,
    assignConversation,
    addTags,
    getConversationById,
    getUnreadCount,
    refreshConversations: fetchConversations,
  };
}