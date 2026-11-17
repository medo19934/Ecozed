import createMiddleware from 'next-intl/middleware';
import { type NextRequest, NextResponse } from 'next/server';
import { routing } from './i18n/routing';
import { ACCESS_COOKIE, REFRESH_COOKIE } from './lib/session-cookies';

const intl = createMiddleware(routing);

/** Admin areas that require a session (checked after the locale segment). */
const PROTECTED = [
  '/dashboard',
  '/classes',
  '/children',
  '/staff',
  '/settings',
  '/messages',
  '/attendance',
  '/kiosk',
  '/scan',
  '/parents',
  '/subscriptions',
  '/daily-reports',
  '/reports',
  '/calendar',
  '/units',
  '/admissions',
  '/enroll',
];
const AUTH_PAGES = ['/login'];

/** Pages a parent may never open (server-side redirect before any page code runs). */
const PARENT_FORBIDDEN = [
  '/children',
  '/parents',
  '/staff',
  '/classes',
  '/units',
  '/attendance',
  '/admissions',
  '/reports',
  '/settings',
  '/kiosk',
];

/** Role from the access-token cookie (not verified here: the API verifies every request). */
function roleFromCookie(request: NextRequest): string | null {
  const token = request.cookies.get(ACCESS_COOKIE)?.value;
  const payload = token?.split('.')[1];
  if (!payload) return null;
  try {
    const json = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/'))) as {
      role?: string;
    };
    return json.role ?? null;
  } catch {
    return null;
  }
}

export default function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const [, maybeLocale, ...rest] = pathname.split('/');
  const locale = (routing.locales as readonly string[]).includes(maybeLocale ?? '')
    ? maybeLocale!
    : routing.defaultLocale;
  const subPath = `/${rest.join('/')}`;
  const hasSession = Boolean(request.cookies.get(REFRESH_COOKIE)?.value);

  if (!hasSession && PROTECTED.some((p) => subPath === p || subPath.startsWith(`${p}/`))) {
    const url = new URL(`/${locale}/login`, request.url);
    // Keep the query (e.g. the kiosk QR token on /scan?t=…) through sign-in.
    url.searchParams.set('next', `${pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(url);
  }
  // No marketing site: the root goes straight to the app.
  if (subPath === '/') {
    return NextResponse.redirect(
      new URL(`/${locale}/${hasSession ? 'dashboard' : 'login'}`, request.url),
    );
  }
  if (
    hasSession &&
    roleFromCookie(request) === 'PARENT' &&
    PARENT_FORBIDDEN.some((p) => subPath === p || subPath.startsWith(`${p}/`))
  ) {
    return NextResponse.redirect(new URL(`/${locale}/dashboard`, request.url));
  }
  if (hasSession && AUTH_PAGES.includes(subPath)) {
    return NextResponse.redirect(new URL(`/${locale}/dashboard`, request.url));
  }
  return intl(request);
}

export const config = {
  // Skip BFF route handlers, Next internals and static files.
  matcher: '/((?!bff|_next|_vercel|.*\\..*).*)',
};
