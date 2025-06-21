import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth/config';
import { redirect } from 'next/navigation';
import { SystemMonitoringDashboard } from '@/components/monitoring/system-monitoring-dashboard';
import { VoiceAgentMonitor } from '@/components/monitoring/voice-agent-monitor';
import { CampaignMonitor } from '@/components/monitoring/campaign-monitor';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Activity, Headphones, Megaphone, Settings } from 'lucide-react';

export default async function MonitoringPage() {
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
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Activity className="h-8 w-8 text-blue-600" />
            System Monitoring
          </h1>
          <p className="text-muted-foreground mt-1">
            Real-time monitoring and health status of all salon automation systems
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={isEnterprise ? 'default' : 'secondary'} className="flex items-center gap-1">
            {isEnterprise ? '🔴 Enterprise Active' : 'Professional Plan'}
          </Badge>
          {isEnterprise && (
            <Badge variant="outline" className="flex items-center gap-1">
              <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse" />
              Live Monitoring
            </Badge>
          )}
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="voice-agent" disabled={!isEnterprise} className="flex items-center gap-2">
            <Headphones className="h-4 w-4" />
            Voice Agent
          </TabsTrigger>
          <TabsTrigger value="campaigns" className="flex items-center gap-2">
            <Megaphone className="h-4 w-4" />
            Campaigns
          </TabsTrigger>
          <TabsTrigger value="system" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            System Health
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>System Overview</CardTitle>
                <CardDescription>
                  High-level status of all automation systems
                </CardDescription>
              </CardHeader>
              <CardContent>
                <SystemMonitoringDashboard compact />
              </CardContent>
            </Card>

            {isEnterprise && (
              <Card>
                <CardHeader>
                  <CardTitle>Voice Agent Status</CardTitle>
                  <CardDescription>
                    Real-time voice processing and call statistics
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <VoiceAgentMonitor compact />
                </CardContent>
              </Card>
            )}

            <Card className={isEnterprise ? '' : 'lg:col-span-1'}>
              <CardHeader>
                <CardTitle>Campaign Activity</CardTitle>
                <CardDescription>
                  Current campaign execution and progress
                </CardDescription>
              </CardHeader>
              <CardContent>
                <CampaignMonitor compact />
              </CardContent>
            </Card>

            {!isEnterprise && (
              <Card className="border-dashed border-2">
                <CardHeader>
                  <CardTitle className="text-muted-foreground">Enterprise Features</CardTitle>
                  <CardDescription>
                    Upgrade to Enterprise for advanced monitoring
                  </CardDescription>
                </CardHeader>
                <CardContent className="text-center py-8">
                  <Headphones className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-sm text-muted-foreground mb-4">
                    Voice Agent monitoring, real-time call analytics, and advanced system health tracking
                  </p>
                  <Badge variant="outline">Available with Enterprise (€299.99/month)</Badge>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="voice-agent">
          {isEnterprise ? (
            <VoiceAgentMonitor />
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Enterprise Voice Agent Monitoring</CardTitle>
                <CardDescription>
                  Advanced voice agent monitoring requires Enterprise subscription
                </CardDescription>
              </CardHeader>
              <CardContent className="text-center py-16">
                <Headphones className="h-16 w-16 text-muted-foreground mx-auto mb-6" />
                <h3 className="text-lg font-semibold mb-2">Voice Agent Monitoring</h3>
                <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                  Monitor real-time call processing, voice synthesis performance, and customer satisfaction metrics with our Enterprise plan.
                </p>
                <Badge variant="outline">Upgrade to Enterprise to unlock</Badge>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="campaigns">
          <CampaignMonitor />
        </TabsContent>

        <TabsContent value="system">
          <SystemMonitoringDashboard />
        </TabsContent>
      </Tabs>
    </div>
  );
}