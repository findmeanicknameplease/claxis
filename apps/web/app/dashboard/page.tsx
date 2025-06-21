import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth/config';
import { redirect } from 'next/navigation';
import { DashboardHeader } from '@/components/dashboard/header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PerformanceMonitor } from '@/components/performance/performance-monitor';
import { 
  Phone, 
  MessageSquare, 
  TrendingUp, 
  Activity,
  Users,
  Calendar,
  ArrowRight,
  Zap
} from 'lucide-react';
import Link from 'next/link';

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    redirect('/auth/login');
  }

  const isEnterprise = session.user.salon?.subscription_tier === 'enterprise';

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader session={session} />
      
      <main className="container mx-auto px-4 py-8">
        <div className="space-y-6">
          {/* Welcome Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">
                Welcome, {session.user.name || session.user.email}
              </h1>
              <p className="text-muted-foreground flex items-center gap-2">
                {session.user.salon?.business_name} 
                <Badge variant={isEnterprise ? 'default' : 'secondary'}>
                  {session.user.salon?.subscription_tier || 'Professional'}
                </Badge>
                • {session.user.role}
              </p>
            </div>
            {isEnterprise && (
              <Badge variant="outline" className="flex items-center gap-1">
                <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse" />
                Enterprise Active
              </Badge>
            )}
          </div>

          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Today's Bookings</CardTitle>
                <Calendar className="h-4 w-4 text-blue-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">12</div>
                <p className="text-xs text-muted-foreground">
                  +2 from yesterday
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Revenue</CardTitle>
                <TrendingUp className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">€1,247</div>
                <p className="text-xs text-muted-foreground">
                  This week
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Messages</CardTitle>
                <MessageSquare className="h-4 w-4 text-purple-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">47</div>
                <p className="text-xs text-muted-foreground">
                  WhatsApp + Instagram
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Voice Agent</CardTitle>
                <Phone className="h-4 w-4 text-orange-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {isEnterprise ? '24/7' : 'Upgrade'}
                </div>
                <p className="text-xs text-muted-foreground">
                  {isEnterprise ? 'AI receptionist active' : 'Available with Enterprise'}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Enterprise Features Showcase */}
          {isEnterprise ? (
            <div className="space-y-6">
              {/* Performance Monitor Widget */}
              <PerformanceMonitor compact={true} />
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="border-l-4 border-l-blue-500">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5 text-blue-600" />
                    Real-time Monitoring
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">System Status</span>
                    <Badge variant="default" className="bg-green-600">
                      <div className="h-2 w-2 bg-white rounded-full mr-1" />
                      All Systems Operational
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <div className="text-muted-foreground">Active Calls</div>
                      <div className="text-lg font-semibold">3</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Response Time</div>
                      <div className="text-lg font-semibold">1.2s</div>
                    </div>
                  </div>
                  <Link href="/dashboard/monitoring">
                    <Button variant="outline" size="sm" className="w-full">
                      View Full Monitoring <ArrowRight className="h-3 w-3 ml-1" />
                    </Button>
                  </Link>
                </CardContent>
              </Card>

              <Card className="border-l-4 border-l-green-500">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Zap className="h-5 w-5 text-green-600" />
                    Voice Agent Performance
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Today's Statistics</span>
                    <Badge variant="outline">47 calls handled</Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <div className="text-muted-foreground">Success Rate</div>
                      <div className="text-lg font-semibold text-green-600">98.5%</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Language</div>
                      <div className="text-lg font-semibold">🇩🇪 German</div>
                    </div>
                  </div>
                  <Link href="/dashboard/voice-agent">
                    <Button variant="outline" size="sm" className="w-full">
                      Manage Voice Agent <ArrowRight className="h-3 w-3 ml-1" />
                    </Button>
                  </Link>
                </CardContent>
              </Card>
              </div>
            </div>
          ) : (
            <Card className="border-dashed border-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Phone className="h-5 w-5 text-muted-foreground" />
                  Enterprise Voice Agent
                </CardTitle>
              </CardHeader>
              <CardContent className="text-center py-8">
                <div className="space-y-4">
                  <div className="text-4xl">🎙️</div>
                  <div>
                    <h3 className="text-lg font-semibold mb-2">24/7 AI Voice Receptionist</h3>
                    <p className="text-muted-foreground mb-4 max-w-md mx-auto">
                      Revolutionary voice automation that replaces a €1,200/month receptionist with intelligent AI that never sleeps.
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-4 max-w-md mx-auto text-sm">
                    <div className="p-3 border rounded">
                      <div className="font-medium">Real-time Processing</div>
                      <div className="text-muted-foreground">&lt;2s response</div>
                    </div>
                    <div className="p-3 border rounded">
                      <div className="font-medium">Multi-language</div>
                      <div className="text-muted-foreground">4 EU languages</div>
                    </div>
                  </div>
                  <Button>
                    Upgrade to Enterprise (€299.99/month)
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Quick Actions */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Link href="/dashboard/communications">
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <MessageSquare className="h-8 w-8 text-blue-600" />
                    <div>
                      <h3 className="font-semibold">Communications</h3>
                      <p className="text-sm text-muted-foreground">WhatsApp, Instagram & Voice</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link href="/dashboard/monitoring">
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <Activity className="h-8 w-8 text-green-600" />
                    <div>
                      <h3 className="font-semibold">System Monitoring</h3>
                      <p className="text-sm text-muted-foreground">Real-time health & performance</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link href="/dashboard/settings">
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <Users className="h-8 w-8 text-purple-600" />
                    <div>
                      <h3 className="font-semibold">Salon Settings</h3>
                      <p className="text-sm text-muted-foreground">Team, services & automation</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}