# Latif Kids — Claude instructions

@AGENTS.md (applies to apps/web: read `apps/web/node_modules/next/dist/docs/` before Next.js code)

## Session start (mandatory)

1. Read `SPEC.md` ("Revision 1" overrides the rest) and `PROGRESS.md`. Visual reference: `docs/latif-kids-hub-reference.pdf`.
2. Pick the first unchecked phase in PROGRESS.md. Work on that phase only.

## Stack

- pnpm workspaces monorepo, Node 22, TypeScript strict everywhere.
- `apps/api` NestJS + Prisma + PostgreSQL, JWT access/refresh, RBAC, Swagger, BullMQ+Redis, S3 (MinIO dev), Socket.IO.
- `apps/web` Next.js App Router + Tailwind + shadcn/ui + TanStack Query + RHF + zod + next-intl (ar default RTL, en) + Recharts.
- `apps/mobile` Expo + Expo Router + NativeWind + i18next (RTL), roles Parent / Teacher.
- `packages/shared` (`@latif/shared`): zod schemas, DTO types, enums, constants. Single source of truth for contracts.

## Layout

```
apps/api      NestJS: src/modules/<feature>/{*.module,*.controller,*.service,dto}.ts, prisma/
apps/web      Next.js: src/app/[locale]/(marketing|auth|admin)/..., src/components, src/lib
apps/mobile   Expo: app/(parent|teacher)/..., src/components, src/lib
packages/shared  src/{schemas,enums,constants,types}/
legacy/       old Ecozed e-commerce app — not in workspace, do not touch
```

## Conventions

- Brand "Latif Kids"; gradient #5b6db4 → #7b649b, page #f2f4f5, radius 20px; icons: lucide only.
- Branches (Al Malqa, Al Rayan, Olaya) are the tenant (`Daycare` table). Roles: SUPER_ADMIN, MANAGER, STAFF, PARENT. Google sign-in only.
- Every business table has `daycareId` (branch); set from JWT via guard/Prisma extension. Never trust client `daycareId`.
- Soft deletes (`deletedAt`), pagination on all list endpoints, audit log for sensitive actions.
- All user-facing strings via i18n keys (ar + en). Use logical CSS (`ms-/me-/ps-/pe-`), never `left/right`.
- Validate input with shared zod schemas on both client and server.
- Files: kebab-case; React components PascalCase exports; no default exports except Next/Expo routes.
- Conventional commits: `feat(api): ...`, `chore: ...`.
- API: use `prisma.scoped` in feature services (`prisma.raw` only for auth/system); register new tenant models in `src/prisma/tenancy.ts`. Guards: `@Public`, `@Roles`, `@RequirePermissions`, `@RequireFeature`.
- Web calls the API only via `/bff/api/*` (`api` in `src/lib/api-client.ts`); tokens never reach browser JS.

## Commands

- `pnpm install` — install all
- `pnpm infra:up` / `pnpm infra:down` — Postgres, Redis, MinIO via docker compose
- `pnpm dev` — run all apps in parallel; `pnpm --filter @latif/api dev` for one
- `pnpm build` · `pnpm lint` · `pnpm typecheck` · `pnpm test` · `pnpm test:e2e` · `pnpm format`
- `pnpm --filter @latif/api db:migrate` · `pnpm --filter @latif/api seed` (branches only; local login via `AUTH_DEV_LOGIN=true`)

## Rules

- Work one phase at a time. When done: tick PROGRESS.md checkboxes, run lint+typecheck+tests, commit.
- Commit after each phase (and at sensible checkpoints within a big phase).
- Keep replies terse. No long explanations, no re-printing files.
- Don't add deps outside the fixed stack without a reason noted in PROGRESS.md.
- No demo data in seeds; no raw i18n keys on screen; every button saves/loads real data.
- Never commit secrets; update `.env.example` when adding env vars.
