import { forwardAuth } from '@/lib/bff';

export function POST(request: Request) {
  return forwardAuth('/auth/login', request);
}
