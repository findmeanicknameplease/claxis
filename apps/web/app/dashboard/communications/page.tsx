import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth/config';
import { redirect } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MessageSquare, Phone, Instagram, TrendingUp } from 'lucide-react';

export default async function CommunicationsPage() {
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    redirect('/auth/login');
  }

  const salon = session.user.salon;
  const isEnterprise = salon?.subscription_tier === 'enterprise';

  return (
    <div className="container mx-auto py-6 px-4 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Communications Hub</h1>
          <p className="text-muted-foreground mt-1">
            Multi-channel customer engagement with AI automation
          </p>
        </div>
        <Badge variant={isEnterprise ? 'default' : 'secondary'} className="flex items-center gap-1">
          {isEnterprise ? 'Enterprise Active' : 'Professional Plan'}
        </Badge>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">WhatsApp</CardTitle>
            <MessageSquare className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">12</div>
            <p className="text-xs text-muted-foreground">messages today</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Voice Calls</CardTitle>
            <Phone className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{isEnterprise ? '24/7' : '0'}</div>
            <p className="text-xs text-muted-foreground">
              {isEnterprise ? 'AI Agent Active' : 'Upgrade Required'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Instagram</CardTitle>
            <Instagram className="h-4 w-4 text-pink-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">5</div>
            <p className="text-xs text-muted-foreground">booking inquiries</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Response Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">98%</div>
            <p className="text-xs text-muted-foreground">within 2 minutes</p>
          </CardContent>
        </Card>
      </div>

      {/* Multi-Channel Tabs */}
      <Tabs defaultValue="whatsapp" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="whatsapp">WhatsApp</TabsTrigger>
          <TabsTrigger value="voice" disabled={!isEnterprise}>Voice Agent</TabsTrigger>
          <TabsTrigger value="instagram">Instagram</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="whatsapp" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-green-600" />
                WhatsApp Business Integration
              </CardTitle>
              <CardDescription>
                Automated booking confirmations, reminders, and customer support
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <p className="font-medium">Booking Confirmations</p>
                    <p className="text-sm text-muted-foreground">Automatic booking confirmation messages</p>
                  </div>
                  <Badge variant="default">Active</Badge>
                </div>
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <p className="font-medium">Appointment Reminders</p>
                    <p className="text-sm text-muted-foreground">24h and 2h reminder messages</p>
                  </div>
                  <Badge variant="default">Active</Badge>
                </div>
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <p className="font-medium">Customer Support</p>
                    <p className="text-sm text-muted-foreground">AI-powered customer service responses</p>
                  </div>
                  <Badge variant="default">Active</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="voice" className="space-y-4">
          {isEnterprise ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Phone className="h-5 w-5 text-blue-600" />
                  Enterprise Voice Agent
                </CardTitle>
                <CardDescription>
                  24/7 AI receptionist with real-time booking and customer service
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 border rounded-lg bg-blue-50 dark:bg-blue-950">
                    <div>
                      <p className="font-medium">Real-time Voice Processing</p>
                      <p className="text-sm text-muted-foreground">WebSocket orchestration with &lt;2s response</p>
                    </div>
                    <Badge variant="default">🔴 Live</Badge>
                  </div>
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <p className="font-medium">Multi-language Support</p>
                      <p className="text-sm text-muted-foreground">German, Dutch, French, English</p>
                    </div>
                    <Badge variant="default">Active</Badge>
                  </div>
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <p className="font-medium">Spam Protection</p>
                      <p className="text-sm text-muted-foreground">TwilioLookup integration with carrier validation</p>
                    </div>
                    <Badge variant="default">Active</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Enterprise Voice Agent</CardTitle>
                <CardDescription>
                  Upgrade to Enterprise for 24/7 AI voice receptionist
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8">
                  <Phone className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-lg font-medium mb-2">Voice Agent Available</p>
                  <p className="text-muted-foreground mb-4">
                    Upgrade to Enterprise (€299.99/month) to unlock 24/7 AI voice receptionist
                  </p>
                  <Button>Upgrade to Enterprise</Button>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="instagram" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Instagram className="h-5 w-5 text-pink-600" />
                Instagram Business Integration
              </CardTitle>
              <CardDescription>
                Automated comment responses and DM booking workflows
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <p className="font-medium">Comment Automation</p>
                    <p className="text-sm text-muted-foreground">AI detects booking intent in comments</p>
                  </div>
                  <Badge variant="secondary">Coming Soon</Badge>
                </div>
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <p className="font-medium">DM Booking Flows</p>
                    <p className="text-sm text-muted-foreground">Multi-step booking workflows via DM</p>
                  </div>
                  <Badge variant="secondary">Coming Soon</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Response Performance</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span>Average Response Time</span>
                    <span className="font-medium">1.2s</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Success Rate</span>
                    <span className="font-medium">98.5%</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Customer Satisfaction</span>
                    <span className="font-medium">4.8/5</span>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Channel Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span>WhatsApp</span>
                    <span className="font-medium">65%</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Voice Calls</span>
                    <span className="font-medium">{isEnterprise ? '25%' : '0%'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Instagram</span>
                    <span className="font-medium">10%</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}