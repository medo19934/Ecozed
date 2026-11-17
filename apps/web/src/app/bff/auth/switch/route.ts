import type { AuthResponse } from '@latif/shared';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { callApi, setSessionCookies } from '@/lib/bff';
import { ACCESS_COOKIE } from '@/lib/session-cookies';

export async function POST(request: Request) {
  const token = (await cookies()).get(ACCESS_COOKIE)?.value;
  const upstream = await callApi('/auth/switch-daycare', {
    method: 'POST',
    token,
    body: await request.text(),
  });
  const body = await upstream.json().catch(() => ({}));
  if (!upstream.ok) return NextResponse.json(body, { status: upstream.status });
  const { user, tokens } = body as AuthResponse;
  return setSessionCookies(NextResponse.json({ user }), tokens);
}
