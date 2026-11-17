# Latif Kids — Progress

Legend: `[ ]` todo · `[x]` done. Work one phase at a time; commit after each.

## Phase 0 — Monorepo skeleton

- [x] CLAUDE.md, SPEC.md, PROGRESS.md
- [x] pnpm workspaces, shared tsconfig, eslint, prettier, editorconfig
- [x] docker-compose (Postgres, Redis, MinIO), .env.example, README
- [x] Empty apps: api, web, mobile; package: shared
- [x] Old Ecozed app moved to `legacy/ecozed` (outside workspace)

## Phase 1 — Foundations (shared + API core + app shells)

- [ ] packages/shared: enums (roles, statuses), base zod schemas, pagination types, constants
- [ ] api: NestJS bootstrap, config module, Swagger, health check
- [ ] api: Prisma schema core (Daycare, User, Membership, StaffPermission, FeatureToggle, AuditLog, RefreshToken)
- [ ] api: tenancy guard + Prisma extension (daycareId scoping, soft delete)
- [ ] api: auth (email/phone+password, JWT access/refresh, OTP, forgot password), RBAC guards + permission flags
- [ ] web: Next.js + Tailwind + shadcn/ui, next-intl (ar RTL default / en), theme tokens (indigo→violet)
- [ ] web: auth pages (login, parent OTP, forgot password), admin layout (collapsible sidebar, breadcrumbs, user/lang menu, fullscreen)
- [ ] mobile: Expo Router + NativeWind + i18next RTL, role-based login, tab shells (parent/teacher)
- [ ] Unit tests for auth service; e2e auth flow

## Phase 2 — Daycare setup & core records

- [ ] 4-step signup/onboarding flow + dashboard checklist widget
- [ ] Daycare profile: info, logo upload (S3/MinIO), phone w/ country code, map picker + geofence warning
- [ ] Bank account, e-payment provider settings (interface + Stripe + mock), T&C rich text, feature toggles
- [ ] Classes CRUD (capacity indicators, teachers) + Units CRUD
- [ ] Children CRUD (guardians, allergies, medical, pickup auth, archive/restore, search/filter/pagination) + profile page
- [ ] Staff CRUD (specialty tags, permissions checklist) + profile tabs (files w/ bin + restore)
- [ ] Seed script: demo daycare (88 children, 25 staff, 12 classes)

## Phase 3 — Dashboard & Attendance

- [ ] Dashboard KPI cards (clickable) + quick actions
- [ ] Attendance donut (date picker, class filter, refresh, last updated)
- [ ] Children daily roster, statuses, check-in/out, drop-off/pick-up person
- [ ] Rotating signed QR + 6-digit code screen (web); scan/type code (mobile)
- [ ] Staff attendance via teacher app with geofence check
- [ ] Parent vacation requests (mobile) + approval (web)

## Phase 4 — Curriculum, Calendar, Daily logs, Documents

- [ ] Lesson/activity entity + attachments; "Add to calendar" form
- [ ] Calendar month/week/day, filters, color chips, "+N more", side panel (progress bars, active teachers)
- [ ] Mobile day strip + bottom-sheet lesson details with media gallery
- [ ] Daily logs (teacher app): meals, nap, toilet, mood, activities, notes, photos; parent feed
- [ ] Documents center: categories, expiry reminders (BullMQ job)

## Phase 5 — Enrollment, Subscriptions & Payments

- [ ] Public enrollment form + terms display
- [ ] Enrollment table: KPIs, filters, date chips, Hijri/Gregorian, accept (creates child+guardian, WhatsApp-ready msg) / reject w/ reason
- [ ] Plans CRUD (services, billing period)
- [ ] Subscriptions table: KPIs, 6 filters + period, expandable rows, pills, red expired rows, row actions, side panels, add modal
- [ ] Parent in-app payment, webhook status updates, PDF receipts
- [ ] e2e: enrollment + subscription flows

## Phase 6 — Messaging, AI Daily Digest, Notifications

- [ ] Threads (child + guardian), list with search/tabs, chat pane, attachments (image/file/voice), unread, read receipts, new message modal
- [ ] Socket.IO gateway (tenant-scoped rooms) + web/mobile clients
- [ ] AI Daily Digest: provider-agnostic LLM service, ar/en, editable "Daily Story" modal, share with family
- [ ] Notifications: in-app bell, Expo push, email; all event triggers via BullMQ

## Phase 7 — Reports & Public website

- [ ] Reports: attendance, financial, enrollment funnel, class occupancy; date filters; CSV/PDF export
- [ ] Marketing (marketing) group: header w/ products dropdown, hero, 4-step cards, features, store badges, pricing, FAQ, WhatsApp button
- [ ] Blog (markdown), About, Contact form
- [ ] Per-daycare public page /d/[slug]: about, services, plans, photos, enrollment form

## Phase 8 — Polish, tests, release readiness

- [ ] Mobile completion pass (parent + teacher flows, push, RTL QA)
- [ ] UX pass: skeletons, empty states, toasts, confirm dialogs, a11y (keyboard, labels, contrast), responsive
- [ ] Hijri/Gregorian toggle + currency setting applied everywhere
- [ ] Service unit test coverage; Playwright smoke test for web
- [ ] Audit log coverage for sensitive actions; pagination everywhere check
- [ ] README run steps, .env.example complete, CI workflow (lint/typecheck/test)
