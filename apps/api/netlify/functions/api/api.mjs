// Netlify Function: the whole Nest API (see src/serverless.ts).
// Build: pnpm --filter @latif/api build && pnpm --filter @latif/api build:netlify
import server from './server.cjs';

export default (req) => server.handle(req);

export const config = { path: ['/api/*', '/health'] };
