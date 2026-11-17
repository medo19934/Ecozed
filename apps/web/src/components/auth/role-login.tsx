'use client';

import { ArrowRight, Baby, Building2, GraduationCap, ShieldCheck } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { PasswordLogin } from './password-login';

type Role = 'SUPER_ADMIN' | 'MANAGER' | 'STAFF' | 'PARENT';
export interface PublicBranch {
  slug: string;
  name: string;
  nameEn: string | null;
}
const ICON = {
  SUPER_ADMIN: ShieldCheck,
  MANAGER: Building2,
  STAFF: GraduationCap,
  PARENT: Baby,
} as const;

/**
 * Who are you? General admin, or per branch: manager / teacher / parent.
 * Picking a card opens the email-or-phone + password form. What each person sees after
 * signing in comes from their account (role + branch), not from the card.
 */
export function RoleLogin({ branches }: { branches: PublicBranch[] }) {
  const t = useTranslations('auth');
  const locale = useLocale();
  const [picked, setPicked] = useState<{ role: Role; branch?: PublicBranch } | null>(null);
  const branchName = (b: PublicBranch) => (locale === 'en' && b.nameEn ? b.nameEn : b.name);

  if (picked) {
    const Icon = ICON[picked.role];
    return (
      <div className="grid gap-5">
        <button
          type="button"
          onClick={() => setPicked(null)}
          className="flex items-center gap-3 rounded-2xl border bg-muted/50 p-3 text-start hover:border-primary"
        >
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand-gradient text-white">
            <Icon className="size-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">{t(`roles.${picked.role}`)}</span>
            <span className="block text-xs text-muted-foreground">
              {picked.branch ? branchName(picked.branch) : t('allBranches')}
            </span>
          </span>
          <span className="flex items-center gap-1 text-sm text-primary">
            <ArrowRight className="size-4 ltr:-scale-x-100" /> {t('changeRole')}
          </span>
        </button>
        <PasswordLogin allowRegister={picked.role === 'PARENT'} />
      </div>
    );
  }

  const Card = ({ role, branch, wide }: { role: Role; branch?: PublicBranch; wide?: boolean }) => {
    const Icon = ICON[role];
    return (
      <button
        type="button"
        onClick={() => setPicked({ role, branch })}
        className={
          wide
            ? 'flex items-center gap-3 rounded-2xl border bg-card p-3 text-start transition hover:border-primary hover:shadow-soft'
            : 'flex flex-col items-center gap-2 rounded-2xl border bg-card p-3 text-center transition hover:border-primary hover:shadow-soft'
        }
      >
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand-gradient text-white">
          <Icon className="size-5" />
        </span>
        <span className="block font-semibold">{t(`roles.${role}`)}</span>
      </button>
    );
  };

  return (
    <div className="grid gap-6">
      <p className="text-sm text-muted-foreground">{t('pickRole')}</p>
      <section className="grid gap-2">
        <h2 className="text-sm font-semibold text-muted-foreground">{t('generalAdmin')}</h2>
        <Card role="SUPER_ADMIN" wide />
      </section>
      {branches.map((b) => (
        <section key={b.slug} className="grid gap-2">
          <h2 className="text-sm font-semibold text-muted-foreground">{branchName(b)}</h2>
          <div className="grid grid-cols-3 gap-2">
            <Card role="MANAGER" branch={b} />
            <Card role="STAFF" branch={b} />
            <Card role="PARENT" branch={b} />
          </div>
        </section>
      ))}
    </div>
  );
}
