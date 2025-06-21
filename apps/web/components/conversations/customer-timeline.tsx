'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Calendar, 
  MessageSquare, 
  Phone, 
  Star, 
  CreditCard,
  User,
  MapPin,
  Clock,
  Heart,
  Gift,
  AlertCircle,
  CheckCircle2,
  RefreshCw
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';

interface CustomerTimelineProps {
  customerId: string;
  customerName: string;
}

interface TimelineEvent {
  id: string;
  type: 'booking' | 'message' | 'call' | 'review' | 'payment' | 'note' | 'system';
  title: string;
  description: string;
  timestamp: Date;
  metadata?: {
    amount?: number;
    rating?: number;
    channel?: string;
    status?: string;
    service?: string;
    staff?: string;
  };
}

interface CustomerProfile {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  avatar?: string;
  tags: string[];
  joinDate: Date;
  lastVisit?: Date;
  totalSpent: number;
  totalBookings: number;
  averageRating: number;
  preferredServices: string[];
  notes: string;
  loyaltyPoints: number;
  vipStatus: boolean;
}

const eventIcons = {
  booking: Calendar,
  message: MessageSquare,
  call: Phone,
  review: Star,
  payment: CreditCard,
  note: User,
  system: AlertCircle,
};

const eventColors = {
  booking: 'text-blue-600 bg-blue-100 dark:bg-blue-900',
  message: 'text-green-600 bg-green-100 dark:bg-green-900',
  call: 'text-purple-600 bg-purple-100 dark:bg-purple-900',
  review: 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900',
  payment: 'text-emerald-600 bg-emerald-100 dark:bg-emerald-900',
  note: 'text-gray-600 bg-gray-100 dark:bg-gray-900',
  system: 'text-orange-600 bg-orange-100 dark:bg-orange-900',
};

// Mock data - replace with actual API calls
const mockCustomerProfile: CustomerProfile = {
  id: 'cust_001',
  name: 'Sarah Mueller',
  email: 'sarah.mueller@email.com',
  phone: '+49 30 12345678',
  tags: ['vip-customer', 'regular', 'facial-specialist'],
  joinDate: new Date('2023-03-15'),
  lastVisit: new Date('2024-12-15'),
  totalSpent: 1247.50,
  totalBookings: 18,
  averageRating: 4.8,
  preferredServices: ['Premium Facial', 'Hair Color', 'Manicure'],
  notes: 'Prefers morning appointments. Allergic to certain products. VIP customer since 2023.',
  loyaltyPoints: 2450,
  vipStatus: true,
};

const mockTimeline: TimelineEvent[] = [
  {
    id: 'evt_001',
    type: 'message',
    title: 'WhatsApp Message',
    description: 'Customer asked about availability for premium facial treatment',
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
    metadata: { channel: 'whatsapp' }
  },
  {
    id: 'evt_002',
    type: 'booking',
    title: 'Appointment Booked',
    description: 'Premium Facial Treatment with Maria',
    timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000),
    metadata: { service: 'Premium Facial', staff: 'Maria', status: 'confirmed' }
  },
  {
    id: 'evt_003',
    type: 'payment',
    title: 'Payment Received',
    description: 'Premium Facial Treatment - €95.00',
    timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    metadata: { amount: 95.00, status: 'completed' }
  },
  {
    id: 'evt_004',
    type: 'review',
    title: 'Review Submitted',
    description: 'Left a 5-star review: "Amazing service as always!"',
    timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    metadata: { rating: 5 }
  },
  {
    id: 'evt_005',
    type: 'call',
    title: 'Voice Call',
    description: 'Inquiry about holiday specials and availability',
    timestamp: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    metadata: { channel: 'voice' }
  },
  {
    id: 'evt_006',
    type: 'note',
    title: 'Staff Note Added',
    description: 'Customer mentioned interest in new hair coloring services',
    timestamp: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
    metadata: { staff: 'Reception' }
  },
];

