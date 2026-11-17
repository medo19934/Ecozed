// Vercel Function: the whole Nest API (src/serverless.ts), all paths rewritten here.
import server from './_server.cjs';

const handle = (req) => server.handle(req);
export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
export const OPTIONS = handle;
export const HEAD = handle;
