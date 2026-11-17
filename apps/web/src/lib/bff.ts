import 'server-only';
import type { AuthResponse, AuthTokens } from '@latif/shared';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import {
  ACCESS_COOKIE,
  API_URL,
  REFRESH_COOKIE,
  accessCookieOptions,
  refreshCookieOptions,
} from './session-cookies';

export const callApi = (path: string, init: RequestInit & { token?: string } = {}) => {
  const headers = new Headers(init.headers);
  if (init.token) headers.set('authorization', `Bearer ${init.token}`);
  if (init.body && !headers.has('content-type')) headers.set('content-type', 'application/json');
  return fetch(`${API_URL}${path}`, { ...init, headers, cache: 'no-store' });
};

export const setSessionCookies = (res: NextResponse, tokens: AuthTokens) => {
  res.cookies.set(ACCESS_COOKIE, tokens.accessToken, accessCookieOptions(tokens.expiresIn));
  res.cookies.set(REFRESH_COOKIE, tokens.refreshToken, refreshCookieOptions());
  return res;
};

export const clearSessionCookies = (res: NextResponse) => {
  res.cookies.delete(ACCESS_COOKIE);
  res.cookies.delete(REFRESH_COOKIE);
  return res;
};

/** Forwards a token-issuing auth call; stores tokens in httpOnly cookies, returns only the user. */
export async function forwardAuth(path: string, request: Request): Promise<NextResponse> {
  const upstream = await callApi(path, { method: 'POST', body: await request.text() });
  const body = await upstream.json().catch(() => ({}));
  if (!upstream.ok) return NextResponse.json(body, { status: upstream.status });
  const { user, tokens } = body as AuthResponse;
  return setSessionCookies(NextResponse.json({ user }), tokens);
}

/** Tries to refresh using the refresh cookie. Returns new tokens or null. */
export async function refreshTokens(): Promise<AuthTokens | null> {
  const jar = await cookies();
  const refreshToken = jar.get(REFRESH_COOKIE)?.value;
  if (!refreshToken) return null;
  const res = await callApi('/auth/refresh', {
    method: 'POST',
    body: JSON.stringify({ refreshToken }),
  });
  if (!res.ok) return null;
  return ((await res.json()) as AuthResponse).tokens;
}
