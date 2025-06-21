'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { MessageSquare, Send, Clock, CheckCircle, XCircle, AlertCircle, Phone } from 'lucide-react';

interface WhatsAppMessage {
  id: string;
  to: string;
  message: string;
  status: 'sending' | 'sent' | 'delivered' | 'failed';
  timestamp: Date;
  type: 'text' | 'template' | 'booking' | 'reminder';
  error?: string;
}

export default function TestDashboard() {
  const [messages, setMessages] = useState<WhatsAppMessage[]>([]);
  const [phoneNumber, setPhoneNumber] = useState('905433521189'); // Pre-filled with your test number
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sample booking data for testing
  const sampleBooking = {
    customerName: 'Test Customer',
    serviceName: 'Hair Cut + Wash',
    appointmentDate: 'Friday, June 21, 2025',
    appointmentTime: '2:30 PM',
    salonName: 'Beauty Salon',
    salonAddress: 'Main Street 123, Berlin'
  };

  const sampleReminder = {
    customerName: 'Test Customer',
    serviceName: 'Hair Cut + Wash',
    appointmentDateTime: 'Friday, June 21, 2025 at 2:30 PM',
    hoursUntilAppointment: 24,
    salonName: 'Beauty Salon'
  };

  const sendWhatsAppMessage = async (
    type: 'text' | 'booking' | 'reminder',
    customMessage?: string
  ) => {
    if (!phoneNumber.trim()) {
      setError('Please enter a phone number');
      return;
    }

    setIsLoading(true);
    setError(null);

    const messageId = Date.now().toString();
    const newMessage: WhatsAppMessage = {
      id: messageId,
      to: phoneNumber,
      message: customMessage || message,
      status: 'sending',
      timestamp: new Date(),
      type
    };

    setMessages(prev => [newMessage, ...prev]);

    try {
      let response;
      
      switch (type) {
        case 'text':
          response = await fetch('/api/whatsapp/send', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              to: phoneNumber,
              message: message,
              type: 'text'
            }),
          });
          break;
        
        case 'booking':
          response = await fetch('/api/whatsapp/send', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              to: phoneNumber,
              type: 'booking',
              bookingDetails: sampleBooking
            }),
          });
          break;
        
        case 'reminder':
          response = await fetch('/api/whatsapp/send', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              to: phoneNumber,
              type: 'reminder',
              reminderDetails: sampleReminder
            }),
          });
          break;
      }

      if (response && response.ok) {
        await response.json();
        setMessages(prev => 
          prev.map(msg => 
            msg.id === messageId 
              ? { ...msg, status: 'sent' as const }
              : msg
          )
        );
        
        if (type === 'text') {
          setMessage('');
        }
      } else {
        const errorData = await response.json();
        console.error('WhatsApp API Response Error:', errorData);
        throw new Error(errorData.error || 'Failed to send message');
      }
    } catch (err) {
      console.error('Error sending message:', err);
      let errorMessage = 'An error occurred';
      
      if (err instanceof TypeError && err.message === 'Failed to fetch') {
        errorMessage = 'Connection error: Please check if the server is running on port 3000';
      } else if (err instanceof Error) {
        errorMessage = err.message;
      }
      
      setError(errorMessage);
      setMessages(prev => 
        prev.map(msg => 
          msg.id === messageId 
            ? { ...msg, status: 'failed' as const, error: errorMessage }
            : msg
        )
      );
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusIcon = (status: WhatsAppMessage['status']) => {
    switch (status) {
      case 'sending':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'sent':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'delivered':
        return <CheckCircle className="h-4 w-4 text-blue-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
    }
  };

  const getStatusBadge = (status: WhatsAppMessage['status']) => {
    const variants = {
      sending: 'secondary',
      sent: 'default',
      delivered: 'default',
      failed: 'destructive'
    } as const;
    
    return (
      <Badge variant={variants[status]} className="text-xs">
        {status === 'sending' ? 'Sending...' : 
         status === 'sent' ? 'Sent' :
         status === 'delivered' ? 'Delivered' : 'Failed'}
      </Badge>
    );
  };

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <MessageSquare className="h-8 w-8 text-green-600" />
          WhatsApp Test Dashboard
        </h1>
        <p className="text-muted-foreground mt-2">
          Test WhatsApp Business API functionality without login
        </p>
      </div>

      {error && (
        <Alert className="mb-6 border-red-200 bg-red-50">
          <AlertCircle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-800">
            {error}
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Messaging Panel */}
        <Card>
          <CardHeader>
            <CardTitle>Send Messages</CardTitle>
            <CardDescription>
              Test different WhatsApp message types
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">
                  Phone Number (without country code)
                </label>
                <Input
                  type="tel"
                  placeholder="905433521189"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  className="w-full"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Enter your test number without + or country code (e.g., 905433521189)
                </p>
              </div>

              <Tabs defaultValue="template" className="w-full">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="template">Template</TabsTrigger>
                  <TabsTrigger value="text">Text</TabsTrigger>
                  <TabsTrigger value="booking">Booking</TabsTrigger>
                  <TabsTrigger value="reminder">Reminder</TabsTrigger>
                </TabsList>
                
                <TabsContent value="template" className="space-y-4">
                  <div className="bg-yellow-50 p-4 rounded-lg">
                    <h4 className="font-medium mb-2">Hello World Template Test</h4>
                    <div className="text-sm text-yellow-700 space-y-1">
                      <p>This will send the pre-approved "hello_world" template message.</p>
                      <p>Template messages work even outside the 24-hour window.</p>
                    </div>
                  </div>
                  <Button 
                    onClick={async () => {
                      setIsLoading(true);
                      setError(null);
                      try {
                        const response = await fetch('/api/whatsapp/test-template', {
                          method: 'POST',
                          headers: {
                            'Content-Type': 'application/json',
                          },
                          body: JSON.stringify({
                            to: phoneNumber
                          }),
                        });
                        
                        if (!response.ok) {
                          const errorData = await response.json();
                          throw new Error(errorData.error || 'Failed to send template');
                        }
                        
                        await response.json();
                        setMessages(prev => [{
                          id: Date.now().toString(),
                          to: phoneNumber,
                          message: 'Hello World Template',
                          status: 'sent',
                          timestamp: new Date(),
                          type: 'template'
                        }, ...prev]);
                      } catch (err) {
                        setError(err instanceof Error ? err.message : 'Failed to send template');
                      } finally {
                        setIsLoading(false);
                      }
                    }}
                    disabled={isLoading}
                    className="w-full"
                  >
                    <Send className="h-4 w-4 mr-2" />
                    {isLoading ? 'Sending...' : 'Send Hello World Template'}
                  </Button>
                </TabsContent>
                
                <TabsContent value="text" className="space-y-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">
                      Message
                    </label>
                    <Textarea
                      placeholder="Enter your message..."
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      rows={4}
                    />
                  </div>
                  <Button 
                    onClick={() => sendWhatsAppMessage('text')}
                    disabled={isLoading || !message.trim()}
                    className="w-full"
                  >
                    <Send className="h-4 w-4 mr-2" />
                    {isLoading ? 'Sending...' : 'Send Text'}
                  </Button>
                </TabsContent>
                
                <TabsContent value="booking" className="space-y-4">
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h4 className="font-medium mb-2">Sample Booking Confirmation:</h4>
                    <div className="text-sm text-gray-600 space-y-1">
                      <p><strong>Customer:</strong> {sampleBooking.customerName}</p>
                      <p><strong>Service:</strong> {sampleBooking.serviceName}</p>
                      <p><strong>Date:</strong> {sampleBooking.appointmentDate}</p>
                      <p><strong>Time:</strong> {sampleBooking.appointmentTime}</p>
                      <p><strong>Salon:</strong> {sampleBooking.salonName}</p>
                    </div>
                  </div>
                  <Button 
                    onClick={() => sendWhatsAppMessage('booking')}
                    disabled={isLoading}
                    className="w-full"
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    {isLoading ? 'Sending...' : 'Send Booking Confirmation'}
                  </Button>
                </TabsContent>
                
                <TabsContent value="reminder" className="space-y-4">
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <h4 className="font-medium mb-2">Sample Appointment Reminder:</h4>
                    <div className="text-sm text-blue-700 space-y-1">
                      <p><strong>Customer:</strong> {sampleReminder.customerName}</p>
                      <p><strong>Service:</strong> {sampleReminder.serviceName}</p>
                      <p><strong>Appointment:</strong> {sampleReminder.appointmentDateTime}</p>
                      <p><strong>In:</strong> {sampleReminder.hoursUntilAppointment} hours</p>
                    </div>
                  </div>
                  <Button 
                    onClick={() => sendWhatsAppMessage('reminder')}
                    disabled={isLoading}
                    className="w-full"
                  >
                    <Clock className="h-4 w-4 mr-2" />
                    {isLoading ? 'Sending...' : 'Send Appointment Reminder'}
                  </Button>
                </TabsContent>
              </Tabs>
            </div>
          </CardContent>
        </Card>

        {/* Message History */}
        <Card>
          <CardHeader>
            <CardTitle>Message History</CardTitle>
            <CardDescription>
              Overview of all sent messages
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {messages.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No messages sent yet</p>
                </div>
              ) : (
                messages.map((msg) => (
                  <div key={msg.id} className="border rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium text-sm">{msg.to}</span>
                        {getStatusBadge(msg.status)}
                      </div>
                      <div className="flex items-center gap-2">
                        {getStatusIcon(msg.status)}
                        <span className="text-xs text-muted-foreground">
                          {msg.timestamp.toLocaleTimeString('en-US')}
                        </span>
                      </div>
                    </div>
                    <div className="text-sm bg-gray-50 p-2 rounded">
                      <div className="flex items-center gap-1 mb-1">
                        <Badge variant="outline" className="text-xs">
                          {msg.type === 'text' ? 'Text' : 
                           msg.type === 'booking' ? 'Booking' : 'Reminder'}
                        </Badge>
                      </div>
                      <p className="text-gray-700 text-xs line-clamp-2">
                        {msg.message.length > 100 
                          ? msg.message.substring(0, 100) + '...' 
                          : msg.message}
                      </p>
                      {msg.error && (
                        <p className="text-red-600 text-xs mt-1">
                          Error: {msg.error}
                        </p>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Debug Info */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Debug Information</CardTitle>
          <CardDescription>
            API endpoint and configuration details
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <p><strong>API Endpoint:</strong> /api/whatsapp/send</p>
            <p><strong>Server URL:</strong> http://localhost:3000</p>
            <p><strong>Test Number Format:</strong> 905433521189 (no + or country code)</p>
            <p><strong>WhatsApp API Version:</strong> v22.0</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}