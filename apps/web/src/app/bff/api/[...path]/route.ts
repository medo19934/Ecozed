import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';
import { callApi, clearSessionCookies, refreshTokens, setSessionCookies } from '@/lib/bff';
import { ACCESS_COOKIE } from '@/lib/session-cookies';

/** Token-issuing endpoints must go through /bff/auth/* so tokens never reach browser JS. */
const BLOCKED = new Set([
  'auth/login',
  'auth/register',
  'auth/refresh',
  'auth/logout',
  'auth/otp/verify',
  'auth/switch-daycare',
]);

async function handle(request: NextRequest, ctx: RouteContext<'/bff/api/[...path]'>) {
  const { path } = await ctx.params;
  const joined = path.join('/');
  if (BLOCKED.has(joined)) return NextResponse.json({ message: 'Not found' }, { status: 404 });

  const target = `/${joined}${request.nextUrl.search}`;
  const hasBody = !['GET', 'HEAD'].includes(request.method);
  const body = hasBody ? await request.arrayBuffer() : undefined;
  const headers: HeadersInit = {};
  const contentType = request.headers.get('content-type');
  if (contentType) headers['content-type'] = contentType;
  const acceptLanguage = request.headers.get('accept-language');
  if (acceptLanguage) headers['accept-language'] = acceptLanguage;

  const send = (token?: string) =>
    callApi(target, { method: request.method, headers, body, token });

  let token = (await cookies()).get(ACCESS_COOKIE)?.value;
  let upstream = await send(token);
  let refreshed = null;

  if (upstream.status === 401) {
    refreshed = await refreshTokens();
    if (refreshed) {
      token = refreshed.accessToken;
      upstream = await send(token);
    }
  }

  const res = new NextResponse(upstream.body, {
    status: upstream.status,
    headers: { 'content-type': upstream.headers.get('content-type') ?? 'application/json' },
  });
  if (refreshed) setSessionCookies(res, refreshed);
  else if (upstream.status === 401) clearSessionCookies(res);
  return res;
}

export { handle as GET, handle as POST, handle as PUT, handle as PATCH, handle as DELETE };
