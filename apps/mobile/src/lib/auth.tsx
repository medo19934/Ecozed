import type { AuthResponse, AuthUser } from '@latif/shared';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { api, setSessionExpiredHandler } from './api';
import { tokenStore } from './token-store';

type Status = 'loading' | 'signedOut' | 'signedIn';

interface AuthState {
  status: Status;
  user: AuthUser | null;
  /** Sign up or sign in with a Google ID token. */
  signInWithGoogle: (idToken: string, locale: string) => Promise<AuthUser>;
  /** Local development only (API AUTH_DEV_LOGIN=true). */
  devLogin: (email: string) => Promise<AuthUser>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('loading');
  const [user, setUser] = useState<AuthUser | null>(null);

  const signOut = useCallback(async () => {
    const tokens = await tokenStore.get();
    if (tokens)
      await api
        .public('/auth/logout', { refreshToken: tokens.refreshToken })
        .catch(() => undefined);
    await tokenStore.clear();
    setUser(null);
    setStatus('signedOut');
  }, []);

  useEffect(() => {
    setSessionExpiredHandler(() => {
      setUser(null);
      setStatus('signedOut');
    });
    (async () => {
      if (!(await tokenStore.get())) return setStatus('signedOut');
      try {
        setUser(await api.get<AuthUser>('/auth/me'));
        setStatus('signedIn');
      } catch {
        await tokenStore.clear();
        setStatus('signedOut');
      }
    })();
  }, []);

  const accept = useCallback(async (res: AuthResponse) => {
    await tokenStore.set(res.tokens);
    setUser(res.user);
    setStatus('signedIn');
    return res.user;
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      status,
      user,
      signOut,
      signInWithGoogle: async (idToken, locale) =>
        accept(await api.public<AuthResponse>('/auth/google', { idToken, locale })),
      devLogin: async (email) =>
        accept(await api.public<AuthResponse>('/auth/dev-login', { email })),
    }),
    [status, user, signOut, accept],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
