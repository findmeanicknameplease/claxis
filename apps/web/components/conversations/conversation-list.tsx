'use client';

import { Conversation } from '@/hooks/use-conversations';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  MessageSquare, 
  Phone, 
  Instagram,
  Clock,
  AlertCircle,
  CheckCircle2,
  Archive
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';

interface ConversationListProps {
  conversations: Conversation[];
  selectedConversation: string | null;
  onSelectConversation: (id: string) => void;
  isLoading?: boolean;
}

const channelIcons = {
  whatsapp: MessageSquare,
  instagram: Instagram,
  voice: Phone,
};

const channelColors = {
  whatsapp: 'text-green-600',
  instagram: 'text-pink-600',
  voice: 'text-blue-600',
};

const statusColors = {
  active: 'text-green-600',
  waiting: 'text-yellow-600',
  resolved: 'text-gray-600',
  archived: 'text-gray-400',
};

const statusIcons = {
  active: CheckCircle2,
  waiting: Clock,
  resolved: CheckCircle2,
  archived: Archive,
};

const priorityColors = {
  low: '',
  medium: 'border-l-yellow-400',
  high: 'border-l-orange-400',
  urgent: 'border-l-red-500',
};

export function ConversationList({
  conversations,
  selectedConversation,
  onSelectConversation,
  isLoading = false,
}: ConversationListProps) {
  if (isLoading) {
    return (
      <div className="p-4 space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="animate-pulse space-y-2">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 bg-muted rounded-full" />
              <div className="flex-1 space-y-1">
                <div className="h-4 bg-muted rounded w-3/4" />
                <div className="h-3 bg-muted rounded w-1/2" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (conversations.length === 0) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="text-center">
          <MessageSquare className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No conversations found</p>
        </div>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="p-2 space-y-1">
        {conversations.map((conversation) => {
          const ChannelIcon = channelIcons[conversation.channel];
          const StatusIcon = statusIcons[conversation.status];
          const isSelected = selectedConversation === conversation.id;
          
          return (
            <div
              key={conversation.id}
              onClick={() => onSelectConversation(conversation.id)}
              className={cn(
                "p-3 rounded-lg cursor-pointer transition-colors border-l-4",
                isSelected 
                  ? "bg-primary/10 border-l-primary" 
                  : "hover:bg-muted/50 border-l-transparent",
                priorityColors[conversation.priority],
                "group"
              )}
            >
              <div className="flex items-start gap-3">
                {/* Avatar */}
                <div className="relative">
                  <div className="h-10 w-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-semibold text-sm">
                    {conversation.customerName.charAt(0).toUpperCase()}
                  </div>
                  <div className={cn(
                    "absolute -bottom-1 -right-1 h-3 w-3 rounded-full border-2 border-background",
                    channelColors[conversation.channel].replace('text-', 'bg-')
                  )}>
                    <ChannelIcon className="h-2 w-2 text-white" />
                  </div>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <h4 className="font-medium text-sm truncate">
                      {conversation.customerName}
                    </h4>
                    <div className="flex items-center gap-1">
                      {conversation.unreadCount > 0 && (
                        <Badge variant="default" className="h-5 text-xs bg-red-500">
                          {conversation.unreadCount}
                        </Badge>
                      )}
                      <StatusIcon className={cn("h-3 w-3", statusColors[conversation.status])} />
                    </div>
                  </div>

                  {/* Last Message */}
                  <p className="text-xs text-muted-foreground truncate mb-2">
                    {conversation.lastMessage.type === 'voice' ? (
                      <span className="flex items-center gap-1">
                        <Phone className="h-3 w-3" />
                        Voice message ({conversation.lastMessage.metadata?.voiceDuration}s)
                      </span>
                    ) : conversation.lastMessage.type === 'image' ? (
                      <span className="flex items-center gap-1">
                        📷 Image
                      </span>
                    ) : (
                      conversation.lastMessage.content
                    )}
                  </p>

                  {/* Footer */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(conversation.updatedAt)} ago
                      </span>
                      <ChannelIcon className={cn("h-3 w-3", channelColors[conversation.channel])} />
                    </div>

                    <div className="flex items-center gap-1">
                      {/* Priority Indicator */}
                      {conversation.priority === 'urgent' && (
                        <AlertCircle className="h-3 w-3 text-red-500" />
                      )}
                      
                      {/* Sentiment Indicator */}
                      <div className={cn(
                        "h-2 w-2 rounded-full",
                        conversation.sentiment === 'positive' ? 'bg-green-500' :
                        conversation.sentiment === 'negative' ? 'bg-red-500' : 'bg-gray-400'
                      )} />

                      {/* Booking Intent */}
                      {conversation.bookingIntent && conversation.bookingIntent.confidence > 0.7 && (
                        <Badge variant="outline" className="text-xs h-4 px-1">
                          📅
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Tags */}
                  {conversation.tags.length > 0 && (
                    <div className="flex gap-1 mt-2 flex-wrap">
                      {conversation.tags.slice(0, 2).map((tag) => (
                        <Badge key={tag} variant="secondary" className="text-xs h-4 px-1">
                          {tag}
                        </Badge>
                      ))}
                      {conversation.tags.length > 2 && (
                        <Badge variant="secondary" className="text-xs h-4 px-1">
                          +{conversation.tags.length - 2}
                        </Badge>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}