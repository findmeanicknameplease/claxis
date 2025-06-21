import { createClient } from '../supabase/server';
import type { Database } from '../supabase/types';

export type StaffMemberWithSalon = Database['public']['Tables']['staff_members']['Row'] & {
  salons: Database['public']['Tables']['salons']['Row'];
};

/**
 * Find staff member by email and return with salon information
 */
export async function findStaffMemberByEmail(email: string): Promise<StaffMemberWithSalon | null> {
  const supabase = await createClient();
  
  const { data, error } = await supabase
    .from('staff_members')
    .select(`
      *,
      salons (*)
    `)
    .eq('email', email)
    .eq('is_active', true)
    .single();

  if (error || !data) {
    console.log('Staff member not found for email:', email);
    return null;
  }

  return data as StaffMemberWithSalon;
}

/**
 * Create a new staff member (used during signup for salon owners)
 */
export async function createStaffMember(params: {
  salonId: string;
  name: string;
  email: string;
  role: string;
  isOwner: boolean;
}): Promise<Database['public']['Tables']['staff_members']['Row'] | null> {
  const supabase = await createClient();
  
  const { data, error } = await supabase
    .from('staff_members')
    .insert({
      salon_id: params.salonId,
      name: params.name,
      email: params.email,
      role: params.role,
      is_owner: params.isOwner,
      is_active: true,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating staff member:', error);
    return null;
  }

  return data;
}

/**
 * Update staff member last activity
 */
export async function updateStaffMemberActivity(staffMemberId: string): Promise<void> {
  const supabase = await createClient();
  
  await supabase
    .from('staff_members')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', staffMemberId);
}