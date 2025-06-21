'use client';

import { useState } from 'react';
import { Conversation } from '@/hooks/use-conversations';
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
import { 
  CheckCircle2,
  Clock,
  Archive,
  UserCheck,
  Tag,
  AlertTriangle,
  Phone,
  Calendar,
  X
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ConversationActionsProps {
  conversation: Conversation;
  onStatusChange: (status: Conversation['status']) => void;
  onAssign: (assignedTo: string) => void;
  onAddTags: (tags: string[]) => void;
  onClose: () => void;
}

const statusOptions = [
  { value: 'active', label: 'Active', icon: CheckCircle2, color: 'text-green-600' },
  { value: 'waiting', label: 'Waiting', icon: Clock, color: 'text-yellow-600' },
  { value: 'resolved', label: 'Resolved', icon: CheckCircle2, color: 'text-gray-600' },
  { value: 'archived', label: 'Archived', icon: Archive, color: 'text-gray-400' },
] as const;

const priorityOptions = [
  { value: 'low', label: 'Low Priority', color: '' },
  { value: 'medium', label: 'Medium Priority', color: 'text-yellow-600' },
  { value: 'high', label: 'High Priority', color: 'text-orange-600' },
  { value: 'urgent', label: 'Urgent', color: 'text-red-600' },
] as const;

const commonTags = [
  'booking-inquiry',
  'pricing-question',
  'complaint',
  'compliment',
  'rescheduling',
  'cancellation',
  'new-customer',
  'vip-customer',
  'follow-up-needed',
  'technical-issue',
];

export function ConversationActions({
  conversation,
  onStatusChange,
  onAssign,
  onAddTags,
  onClose,
}: ConversationActionsProps) {
  const [newTag, setNewTag] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  const handleAddTag = () => {
    if (newTag.trim() && !conversation.tags.includes(newTag.trim())) {
      setSelectedTags([...selectedTags, newTag.trim()]);
      setNewTag('');
    }
  };

  const handleQuickTag = (tag: string) => {
    if (!conversation.tags.includes(tag) && !selectedTags.includes(tag)) {
      setSelectedTags([...selectedTags, tag]);
    }
  };

  const handleSaveTags = () => {
    if (selectedTags.length > 0) {
      onAddTags(selectedTags);
      setSelectedTags([]);
    }
  };

  const handleBookingAction = () => {
    // In a real implementation, this would open a booking modal
    // or redirect to the booking system
    console.log('Opening booking system for customer:', conversation.customerName);
  };

  const handleCallCustomer = () => {
    if (conversation.customerPhone) {
      // In a real implementation, this might trigger a voice call
      window.open(`tel:${conversation.customerPhone}`);
    }
  };

  return (
    <div className="p-4 border-b bg-muted/30 space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="font-medium">Conversation Actions</h4>
        <Button variant="ghost" size="sm" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handleBookingAction}
          className="justify-start"
        >
          <Calendar className="h-4 w-4 mr-2" />
          Create Booking
        </Button>
        
        {conversation.customerPhone && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleCallCustomer}
            className="justify-start"
          >
            <Phone className="h-4 w-4 mr-2" />
            Call Customer
          </Button>
        )}

        <Button
          variant="outline"
          size="sm"
          onClick={() => onStatusChange('resolved')}
          className="justify-start"
          disabled={conversation.status === 'resolved'}
        >
          <CheckCircle2 className="h-4 w-4 mr-2" />
          Mark Resolved
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={() => onStatusChange('archived')}
          className="justify-start"
          disabled={conversation.status === 'archived'}
        >
          <Archive className="h-4 w-4 mr-2" />
          Archive
        </Button>
      </div>

      {/* Status Change */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Status</Label>
        <Select
          value={conversation.status}
          onValueChange={(value) => onStatusChange(value as Conversation['status'])}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {statusOptions.map((option) => {
              const Icon = option.icon;
              return (
                <SelectItem key={option.value} value={option.value}>
                  <div className="flex items-center gap-2">
                    <Icon className={cn("h-4 w-4", option.color)} />
                    {option.label}
                  </div>
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      </div>

      {/* Priority */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Priority</Label>
        <div className="grid grid-cols-2 gap-1">
          {priorityOptions.map((option) => (
            <Button
              key={option.value}
              variant={conversation.priority === option.value ? 'default' : 'outline'}
              size="sm"
              onClick={() => {
                // In a real implementation, you'd have an onPriorityChange prop
                console.log('Priority changed to:', option.value);
              }}
              className="justify-start text-xs h-8"
            >
              {option.value === 'urgent' && <AlertTriangle className="h-3 w-3 mr-1" />}
              {option.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Assignment */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Assigned To</Label>
        <Select
          value={conversation.assignedTo || 'unassigned'}
          onValueChange={(value) => onAssign(value === 'unassigned' ? '' : value)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Unassigned" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="unassigned">
              <div className="flex items-center gap-2">
                <UserCheck className="h-4 w-4 text-muted-foreground" />
                Unassigned
              </div>
            </SelectItem>
            <SelectItem value="me">
              <div className="flex items-center gap-2">
                <UserCheck className="h-4 w-4 text-blue-600" />
                Assign to me
              </div>
            </SelectItem>
            <SelectItem value="manager">
              <div className="flex items-center gap-2">
                <UserCheck className="h-4 w-4 text-purple-600" />
                Manager
              </div>
            </SelectItem>
            <SelectItem value="specialist">
              <div className="flex items-center gap-2">
                <UserCheck className="h-4 w-4 text-green-600" />
                Specialist
              </div>
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Tags */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Tags</Label>
        
        {/* Current Tags */}
        {conversation.tags.length > 0 && (
          <div className="flex gap-1 flex-wrap">
            {conversation.tags.map((tag) => (
              <Badge key={tag} variant="secondary" className="text-xs">
                <Tag className="h-2 w-2 mr-1" />
                {tag}
              </Badge>
            ))}
          </div>
        )}

        {/* Add New Tag */}
        <div className="flex gap-2">
          <Input
            placeholder="Add tag..."
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleAddTag()}
            className="text-sm"
          />
          <Button size="sm" onClick={handleAddTag} disabled={!newTag.trim()}>
            Add
          </Button>
        </div>

        {/* New Tags to Add */}
        {selectedTags.length > 0 && (
          <div className="space-y-2">
            <div className="flex gap-1 flex-wrap">
              {selectedTags.map((tag) => (
                <Badge key={tag} variant="outline" className="text-xs">
                  <Tag className="h-2 w-2 mr-1" />
                  {tag}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-3 w-3 p-0 ml-1"
                    onClick={() => setSelectedTags(selectedTags.filter(t => t !== tag))}
                  >
                    <X className="h-2 w-2" />
                  </Button>
                </Badge>
              ))}
            </div>
            <Button size="sm" onClick={handleSaveTags}>
              Save Tags
            </Button>
          </div>
        )}

        {/* Common Tags */}
        <div>
          <Label className="text-xs text-muted-foreground">Quick Tags</Label>
          <div className="flex gap-1 flex-wrap mt-1">
            {commonTags.slice(0, 6).map((tag) => (
              <Button
                key={tag}
                variant="ghost"
                size="sm"
                onClick={() => handleQuickTag(tag)}
                disabled={conversation.tags.includes(tag) || selectedTags.includes(tag)}
                className="text-xs h-6 px-2"
              >
                {tag}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* Booking Intent Action */}
      {conversation.bookingIntent && conversation.bookingIntent.confidence > 0.7 && (
        <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <h5 className="text-sm font-medium">Booking Intent Detected</h5>
              <p className="text-xs text-muted-foreground">
                {Math.round(conversation.bookingIntent.confidence * 100)}% confidence for {conversation.bookingIntent.serviceType}
              </p>
            </div>
            <Button size="sm" onClick={handleBookingAction}>
              Create Booking
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}