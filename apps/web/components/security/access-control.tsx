'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { 
  Shield, 
  AlertTriangle,
  CheckCircle2,
  Settings,
  Monitor,
  UserCheck,
  AlertCircle,
  Download
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';

interface AccessControlProps {
  salonId: string;
  currentUserRole: 'owner' | 'manager' | 'staff';
  className?: string;
}

interface SecurityEvent {
  id: string;
  type: 'login' | 'logout' | 'permission_change' | 'failed_attempt' | 'suspicious_activity';
  user: string;
  action: string;
  timestamp: Date;
  ip_address?: string;
  device?: string;
  location?: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

interface AccessPolicy {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  settings: Record<string, any>;
}

interface UserPermission {
  userId: string;
  name: string;
  email: string;
  role: 'owner' | 'manager' | 'staff';
  status: 'active' | 'inactive' | 'suspended';
  lastLogin?: Date;
  permissions: {
    dashboard: boolean;
    bookings: boolean;
    customers: boolean;
    communications: boolean;
    voice_agent: boolean;
    reports: boolean;
    settings: boolean;
    user_management: boolean;
  };
}

// Mock data
const mockSecurityEvents: SecurityEvent[] = [
  {
    id: 'evt_001',
    type: 'login',
    user: 'maria.schmidt@salon.com',
    action: 'User logged in successfully',
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
    ip_address: '192.168.1.15',
    device: 'Chrome/Windows',
    location: 'Berlin, Germany',
    severity: 'low',
  },
  {
    id: 'evt_002',
    type: 'failed_attempt',
    user: 'unknown@example.com',
    action: 'Failed login attempt - Invalid credentials',
    timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000),
    ip_address: '203.45.67.89',
    device: 'Unknown',
    location: 'Unknown',
    severity: 'medium',
  },
  {
    id: 'evt_003',
    type: 'permission_change',
    user: 'owner@salon.com',
    action: 'Updated user permissions for julia.weber@salon.com',
    timestamp: new Date(Date.now() - 8 * 60 * 60 * 1000),
    ip_address: '192.168.1.10',
    device: 'Safari/macOS',
    location: 'Berlin, Germany',
    severity: 'low',
  },
];

const mockAccessPolicies: AccessPolicy[] = [
  {
    id: 'policy_001',
    name: 'Two-Factor Authentication',
    description: 'Require 2FA for all user accounts',
    enabled: true,
    settings: { enforce_for_all: true, grace_period_days: 7 },
  },
  {
    id: 'policy_002',
    name: 'Session Timeout',
    description: 'Automatically log out inactive users',
    enabled: true,
    settings: { timeout_minutes: 30, warning_minutes: 5 },
  },
  {
    id: 'policy_003',
    name: 'IP Allowlist',
    description: 'Restrict access to specific IP addresses',
    enabled: false,
    settings: { allowed_ips: ['192.168.1.0/24'], strict_mode: false },
  },
  {
    id: 'policy_004',
    name: 'Device Restrictions',
    description: 'Limit access to trusted devices',
    enabled: false,
    settings: { max_devices_per_user: 3, require_approval: true },
  },
];

const mockUserPermissions: UserPermission[] = [
  {
    userId: 'user_001',
    name: 'Maria Schmidt',
    email: 'maria.schmidt@salon.com',
    role: 'owner',
    status: 'active',
    lastLogin: new Date(Date.now() - 2 * 60 * 60 * 1000),
    permissions: {
      dashboard: true,
      bookings: true,
      customers: true,
      communications: true,
      voice_agent: true,
      reports: true,
      settings: true,
      user_management: true,
    },
  },
  {
    userId: 'user_002',
    name: 'Julia Weber',
    email: 'julia.weber@salon.com',
    role: 'manager',
    status: 'active',
    lastLogin: new Date(Date.now() - 24 * 60 * 60 * 1000),
    permissions: {
      dashboard: true,
      bookings: true,
      customers: true,
      communications: true,
      voice_agent: true,
      reports: true,
      settings: false,
      user_management: false,
    },
  },
  {
    userId: 'user_003',
    name: 'Anna Kowalski',
    email: 'anna.kowalski@salon.com',
    role: 'staff',
    status: 'active',
    lastLogin: new Date(Date.now() - 6 * 60 * 60 * 1000),
    permissions: {
      dashboard: true,
      bookings: true,
      customers: true,
      communications: false,
      voice_agent: false,
      reports: false,
      settings: false,
      user_management: false,
    },
  },
];

