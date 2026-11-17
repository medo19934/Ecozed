'use client';

import type { AuthUser } from '@latif/shared';
import { KeyRound, LogOut } from 'lucide-react';
import { PinDialog } from '@/components/attendance/pin-dialog';
import { useTranslations } from 'next-intl';
import { Avatar } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useRouter } from '@/i18n/navigation';
import { useSessionActions } from '@/lib/use-session';

export function UserMenu({ user }: { user: AuthUser }) {
  const t = useTranslations('user');
  const tp = useTranslations('pin');
  const router = useRouter();
  const { logout } = useSessionActions();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="flex items-center gap-2 rounded-xl p-1 pe-2 outline-none transition hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/40"
        aria-label={t('menu')}
      >
        <Avatar name={user.fullName} src={user.avatarUrl} />
        <span className="hidden text-start leading-tight sm:block">
          <span className="block text-sm font-medium">{user.fullName}</span>
          <span className="block text-xs text-muted-foreground">{t(`roles.${user.role}`)}</span>
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="truncate">{user.email ?? user.phone}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {user.daycareId && user.role !== 'SUPER_ADMIN' && (
          <PinDialog>
            <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
              <KeyRound aria-hidden />
              {tp('menu')}
            </DropdownMenuItem>
          </PinDialog>
        )}
        <DropdownMenuItem
          variant="destructive"
          onSelect={async () => {
            await logout();
            router.replace('/login');
            router.refresh();
          }}
        >
          <LogOut className="rtl:-scale-x-100" aria-hidden />
          {t('logout')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
