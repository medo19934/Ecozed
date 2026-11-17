'use client';

import type { AuthUser } from '@latif/shared';
import { Building2, ChevronDown } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useRouter } from '@/i18n/navigation';
import { useSessionActions } from '@/lib/use-session';

/** Header branch switcher. Super admins see all branches; others their own. */
export function BranchSwitcher({ user }: { user: AuthUser }) {
  const t = useTranslations('branch');
  const tc = useTranslations('common');
  const router = useRouter();
  const { switchDaycare } = useSessionActions();
  const current = user.memberships.find((m) => m.daycareId === user.daycareId);

  if (user.memberships.length === 0) return null;

  const label = (
    <>
      <Building2 className="size-4 text-primary" aria-hidden />
      <span className="max-w-36 truncate">{current?.daycareName ?? t('none')}</span>
    </>
  );

  if (user.memberships.length === 1) {
    return (
      <span className="hidden items-center gap-2 rounded-xl bg-card px-3 py-2 text-sm shadow-soft sm:flex">
        {label}
      </span>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={t('switch')}
        className="flex items-center gap-2 rounded-xl bg-card px-3 py-2 text-sm shadow-soft outline-none transition hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/40"
      >
        {label}
        <ChevronDown className="size-4 text-muted-foreground" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-60">
        <DropdownMenuLabel>{t('switch')}</DropdownMenuLabel>
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
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
