'use client';

import { Message } from '@/hooks/use-conversations';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Phone, 
  Image, 
  FileText, 
  Play, 
  Download,
  MessageSquare,
  Bot,
  User,
  Check,
  CheckCheck,
  Clock,
  AlertCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';

interface MessageBubbleProps {
  message: Message;
  isOwn: boolean;
}

const statusIcons = {
  sent: Clock,
  delivered: Check,
  read: CheckCheck,
  failed: AlertCircle,
};

const statusColors = {
  sent: 'text-gray-400',
  delivered: 'text-gray-600',
  read: 'text-blue-600',
  failed: 'text-red-600',
};

export function MessageBubble({ message, isOwn }: MessageBubbleProps) {
  const StatusIcon = statusIcons[message.status];

  const renderMessageContent = () => {
    switch (message.type) {
      case 'voice':
        return (
          <div className="flex items-center gap-3 min-w-48">
            <Button variant="ghost" size="sm" className="h-8 w-8 rounded-full p-0">
              <Play className="h-4 w-4" />
            </Button>
            <div className="flex-1">
              <div className="h-2 bg-muted rounded-full relative overflow-hidden">
                <div className="h-full bg-primary rounded-full w-1/3" />
              </div>
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>0:00</span>
                <span>{message.metadata?.voiceDuration || 0}s</span>
              </div>
            </div>
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
              <Download className="h-3 w-3" />
            </Button>
          </div>
        );

      case 'image':
        return (
          <div className="space-y-2">
            <div className="w-48 h-32 bg-muted rounded-lg flex items-center justify-center">
              <Image className="h-8 w-8 text-muted-foreground" />
            </div>
            {message.content && (
              <p className="text-sm">{message.content}</p>
            )}
          </div>
        );

      case 'document':
        return (
          <div className="flex items-center gap-3 p-3 border rounded-lg min-w-48">
            <FileText className="h-8 w-8 text-blue-600" />
            <div className="flex-1">
              <p className="font-medium text-sm">Document</p>
              <p className="text-xs text-muted-foreground">{message.content}</p>
            </div>
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
              <Download className="h-3 w-3" />
            </Button>
          </div>
        );

      case 'system':
        return (
          <div className="flex items-center justify-center">
            <div className="flex items-center gap-2 px-3 py-1 bg-muted rounded-full text-sm text-muted-foreground">
              <Bot className="h-3 w-3" />
              {message.content}
            </div>
          </div>
        );

      default:
        return (
          <div className="space-y-1">
            <p className="text-sm leading-relaxed whitespace-pre-wrap">
              {message.content}
            </p>
            
            {/* AI-generated metadata */}
            {message.metadata?.sentiment && (
              <div className="flex items-center gap-2 text-xs">
                <Badge 
                  variant="outline" 
                  className={cn(
                    "h-4 text-xs",
                    message.metadata.sentiment === 'positive' ? 'border-green-200 text-green-700' :
                    message.metadata.sentiment === 'negative' ? 'border-red-200 text-red-700' :
                    'border-gray-200 text-gray-700'
                  )}
                >
                  {message.metadata.sentiment === 'positive' ? '😊' : 
                   message.metadata.sentiment === 'negative' ? '😔' : '😐'}
                  {message.metadata.sentiment}
                </Badge>
                
                {message.metadata.aiConfidence && (
                  <span className="text-muted-foreground">
                    {Math.round(message.metadata.aiConfidence * 100)}% confidence
                  </span>
                )}
              </div>
            )}

            {/* Voice transcription */}
            {message.metadata?.transcription && (
              <div className="mt-2 p-2 bg-muted/50 rounded text-xs text-muted-foreground">
                <div className="flex items-center gap-1 mb-1">
                  <Phone className="h-3 w-3" />
                  Transcription:
                </div>
                <p>"{message.metadata.transcription}"</p>
              </div>
            )}
          </div>
        );
    }
  };

  // System messages are centered
  if (message.type === 'system') {
    return (
      <div className="flex justify-center my-4">
        {renderMessageContent()}
      </div>
    );
  }

  return (
    <div className={cn(
      "flex gap-3 max-w-[80%]",
      isOwn ? "ml-auto flex-row-reverse" : ""
    )}>
      {/* Avatar */}
      <div className={cn(
        "h-8 w-8 rounded-full flex items-center justify-center text-white text-sm font-medium flex-shrink-0",
        isOwn 
          ? "bg-primary" 
          : message.channel === 'whatsapp' 
            ? "bg-green-600" 
            : message.channel === 'instagram'
              ? "bg-pink-600"
              : "bg-blue-600"
      )}>
        {isOwn ? (
          <User className="h-4 w-4" />
        ) : (
          message.channel === 'voice' ? (
            <Phone className="h-4 w-4" />
          ) : (
            <MessageSquare className="h-4 w-4" />
          )
        )}
      </div>

      {/* Message Content */}
      <div className={cn("space-y-1", isOwn ? "items-end" : "items-start")}>
        <div className={cn(
          "rounded-2xl px-4 py-2 max-w-sm",
          isOwn 
            ? "bg-primary text-primary-foreground" 
            : "bg-muted"
        )}>
          {renderMessageContent()}
        </div>

        {/* Timestamp and Status */}
        <div className={cn(
          "flex items-center gap-1 text-xs text-muted-foreground",
          isOwn ? "flex-row-reverse" : ""
        )}>
          <span>{formatDistanceToNow(new Date(message.timestamp))} ago</span>
          {isOwn && (
            <StatusIcon className={cn("h-3 w-3", statusColors[message.status])} />
          )}
        </div>
      </div>
    </div>
  );
}