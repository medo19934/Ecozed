import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { AddressInfo } from 'node:net';

/**
 * Netlify Function entry: boots Nest once per container on a loopback port and
 * forwards each Web `Request` to it (multipart, files and headers pass through untouched).
 */
let origin: Promise<string> | null = null;

async function boot(): Promise<string> {
  // Netlify Database injects NETLIFY_DB_URL into functions.
  if (!process.env.DATABASE_URL && process.env.NETLIFY_DB_URL)
    process.env.DATABASE_URL = process.env.NETLIFY_DB_URL;
  const { migrate, purgeOnce } = await import('./serverless-migrate');
  // Embedded by scripts/build-netlify.mjs (the function has no prisma/ folder).
  const embedded = (globalThis as { __LATIF_MIGRATIONS__?: { name: string; sql: string }[] })
    .__LATIF_MIGRATIONS__;
  const applied = await migrate(process.env.DATABASE_URL ?? '', embedded);
  if (applied.length) Logger.log(`Applied migrations: ${applied.join(', ')}`, 'Serverless');
  if (await purgeOnce(process.env.DATABASE_URL ?? '', process.env.PURGE_DATA_ONCE)) {
    Logger.warn('All app data wiped (PURGE_DATA_ONCE)', 'Serverless');
  }
  const { AppModule } = await import('./app.module');
  const { configureApp, setupSwagger } = await import('./bootstrap');
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true,
    logger: ['error', 'warn', 'log'],
  });
  app.set('trust proxy', 'loopback');
  configureApp(app);
  setupSwagger(app);
  await app.listen(0, '127.0.0.1');
  const { port } = app.getHttpServer().address() as AddressInfo;
  return `http://127.0.0.1:${port}`;
}

const HOP = [
  'connection',
  'keep-alive',
  'transfer-encoding',
  'content-length',
  'content-encoding',
  'host',
];

export async function handle(req: Request): Promise<Response> {
  origin ??= boot().catch((e: unknown) => {
    origin = null;
    throw e;
  });
  const base = await origin;
  const url = new URL(req.url);
  const headers = new Headers(req.headers);
  for (const h of HOP) headers.delete(h);
  const ip = req.headers.get('x-nf-client-connection-ip');
  if (ip) headers.set('x-forwarded-for', ip);
  const res = await fetch(`${base}${url.pathname}${url.search}`, {
    method: req.method,
    headers,
    body: req.method === 'GET' || req.method === 'HEAD' ? undefined : await req.arrayBuffer(),
    redirect: 'manual',
  });
  const out = new Headers(res.headers);
  for (const h of HOP) out.delete(h);
  return new Response(res.status === 204 || res.status === 304 ? null : await res.arrayBuffer(), {
    status: res.status,
    headers: out,
  });
}
