import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { callApi, clearSessionCookies } from '@/lib/bff';
import { REFRESH_COOKIE } from '@/lib/session-cookies';

export async function POST() {
  const refreshToken = (await cookies()).get(REFRESH_COOKIE)?.value;
  if (refreshToken) {
    await callApi('/auth/logout', { method: 'POST', body: JSON.stringify({ refreshToken }) }).catch(
      () => undefined,
    );
  }
  return clearSessionCookies(NextResponse.json({ ok: true }));
}
