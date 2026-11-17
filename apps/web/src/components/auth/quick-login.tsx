'use client';

import type { AuthUser, DemoAccount } from '@latif/shared';
import { Baby, Building2, GraduationCap, Loader2, ShieldCheck, UserRound } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import { sessionApi } from '@/lib/api-client';
import { useErrorMessage } from '@/lib/use-error-message';
import { usePostLogin } from '@/lib/use-post-login';

const ICON = {
  SUPER_ADMIN: ShieldCheck,
  MANAGER: Building2,
  STAFF: GraduationCap,
  PARENT: Baby,
} as const;

/** Public mode: one tap per role card, or sign in with any email / phone number. */
export function QuickLogin({ accounts }: { accounts: DemoAccount[] }) {
  const t = useTranslations('auth');
  const locale = useLocale();
  const errorMessage = useErrorMessage();
  const onLoggedIn = usePostLogin();
  const [busy, setBusy] = useState<string | null>(null);

  const signIn = async (id: string) => {
    setBusy(id);
    try {
      const { user } = await sessionApi.login<{ user: AuthUser }>(id, locale);
      onLoggedIn(user);
    } catch (err) {
      toast.error(errorMessage(err));
      setBusy(null);
    }
  };

  const admin = accounts.filter((a) => !a.branch);
  const branches = [
    ...new Map(accounts.filter((a) => a.branch).map((a) => [a.branch!.slug, a.branch!])).values(),
  ];
  const Card = ({ a, wide }: { a: DemoAccount; wide?: boolean }) => {
    const Icon = ICON[a.role as keyof typeof ICON] ?? UserRound;
    return (
      <button
        type="button"
        disabled={!!busy}
        onClick={() => signIn(a.email)}
        className={
          wide
            ? 'group flex items-center gap-3 rounded-2xl border bg-card p-3 text-start transition hover:border-primary hover:shadow-soft disabled:opacity-60'
            : 'group flex flex-col items-center gap-2 rounded-2xl border bg-card p-3 text-center transition hover:border-primary hover:shadow-soft disabled:opacity-60'
        }
      >
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand-gradient text-white">
          {busy === a.email ? (
            <Loader2 className="size-5 animate-spin" />
          ) : (
            <Icon className="size-5" />
          )}
        </span>
        <span className="w-full min-w-0">
          <span className="block font-semibold">{t(`roles.${a.role}`)}</span>
          <span className="block truncate text-xs text-muted-foreground">{a.name}</span>
        </span>
      </button>
    );
  };

  return (
    <div className="grid gap-6">
      {admin.length > 0 && (
        <section className="grid gap-2">
          <h2 className="text-sm font-semibold text-muted-foreground">{t('generalAdmin')}</h2>
          {admin.map((a) => (
            <Card key={a.email} a={a} wide />
          ))}
        </section>
      )}
      {branches.map((b) => (
        <section key={b.slug} className="grid gap-2">
          <h2 className="text-sm font-semibold text-muted-foreground">
            {t('branchOf', { name: locale === 'en' && b.nameEn ? b.nameEn : b.name })}
          </h2>
          <div className="grid grid-cols-3 gap-2">
            {accounts
              .filter((a) => a.branch?.slug === b.slug)
              .map((a) => (
                <Card key={a.email} a={a} />
              ))}
          </div>
        </section>
      ))}
    </div>
  );
}
