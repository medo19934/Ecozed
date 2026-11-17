import { execSync } from 'node:child_process';

/**
 * Applies pending migrations to the dedicated test database once per e2e run.
 * Tests use unique identifiers, so no destructive reset is needed.
 */
export default function globalSetup(): void {
  const url =
    process.env.TEST_DATABASE_URL ??
    'postgresql://latif:latif@localhost:5432/latif_kids_test?schema=public';
  execSync('pnpm exec prisma migrate deploy', {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: url },
  });
}
