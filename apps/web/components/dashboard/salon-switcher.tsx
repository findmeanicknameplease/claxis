'use client';

import { useState, useEffect } from 'react';
import { Check, ChevronsUpDown, Building2, Crown, Users, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandSeparator,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface Salon {
  id: string;
  business_name: string;
  address: string;
  subscription_tier: 'professional' | 'enterprise';
  avatar?: string;
  role: 'owner' | 'manager' | 'staff';
  status: 'active' | 'inactive';
  stats: {
    total_staff: number;
    monthly_revenue: number;
    active_campaigns: number;
  };
}

interface SalonSwitcherProps {
  currentSalonId: string;
  onSalonChange: (salonId: string) => void;
  className?: string;
}

// Mock data - replace with actual API calls
const mockSalons: Salon[] = [
  {
    id: 'salon_001',
    business_name: 'Gemini Salon Berlin',
    address: 'Unter den Linden 1, Berlin',
    subscription_tier: 'enterprise',
    role: 'owner',
    status: 'active',
    stats: {
      total_staff: 12,
      monthly_revenue: 25600,
      active_campaigns: 8,
    },
  },
  {
    id: 'salon_002',
    business_name: 'Beauty Corner Munich',
    address: 'Marienplatz 5, Munich',
    subscription_tier: 'enterprise',
    role: 'manager',
    status: 'active',
    stats: {
      total_staff: 8,
      monthly_revenue: 18900,
      active_campaigns: 5,
    },
  },
  {
    id: 'salon_003',
    business_name: 'Style Haven Frankfurt',
    address: 'Zeil 42, Frankfurt',
    subscription_tier: 'professional',
    role: 'staff',
    status: 'active',
    stats: {
      total_staff: 4,
      monthly_revenue: 12400,
      active_campaigns: 3,
    },
  },
];

export function SalonSwitcher({ currentSalonId, onSalonChange, className }: SalonSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [salons, setSalons] = useState<Salon[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const currentSalon = salons.find(salon => salon.id === currentSalonId);

  useEffect(() => {
    const fetchSalons = async () => {
      try {
        // Mock API call
        await new Promise(resolve => setTimeout(resolve, 500));
        setSalons(mockSalons);
      } catch (error) {
        console.error('Failed to fetch salons:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSalons();
  }, []);

  const handleSalonSelect = (salonId: string) => {
    onSalonChange(salonId);
    setIsOpen(false);
  };

  if (isLoading) {
    return (
      <div className={cn("flex items-center space-x-2", className)}>
        <div className="h-8 w-8 bg-muted animate-pulse rounded-full" />
        <div className="h-4 w-32 bg-muted animate-pulse rounded" />
      </div>
    );
  }

  if (!currentSalon) {
    return null;
  }

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={isOpen}
          aria-label="Select salon"
          className={cn("w-[300px] justify-between", className)}
        >
          <div className="flex items-center space-x-2">
            <Avatar className="h-6 w-6">
              <AvatarImage src={currentSalon.avatar} alt={currentSalon.business_name} />
              <AvatarFallback className="text-xs">
                {currentSalon.business_name.split(' ').map(n => n[0]).join('')}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col items-start">
              <span className="text-sm font-medium">{currentSalon.business_name}</span>
              <div className="flex items-center space-x-1">
                <Badge 
                  variant={currentSalon.subscription_tier === 'enterprise' ? 'default' : 'secondary'}
                  className="text-xs h-4"
                >
                  {currentSalon.subscription_tier === 'enterprise' && (
                    <Crown className="h-2 w-2 mr-1" />
                  )}
                  {currentSalon.subscription_tier}
                </Badge>
                <span className="text-xs text-muted-foreground">•</span>
                <span className="text-xs text-muted-foreground capitalize">{currentSalon.role}</span>
              </div>
            </div>
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0">
        <Command>
          <CommandInput placeholder="Search salons..." />
          <CommandEmpty>No salon found.</CommandEmpty>
          <CommandGroup heading="Your Salons">
            {salons.map((salon) => (
              <CommandItem
                key={salon.id}
                value={salon.id}
                onSelect={() => handleSalonSelect(salon.id)}
                className="flex items-start space-x-3 p-3"
              >
                <Avatar className="h-8 w-8 mt-0.5">
                  <AvatarImage src={salon.avatar} alt={salon.business_name} />
                  <AvatarFallback className="text-xs">
                    {salon.business_name.split(' ').map(n => n[0]).join('')}
                  </AvatarFallback>
                </Avatar>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="font-medium text-sm">{salon.business_name}</span>
                      {salon.subscription_tier === 'enterprise' && (
                        <Badge variant="default" className="text-xs h-4">
                          <Crown className="h-2 w-2 mr-1" />
                          Enterprise
                        </Badge>
                      )}
                    </div>
                    <Check
                      className={cn(
                        "ml-auto h-4 w-4",
                        currentSalonId === salon.id ? "opacity-100" : "opacity-0"
                      )}
                    />
                  </div>
                  
                  <p className="text-xs text-muted-foreground truncate">{salon.address}</p>
                  
                  <div className="flex items-center space-x-4 mt-2 text-xs text-muted-foreground">
                    <div className="flex items-center space-x-1">
                      <Users className="h-3 w-3" />
                      <span>{salon.stats.total_staff} staff</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <Building2 className="h-3 w-3" />
                      <span>€{(salon.stats.monthly_revenue / 1000).toFixed(1)}k/mo</span>
                    </div>
                    <Badge variant="outline" className="h-4 text-xs">
                      {salon.stats.active_campaigns} campaigns
                    </Badge>
                  </div>
                  
                  <div className="flex items-center space-x-2 mt-2">
                    <Badge 
                      variant={salon.status === 'active' ? 'default' : 'secondary'}
                      className="text-xs h-4"
                    >
                      {salon.status}
                    </Badge>
                    <Badge variant="outline" className="text-xs h-4 capitalize">
                      {salon.role}
                    </Badge>
                  </div>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
          
          <CommandSeparator />
          
          <CommandGroup>
            <CommandItem
              onSelect={() => {
                setIsOpen(false);
                // In a real implementation, this would open a salon management modal
                console.log('Opening salon management');
              }}
              className="flex items-center space-x-2 p-3"
            >
              <Settings className="h-4 w-4" />
              <span>Manage Salons</span>
            </CommandItem>
          </CommandGroup>
        </Command>
      </PopoverContent>
    </Popover>
  );
}