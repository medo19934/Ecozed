'use client';

import type { AuthUser } from '@latif/shared';
import { useSearchParams } from 'next/navigation';
import { useRouter } from '@/i18n/navigation';
import { useSessionActions } from './use-session';

/** After a successful login: cache user, then go to ?next or dashboard. */
export function usePostLogin() {
  const router = useRouter();
  const search = useSearchParams();
  const { setUser } = useSessionActions();
  return (user: AuthUser) => {
    setUser(user);
    const next = search.get('next');
    // Only allow same-site relative paths; strip locale (router adds it).
    const safe =
      next && next.startsWith('/') && !next.startsWith('//')
        ? next.replace(/^\/(ar|en)(?=\/|$)/, '')
        : null;
    router.replace(safe || '/dashboard');
    router.refresh();
  };
}