const severityColors = {
  low: 'text-green-600 bg-green-100 dark:bg-green-900',
  medium: 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900',
  high: 'text-orange-600 bg-orange-100 dark:bg-orange-900',
  critical: 'text-red-600 bg-red-100 dark:bg-red-900',
};

const eventIcons = {
  login: CheckCircle2,
  logout: Monitor,
  permission_change: UserCheck,
  failed_attempt: AlertTriangle,
  suspicious_activity: AlertCircle,
};

export function AccessControl({ salonId, currentUserRole, className }: AccessControlProps) {
  const [securityEvents, setSecurityEvents] = useState<SecurityEvent[]>([]);
  const [accessPolicies, setAccessPolicies] = useState<AccessPolicy[]>([]);
  const [userPermissions, setUserPermissions] = useState<UserPermission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'events' | 'policies' | 'users'>('events');

  useEffect(() => {
    const fetchSecurityData = async () => {
      try {
        // Mock API call
        await new Promise(resolve => setTimeout(resolve, 500));
        setSecurityEvents(mockSecurityEvents);
        setAccessPolicies(mockAccessPolicies);
        setUserPermissions(mockUserPermissions);
      } catch (error) {
        console.error('Failed to fetch security data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSecurityData();
  }, [salonId]);

  const handlePolicyToggle = (policyId: string, enabled: boolean) => {
    setAccessPolicies(policies =>
      policies.map(policy =>
        policy.id === policyId ? { ...policy, enabled } : policy
      )
    );
  };

  const handlePermissionUpdate = (userId: string, permission: string, value: boolean) => {
    setUserPermissions(users =>
      users.map(user =>
        user.userId === userId
          ? {
              ...user,
              permissions: { ...user.permissions, [permission]: value }
            }
          : user
      )
    );
  };

  const exportSecurityLog = () => {
    const csvContent = [
      'Timestamp,Type,User,Action,IP,Device,Location,Severity',
      ...securityEvents.map(event =>
        [
          event.timestamp.toLocaleString(),
          event.type,
          event.user,
          event.action,
          event.ip_address || '',
          event.device || '',
          event.location || '',
          event.severity,
        ].join(',')
      )
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `security-log-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <div className={cn("space-y-4", className)}>
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-48" />
          <div className="grid grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-32 bg-muted rounded" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Only allow owners and managers to view security settings
  if (currentUserRole === 'staff') {
    return (
      <Card className={className}>
        <CardContent className="pt-6 text-center">
          <Shield className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Access Restricted</h3>
          <p className="text-muted-foreground">
            You don't have permission to view security settings.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={cn("space-y-6", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold flex items-center gap-2">
            <Shield className="h-6 w-6" />
            Security & Access Control
          </h2>
          <p className="text-muted-foreground">
            Manage user permissions, security policies, and monitor access events
          </p>
        </div>
        <Button onClick={exportSecurityLog} variant="outline">
          <Download className="h-4 w-4 mr-2" />
          Export Log
        </Button>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {userPermissions.filter(u => u.status === 'active').length}
              </div>
              <div className="text-xs text-muted-foreground">Active Users</div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {accessPolicies.filter(p => p.enabled).length}
              </div>
              <div className="text-xs text-muted-foreground">Active Policies</div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-600">
                {securityEvents.filter(e => e.severity === 'medium' || e.severity === 'high').length}
              </div>
              <div className="text-xs text-muted-foreground">Security Alerts</div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">
                {securityEvents.filter(e => e.type === 'failed_attempt').length}
              </div>
              <div className="text-xs text-muted-foreground">Failed Attempts</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tab Navigation */}
      <div className="flex space-x-1 bg-muted p-1 rounded-lg w-fit">
        <Button
          variant={activeTab === 'events' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('events')}
        >
          Security Events
        </Button>
        <Button
          variant={activeTab === 'policies' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('policies')}
        >
          Access Policies
        </Button>
        <Button
          variant={activeTab === 'users' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('users')}
        >
          User Permissions
        </Button>
      </div>

      {/* Tab Content */}
      {activeTab === 'events' && (
        <Card>
          <CardHeader>
            <CardTitle>Recent Security Events</CardTitle>
            <CardDescription>
              Monitor login attempts, permission changes, and security incidents
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {securityEvents.map((event) => {
                const Icon = eventIcons[event.type];
                return (
                  <div key={event.id} className="flex items-start gap-4 p-4 border rounded-lg">
                    <div className={cn(
                      "h-10 w-10 rounded-full flex items-center justify-center flex-shrink-0",
                      severityColors[event.severity]
                    )}>
                      <Icon className="h-5 w-5" />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium text-sm">{event.action}</h4>
                        <Badge variant="outline" className={cn("text-xs", severityColors[event.severity])}>
                          {event.severity}
                        </Badge>
                      </div>
                      
                      <div className="text-sm text-muted-foreground mt-1">
                        <span className="font-medium">{event.user}</span>
                        {event.ip_address && (
                          <span> • IP: {event.ip_address}</span>
                        )}
                        {event.device && (
                          <span> • {event.device}</span>
                        )}
                        {event.location && (
                          <span> • {event.location}</span>
                        )}
                      </div>
                      
                      <div className="text-xs text-muted-foreground mt-1">
                        {formatDistanceToNow(event.timestamp)} ago
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {activeTab === 'policies' && (
        <Card>
          <CardHeader>
            <CardTitle>Security Policies</CardTitle>
            <CardDescription>
              Configure security policies and access controls for your salon
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {accessPolicies.map((policy) => (
                <div key={policy.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium">{policy.name}</h4>
                      <Badge variant={policy.enabled ? 'default' : 'secondary'}>
                        {policy.enabled ? 'Enabled' : 'Disabled'}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {policy.description}
                    </p>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm">
                      <Settings className="h-4 w-4 mr-2" />
                      Configure
                    </Button>
                    <Switch
                      checked={policy.enabled}
                      onCheckedChange={(enabled) => handlePolicyToggle(policy.id, enabled)}
                      disabled={currentUserRole !== 'owner'}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {activeTab === 'users' && (
        <Card>
          <CardHeader>
            <CardTitle>User Permissions</CardTitle>
            <CardDescription>
              Manage user roles and permissions for your salon team
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {userPermissions.map((user) => (
                <div key={user.userId} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium">{user.name}</h4>
                        <Badge variant="outline" className="capitalize">
                          {user.role}
                        </Badge>
                        <Badge variant={user.status === 'active' ? 'default' : 'secondary'}>
                          {user.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {user.email} • Last login: {user.lastLogin ? formatDistanceToNow(user.lastLogin) + ' ago' : 'Never'}
                      </p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {Object.entries(user.permissions).map(([permission, enabled]) => (
                      <div key={permission} className="flex items-center space-x-2">
                        <Switch
                          checked={enabled}
                          onCheckedChange={(value) => handlePermissionUpdate(user.userId, permission, value)}
                          disabled={currentUserRole !== 'owner' || user.role === 'owner'}
                        />
                        <Label className="text-sm capitalize">
                          {permission.replace('_', ' ')}
                        </Label>
                      </div>
                    ))}
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