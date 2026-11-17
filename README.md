# Latif Kids

Nursery management for Latif Kids (branches Al Malqa, Al Rayan, Olaya) — admin web + parent/teacher mobile app. Arabic (RTL, default) + English. Google sign-in only.

See `SPEC.md` ("Revision 1" first), `PROGRESS.md` (phases + decisions) and `docs/latif-kids-hub-reference.pdf`.

## Structure

- `apps/api` — NestJS 11 + Prisma 7 API (`/api/v1`, Swagger at `/api/docs`)
- `apps/web` — Next.js 16 admin/parent web (BFF auth via httpOnly cookies)
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
pnpm --filter @latif/api seed    # the 3 branches (no demo data)
pnpm dev                         # api :4000, web :3000, expo dev server
```

## Google sign-in setup

1. Google Cloud Console → APIs & Services → Credentials → create OAuth client IDs:
   - **Web application**: authorised JavaScript origins `http://localhost:3000` (+ your production domain).
   - **iOS** (bundle id `app.latifkids.mobile`) and **Android** (package `app.latifkids.mobile` + SHA-1) for the mobile app.
2. In `.env`:
   - `GOOGLE_CLIENT_IDS` = all client IDs, comma-separated (API accepts tokens for any of them).
   - `SUPER_ADMIN_EMAILS` = the owner's Google email(s) → super admin on first sign-in.
   - `apps/web/.env.local`: `NEXT_PUBLIC_GOOGLE_CLIENT_ID=<web client id>`.
   - Mobile: `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`, `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`, `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID`.
3. Who gets what: any new Google account → **parent**. Staff are added by an admin by email, then sign in with that Google account. Super admins come from `SUPER_ADMIN_EMAILS`.

Mobile Google sign-in needs a development build (`npx expo run:android` / `run:ios` or EAS); Google does not allow it inside Expo Go. Set `EXPO_PUBLIC_API_URL` to your computer's LAN address on a device.

**Without Google credentials (local only):** set `AUTH_DEV_LOGIN=true` (API), `NEXT_PUBLIC_AUTH_DEV_LOGIN=true` (web) / `EXPO_PUBLIC_AUTH_DEV_LOGIN=true` (mobile) to show a "DEV" email sign-in. The API refuses this in production.

## Deploy (use it for real on web + phone)

The phone app and Google sign-in need the API on a public **HTTPS** address.

**Option A — one server (VPS) with Docker** (simplest, includes HTTPS):

```bash
cp .env.production.example .env.production   # fill DOMAIN, secrets, Google IDs, your email
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
```

Point your domain's DNS (A record) to the server first; Caddy gets the HTTPS certificate automatically.
Web: `https://DOMAIN` · API: `https://DOMAIN/api/v1` · uploads persist in a Docker volume.

**Option B — Render** (no server to manage): New → Blueprint → this repo (`render.yaml`). Fill the values it asks for (`CORS_ORIGINS`, `API_URL`, Google IDs, `SUPER_ADMIN_EMAILS`).

On first start the API applies migrations and creates the three branches. Sign in with the Google email you put in `SUPER_ADMIN_EMAILS`.

**Phone app (real install, not Expo Go):**

```bash
cd apps/mobile
npm i -g eas-cli && eas login && eas init     # one-time, free Expo account
# set EXPO_PUBLIC_API_URL in eas.json (preview/production) to https://DOMAIN
eas build -p android --profile preview          # gives an APK link + QR to install
eas build -p ios --profile preview              # needs an Apple developer account
```

Add the Android/iOS OAuth client IDs (`EXPO_PUBLIC_GOOGLE_*`) as EAS environment variables (`eas env:create`), and include them in the API's `GOOGLE_CLIENT_IDS`.

## Tests

```bash
pnpm test        # unit tests (shared, api, mobile)
pnpm test:e2e    # API e2e — needs Postgres; uses database latif_kids_test
```

The compose Postgres creates `latif_kids_test` automatically on first start.

Other: `pnpm lint`, `pnpm typecheck`, `pnpm format`, `pnpm build`, `pnpm infra:down`.
