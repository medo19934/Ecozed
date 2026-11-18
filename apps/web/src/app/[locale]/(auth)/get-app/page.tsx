import { Apple, Download, Share, Smartphone, SquarePlus } from 'lucide-react';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import QRCode from 'qrcode';
import { initLocale } from '@/i18n/locale';

const APP_URL = process.env.NEXT_PUBLIC_MOBILE_APP_URL || 'https://latif-kids-app.vercel.app';
const APK_URL =
  process.env.NEXT_PUBLIC_ANDROID_APK_URL || 'https://github.com/medo19934/Ecozed/releases/latest';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('getApp');
  return { title: t('title') };
}

/** Public page: Android APK download + iPhone "Add to Home Screen" (no App Store needed). */
export default async function GetAppPage({ params }: PageProps<'/[locale]/get-app'>) {
  await initLocale(params);
  const t = await getTranslations('getApp');
  const qr = (url: string) =>
    QRCode.toDataURL(url, { margin: 1, width: 220, color: { dark: '#2b2f45' } });
  const [iosQr, apkQr] = await Promise.all([qr(APP_URL), qr(APK_URL)]);

  return (
    <div className="overflow-hidden rounded-[20px] bg-card shadow-soft">
      <div className="bg-brand-gradient px-6 py-8 text-white sm:px-8">
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <p className="mt-2 text-white/85">{t('subtitle')}</p>
      </div>
      <div className="grid gap-6 p-6 sm:p-8">
        <section className="grid gap-3 rounded-2xl border p-5">
          <h2 className="flex items-center gap-2 font-semibold">
            <Apple className="size-5 text-primary" aria-hidden /> {t('iosTitle')}
          </h2>
          <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-center">
            <ol className="ms-5 grid list-decimal gap-2 text-sm">
              <li>
                {t('ios1')}{' '}
                <a
                  href={APP_URL}
                  dir="ltr"
                  className="inline-block font-medium whitespace-nowrap text-primary underline"
                >
                  {APP_URL.replace('https://', '')}
                </a>
              </li>
              <li>
                {t('ios2')} <Share className="inline size-4 align-text-bottom" aria-hidden />
              </li>
              <li>
                {t('ios3')} <SquarePlus className="inline size-4 align-text-bottom" aria-hidden />
              </li>
              <li>{t('ios4')}</li>
            </ol>
            <img
              src={iosQr}
              alt={t('qrAlt')}
              width={140}
              height={140}
              className="justify-self-center rounded-xl border"
            />
          </div>
          <p className="text-xs text-muted-foreground">{t('iosNote')}</p>
        </section>
        <section className="grid gap-3 rounded-2xl border p-5">
          <h2 className="flex items-center gap-2 font-semibold">
            <Smartphone className="size-5 text-primary" aria-hidden /> {t('androidTitle')}
          </h2>
          <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-center">
            <div className="grid gap-3 text-sm">
              <p>{t('android1')}</p>
              <a
                href={APK_URL}
                className="inline-flex h-11 w-fit items-center gap-2 rounded-xl bg-primary px-4 font-medium text-primary-foreground"
              >
                <Download className="size-4" aria-hidden /> {t('androidButton')}
              </a>
              <p className="text-xs text-muted-foreground">{t('androidNote')}</p>
            </div>
            <img
              src={apkQr}
              alt={t('qrAlt')}
              width={140}
              height={140}
              className="justify-self-center rounded-xl border"
            />
          </div>
        </section>
      </div>
    </div>
  );
}
