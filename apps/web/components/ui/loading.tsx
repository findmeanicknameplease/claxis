'use client';

import { cn } from '@/lib/utils';
import { Loader2, Sparkles } from 'lucide-react';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function LoadingSpinner({ size = 'md', className }: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-6 w-6',
    lg: 'h-8 w-8',
  };

  return (
    <Loader2 
      className={cn(
        'animate-spin text-primary',
        sizeClasses[size],
        className
      )} 
    />
  );
}

interface LoadingSkeletonProps {
  className?: string;
  lines?: number;
}

export function LoadingSkeleton({ className, lines = 1 }: LoadingSkeletonProps) {
  return (
    <div className={cn('space-y-2', className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="h-4 bg-muted animate-pulse rounded"
          style={{
            width: `${Math.random() * 40 + 60}%`,
            animationDelay: `${i * 0.1}s`,
          }}
        />
      ))}
    </div>
  );
}

interface PremiumLoadingProps {
  message?: string;
  submessage?: string;
  progress?: number;
  className?: string;
}

export function PremiumLoading({ 
  message = 'Loading...', 
  submessage,
  progress,
  className 
}: PremiumLoadingProps) {
  return (
    <div className={cn(
      'flex flex-col items-center justify-center p-8 space-y-4',
      className
    )}>
      {/* Premium animated icon */}
      <div className="relative">
        <div className="h-16 w-16 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 animate-pulse" />
        <Sparkles className="absolute inset-0 h-16 w-16 text-white animate-spin" style={{ animationDuration: '3s' }} />
      </div>
      
      {/* Loading message */}
      <div className="text-center space-y-2">
        <h3 className="text-lg font-semibold">{message}</h3>
        {submessage && (
          <p className="text-sm text-muted-foreground">{submessage}</p>
        )}
      </div>
      
      {/* Progress bar */}
      {progress !== undefined && (
        <div className="w-64 h-2 bg-muted rounded-full overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-blue-500 to-purple-600 transition-all duration-300 ease-out"
            style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
          />
        </div>
      )}
      
      {/* Animated dots */}
      <div className="flex space-x-1">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-2 w-2 bg-primary rounded-full animate-bounce"
            style={{ animationDelay: `${i * 0.1}s` }}
          />
        ))}
      </div>
    </div>
  );
}

interface LoadingCardProps {
  title?: string;
  description?: string;
  className?: string;
}

export function LoadingCard({ title, description, className }: LoadingCardProps) {
  return (
    <div className={cn(
      'p-6 border rounded-lg bg-background space-y-4',
      className
    )}>
      {/* Header skeleton */}
      <div className="space-y-2">
        {title ? (
          <h3 className="font-semibold text-lg">{title}</h3>
        ) : (
          <div className="h-6 bg-muted animate-pulse rounded w-48" />
        )}
        {description ? (
          <p className="text-muted-foreground text-sm">{description}</p>
        ) : (
          <div className="h-4 bg-muted animate-pulse rounded w-64" />
        )}
      </div>
      
      {/* Content skeleton */}
      <div className="space-y-3">
        <div className="h-4 bg-muted animate-pulse rounded w-full" />
        <div className="h-4 bg-muted animate-pulse rounded w-3/4" />
        <div className="h-4 bg-muted animate-pulse rounded w-1/2" />
      </div>
      
      {/* Action skeleton */}
      <div className="flex justify-end space-x-2">
        <div className="h-9 w-20 bg-muted animate-pulse rounded" />
        <div className="h-9 w-24 bg-muted animate-pulse rounded" />
      </div>
    </div>
  );
}

interface LoadingTableProps {
  rows?: number;
  columns?: number;
  className?: string;
}

export function LoadingTable({ rows = 5, columns = 4, className }: LoadingTableProps) {
  return (
    <div className={cn('space-y-4', className)}>
      {/* Table header */}
      <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
        {Array.from({ length: columns }).map((_, i) => (
          <div key={i} className="h-5 bg-muted animate-pulse rounded" />
        ))}
      </div>
      
      {/* Table rows */}
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div 
          key={rowIndex} 
          className="grid gap-4" 
          style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}
        >
          {Array.from({ length: columns }).map((_, colIndex) => (
            <div
              key={colIndex}
              className="h-4 bg-muted animate-pulse rounded"
              style={{ animationDelay: `${(rowIndex * columns + colIndex) * 0.05}s` }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

interface LoadingMetricCardProps {
  className?: string;
}

export function LoadingMetricCard({ className }: LoadingMetricCardProps) {
  return (
    <div className={cn(
      'p-6 border rounded-lg bg-background space-y-4',
      className
    )}>
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-4 bg-muted animate-pulse rounded w-24" />
          <div className="h-8 bg-muted animate-pulse rounded w-16" />
        </div>
        <div className="h-12 w-12 bg-muted animate-pulse rounded-full" />
      </div>
      
      <div className="space-y-2">
        <div className="h-3 bg-muted animate-pulse rounded w-32" />
        <div className="h-2 bg-muted animate-pulse rounded w-full" />
      </div>
    </div>
  );
}