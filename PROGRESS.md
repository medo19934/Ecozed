# Latif Kids — Progress

Legend: `[ ]` todo · `[x]` done. Work one phase at a time; commit after each.
SPEC.md "Revision 1" (from `docs/latif-kids-hub-reference.pdf`) overrides the original spec.

## Phase 0 — Monorepo skeleton

- [x] CLAUDE.md, SPEC.md, PROGRESS.md
- [x] pnpm workspaces, shared tsconfig, eslint, prettier, editorconfig
- [x] docker-compose (Postgres, Redis, MinIO), .env.example, README
- [x] Empty apps: api, web, mobile; package: shared
- [x] Old Ecozed app moved to `legacy/ecozed` (outside workspace)

## Phase 1 — Foundations (shared + API core + app shells)

- [x] packages/shared: enums (roles, statuses), base zod schemas, pagination types, constants (branches, Sat–Thu week)
- [x] api: NestJS bootstrap, config module, Swagger, health check
- [x] api: Prisma schema core (Branch=`Daycare`, User w/ googleId, Membership w/ permission flags, DaycareFeature, AuditLog, RefreshToken)
- [x] api: tenancy guard + Prisma extension (branch scoping, soft delete); super admin acts in any branch
- [x] api: Google sign-up/sign-in (ID token verify), JWT access/refresh rotation, RBAC guards + permission flags + feature toggles
- [x] web: Next.js + Tailwind + shadcn-style UI, next-intl (ar RTL default / en), reference palette (#5b6db4→#7b649b, #f2f4f5)
- [x] web: Google login page, icon sidebar (role-based nav), header bell + branch switcher, parent home (Sat–Thu strip, Enroll card)
- [x] mobile: Expo Router + NativeWind + i18next RTL, Google sign-in, parent/teacher tab shells, parent home
- [x] Unit tests for auth service; e2e Google auth flow (fake verifier)

## Phase 2 — Branch setup & core records

- [x] Branch profile (super admin edits all; manager own): name ar/en, logo upload (local/S3/MinIO), phone, address, map pin + geofence radius warning
- [x] Feature toggles per branch (messages, QR attendance, geofenced staff attendance, Daily Story AI — off by default)
- [x] Staff: admin creates staff by email (role manager/teacher/assistant, branch, class), permission toggles enforced; profile panel + Files tab (private, upload/download/soft-delete, deleted-files bin)
- [x] Classes CRUD (capacity, age range, teachers); teachers see only their class
- [x] Children CRUD (guardians linked to parent accounts, allergies, medical, pickup, archive/restore, search/filter/pagination) + child profile
- [x] Parent: linked children list on home (web + mobile); visibility enforced (own children only); teacher mobile "Today" lists own class
- [x] Admin-only "TEST data" button (clearly labelled) — no seed demo data

## Phase 3 — Dashboard & Attendance

- [x] Dashboard: 5 cards (children, staff, classes, units, activities) + attendance donut (class/date filters, refresh, last updated), branch filter for super admin
- [x] Attendance kiosk screen: QR rotating every 30 s (server-signed, no reuse) + 6-digit personal PIN; success/error feedback
- [x] Mobile: scan kiosk QR (expo-camera); record person, direction in/out, time, method; personal PIN in profile
- [x] Children daily roster (attended, absent, vacation, departure, no record) on web + teacher app; vacation requests by parents (web + app) with staff approval
- [x] Staff check-in with geolocation inside branch radius (+ device biometric via expo-local-authentication)

## Phase 4 — Admissions, Calendar, Units

- [x] Parent "Enroll my child" → admission request to a branch (web + app), withdraw while under review, see decision/reason
- [x] Admission requests: 4 cards, period chips, search/status/date filters, Gregorian + Hijri dates; Accept (create child, assign class, link parent) / Reject (polite message). Message thread on accept arrives with messaging (phase 6)
- [x] Calendar day/week/month, Sat–Thu, Friday closed & greyed; filters class/type; Add to calendar (admin/manager); targets all branches/branch/class; "+N more"; app day strip + bottom-sheet details
- [x] Units: active/archived, goals, lessons & activities, active teachers side panel; dashboard units/activities counts

## Phase 5 — Subscriptions (on-site payments)

- [ ] Plans (name, price SAR, period, services)
- [ ] Subscriptions: 4 cards, 6 filters + period, table, row menu Mark paid / Remind / Archive child / Cancel, unpaid rows red, side panel reminders + plan details, Add subscription
- [ ] Parent read-only status of own children

## Phase 6 — Messages, Daily reports, Daily Story, Notifications

- [ ] Inbox + chat (per-child threads, text/photo/file/voice, unread, read ticks), new conversation, announcements to branch/class, quick replies/templates
- [ ] Socket.IO real time; scope: parent own children, teacher own class, manager own branch, admin all
- [ ] Daily reports (teacher app): meals, nap, toilet, mood, activities, notes, photos; parent view
- [ ] Daily Story AI (when toggle on): generate from day's records → teacher edits → Share with family (ar/en)
- [ ] Notifications: bell, Expo push, quiet hours; triggers (attendance, message, payment reminder, admission status, calendar, story shared)

## Phase 7 — Reports & polish

- [ ] Reports: attendance, payments (paid/unpaid), admissions funnel, class occupancy; CSV/PDF export
- [ ] UX pass: skeletons, empty states, toasts, confirm dialogs, a11y, responsive; no raw i18n keys
- [ ] Hijri/Gregorian display option

## Phase 8 — Release readiness

- [ ] Mobile completion pass (parent + teacher flows, push, RTL QA on devices; dev build for Google sign-in)
- [ ] Service unit test coverage; e2e for admissions/subscriptions; Playwright smoke test for web
- [ ] Audit log coverage; pagination everywhere check
- [ ] README, .env.example, CI workflow (lint/typecheck/test)

## Decisions & notes

- Scope changed per owner PDF (SPEC "Revision 1"): branches instead of SaaS tenants, Google-only auth, on-site payments, no marketing site, no demo data.
- NestJS pinned to v11: v12 is ESM-only and `nestjs-zod` (shared zod DTOs → Swagger) supports ≤11.
- Prisma 7 (`prisma-client` generator, `@prisma/adapter-pg`, `prisma.config.ts`). Client in `apps/api/src/generated` (git-ignored).
- `PrismaService.scoped` = branch + soft-delete client (use in features); `.raw` = auth/system only. New tenant models must be added to `TENANT_MODELS` (a test enforces it). Branch table is still named `Daycare` (`daycareId`).
- Auth: `POST /auth/google` verifies the Google ID token (`google-auth-library`, audiences = `GOOGLE_CLIENT_IDS`). New email → parent; existing email (staff created by admin) → linked; `SUPER_ADMIN_EMAILS` → super admin. `POST /auth/dev-login` only when `AUTH_DEV_LOGIN=true` (refused in production).
- Web auth = BFF: `/bff/auth/*` route handlers store JWTs in httpOnly cookies; `/bff/api/*` proxies to the API with auto refresh. Next 16 uses `src/proxy.ts`.
- Mobile Google sign-in = `expo-auth-session` (needs a dev build / store build with OAuth client IDs; Expo Go is not supported by Google).
- shadcn registry unreachable from the sandbox → components hand-written in shadcn style (`components.json` kept).
- Expo SDK 58, NativeWind 4 + Tailwind 3 (mobile), React 19.3 across web+mobile. Tokens in SecureStore. Arabic default; switching language reloads to apply native RTL.
- e2e tests run against `latif_kids_test` (`prisma migrate deploy`, unique fixtures, no destructive reset).
- Storage: `STORAGE_DRIVER=local` (dev disk, `apps/api/storage/`, git-ignored) or `s3` (MinIO/AWS). Files are never public: served through authenticated API routes (web via BFF, mobile with bearer header).
- Guardians link to parent accounts by email/phone both when staff save a child and on every parent sign-in; a linked parent gets a PARENT membership in that branch. `/parent/children` filters by `guardians.userId` (crosses branches).
- Branch map: lat/lng fields + "use my location" + Google Maps embed preview (no API key). A full Places/pin picker needs `NEXT_PUBLIC_GOOGLE_MAPS_KEY` (later).
- Web route guard: pages not in the user's nav render "no permission"; the API is the real enforcement.
- Attendance: one `ChildAttendance`/`StaffAttendance` row per person per branch-local day + append-only `AttendanceEvent` log. Kiosk QR = HMAC token (branch + 30 s window, accepted for current/previous window); scanned by the signed-in app user (parent → their children in that branch, staff → themselves). PINs are HMAC-hashed, unique per branch, shown once. Self-service scans are debounced 60 s.
- Units/activities dashboard cards read 0 until the curriculum module (phase 4).
- Biometric before location check-in runs on the device (expo-local-authentication); the server enforces the geofence (radius + up to 50 m GPS accuracy).
- Added dep `qrcode` (web) to render the kiosk QR offline — no third-party QR service.
- Calendar events with audience ALL have no branch (`daycareId` null); `CalendarEvent` is tenancy-exempt and every query filters explicitly by role (admin: branch + all; teacher: branch + all + own classes; parent: their children's branches/classes + all).
- Admission email defaults to the requesting parent's Google email so the accepted child links to their account automatically.
