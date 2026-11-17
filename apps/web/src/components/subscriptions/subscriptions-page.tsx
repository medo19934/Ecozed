'use client';

import { useSession } from '@/lib/use-session';
import { MySubscriptions, SubscriptionsView } from './subscriptions-view';

export function SubscriptionsPage() {
  const { data: user } = useSession();
  return user?.role === 'PARENT' ? <MySubscriptions /> : <SubscriptionsView />;
}
