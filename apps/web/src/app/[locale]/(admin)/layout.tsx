import { AdminShell } from '@/components/layout/admin-shell';
import { initLocale } from '@/i18n/locale';

export default async function AdminLayout({ children, params }: LayoutProps<'/[locale]'>) {
  await initLocale(params);
  return <AdminShell>{children}</AdminShell>;
}
