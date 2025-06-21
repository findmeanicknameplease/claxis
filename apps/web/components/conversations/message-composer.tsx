'use client';

import { useState, useRef, KeyboardEvent } from 'react';
import { Conversation, Message } from '@/hooks/use-conversations';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Send, 
  Paperclip, 
  Mic, 
  Image, 
  Smile,
  Sparkles,
  MessageSquare,
  Phone,
  Instagram
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface MessageComposerProps {
  onSendMessage: (content: string, type?: Message['type']) => Promise<void>;
  conversation: Conversation;
  disabled?: boolean;
}

const quickReplies = [
  'Thank you for your message!',
  'I\'ll get back to you shortly.',
  'Would you like to schedule an appointment?',
  'What service are you interested in?',
  'Our opening hours are 9 AM to 7 PM.',
  'I can help you with that.',
];

const channelFeatures = {
  whatsapp: {
    supportsVoice: true,
    supportsImages: true,
    supportsDocuments: true,
    icon: MessageSquare,
    color: 'text-green-600',
  },
  instagram: {
    supportsVoice: false,
    supportsImages: true,
    supportsDocuments: false,
    icon: Instagram,
    color: 'text-pink-600',
  },
  voice: {
    supportsVoice: true,
    supportsImages: false,
    supportsDocuments: false,
    icon: Phone,
    color: 'text-blue-600',
  },
};

export function MessageComposer({ 
  onSendMessage, 
  conversation, 
  disabled = false 
}: MessageComposerProps) {
  const [message, setMessage] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [showQuickReplies, setShowQuickReplies] = useState(false);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const features = channelFeatures[conversation.channel];
  const ChannelIcon = features.icon;

  const handleSend = async () => {
    if (!message.trim() || disabled) return;

    const content = message.trim();
    setMessage('');
    
    try {
      await onSendMessage(content);
    } catch (error) {
      // Restore message on error
      setMessage(content);
    }
  };

  const handleKeyPress = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleQuickReply = (reply: string) => {
    setMessage(reply);
    setShowQuickReplies(false);
    // Auto-focus input for editing
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const generateAIResponse = async () => {
    if (disabled) return;

    setIsGeneratingAI(true);
    try {
      // Mock AI response generation
      const aiResponses = [
        "I'd be happy to help you schedule an appointment. What service are you interested in?",
        "Thank you for reaching out! Our team will get back to you within 24 hours.",
        "Based on your message, I think our premium facial treatment would be perfect for you. Would you like to know more?",
        "Great question! Our opening hours are Monday to Saturday, 9 AM to 7 PM. Would you like to book an appointment?",
        "I understand your concern. Let me connect you with our specialist who can provide the best advice for your needs.",
      ];
      
      const randomResponse = aiResponses[Math.floor(Math.random() * aiResponses.length)] || "Thank you for your message. How can I help you today?";
      
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      setMessage(randomResponse);
      inputRef.current?.focus();
    } catch (error) {
      console.error('Failed to generate AI response:', error);
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const handleFileUpload = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Determine message type based on file
    let messageType: Message['type'] = 'document';
    if (file.type.startsWith('image/')) {
      messageType = 'image';
    }

    try {
      // In a real implementation, you'd upload the file first
      await onSendMessage(`Shared ${messageType}: ${file.name}`, messageType);
    } catch (error) {
      console.error('Failed to send file:', error);
    }

    // Reset file input
    e.target.value = '';
  };

  const startVoiceRecording = () => {
    if (!features.supportsVoice) return;
    
    setIsRecording(true);
    // In a real implementation, start recording audio
    console.log('Started voice recording...');
  };

  const stopVoiceRecording = async () => {
    setIsRecording(false);
    // In a real implementation, stop recording and send audio
    await onSendMessage('Voice message', 'voice');
  };

  if (disabled) {
    return (
      <div className="p-4 border-t bg-muted/30">
        <div className="flex items-center justify-center p-4 text-sm text-muted-foreground">
          <ChannelIcon className={cn("h-4 w-4 mr-2", features.color)} />
          This conversation is {conversation.status}. No new messages can be sent.
        </div>
      </div>
    );
  }

  return (
    <div className="border-t bg-background">
      {/* Quick Replies */}
      {showQuickReplies && (
        <div className="p-3 border-b bg-muted/30">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium text-muted-foreground">Quick Replies</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {quickReplies.map((reply, index) => (
              <Button
                key={index}
                variant="outline"
                size="sm"
                onClick={() => handleQuickReply(reply)}
                className="text-xs h-7"
              >
                {reply}
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Booking Intent Suggestion */}
      {conversation.bookingIntent && conversation.bookingIntent.confidence > 0.7 && (
        <div className="p-3 border-b bg-blue-50 dark:bg-blue-950">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge variant="secondary">📅 Booking Intent Detected</Badge>
              <span className="text-sm text-muted-foreground">
                Customer seems interested in booking {conversation.bookingIntent.serviceType}
              </span>
            </div>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => handleQuickReply("I'd be happy to help you book an appointment. What date and time work best for you?")}
            >
              Use Suggestion
            </Button>
          </div>
        </div>
      )}

      {/* Composer */}
      <div className="p-4">
        <div className="flex items-end gap-2">
          {/* Attachment Button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleFileUpload}
            disabled={!features.supportsImages && !features.supportsDocuments}
            className="h-10 w-10 p-0"
          >
            <Paperclip className="h-4 w-4" />
          </Button>

          {/* Voice Button */}
          <Button
            variant="ghost"
            size="sm"
            onMouseDown={startVoiceRecording}
            onMouseUp={stopVoiceRecording}
            disabled={!features.supportsVoice}
            className={cn(
              "h-10 w-10 p-0",
              isRecording && "bg-red-100 text-red-600"
            )}
          >
            <Mic className="h-4 w-4" />
          </Button>

          {/* Message Input */}
          <div className="flex-1 relative">
            <Input
              ref={inputRef}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={`Type a message via ${conversation.channel}...`}
              className="pr-20"
              disabled={isGeneratingAI}
            />
            
            {/* AI and Quick Reply Buttons */}
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowQuickReplies(!showQuickReplies)}
                className={cn(
                  "h-6 w-6 p-0",
                  showQuickReplies && "bg-muted"
                )}
              >
                <Smile className="h-3 w-3" />
              </Button>
              
              <Button
                variant="ghost"
                size="sm"
                onClick={generateAIResponse}
                disabled={isGeneratingAI}
                className="h-6 w-6 p-0"
              >
                {isGeneratingAI ? (
                  <div className="h-3 w-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Sparkles className="h-3 w-3" />
                )}
              </Button>
            </div>
          </div>

          {/* Send Button */}
          <Button
            onClick={handleSend}
            disabled={!message.trim() || isGeneratingAI}
            className="h-10 w-10 p-0"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>

        {/* Channel Info */}
        <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <ChannelIcon className={cn("h-3 w-3", features.color)} />
            <span>Sending via {conversation.channel}</span>
            {isRecording && (
              <Badge variant="destructive" className="h-4 text-xs animate-pulse">
                Recording...
              </Badge>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            {features.supportsVoice && (
              <span className="flex items-center gap-1">
                <Mic className="h-3 w-3" /> Voice
              </span>
            )}
            {features.supportsImages && (
              <span className="flex items-center gap-1">
                <Image className="h-3 w-3" /> Images
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept={
          features.supportsImages && features.supportsDocuments 
            ? "image/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            : features.supportsImages 
              ? "image/*"
              : "application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        }
        onChange={handleFileSelected}
      />
    </div>
  );
}