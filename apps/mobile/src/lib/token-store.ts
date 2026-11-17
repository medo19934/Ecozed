import type { AuthTokens } from '@latif/shared';
import { secureStorage } from './secure-storage';

const KEY = 'lk.tokens';

export const tokenStore = {
  async get(): Promise<AuthTokens | null> {
    const raw = await secureStorage.get(KEY);
    return raw ? (JSON.parse(raw) as AuthTokens) : null;
  },
  set: (tokens: AuthTokens) => secureStorage.set(KEY, JSON.stringify(tokens)),
  clear: () => secureStorage.remove(KEY),
};
