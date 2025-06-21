'use client';

import { useCampaignProgress } from '@/hooks/use-campaign-progress';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { 
  Megaphone, 
  Play, 
  Pause, 
  Square, 
  Clock,
  Users,
  TrendingUp,
  CheckCircle2,
  RefreshCw,
  Plus
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';

interface CampaignMonitorProps {
  compact?: boolean;
}

const campaignTypeIcons = {
  'review-requests': '⭐',
  'reactivation': '🔄', 
  'follow-up': '👋',
  'promotional': '🎉',
  'missed-call-callback': '📞',
};

const campaignTypeLabels = {
  'review-requests': 'Review Requests',
  'reactivation': 'Customer Reactivation',
  'follow-up': 'Follow-up Calls', 
  'promotional': 'Promotional',
  'missed-call-callback': 'Missed Call Callbacks',
};

const statusColors = {
  pending: 'bg-yellow-500',
  running: 'bg-blue-500 animate-pulse',
  completed: 'bg-green-500',
  paused: 'bg-orange-500',
  error: 'bg-red-500',
};

export function CampaignMonitor({ compact = false }: CampaignMonitorProps) {
  const {
    metrics,
    isLoading,
    error,
    pauseCampaign,
    resumeCampaign,
    deleteCampaign,
    refreshCampaigns,
    getActiveCampaigns,
  } = useCampaignProgress();

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
              <Megaphone className="h-5 w-5 text-red-600" />
              <span className="text-red-700 dark:text-red-300">Campaign Error</span>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={refreshCampaigns}
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

  const activeCampaigns = getActiveCampaigns();

  if (compact) {
    return (
      <div className="space-y-4">
        {/* Quick Stats */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-muted-foreground">Active</div>
            <div className="text-xl font-bold">{activeCampaigns.length}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Completed Today</div>
            <div className="text-xl font-bold">{metrics?.completedToday || 0}</div>
          </div>
        </div>

        {/* Active Campaign List */}
        <div className="space-y-2">
          {activeCampaigns.slice(0, 3).map((campaign) => (
            <div key={campaign.id} className="flex items-center justify-between p-2 border rounded">
              <div className="flex items-center gap-2">
                <div className={cn("h-2 w-2 rounded-full", statusColors[campaign.status])} />
                <span className="text-sm font-medium truncate">{campaign.name}</span>
              </div>
              <div className="text-xs text-muted-foreground">
                {campaign.progress}%
              </div>
            </div>
          ))}
          {activeCampaigns.length === 0 && (
            <div className="text-center py-4 text-sm text-muted-foreground">
              No active campaigns
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Campaign Overview */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Megaphone className="h-6 w-6" />
            Campaign Monitor
          </h2>
          <p className="text-muted-foreground">
            Real-time campaign execution and performance tracking
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={refreshCampaigns}>
            <RefreshCw className="h-4 w-4 mr-1" />
            Refresh
          </Button>
          <Button size="sm">
            <Plus className="h-4 w-4 mr-1" />
            New Campaign
          </Button>
        </div>
      </div>

      {/* Metrics Overview */}
      {metrics && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Campaigns</CardTitle>
              <Megaphone className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.activeCampaigns}</div>
              <p className="text-xs text-muted-foreground">Currently running</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Completed Today</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.completedToday}</div>
              <p className="text-xs text-muted-foreground">Finished campaigns</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Calls</CardTitle>
              <Users className="h-4 w-4 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.totalCalls}</div>
              <p className="text-xs text-muted-foreground">All campaigns</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
              <TrendingUp className="h-4 w-4 text-emerald-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.averageSuccessRate}%</div>
              <p className="text-xs text-muted-foreground">Average across all</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Active Campaigns */}
      <Card>
        <CardHeader>
          <CardTitle>Active Campaigns</CardTitle>
          <CardDescription>
            Currently running and scheduled campaigns
          </CardDescription>
        </CardHeader>
        <CardContent>
          {activeCampaigns.length === 0 ? (
            <div className="text-center py-8">
              <Megaphone className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">No Active Campaigns</h3>
              <p className="text-muted-foreground mb-4">
                Create a new campaign to start engaging with your customers
              </p>
              <Button>
                <Plus className="h-4 w-4 mr-1" />
                Create Campaign
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {activeCampaigns.map((campaign) => (
                <Card key={campaign.id} className="border-l-4 border-l-blue-500">
                  <CardContent className="pt-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="text-2xl">
                          {campaignTypeIcons[campaign.type]}
                        </div>
                        <div>
                          <h4 className="font-semibold">{campaign.name}</h4>
                          <p className="text-sm text-muted-foreground">
                            {campaignTypeLabels[campaign.type]}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={campaign.status === 'running' ? 'default' : 'secondary'}>
                          <div className={cn("h-2 w-2 rounded-full mr-1", statusColors[campaign.status])} />
                          {campaign.status}
                        </Badge>
                        <div className="flex items-center gap-1">
                          {campaign.status === 'running' ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => pauseCampaign(campaign.id)}
                            >
                              <Pause className="h-3 w-3" />
                            </Button>
                          ) : campaign.status === 'paused' ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => resumeCampaign(campaign.id)}
                            >
                              <Play className="h-3 w-3" />
                            </Button>
                          ) : null}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => deleteCampaign(campaign.id)}
                          >
                            <Square className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3">
                      {/* Progress Bar */}
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span>Progress</span>
                          <span>{campaign.progress}%</span>
                        </div>
                        <Progress value={campaign.progress} className="h-2" />
                      </div>

                      {/* Campaign Stats */}
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <div className="text-muted-foreground">Completed</div>
                          <div className="font-semibold">{campaign.completed}</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Failed</div>
                          <div className="font-semibold text-red-600">{campaign.failed}</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Success Rate</div>
                          <div className="font-semibold">{campaign.successRate.toFixed(1)}%</div>
                        </div>
                      </div>

                      {/* Timing Information */}
                      <div className="flex items-center justify-between text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Started {formatDistanceToNow(campaign.startedAt || campaign.createdAt)} ago
                        </div>
                        {campaign.estimatedCompletion && (
                          <div>
                            ETA: {formatDistanceToNow(campaign.estimatedCompletion)}
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Activity */}
      {metrics?.recentActivity && metrics.recentActivity.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>
              Latest campaign events and status changes
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {metrics.recentActivity.map((activity, index) => (
                <div key={index} className="flex items-center gap-3 p-2 border rounded">
                  <div className="h-2 w-2 bg-blue-500 rounded-full" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">{activity.name}</p>
                    <p className="text-xs text-muted-foreground">{activity.action}</p>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {formatDistanceToNow(activity.timestamp)} ago
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}