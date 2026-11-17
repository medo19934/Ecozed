'use client';

import { Menu, PanelLeftClose, PanelLeftOpen, Smartphone } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useState, type ReactNode } from 'react';
import { LocaleSwitcher } from '@/components/locale-switcher';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { useRouter } from '@/i18n/navigation';
import { ApiError } from '@/lib/api-client';
import { useSession } from '@/lib/use-session';
import { cn } from '@/lib/utils';
import { FullscreenToggle } from './fullscreen-toggle';
import { SidebarNav } from './sidebar';
import { UserMenu } from './user-menu';

const COLLAPSE_KEY = 'lk:sidebar-collapsed';

export function AdminShell({ children }: { children: ReactNode }) {
  const t = useTranslations('nav');
  const ta = useTranslations('auth');
  const router = useRouter();
  const session = useSession();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setCollapsed(localStorage.getItem(COLLAPSE_KEY) === '1');
  }, []);
  useEffect(() => {
    if (session.error instanceof ApiError && session.error.status === 401) router.replace('/login');
  }, [session.error, router]);

  const toggle = () =>
    setCollapsed((c) => {
      localStorage.setItem(COLLAPSE_KEY, c ? '0' : '1');
      return !c;
    });

  const user = session.data;

  return (
    <div className="flex min-h-dvh">
      <aside
        className={cn(
          'sticky top-0 hidden h-dvh shrink-0 border-e bg-sidebar transition-[width] duration-200 lg:block',
          collapsed ? 'w-20' : 'w-72',
        )}
      >
        <SidebarNav collapsed={collapsed} />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b bg-background/80 px-4 backdrop-blur sm:px-6">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden" aria-label={t('openMenu')}>
                <Menu />
              </Button>
            </SheetTrigger>
            <SheetContent side="start" className="bg-sidebar p-0">
              <SheetTitle className="sr-only">{t('home')}</SheetTitle>
              <SidebarNav onNavigate={() => setMobileOpen(false)} />
            </SheetContent>
          </Sheet>
          <Button
            variant="ghost"
            size="icon"
            className="hidden lg:inline-flex"
            aria-label={collapsed ? t('expand') : t('collapse')}
            aria-expanded={!collapsed}
            onClick={toggle}
          >
            {collapsed ? (
              <PanelLeftOpen className="rtl:-scale-x-100" />
            ) : (
              <PanelLeftClose className="rtl:-scale-x-100" />
            )}
          </Button>
          <div className="flex-1" />
          <FullscreenToggle />
          <LocaleSwitcher />
          {user ? <UserMenu user={user} /> : <Skeleton className="h-10 w-36" />}
        </header>

        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          {user?.role === 'PARENT' ? (
            <Card className="mx-auto max-w-lg text-center">
              <CardHeader className="justify-items-center">
                <span className="flex size-14 items-center justify-center rounded-2xl bg-brand-gradient text-white">
                  <Smartphone className="size-7" aria-hidden />
                </span>
                <CardTitle>{ta('parentNoticeTitle')}</CardTitle>
                <CardDescription>{ta('parentNoticeBody')}</CardDescription>
              </CardHeader>
            </Card>
          ) : (
            children
          )}
        </main>
      </div>
    </div>
  );
}
