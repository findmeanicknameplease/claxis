import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth/config';
import { redirect } from 'next/navigation';
import { PerformanceMonitor } from '@/components/performance/performance-monitor';

export default async function PerformancePage() {
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    redirect('/auth/login');
  }

  if (!session.user.salon) {
    redirect('/onboarding');
  }

  // Only Enterprise tier gets advanced performance monitoring
  if (session.user.salon.subscription_tier !== 'enterprise') {
    redirect('/dashboard/billing?upgrade=enterprise');
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <PerformanceMonitor />
    </div>
  );
}