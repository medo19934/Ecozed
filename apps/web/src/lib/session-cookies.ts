/** Cookie names + options shared by the proxy and BFF route handlers. */
export const ACCESS_COOKIE = 'lk_at';
export const REFRESH_COOKIE = 'lk_rt';

const secure = process.env.NODE_ENV === 'production';

export const accessCookieOptions = (maxAge: number) => ({
  httpOnly: true,
  secure,
  sameSite: 'lax' as const,
  path: '/',
  maxAge,
});

export const refreshCookieOptions = () => ({
  httpOnly: true,
  secure,
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 60 * 60 * 24 * 30,
});

export const API_URL = process.env.API_URL ?? 'http://localhost:4000/api/v1';
