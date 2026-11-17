// Bundles the compiled API (dist/) into one self-contained Netlify Function file.
// Run after `pnpm build`. Output: netlify/functions/api/server.cjs (git-ignored).
import { build } from 'esbuild';
import { mkdir, readdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const migDir = join(root, 'prisma', 'migrations');
const migrations = [];
for (const d of (await readdir(migDir, { withFileTypes: true }))
  .filter((x) => x.isDirectory())
  .sort((a, b) => a.name.localeCompare(b.name))) {
  migrations.push({
    name: d.name,
    sql: await readFile(join(migDir, d.name, 'migration.sql'), 'utf8'),
  });
}

// Optional Nest peers we don't use: Nest requires them inside try/catch, so a throwing stub is enough.
const OPTIONAL =
  /^(class-validator|class-transformer(\/.*)?|@nestjs\/websockets(\/.*)?|@nestjs\/microservices(\/.*)?)$/;
const out = join(root, 'netlify', 'functions', 'api', 'server.cjs');
await mkdir(dirname(out), { recursive: true });
await build({
  entryPoints: [join(root, 'dist', 'serverless.js')],
  outfile: out,
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'cjs',
  keepNames: true,
  legalComments: 'none',
  banner: { js: `globalThis.__LATIF_MIGRATIONS__ = ${JSON.stringify(migrations)};` },
  plugins: [
    {
      name: 'optional-peers',
      setup(b) {
        b.onResolve({ filter: OPTIONAL }, (a) => ({ path: a.path, namespace: 'optional' }));
        b.onLoad({ filter: /.*/, namespace: 'optional' }, (a) => ({
          contents: `throw Object.assign(new Error("Cannot find module '${a.path}'"), { code: 'MODULE_NOT_FOUND' });`,
        }));
      },
    },
  ],
});
console.log(`Bundled ${out} with ${migrations.length} migrations`);
