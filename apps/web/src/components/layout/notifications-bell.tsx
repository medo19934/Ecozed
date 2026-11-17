'use client';

import { Bell, BellOff } from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { buttonVariants } from '@/components/ui/button';

/** Notification bell. Real notifications are wired in the notifications phase. */
export function NotificationsBell() {
  const t = useTranslations('nav');
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={t('notifications')}
        className={buttonVariants({ variant: 'ghost', size: 'icon' })}
      >
        <Bell />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel>{t('notifications')}</DropdownMenuLabel>
        <div className="flex flex-col items-center gap-2 px-3 py-6 text-center text-sm text-muted-foreground">
          <BellOff className="size-5" aria-hidden />
          {t('noNotifications')}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
