import type { ApiErrorBody, AuthResponse } from '@latif/shared';
import { Platform } from 'react-native';
import { i18n } from '@/i18n';
import { tokenStore } from './token-store';

export const API_URL = process.env.EXPO_PUBLIC_API_URL
  ? `${process.env.EXPO_PUBLIC_API_URL.replace(/\/$/, '')}/api/v1`
  : 'http://localhost:4000/api/v1';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly body: ApiErrorBody,
  ) {
    super(body.message);
  }
  get code() {
    return this.body.code;
  }
}

let refreshing: Promise<boolean> | null = null;
let onSessionExpired: (() => void) | null = null;
export const setSessionExpiredHandler = (fn: () => void) => {
  onSessionExpired = fn;
};

async function raw<T>(path: string, init: RequestInit, token?: string): Promise<T> {
  const headers: Record<string, string> = {
    'accept-language': i18n.language ?? 'ar',
  };
  if (!(init.body instanceof FormData)) headers['content-type'] = 'application/json';
  if (token) headers.authorization = `Bearer ${token}`;
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { ...headers, ...(init.headers as object) },
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : undefined;
  if (!res.ok)
    throw new ApiError(res.status, data ?? { statusCode: res.status, message: res.statusText });
  return data as T;
}

async function tryRefresh(): Promise<boolean> {
  refreshing ??= (async () => {
    const tokens = await tokenStore.get();
    if (!tokens) return false;
    try {
      const res = await raw<AuthResponse>('/auth/refresh', {
        method: 'POST',
        body: JSON.stringify({ refreshToken: tokens.refreshToken }),
      });
      await tokenStore.set(res.tokens);
      return true;
    } catch {
      await tokenStore.clear();
      return false;
    }
  })().finally(() => {
    refreshing = null;
  });
  return refreshing;
}

/** Authenticated request with one transparent refresh on 401. */
export async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const tokens = await tokenStore.get();
  try {
    return await raw<T>(path, init, tokens?.accessToken);
  } catch (e) {
    if (e instanceof ApiError && e.status === 401 && tokens && (await tryRefresh())) {
      const next = await tokenStore.get();
      return raw<T>(path, init, next?.accessToken);
    }
    if (e instanceof ApiError && e.status === 401 && tokens) onSessionExpired?.();
    throw e;
  }
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: 'POST',
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  /** Multipart upload of a local file (`uri` from a picker or recorder). */
  upload: async <T>(
    path: string,
    file: { uri: string; name: string; type: string },
    fields: Record<string, string> = {},
  ) => {
    const form = new FormData();
    for (const [k, v] of Object.entries(fields)) form.append(k, v);
    if (Platform.OS === 'web') {
      // Browsers need a real Blob; native accepts { uri, name, type }.
      form.append(
        'file',
        new File([await (await fetch(file.uri)).blob()], file.name, { type: file.type }),
      );
    } else {
      form.append('file', file as unknown as Blob);
    }
    return request<T>(path, { method: 'POST', body: form });
  },
  /** Unauthenticated GET (sign-in options). */
  publicGet: <T>(path: string) => raw<T>(path, {}),
  /** Unauthenticated call (login, OTP). */
  public: <T>(path: string, body: unknown) =>
    raw<T>(path, { method: 'POST', body: JSON.stringify(body) }),
};
