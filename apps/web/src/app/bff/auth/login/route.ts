import { forwardAuth } from '@/lib/bff';

/** Email / phone sign-in (public demo mode); the API returns 404 unless PUBLIC_DEMO=true. */
export function POST(request: Request) {
  return forwardAuth('/auth/login', request);
}
