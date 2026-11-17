import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';

export default function NotFound() {
  const t = useTranslations('nav');
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
      <p className="text-brand-gradient text-7xl font-black">404</p>
      <Button asChild>
        <Link href="/">{t('home')}</Link>
      </Button>
    </main>
  );
}
