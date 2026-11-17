'use client';

import type { AuthUser } from '@latif/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, sessionApi } from './api-client';

export const SESSION_KEY = ['session'] as const;

export function useSession() {
  return useQuery({
    queryKey: SESSION_KEY,
    queryFn: () => api.get<AuthUser>('/auth/me'),
    staleTime: 60_000,
    retry: false,
  });
}

export function useSessionActions() {
  const qc = useQueryClient();
  return {
    setUser: (user: AuthUser) => qc.setQueryData(SESSION_KEY, user),
    async logout() {
      await sessionApi.logout();
      qc.clear();
    },
    async switchDaycare(daycareId: string) {
      const { user } = await sessionApi.switchDaycare<{ user: AuthUser }>(daycareId);
      qc.clear();
      qc.setQueryData(SESSION_KEY, user);
    },
  };
}
