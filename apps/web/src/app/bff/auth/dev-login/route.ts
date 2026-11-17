import { forwardAuth } from '@/lib/bff';

/** Local development only; the API returns 404 unless AUTH_DEV_LOGIN=true. */
export function POST(request: Request) {
  return forwardAuth('/auth/dev-login', request);
}