export function CustomerTimeline({ customerId, customerName: _customerName }: CustomerTimelineProps) {
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCustomerData = async () => {
      try {
        // Mock API call - replace with actual fetch
        await new Promise(resolve => setTimeout(resolve, 500));
        setProfile(mockCustomerProfile);
        setTimeline(mockTimeline);
      } catch (error) {
        console.error('Failed to fetch customer data:', error);
        setError('Failed to load customer timeline');
      } finally {
        setIsLoading(false);
      }
    };

    fetchCustomerData();
  }, [customerId]);

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <div className="animate-pulse space-y-4">
          <div className="h-32 bg-muted rounded-lg" />
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-16 bg-muted rounded" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="flex items-center justify-center h-full">
        <Card className="w-96">
          <CardContent className="pt-6 text-center">
            <User className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Unable to Load Timeline</h3>
            <p className="text-muted-foreground mb-4">{error || 'Customer profile not found'}</p>
            <Button onClick={() => window.location.reload()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Customer Profile Header */}
      <div className="p-6 border-b">
        <div className="flex items-start gap-4">
          <div className="h-16 w-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-xl">
            {profile.name.split(' ').map(n => n[0]).join('')}
          </div>
          
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <h3 className="text-xl font-semibold">{profile.name}</h3>
              {profile.vipStatus && (
                <Badge variant="default" className="bg-gradient-to-r from-yellow-400 to-orange-500">
                  <Heart className="h-3 w-3 mr-1" />
                  VIP
                </Badge>
              )}
            </div>
            
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <MapPin className="h-3 w-3" />
                  {profile.email}
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Phone className="h-3 w-3" />
                  {profile.phone}
                </div>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Calendar className="h-3 w-3" />
                  Customer since {profile.joinDate.toLocaleDateString()}
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  Last visit {profile.lastVisit ? formatDistanceToNow(profile.lastVisit) + ' ago' : 'Never'}
                </div>
              </div>
            </div>

            {/* Tags */}
            <div className="flex gap-1 flex-wrap mt-3">
              {profile.tags.map((tag) => (
                <Badge key={tag} variant="secondary" className="text-xs">
                  {tag}
                </Badge>
              ))}
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-4 gap-4 mt-6">
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">€{profile.totalSpent}</div>
                <div className="text-xs text-muted-foreground">Total Spent</div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{profile.totalBookings}</div>
                <div className="text-xs text-muted-foreground">Appointments</div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="text-center">
                <div className="text-2xl font-bold text-yellow-600 flex items-center justify-center gap-1">
                  {profile.averageRating} <Star className="h-4 w-4 fill-current" />
                </div>
                <div className="text-xs text-muted-foreground">Avg Rating</div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600 flex items-center justify-center gap-1">
                  {profile.loyaltyPoints} <Gift className="h-4 w-4" />
                </div>
                <div className="text-xs text-muted-foreground">Points</div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Timeline */}
      <div className="flex-1 overflow-hidden">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-lg font-semibold">Customer Timeline</h4>
            <Badge variant="outline">{timeline.length} events</Badge>
          </div>
        </div>

        <ScrollArea className="h-full px-6 pb-6">
          <div className="space-y-4">
            {timeline.map((event, index) => {
              const Icon = eventIcons[event.type];
              const isLast = index === timeline.length - 1;
              
              return (
                <div key={event.id} className="relative">
                  {/* Timeline Line */}
                  {!isLast && (
                    <div className="absolute left-6 top-12 w-0.5 h-8 bg-border" />
                  )}
                  
                  <div className="flex gap-4">
                    {/* Icon */}
                    <div className={cn(
                      "h-12 w-12 rounded-full flex items-center justify-center flex-shrink-0",
                      eventColors[event.type]
                    )}>
                      <Icon className="h-5 w-5" />
                    </div>
                    
                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <Card>
                        <CardContent className="pt-4">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <h5 className="font-medium text-sm">{event.title}</h5>
                              <p className="text-sm text-muted-foreground mt-1">
                                {event.description}
                              </p>
                              
                              {/* Metadata */}
                              {event.metadata && (
                                <div className="flex items-center gap-2 mt-2 text-xs">
                                  {event.metadata.amount && (
                                    <Badge variant="outline" className="h-4">
                                      €{event.metadata.amount}
                                    </Badge>
                                  )}
                                  {event.metadata.rating && (
                                    <Badge variant="outline" className="h-4">
                                      {event.metadata.rating} ⭐
                                    </Badge>
                                  )}
                                  {event.metadata.service && (
                                    <Badge variant="outline" className="h-4">
                                      {event.metadata.service}
                                    </Badge>
                                  )}
                                  {event.metadata.staff && (
                                    <Badge variant="outline" className="h-4">
                                      {event.metadata.staff}
                                    </Badge>
                                  )}
                                  {event.metadata.status && (
                                    <Badge 
                                      variant={event.metadata.status === 'completed' ? 'default' : 'secondary'}
                                      className="h-4"
                                    >
                                      {event.metadata.status === 'completed' && (
                                        <CheckCircle2 className="h-2 w-2 mr-1" />
                                      )}
                                      {event.metadata.status}
                                    </Badge>
                                  )}
                                </div>
                              )}
                            </div>
                            
                            <div className="text-xs text-muted-foreground ml-4 flex-shrink-0">
                              {formatDistanceToNow(event.timestamp)} ago
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </div>

      {/* Customer Notes */}
      {profile.notes && (
        <div className="p-6 border-t bg-muted/30">
          <h5 className="font-medium text-sm mb-2">Customer Notes</h5>
          <p className="text-sm text-muted-foreground">{profile.notes}</p>
        </div>
      )}
    </div>
  );
}