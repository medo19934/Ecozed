'use client';

import type { AuthUser } from '@latif/shared';
import { Building2, LogOut } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Avatar } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useRouter } from '@/i18n/navigation';
import { useSessionActions } from '@/lib/use-session';

export function UserMenu({ user }: { user: AuthUser }) {
  const t = useTranslations('user');
  const tc = useTranslations('common');
  const router = useRouter();
  const { logout, switchDaycare } = useSessionActions();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="flex items-center gap-2 rounded-xl p-1 pe-2 outline-none transition hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/40"
        aria-label={t('menu')}
      >
        <Avatar name={user.fullName} />
        <span className="hidden text-start leading-tight sm:block">
          <span className="block text-sm font-medium">{user.fullName}</span>
          {user.role && (
            <span className="block text-xs text-muted-foreground">{t(`roles.${user.role}`)}</span>
          )}
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="truncate">{user.email ?? user.phone}</DropdownMenuLabel>
        {user.memberships.length > 1 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="flex items-center gap-2">
              <Building2 className="size-3.5" aria-hidden />
              {t('switchDaycare')}
            </DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={user.daycareId ?? ''}
              onValueChange={async (id) => {
                try {
                  await switchDaycare(id);
                  router.refresh();
                } catch {
                  toast.error(tc('errorGeneric'));
                }
              }}
            >
              {user.memberships.map((m) => (
                <DropdownMenuRadioItem key={m.daycareId} value={m.daycareId}>
                  <span className="truncate">{m.daycareName}</span>
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          onSelect={async () => {
            await logout();
            router.replace('/login');
            router.refresh();
          }}
        >
          <LogOut className="flip-rtl" aria-hidden />
          {t('logout')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
