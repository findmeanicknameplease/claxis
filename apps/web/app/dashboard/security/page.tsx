import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth/config';
import { redirect } from 'next/navigation';
import { AccessControl } from '@/components/security/access-control';

export default async function SecurityPage() {
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    redirect('/auth/login');
  }

  if (!session.user.salon) {
    redirect('/onboarding');
  }

  // Only Enterprise tier gets security features
  if (session.user.salon.subscription_tier !== 'enterprise') {
    redirect('/dashboard/billing?upgrade=enterprise');
  }

  // Only owners and managers can access security settings
  if (session.user.role === 'staff') {
    redirect('/dashboard');
  }

  // Validate role is one of the expected values before casting
  const userRole = session.user.role;
  const validRoles: Array<'owner' | 'manager' | 'staff'> = ['owner', 'manager', 'staff'];
  const currentUserRole = validRoles.includes(userRole as any) 
    ? (userRole as 'owner' | 'manager' | 'staff')
    : 'staff'; // Default fallback to most restrictive role

  return (
    <div className="container mx-auto px-4 py-8">
      <AccessControl
        salonId={session.user.salon.id}
        currentUserRole={currentUserRole}
      />
    </div>
  );
}