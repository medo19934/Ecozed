# Latif Kids

Multi-tenant daycare/nursery management SaaS — admin web, parent/teacher mobile app, marketing site. Arabic (RTL, default) + English.

See `SPEC.md` (product spec) and `PROGRESS.md` (phase checklist + decisions).

## Structure

- `apps/api` — NestJS 11 + Prisma 7 API (`/api/v1`, Swagger at `/api/docs`)
- `apps/web` — Next.js 16 admin + marketing site (BFF auth via httpOnly cookies)
- `apps/mobile` — Expo SDK 58 app (Parent / Teacher)
- `packages/shared` — shared zod schemas, types, enums (`@latif/shared`)
- `legacy/ecozed` — previous e-commerce app, kept for reference (not part of the workspace)

## Run locally

```bash
corepack enable                  # pnpm 10, Node 22
cp .env.example .env
pnpm install                     # also builds @latif/shared
pnpm infra:up                    # Postgres :5432, Redis :6379, MinIO :9000 (console :9001)
pnpm --filter @latif/api db:migrate
pnpm --filter @latif/api seed    # demo daycare + users
pnpm dev                         # api :4000, web :3000, expo dev server
```

Demo logins (password `Password123!`): `owner@latifkids.test`, `manager@latifkids.test`, `teacher@latifkids.test`, `parent@latifkids.test` (parent also via OTP on `+966500000004`). With `OTP_DEV_ECHO=true` the OTP code is returned in the API response and shown in a dev toast/alert.

Mobile: set `EXPO_PUBLIC_API_URL` to your machine's LAN address (e.g. `http://192.168.1.10:4000`) when running on a device.

## Tests

```bash
pnpm test        # unit tests (shared, api, mobile)
pnpm test:e2e    # API e2e — needs Postgres; uses database latif_kids_test
```

The compose Postgres creates `latif_kids_test` automatically on first start.

Other: `pnpm lint`, `pnpm typecheck`, `pnpm format`, `pnpm build`, `pnpm infra:down`.
