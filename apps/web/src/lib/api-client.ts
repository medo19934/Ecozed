import type { ApiErrorBody } from '@latif/shared';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly body: ApiErrorBody,
  ) {
    super(body.message);
  }
  get code(): string | undefined {
    return this.body.code;
  }
}

async function request<T>(url: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !(init.body instanceof FormData))
    headers.set('content-type', 'application/json');
  const res = await fetch(url, { ...init, headers, credentials: 'same-origin' });
  const text = await res.text();
  const data = text ? JSON.parse(text) : undefined;
  if (!res.ok) {
    throw new ApiError(res.status, data ?? { statusCode: res.status, message: res.statusText });
  }
  return data as T;
}

/** Same-origin URL for a private API file (images/downloads), streamed through the BFF. */
export const fileUrl = (path: string, version?: string | number) =>
  `/bff/api${path}${version ? `?v=${encodeURIComponent(String(version))}` : ''}`;

const json = (body: unknown) => (body === undefined ? undefined : JSON.stringify(body));

/** Browser client for the Nest API through the BFF proxy (`/bff/api/*`). */
export const api = {
  get: <T>(path: string) => request<T>(`/bff/api${path}`),
  post: <T>(path: string, body?: unknown) =>
    request<T>(`/bff/api${path}`, { method: 'POST', body: json(body) }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(`/bff/api${path}`, { method: 'PATCH', body: json(body) }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(`/bff/api${path}`, { method: 'PUT', body: json(body) }),
  delete: <T>(path: string) => request<T>(`/bff/api${path}`, { method: 'DELETE' }),
  upload: <T>(path: string, file: File, fields: Record<string, string> = {}) => {
    const form = new FormData();
    form.append('file', file);
    for (const [k, v] of Object.entries(fields)) form.append(k, v);
    return request<T>(`/bff/api${path}`, { method: 'POST', body: form });
  },
};

/** Session endpoints handled by Next route handlers (tokens stay in httpOnly cookies). */
export const sessionApi = {
  google: <T>(idToken: string, locale: string) =>
    request<T>('/bff/auth/google', { method: 'POST', body: json({ idToken, locale }) }),
  devLogin: <T>(email: string) =>
    request<T>('/bff/auth/dev-login', { method: 'POST', body: json({ email }) }),
  switchDaycare: <T>(daycareId: string) =>
    request<T>('/bff/auth/switch', { method: 'POST', body: json({ daycareId }) }),
  logout: () => request<{ ok: true }>('/bff/auth/logout', { method: 'POST' }),
};
