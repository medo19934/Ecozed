'use client';

import { Menu, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useState, type ReactNode } from 'react';
import { LocaleSwitcher } from '@/components/locale-switcher';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { useRouter } from '@/i18n/navigation';
import { ApiError } from '@/lib/api-client';
import { useSession } from '@/lib/use-session';
import { cn } from '@/lib/utils';
import { BranchSwitcher } from './branch-switcher';
import { FullscreenToggle } from './fullscreen-toggle';
import { navFor } from './nav-items';
import { NotificationsBell } from './notifications-bell';
import { SidebarNav } from './sidebar';
import { UserMenu } from './user-menu';

const EXPAND_KEY = 'lk:sidebar-expanded';

export function AdminShell({ children }: { children: ReactNode }) {
  const t = useTranslations('nav');
  const router = useRouter();
  const session = useSession();
  // Icon rail by default (logo on top); users can expand it.
  const [collapsed, setCollapsed] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(EXPAND_KEY) !== '1');
    } catch {
      /* storage unavailable */
    }
  }, []);
  useEffect(() => {
    if (session.error instanceof ApiError && session.error.status === 401) router.replace('/login');
  }, [session.error, router]);

  const toggle = () =>
    setCollapsed((c) => {
      try {
        localStorage.setItem(EXPAND_KEY, c ? '1' : '0');
      } catch {
        /* ignore */
      }
      return !c;
    });

  const user = session.data;
  const items = navFor(user?.role);

  return (
    <div className="flex min-h-dvh">
      <aside
        className={cn(
          'sticky top-0 hidden h-dvh shrink-0 border-e bg-sidebar transition-[width] duration-200 lg:block',
          collapsed ? 'w-20' : 'w-64',
        )}
      >
        <SidebarNav items={items} collapsed={collapsed} />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b bg-background/85 px-4 backdrop-blur sm:px-6">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden" aria-label={t('openMenu')}>
                <Menu />
              </Button>
            </SheetTrigger>
            <SheetContent side="start" className="bg-sidebar p-0">
              <SheetTitle className="sr-only">{t('home')}</SheetTitle>
              <SidebarNav items={items} onNavigate={() => setMobileOpen(false)} />
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
          {user && <BranchSwitcher user={user} />}
          <div className="flex-1" />
          <NotificationsBell />
          <FullscreenToggle />
          <LocaleSwitcher />
          {user ? <UserMenu user={user} /> : <Skeleton className="h-10 w-36" />}
        </header>

        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
