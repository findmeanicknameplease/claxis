'use client';

import { signOut } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Session } from 'next-auth';
import Link from 'next/link';
import { SalonSwitcher } from './salon-switcher';

interface DashboardHeaderProps {
  session: Session;
  onSalonChange?: (salonId: string) => void;
}

export function DashboardHeader({ session, onSalonChange }: DashboardHeaderProps) {
  const handleSignOut = () => {
    signOut({ callbackUrl: '/' });
  };

  // Guard against undefined user
  if (!session.user) {
    return null;
  }

  const userInitials = session.user.name
    ? session.user.name.split(' ').map(n => n[0]).join('').toUpperCase()
    : session.user.email?.charAt(0).toUpperCase() || 'U';

  return (
    <header className="border-b bg-background">
      <div className="container mx-auto px-4 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link href="/dashboard" className="text-xl font-bold">
            Gemini Salon AI
          </Link>
          
          {/* Multi-Salon Switcher for Enterprise */}
          {session.user.salon?.subscription_tier === 'enterprise' && onSalonChange && (
            <SalonSwitcher
              currentSalonId={session.user.salon.id}
              onSalonChange={onSalonChange}
              className="hidden lg:flex"
            />
          )}
          <nav className="hidden md:flex space-x-4">
            <Link href="/dashboard" className="text-sm font-medium hover:text-primary">
              Dashboard
            </Link>
            <Link href="/dashboard/bookings" className="text-sm font-medium hover:text-primary">
              Bookings
            </Link>
            <Link href="/dashboard/customers" className="text-sm font-medium hover:text-primary">
              Customers
            </Link>
            <Link href="/dashboard/services" className="text-sm font-medium hover:text-primary">
              Services
            </Link>
            <Link href="/dashboard/communications" className="text-sm font-medium hover:text-primary">
              Communications
            </Link>
            <Link href="/dashboard/conversations" className="text-sm font-medium hover:text-primary">
              Conversations
            </Link>
            <Link href="/dashboard/monitoring" className="text-sm font-medium hover:text-primary">
              Monitoring
            </Link>
            {session.user.salon?.subscription_tier === 'enterprise' && (
              <>
                <Link href="/dashboard/voice-agent" className="text-sm font-medium hover:text-primary text-blue-600">
                  Voice Agent
                </Link>
                <Link href="/dashboard/performance" className="text-sm font-medium hover:text-primary text-green-600">
                  Performance
                </Link>
                {(session.user.role === 'owner' || session.user.role === 'manager') && (
                  <Link href="/dashboard/security" className="text-sm font-medium hover:text-primary text-amber-600">
                    Security
                  </Link>
                )}
              </>
            )}
            {session.user.is_owner && (
              <Link href="/dashboard/settings" className="text-sm font-medium hover:text-primary">
                Settings
              </Link>
            )}
          </nav>
        </div>

        <div className="flex items-center space-x-4">
          <div className="text-sm text-muted-foreground">
            {session.user.salon?.business_name}
          </div>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={session.user.image || ''} alt={session.user.name || ''} />
                  <AvatarFallback>{userInitials}</AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" forceMount>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">
                    {session.user.name || session.user.email}
                  </p>
                  <p className="text-xs leading-none text-muted-foreground">
                    {session.user.email}
                  </p>
                  <p className="text-xs leading-none text-muted-foreground">
                    {session.user.role} • {session.user.salon?.subscription_tier}
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/dashboard/profile">Profile</Link>
              </DropdownMenuItem>
              {session.user.is_owner && (
                <DropdownMenuItem asChild>
                  <Link href="/dashboard/settings">Settings</Link>
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSignOut}>
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}