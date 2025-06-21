'use client';

import { ConversationFilters } from '@/hooks/use-conversations';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { 
  CheckCircle2, 
  Clock, 
  Archive, 
  AlertCircle,
  Search,
  X
} from 'lucide-react';

interface InboxFiltersProps {
  filters: ConversationFilters;
  onFiltersChange: (filters: ConversationFilters) => void;
  conversationCounts: {
    active: number;
    waiting: number;
    resolved: number;
  };
}

export function InboxFilters({ 
  filters, 
  onFiltersChange, 
  conversationCounts 
}: InboxFiltersProps) {
  const updateFilter = (key: keyof ConversationFilters, value: any) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  const clearFilters = () => {
    onFiltersChange({ channel: 'all', status: 'all' });
  };

  const hasActiveFilters = 
    (filters.status && filters.status !== 'all') ||
    (filters.priority && filters.priority !== 'all') ||
    (filters.assignedTo && filters.assignedTo !== 'all') ||
    filters.hasUnread ||
    filters.search;

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search conversations..."
          value={filters.search || ''}
          onChange={(e) => updateFilter('search', e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Status Filter */}
      <div className="space-y-2">
        <Label className="text-xs font-medium text-muted-foreground">STATUS</Label>
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant={filters.status === 'active' ? 'default' : 'outline'}
            size="sm"
            onClick={() => updateFilter('status', filters.status === 'active' ? 'all' : 'active')}
            className="justify-start h-8"
          >
            <CheckCircle2 className="h-3 w-3 mr-2" />
            Active
            <Badge variant="secondary" className="ml-auto h-4 text-xs">
              {conversationCounts.active}
            </Badge>
          </Button>
          <Button
            variant={filters.status === 'waiting' ? 'default' : 'outline'}
            size="sm"
            onClick={() => updateFilter('status', filters.status === 'waiting' ? 'all' : 'waiting')}
            className="justify-start h-8"
          >
            <Clock className="h-3 w-3 mr-2" />
            Waiting
            <Badge variant="secondary" className="ml-auto h-4 text-xs">
              {conversationCounts.waiting}
            </Badge>
          </Button>
          <Button
            variant={filters.status === 'resolved' ? 'default' : 'outline'}
            size="sm"
            onClick={() => updateFilter('status', filters.status === 'resolved' ? 'all' : 'resolved')}
            className="justify-start h-8"
          >
            <Archive className="h-3 w-3 mr-2" />
            Resolved
            <Badge variant="secondary" className="ml-auto h-4 text-xs">
              {conversationCounts.resolved}
            </Badge>
          </Button>
          <Button
            variant={filters.status === 'archived' ? 'default' : 'outline'}
            size="sm"
            onClick={() => updateFilter('status', filters.status === 'archived' ? 'all' : 'archived')}
            className="justify-start h-8"
          >
            <Archive className="h-3 w-3 mr-2" />
            Archived
          </Button>
        </div>
      </div>

      {/* Priority Filter */}
      <div className="space-y-2">
        <Label className="text-xs font-medium text-muted-foreground">PRIORITY</Label>
        <Select
          value={filters.priority || 'all'}
          onValueChange={(value) => updateFilter('priority', value)}
        >
          <SelectTrigger className="h-8">
            <SelectValue placeholder="All priorities" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All priorities</SelectItem>
            <SelectItem value="urgent">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-3 w-3 text-red-500" />
                Urgent
              </div>
            </SelectItem>
            <SelectItem value="high">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-3 w-3 text-orange-500" />
                High
              </div>
            </SelectItem>
            <SelectItem value="medium">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-3 w-3 text-yellow-500" />
                Medium
              </div>
            </SelectItem>
            <SelectItem value="low">Low</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Assignment Filter */}
      <div className="space-y-2">
        <Label className="text-xs font-medium text-muted-foreground">ASSIGNED TO</Label>
        <Select
          value={filters.assignedTo || 'all'}
          onValueChange={(value) => updateFilter('assignedTo', value)}
        >
          <SelectTrigger className="h-8">
            <SelectValue placeholder="All assignments" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All assignments</SelectItem>
            <SelectItem value="unassigned">Unassigned</SelectItem>
            <SelectItem value="me">Assigned to me</SelectItem>
            <SelectItem value="others">Assigned to others</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Unread Toggle */}
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">Show only unread</Label>
        <Switch
          checked={filters.hasUnread || false}
          onCheckedChange={(checked) => updateFilter('hasUnread', checked)}
        />
      </div>

      {/* Clear Filters */}
      {hasActiveFilters && (
        <Button
          variant="outline"
          size="sm"
          onClick={clearFilters}
          className="w-full h-8"
        >
          <X className="h-3 w-3 mr-2" />
          Clear Filters
        </Button>
      )}
    </div>
  );
}