'use client';

import { useSystemHealth } from '@/hooks/use-system-health';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { 
  Server, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle,
  Clock,
  Wifi,
  Database,
  Headphones,
  MessageSquare,
  Brain,
  RefreshCw,
  ExternalLink
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';

interface SystemMonitoringDashboardProps {
  compact?: boolean;
}

const serviceIcons = {
  'Voice Gateway Service': Headphones,
  'ElevenLabs API': Brain,
  'Twilio Integration': Headphones,
  'WhatsApp Business API': MessageSquare,
  'Supabase Database': Database,
  'n8n Workflows': Server,
  'Redis Cache': Database,
};

const statusColors = {
  healthy: 'text-green-600 bg-green-100 dark:bg-green-900',
  degraded: 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900',
  down: 'text-red-600 bg-red-100 dark:bg-red-900',
};

const statusIcons = {
  healthy: CheckCircle2,
  degraded: AlertTriangle,
  down: XCircle,
};

export function SystemMonitoringDashboard({ compact = false }: SystemMonitoringDashboardProps) {
  const {
    health,
    isLoading,
    error,
    refreshHealth,
    getServicesByStatus,
    getCriticalServices,
    getAverageResponseTime,
  } = useSystemHealth();

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-muted rounded w-3/4"></div>
          <div className="h-8 bg-muted rounded"></div>
          <div className="h-4 bg-muted rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-red-200 bg-red-50 dark:bg-red-950">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Server className="h-5 w-5 text-red-600" />
              <span className="text-red-700 dark:text-red-300">System Monitoring Error</span>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={refreshHealth}
              className="border-red-200"
            >
              <RefreshCw className="h-4 w-4 mr-1" />
              Retry
            </Button>
          </div>
          <p className="text-sm text-red-600 dark:text-red-400 mt-2">{error}</p>
        </CardContent>
      </Card>
    );
  }

  const healthyServices = getServicesByStatus('healthy');
  const degradedServices = getServicesByStatus('degraded');
  const downServices = getServicesByStatus('down');
  const criticalServices = getCriticalServices();
  const avgResponseTime = getAverageResponseTime();

  if (compact) {
    return (
      <div className="space-y-4">
        {/* Overall Status */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={cn(
              "h-3 w-3 rounded-full",
              health.overall === 'healthy' ? "bg-green-500" : 
              health.overall === 'degraded' ? "bg-yellow-500" : "bg-red-500"
            )} />
            <span className="font-medium">
              {health.overall === 'healthy' ? 'All Systems Operational' :
               health.overall === 'degraded' ? 'Some Issues Detected' : 'Service Disruption'}
            </span>
          </div>
          <Badge variant="outline" className="text-xs">
            {health.uptimePercentage.toFixed(1)}% uptime
          </Badge>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-muted-foreground">Services Online</div>
            <div className="text-xl font-bold text-green-600">
              {healthyServices.length}/{health.services.length}
            </div>
          </div>
          <div>
            <div className="text-muted-foreground">Avg Response</div>
            <div className="text-xl font-bold">{avgResponseTime}ms</div>
          </div>
        </div>

        {/* Critical Issues */}
        {(degradedServices.length > 0 || downServices.length > 0) && (
          <div className="space-y-1">
            {downServices.map((service) => (
              <div key={service.name} className="flex items-center gap-2 text-sm text-red-600">
                <XCircle className="h-3 w-3" />
                <span>{service.name} is down</span>
              </div>
            ))}
            {degradedServices.map((service) => (
              <div key={service.name} className="flex items-center gap-2 text-sm text-yellow-600">
                <AlertTriangle className="h-3 w-3" />
                <span>{service.name} degraded</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* System Overview Header */}
      <Card className={cn(
        "border-l-4",
        health.overall === 'healthy' ? "border-l-green-500 bg-green-50 dark:bg-green-950" :
        health.overall === 'degraded' ? "border-l-yellow-500 bg-yellow-50 dark:bg-yellow-950" :
        "border-l-red-500 bg-red-50 dark:bg-red-950"
      )}>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={cn(
                "h-4 w-4 rounded-full",
                health.overall === 'healthy' ? "bg-green-500" :
                health.overall === 'degraded' ? "bg-yellow-500 animate-pulse" :
                "bg-red-500 animate-pulse"
              )} />
              <div>
                <h3 className="font-semibold text-lg">
                  {health.overall === 'healthy' ? 'All Systems Operational' :
                   health.overall === 'degraded' ? 'Some Services Degraded' : 
                   'System Disruption Detected'}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {healthyServices.length} of {health.services.length} services running normally
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">
                Updated {formatDistanceToNow(health.lastUpdate)} ago
              </Badge>
              <Button variant="outline" size="sm" onClick={refreshHealth}>
                <RefreshCw className="h-4 w-4 mr-1" />
                Refresh
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* System Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Services Online</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {healthyServices.length}/{health.services.length}
            </div>
            <p className="text-xs text-muted-foreground">
              {((healthyServices.length / health.services.length) * 100).toFixed(1)}% operational
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Response Time</CardTitle>
            <Clock className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{avgResponseTime}ms</div>
            <p className="text-xs text-muted-foreground">
              Average across all services
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Uptime</CardTitle>
            <Wifi className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{health.uptimePercentage.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">
              Rolling 30-day average
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Incidents</CardTitle>
            <AlertTriangle className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{health.incidentCount}</div>
            <p className="text-xs text-muted-foreground">
              Past 24 hours
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Service Status Grid */}
      <Card>
        <CardHeader>
          <CardTitle>Service Status</CardTitle>
          <CardDescription>
            Real-time status of all integrated services and systems
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {health.services.map((service) => {
              const StatusIcon = statusIcons[service.status];
              const ServiceIcon = serviceIcons[service.name as keyof typeof serviceIcons] || Server;
              
              return (
                <Card key={service.name} className="border-l-4 border-l-muted">
                  <CardContent className="pt-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <ServiceIcon className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <h4 className="font-medium">{service.name}</h4>
                          <p className="text-xs text-muted-foreground">
                            {service.description}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge 
                          variant="outline" 
                          className={cn("text-xs", statusColors[service.status])}
                        >
                          <StatusIcon className="h-3 w-3 mr-1" />
                          {service.status}
                        </Badge>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <div className="text-muted-foreground">Response Time</div>
                        <div className="font-semibold">{service.responseTime}ms</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Uptime</div>
                        <div className="font-semibold">{service.uptime.toFixed(1)}%</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Error Count</div>
                        <div className={cn(
                          "font-semibold",
                          service.errorCount > 0 ? "text-red-600" : "text-green-600"
                        )}>
                          {service.errorCount}
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                      <span>Last checked {formatDistanceToNow(service.lastCheck)} ago</span>
                      {service.endpoint && (
                        <Button variant="ghost" size="sm" className="h-6 px-2">
                          <ExternalLink className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Critical Services Monitor */}
      <Card>
        <CardHeader>
          <CardTitle>Critical Services</CardTitle>
          <CardDescription>
            Essential services that directly impact customer experience
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {criticalServices.map((service) => {
              const StatusIcon = statusIcons[service.status];
              const ServiceIcon = serviceIcons[service.name as keyof typeof serviceIcons] || Server;
              
              return (
                <div 
                  key={service.name} 
                  className={cn(
                    "flex items-center justify-between p-4 rounded-lg border",
                    service.status === 'healthy' ? "bg-green-50 dark:bg-green-950 border-green-200" :
                    service.status === 'degraded' ? "bg-yellow-50 dark:bg-yellow-950 border-yellow-200" :
                    "bg-red-50 dark:bg-red-950 border-red-200"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <ServiceIcon className="h-5 w-5" />
                    <div>
                      <p className="font-medium">{service.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {service.responseTime}ms response • {service.uptime.toFixed(1)}% uptime
                      </p>
                    </div>
                  </div>
                  <Badge 
                    variant="outline"
                    className={cn("text-xs", statusColors[service.status])}
                  >
                    <StatusIcon className="h-3 w-3 mr-1" />
                    {service.status}
                  </Badge>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* System Performance */}
      <Card>
        <CardHeader>
          <CardTitle>System Performance</CardTitle>
          <CardDescription>
            Overall system health and performance metrics
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-sm font-medium">Overall Health</span>
                <span className="text-sm text-muted-foreground">
                  {health.overall === 'healthy' ? 'Excellent' :
                   health.overall === 'degraded' ? 'Good' : 'Poor'}
                </span>
              </div>
              <Progress 
                value={health.overall === 'healthy' ? 100 : health.overall === 'degraded' ? 70 : 30} 
                className="h-2" 
              />
              <p className="text-xs text-muted-foreground mt-1">
                {healthyServices.length} of {health.services.length} services operational
              </p>
            </div>
            
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-sm font-medium">Response Performance</span>
                <span className="text-sm text-muted-foreground">
                  {avgResponseTime < 500 ? 'Excellent' : avgResponseTime < 1000 ? 'Good' : 'Needs Improvement'}
                </span>
              </div>
              <Progress 
                value={Math.max(0, 100 - (avgResponseTime / 10))} 
                className="h-2" 
              />
              <p className="text-xs text-muted-foreground mt-1">
                {avgResponseTime}ms average response time
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}