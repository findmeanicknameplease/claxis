'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { 
  Activity, 
  Zap, 
  Clock, 
  TrendingUp, 
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  Monitor,
  Cpu,
  HardDrive,
  Wifi,
  Download
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useWebVitals, usePerformanceMonitor } from '@/hooks/use-performance';
import { PerformanceOptimizer } from '@/lib/performance/optimization';

interface PerformanceMonitorProps {
  className?: string;
  compact?: boolean;
}

interface PerformanceMetric {
  name: string;
  value: number;
  threshold: number;
  unit: string;
  description: string;
  status: 'good' | 'needs-improvement' | 'poor';
  icon: React.ComponentType<{ className?: string }>;
}

export function PerformanceMonitor({ className, compact = false }: PerformanceMonitorProps) {
  const [metrics, setMetrics] = useState<Record<string, any>>({});
  const [isMonitoring, setIsMonitoring] = useState<boolean>(false);
  const webVitals = useWebVitals();
  const { renderTime, rerenderCount } = usePerformanceMonitor('PerformanceMonitor');

  useEffect(() => {
    const interval = setInterval(() => {
      const currentMetrics = PerformanceOptimizer.getMetrics();
      setMetrics(currentMetrics);
    }, 1000);

    setIsMonitoring(true);

    return () => {
      clearInterval(interval);
      setIsMonitoring(false);
    };
  }, []);

  const performanceMetrics: PerformanceMetric[] = [
    {
      name: 'LCP',
      value: webVitals['LCP'] || 0,
      threshold: 2500,
      unit: 'ms',
      description: 'Largest Contentful Paint',
      status: !webVitals['LCP'] ? 'good' : webVitals['LCP'] <= 2500 ? 'good' : webVitals['LCP'] <= 4000 ? 'needs-improvement' : 'poor',
      icon: Clock,
    },
    {
      name: 'FID',
      value: webVitals['FID'] || 0,
      threshold: 100,
      unit: 'ms',
      description: 'First Input Delay',
      status: !webVitals['FID'] ? 'good' : webVitals['FID'] <= 100 ? 'good' : webVitals['FID'] <= 300 ? 'needs-improvement' : 'poor',
      icon: Zap,
    },
    {
      name: 'CLS',
      value: webVitals['CLS'] || 0,
      threshold: 0.1,
      unit: '',
      description: 'Cumulative Layout Shift',
      status: !webVitals['CLS'] ? 'good' : webVitals['CLS'] <= 0.1 ? 'good' : webVitals['CLS'] <= 0.25 ? 'needs-improvement' : 'poor',
      icon: Activity,
    },
  ];

  const getStatusColor = (status: PerformanceMetric['status']) => {
    switch (status) {
      case 'good':
        return 'text-green-600 bg-green-100 dark:bg-green-900';
      case 'needs-improvement':
        return 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900';
      case 'poor':
        return 'text-red-600 bg-red-100 dark:bg-red-900';
      default:
        return 'text-gray-600 bg-gray-100 dark:bg-gray-900';
    }
  };

  const getStatusIcon = (status: PerformanceMetric['status']) => {
    switch (status) {
      case 'good':
        return CheckCircle2;
      case 'needs-improvement':
        return AlertTriangle;
      case 'poor':
        return TrendingDown;
      default:
        return Activity;
    }
  };

  const exportPerformanceData = () => {
    const data = {
      timestamp: new Date().toISOString(),
      webVitals,
      metrics,
      component: {
        renderTime,
        rerenderCount,
      }
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `performance-report-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (compact) {
    return (
      <Card className={className}>
        <CardContent className="pt-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Activity className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">Performance</span>
            </div>
            <div className="flex items-center space-x-1">
              {performanceMetrics.map((metric) => {
                const StatusIcon = getStatusIcon(metric.status);
                return (
                  <StatusIcon
                    key={metric.name}
                    className={cn('h-3 w-3', getStatusColor(metric.status))}
                  />
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold flex items-center gap-2">
            <Monitor className="h-6 w-6" />
            Performance Monitor
          </h2>
          <p className="text-muted-foreground">
            Real-time application performance metrics and Web Vitals
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Badge variant={isMonitoring ? 'default' : 'secondary'}>
            {isMonitoring ? 'Monitoring' : 'Stopped'}
          </Badge>
          <Button onClick={exportPerformanceData} variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Web Vitals */}
      <div className="grid gap-4 md:grid-cols-3">
        {performanceMetrics.map((metric) => {
          const Icon = metric.icon;
          const StatusIcon = getStatusIcon(metric.status);
          const progress = Math.min((metric.value / metric.threshold) * 100, 100);
          
          return (
            <Card key={metric.name}>
              <CardContent className="pt-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <Icon className="h-5 w-5 text-primary" />
                    <span className="font-medium">{metric.name}</span>
                  </div>
                  <StatusIcon className={cn('h-4 w-4', getStatusColor(metric.status))} />
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-end space-x-1">
                    <span className="text-2xl font-bold">
                      {metric.value.toFixed(metric.unit === 'ms' ? 0 : 2)}
                    </span>
                    <span className="text-sm text-muted-foreground">{metric.unit}</span>
                  </div>
                  
                  <Progress 
                    value={progress} 
                    className={cn(
                      'h-2',
                      metric.status === 'good' && 'text-green-600',
                      metric.status === 'needs-improvement' && 'text-yellow-600',
                      metric.status === 'poor' && 'text-red-600'
                    )}
                  />
                  
                  <p className="text-xs text-muted-foreground">{metric.description}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Detailed Metrics */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Resource Performance */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wifi className="h-5 w-5" />
              Resource Loading
            </CardTitle>
            <CardDescription>
              Performance metrics for various resource types
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Object.entries(metrics).filter(([key]) => key.startsWith('resource_')).map(([key, value]) => {
                const resourceType = key.replace('resource_', '');
                return (
                  <div key={key} className="flex items-center justify-between">
                    <span className="text-sm capitalize">{resourceType}</span>
                    <div className="text-right">
                      <div className="text-sm font-medium">{value.avg?.toFixed(0)}ms</div>
                      <div className="text-xs text-muted-foreground">avg</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Memory Usage */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <HardDrive className="h-5 w-5" />
              Memory Usage
            </CardTitle>
            <CardDescription>
              JavaScript heap memory consumption
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {metrics['memory_used'] && metrics['memory_total'] && (
                <>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Used</span>
                      <span>{(metrics['memory_used'].avg / 1024 / 1024).toFixed(1)} MB</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Total</span>
                      <span>{(metrics['memory_total'].avg / 1024 / 1024).toFixed(1)} MB</span>
                    </div>
                    <Progress 
                      value={(metrics['memory_used'].avg / metrics['memory_total'].avg) * 100}
                      className="h-2"
                    />
                  </div>
                  
                  <div className="text-xs text-muted-foreground">
                    Usage: {((metrics['memory_used'].avg / metrics['memory_total'].avg) * 100).toFixed(1)}%
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Component Performance */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Cpu className="h-5 w-5" />
            Component Performance
          </CardTitle>
          <CardDescription>
            Performance metrics for this component
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {renderTime.toFixed(2)}ms
              </div>
              <div className="text-xs text-muted-foreground">Last Render</div>
            </div>
            
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {rerenderCount}
              </div>
              <div className="text-xs text-muted-foreground">Total Renders</div>
            </div>
            
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">
                {rerenderCount > 0 ? (renderTime / rerenderCount).toFixed(2) : '0.00'}ms
              </div>
              <div className="text-xs text-muted-foreground">Avg Render</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Performance Tips */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Performance Recommendations
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {performanceMetrics.some(m => m.status === 'poor') && (
              <div className="flex items-start space-x-3 p-3 bg-red-50 dark:bg-red-950 rounded-lg">
                <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5" />
                <div>
                  <p className="font-medium text-red-900 dark:text-red-100">Poor Performance Detected</p>
                  <p className="text-sm text-red-700 dark:text-red-200">
                    Some Web Vitals metrics are below recommended thresholds. Consider optimizing images, reducing JavaScript bundles, or implementing code splitting.
                  </p>
                </div>
              </div>
            )}
            
            {performanceMetrics.some(m => m.status === 'needs-improvement') && (
              <div className="flex items-start space-x-3 p-3 bg-yellow-50 dark:bg-yellow-950 rounded-lg">
                <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
                <div>
                  <p className="font-medium text-yellow-900 dark:text-yellow-100">Performance Can Be Improved</p>
                  <p className="text-sm text-yellow-700 dark:text-yellow-200">
                    Consider implementing lazy loading, optimizing critical rendering path, or reducing third-party scripts.
                  </p>
                </div>
              </div>
            )}
            
            {performanceMetrics.every(m => m.status === 'good') && (
              <div className="flex items-start space-x-3 p-3 bg-green-50 dark:bg-green-950 rounded-lg">
                <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
                <div>
                  <p className="font-medium text-green-900 dark:text-green-100">Excellent Performance</p>
                  <p className="text-sm text-green-700 dark:text-green-200">
                    All Web Vitals metrics are within recommended ranges. Your users are experiencing optimal performance.
                  </p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}