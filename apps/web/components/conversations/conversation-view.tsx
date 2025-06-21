'use client';

import { useState, useRef, useEffect } from 'react';
import { Conversation, Message } from '@/hooks/use-conversations';
import { useConversations } from '@/hooks/use-conversations';
import { MessageBubble } from './message-bubble';
import { MessageComposer } from './message-composer';
import { ConversationActions } from './conversation-actions';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Phone, 
  MessageSquare, 
  Instagram,
  MoreVertical,
  Tag,
  UserCheck
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';

interface ConversationViewProps {
  conversation: Conversation;
  messages: Message[];
}

const channelIcons = {
  whatsapp: MessageSquare,
  instagram: Instagram,
  voice: Phone,
};

const channelColors = {
  whatsapp: 'text-green-600 bg-green-100 dark:bg-green-900',
  instagram: 'text-pink-600 bg-pink-100 dark:bg-pink-900',
  voice: 'text-blue-600 bg-blue-100 dark:bg-blue-900',
};

export function ConversationView({ conversation, messages }: ConversationViewProps) {
  const { 
    sendMessage, 
    markAsRead, 
    updateConversationStatus,
    assignConversation,
    addTags 
  } = useConversations();
  
  const [isTyping, setIsTyping] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const ChannelIcon = channelIcons[conversation.channel];

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Mark as read when conversation is viewed
  useEffect(() => {
    if (conversation.unreadCount > 0) {
      markAsRead(conversation.id);
    }
  }, [conversation.id, conversation.unreadCount, markAsRead]);

  const handleSendMessage = async (content: string, type: Message['type'] = 'text') => {
    try {
      setIsTyping(true);
      await sendMessage(conversation.id, content, type);
    } catch (error) {
      console.error('Failed to send message:', error);
    } finally {
      setIsTyping(false);
    }
  };

  const groupedMessages = groupMessagesByTime(messages);

  return (
    <div className="flex flex-col h-full">
      {/* Conversation Header */}
      <div className="p-4 border-b bg-muted/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Badge variant="outline" className={cn("flex items-center gap-1", channelColors[conversation.channel])}>
              <ChannelIcon className="h-3 w-3" />
              {conversation.channel}
            </Badge>
            
            {conversation.bookingIntent && conversation.bookingIntent.confidence > 0.7 && (
              <Badge variant="secondary" className="flex items-center gap-1">
                📅 Booking Intent ({Math.round(conversation.bookingIntent.confidence * 100)}%)
              </Badge>
            )}

            <Badge 
              variant={conversation.sentiment === 'positive' ? 'default' : 
                     conversation.sentiment === 'negative' ? 'destructive' : 'secondary'}
              className="text-xs"
            >
              {conversation.sentiment === 'positive' ? '😊' : 
               conversation.sentiment === 'negative' ? '😔' : '😐'} 
              {conversation.sentiment}
            </Badge>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowActions(!showActions)}
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Customer Info */}
        <div className="mt-3 flex items-center justify-between">
          <div>
            <h3 className="font-semibold">{conversation.customerName}</h3>
            {conversation.customerPhone && (
              <p className="text-sm text-muted-foreground">{conversation.customerPhone}</p>
            )}
          </div>
          
          <div className="text-right text-sm text-muted-foreground">
            <p>Last active {formatDistanceToNow(conversation.updatedAt)} ago</p>
            {conversation.assignedTo && (
              <p className="flex items-center gap-1 justify-end">
                <UserCheck className="h-3 w-3" />
                Assigned to {conversation.assignedTo}
              </p>
            )}
          </div>
        </div>

        {/* Tags */}
        {conversation.tags.length > 0 && (
          <div className="mt-2 flex gap-1 flex-wrap">
            {conversation.tags.map((tag) => (
              <Badge key={tag} variant="outline" className="text-xs">
                <Tag className="h-2 w-2 mr-1" />
                {tag}
              </Badge>
            ))}
          </div>
        )}

        {/* Booking Intent Details */}
        {conversation.bookingIntent && conversation.bookingIntent.confidence > 0.7 && (
          <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
            <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
              📅 Detected Booking Intent
              <Badge variant="secondary">{Math.round(conversation.bookingIntent.confidence * 100)}% confidence</Badge>
            </h4>
            <div className="grid grid-cols-2 gap-2 text-sm">
              {conversation.bookingIntent.serviceType && (
                <div>
                  <span className="text-muted-foreground">Service:</span>
                  <span className="ml-1 font-medium">{conversation.bookingIntent.serviceType}</span>
                </div>
              )}
              {conversation.bookingIntent.preferredDateTime && (
                <div>
                  <span className="text-muted-foreground">Preferred Time:</span>
                  <span className="ml-1 font-medium">
                    {conversation.bookingIntent.preferredDateTime.toLocaleDateString()}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Actions Panel */}
      {showActions && (
        <ConversationActions
          conversation={conversation}
          onStatusChange={(status) => updateConversationStatus(conversation.id, status)}
          onAssign={(assignedTo) => assignConversation(conversation.id, assignedTo)}
          onAddTags={(tags) => addTags(conversation.id, tags)}
          onClose={() => setShowActions(false)}
        />
      )}

      {/* Messages */}
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {groupedMessages.map((group, groupIndex) => (
            <div key={groupIndex}>
              {/* Time Divider */}
              <div className="flex items-center justify-center mb-4">
                <div className="px-3 py-1 bg-muted rounded-full text-xs text-muted-foreground">
                  {group.date}
                </div>
              </div>

              {/* Messages */}
              <div className="space-y-2">
                {group.messages.map((message) => (
                  <MessageBubble
                    key={message.id}
                    message={message}
                    isOwn={message.direction === 'outbound'}
                  />
                ))}
              </div>
            </div>
          ))}

          {/* Typing Indicator */}
          {isTyping && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" />
                <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
              </div>
              Sending...
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Message Composer */}
      <MessageComposer
        onSendMessage={handleSendMessage}
        conversation={conversation}
        disabled={isTyping || conversation.status === 'archived'}
      />
    </div>
  );
}

function groupMessagesByTime(messages: Message[]) {
  const groups: { date: string; messages: Message[] }[] = [];
  let currentGroup: { date: string; messages: Message[] } | null = null;

  messages.forEach((message) => {
    const messageDate = new Date(message.timestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    let dateLabel: string;
    if (messageDate.toDateString() === today.toDateString()) {
      dateLabel = 'Today';
    } else if (messageDate.toDateString() === yesterday.toDateString()) {
      dateLabel = 'Yesterday';
    } else {
      dateLabel = messageDate.toLocaleDateString();
    }

    if (!currentGroup || currentGroup.date !== dateLabel) {
      currentGroup = { date: dateLabel, messages: [] };
      groups.push(currentGroup);
    }

    currentGroup.messages.push(message);
  });

  return groups;
}