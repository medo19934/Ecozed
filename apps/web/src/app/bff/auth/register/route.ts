import { forwardAuth } from '@/lib/bff';

/** Parent self sign-up (email or phone + password). */
export function POST(request: Request) {
  return forwardAuth('/auth/register', request);
}
