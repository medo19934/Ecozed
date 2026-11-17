'use client';

import { Sparkles } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useSession } from '@/lib/use-session';

export function DashboardWelcome() {
  const t = useTranslations('dashboard');
  const { data: user, isLoading } = useSession();
  const daycare = user?.memberships.find((m) => m.daycareId === user.daycareId)?.daycareName ?? '';

  return (
    <Card className="overflow-hidden border-0 bg-brand-gradient text-white">
      <CardContent className="flex items-center gap-5">
        <span className="hidden size-14 shrink-0 items-center justify-center rounded-2xl bg-white/15 sm:flex">
          <Sparkles className="size-7" aria-hidden />
        </span>
        <div className="space-y-1">
          {isLoading || !user ? (
            <>
              <Skeleton className="h-7 w-48 bg-white/20" />
              <Skeleton className="h-4 w-72 bg-white/20" />
            </>
          ) : (
            <>
              <h2 className="text-xl font-semibold">{t('welcome', { name: user.fullName })}</h2>
              <p className="text-white/80">{t('subtitle', { daycare })}</p>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
