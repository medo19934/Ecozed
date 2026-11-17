import path from 'node:path';
import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
  transpilePackages: ['@latif/shared'],
  reactStrictMode: true,
  // Self-contained server for Docker / Render (pnpm monorepo → trace from the repo root).
  output: 'standalone',
  outputFileTracingRoot: path.join(__dirname, '../../'),
};

export default withNextIntl(nextConfig);
