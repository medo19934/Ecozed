'use client';

import { Languages } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { usePathname, useRouter } from '@/i18n/navigation';

/** Toggles ar ⇄ en, preserving the current path. */
export function LocaleSwitcher({ variant = 'ghost' }: { variant?: 'ghost' | 'outline' }) {
  const locale = useLocale();
  const t = useTranslations('common');
  const router = useRouter();
  const pathname = usePathname();
  const [pending, start] = useTransition();
  const next = locale === 'ar' ? 'en' : 'ar';

  return (
    <Button
      variant={variant}
      size="sm"
      disabled={pending}
      aria-label={t('language')}
      onClick={() => start(() => router.replace(pathname, { locale: next }))}
    >
      <Languages aria-hidden />
      {next === 'ar' ? t('arabic') : t('english')}
    </Button>
  );
}
