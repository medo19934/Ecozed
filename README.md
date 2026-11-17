# Latif Kids

Multi-tenant daycare/nursery management SaaS — admin web, parent/teacher mobile app, marketing site. Arabic (RTL) + English.

See `SPEC.md` (product spec) and `PROGRESS.md` (phase checklist).

## Structure

- `apps/api` — NestJS + Prisma API
- `apps/web` — Next.js admin + marketing site
- `apps/mobile` — Expo app (Parent / Teacher)
- `packages/shared` — shared zod schemas, types, enums
- `legacy/ecozed` — previous e-commerce app, kept for reference (not part of the workspace)

## Run locally

```bash
corepack enable          # pnpm 10
cp .env.example .env
pnpm install
pnpm infra:up            # Postgres :5432, Redis :6379, MinIO :9000 (console :9001)
pnpm dev
```

Other: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm format`, `pnpm infra:down`.
