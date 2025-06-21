'use client';

import { useState } from 'react';
import { useConversations } from '@/hooks/use-conversations';
import { ConversationList } from './conversation-list';
import { ConversationView } from './conversation-view';
import { CustomerTimeline } from './customer-timeline';
import { InboxFilters } from './inbox-filters';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  MessageSquare, 
  Phone, 
  Instagram, 
  Filter,
  Users,
  Settings,
  Search
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface UnifiedInboxProps {
  className?: string;
}

export function UnifiedInbox({ className }: UnifiedInboxProps) {
  const {
    conversations,
    messages,
    selectedConversation,
    setSelectedConversation,
    filters,
    setFilters,
    isLoading,
    error,
    getUnreadCount,
    getConversationById,
  } = useConversations();

  const [showFilters, setShowFilters] = useState(false);
  const [activeTab, setActiveTab] = useState<'conversation' | 'timeline'>('conversation');

  const unreadCount = getUnreadCount();
  const selectedConv = selectedConversation ? getConversationById(selectedConversation) : null;

  const channelCounts = {
    whatsapp: conversations.filter(c => c.channel === 'whatsapp').length,
    instagram: conversations.filter(c => c.channel === 'instagram').length,
    voice: conversations.filter(c => c.channel === 'voice').length,
  };

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <Card className="w-96">
          <CardContent className="pt-6 text-center">
            <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Connection Error</h3>
            <p className="text-muted-foreground mb-4">{error}</p>
            <Button onClick={() => window.location.reload()}>
              Retry Connection
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className={cn("flex h-full bg-background", className)}>
      {/* Sidebar - Conversation List */}
      <div className="w-80 border-r flex flex-col">
        {/* Header */}
        <div className="p-4 border-b">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              <h2 className="text-lg font-semibold">Conversations</h2>
              {unreadCount > 0 && (
                <Badge variant="default" className="bg-red-500">
                  {unreadCount}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowFilters(!showFilters)}
                className={showFilters ? 'bg-muted' : ''}
              >
                <Filter className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm">
                <Search className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Channel Tabs */}
          <Tabs 
            value={filters.channel || 'all'} 
            onValueChange={(value) => setFilters({ ...filters, channel: value as any })}
          >
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="all" className="text-xs">
                All {conversations.length}
              </TabsTrigger>
              <TabsTrigger value="whatsapp" className="text-xs">
                <MessageSquare className="h-3 w-3 mr-1" />
                {channelCounts.whatsapp}
              </TabsTrigger>
              <TabsTrigger value="voice" className="text-xs">
                <Phone className="h-3 w-3 mr-1" />
                {channelCounts.voice}
              </TabsTrigger>
              <TabsTrigger value="instagram" className="text-xs">
                <Instagram className="h-3 w-3 mr-1" />
                {channelCounts.instagram}
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Filters */}
        {showFilters && (
          <div className="p-4 border-b bg-muted/30">
            <InboxFilters 
              filters={filters} 
              onFiltersChange={setFilters}
              conversationCounts={{
                active: conversations.filter(c => c.status === 'active').length,
                waiting: conversations.filter(c => c.status === 'waiting').length,
                resolved: conversations.filter(c => c.status === 'resolved').length,
              }}
            />
          </div>
        )}

        {/* Conversation List */}
        <div className="flex-1 overflow-hidden">
          <ConversationList
            conversations={conversations}
            selectedConversation={selectedConversation}
            onSelectConversation={setSelectedConversation}
            isLoading={isLoading}
          />
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col">
        {selectedConversation ? (
          <>
            {/* Header */}
            <div className="p-4 border-b">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className="h-10 w-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-semibold">
                      {selectedConv?.customerName.charAt(0).toUpperCase()}
                    </div>
                    <div className={cn(
                      "absolute -bottom-1 -right-1 h-3 w-3 rounded-full border-2 border-background",
                      selectedConv?.channel === 'whatsapp' ? 'bg-green-500' :
                      selectedConv?.channel === 'instagram' ? 'bg-pink-500' : 'bg-blue-500'
                    )} />
                  </div>
                  <div>
                    <h3 className="font-semibold">{selectedConv?.customerName}</h3>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span className="capitalize">{selectedConv?.channel}</span>
                      <span>•</span>
                      <span className="capitalize">{selectedConv?.status}</span>
                      {selectedConv?.priority && selectedConv.priority !== 'low' && (
                        <>
                          <span>•</span>
                          <Badge 
                            variant={selectedConv.priority === 'urgent' ? 'destructive' : 'secondary'}
                            className="text-xs"
                          >
                            {selectedConv.priority}
                          </Badge>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as any)}>
                    <TabsList>
                      <TabsTrigger value="conversation">
                        <MessageSquare className="h-4 w-4 mr-1" />
                        Chat
                      </TabsTrigger>
                      <TabsTrigger value="timeline">
                        <Users className="h-4 w-4 mr-1" />
                        Timeline
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>
                  <Button variant="ghost" size="sm">
                    <Settings className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-hidden">
              <Tabs value={activeTab} className="h-full">
                <TabsContent value="conversation" className="h-full m-0">
                  {selectedConv && (
                    <ConversationView
                      conversation={selectedConv}
                      messages={messages[selectedConversation] || []}
                    />
                  )}
                </TabsContent>
                <TabsContent value="timeline" className="h-full m-0">
                  {selectedConv?.customerId && selectedConv?.customerName && (
                    <CustomerTimeline
                      customerId={selectedConv.customerId}
                      customerName={selectedConv.customerName}
                    />
                  )}
                </TabsContent>
              </Tabs>
            </div>
          </>
        ) : (
          /* Empty State */
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center max-w-md">
              <MessageSquare className="h-16 w-16 text-muted-foreground mx-auto mb-6" />
              <h3 className="text-xl font-semibold mb-2">Select a Conversation</h3>
              <p className="text-muted-foreground mb-6">
                Choose a conversation from the sidebar to start viewing messages and customer details.
              </p>
              {conversations.length === 0 && !isLoading && (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    No conversations yet. Conversations will appear here when customers contact you via:
                  </p>
                  <div className="flex justify-center gap-4">
                    <div className="flex items-center gap-2 text-sm">
                      <MessageSquare className="h-4 w-4 text-green-600" />
                      WhatsApp
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Instagram className="h-4 w-4 text-pink-600" />
                      Instagram
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Phone className="h-4 w-4 text-blue-600" />
                      Voice Calls
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}