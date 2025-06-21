import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth/config';
import { redirect } from 'next/navigation';
import { UnifiedInbox } from '@/components/conversations/unified-inbox';

export default async function ConversationsPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect('/auth/login');
  }

  return (
    <div className="h-[calc(100vh-4rem)]"> {/* Full height minus header */}
      <UnifiedInbox />
    </div>
  );
}