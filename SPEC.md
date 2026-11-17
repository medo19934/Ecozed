# Latif Kids — Product Specification

> Original daycare/nursery management SaaS. Brand: "Latif Kids" (placeholder). Palette: indigo → violet gradient. Icons: lucide.

# Product
Multi-tenant SaaS for daycares/nurseries. Three client surfaces:
- Admin Web App (daycare owner/manager/staff dashboard)
- Mobile App (single Expo app, two roles: Parent/Family and Teacher/Staff)
- Public Marketing Website (landing + signup + blog + contact)

Languages: Arabic (default, RTL) and English (LTR). Full i18n and RTL support everywhere. Hijri + Gregorian date display option. Currency configurable (default SAR).

# Stack (fixed)
- Monorepo: pnpm workspaces
  - apps/api: NestJS + TypeScript + Prisma + PostgreSQL, JWT (access+refresh), RBAC, OpenAPI/Swagger, BullMQ + Redis for jobs/notifications, S3-compatible storage (MinIO in dev)
  - apps/web: Next.js (App Router) + TypeScript + Tailwind + shadcn/ui + TanStack Query + react-hook-form + zod + next-intl (ar/en, RTL) + Recharts
  - apps/mobile: Expo (React Native) + TypeScript + Expo Router + NativeWind + i18next (RTL) + expo-notifications + expo-camera (QR) + expo-location
  - packages/shared: zod schemas, DTO types, enums, constants (used by all apps)
- Multi-tenancy: every business table has daycareId; enforce in a Prisma middleware/guard. Never trust client daycareId.

# Roles & permissions
- SuperAdmin (platform), Owner, Manager, Teacher/Staff, Parent.
- Per-staff permission flags: canAddChild, canAddStaff, canArchiveAccounts, canViewMessages, etc.
- Per-daycare feature toggles (Settings): Messages, Child QR attendance, In-app payment for parents, Staff attendance via teacher app (geofenced).

# Modules (all must be functional)

## 1. Auth & Onboarding
- Free signup flow (4 steps): (1) create account/trial, (2) complete daycare setup (daycare info, children, staff, parents), (3) activate digital services (public daycare website, fees, services, enrollment + payments), (4) start managing.
- Email/phone + password, OTP, forgot password, language switch, login for parents via phone/OTP.
- Onboarding checklist widget on dashboard.

## 2. Dashboard
- KPI cards: children count, staff count, classes count, units count, activities count (each clickable).
- "Children attendance" donut chart with date picker + class filter + refresh and "last updated" timestamp. Segments: No record, Absent, Vacation, Departure, Attended, plus total in center.
- Quick actions.

## 3. Daycare profile / settings
- Daycare data: name, logo, phone (with country code), city, address, map location picker (Google Maps; pin + address search). Location is used as the geofence for staff attendance verification (warn user about this).
- Bank account data (bank name, account holder, account no., IBAN).
- E-payment data (payment gateway credentials per tenant: pluggable provider interface, implement Stripe + a mock provider).
- Terms & conditions: rich-text editor shown to parents at enrollment.
- Permission toggles listed above.

## 4. Classes (Classrooms) & Units
- CRUD classes (name, capacity, age range, assigned teachers). CRUD units (curriculum units/groups, e.g. "Water Unit"). Capacity indicators.

## 5. Children
- CRUD child: name, gender, birthdate (age shown "3 years 5 months"), photo, class, guardians (multiple, with relationship), allergies, medical notes, pickup authorizations, documents, status (active/archived).
- Archive/restore. Search + filters + pagination.
- Child profile page: info, attendance history, subscriptions, messages, documents, daily digest history.

## 6. Staff
- CRUD staff: name, role (teacher/assistant/admin), specialty tags (Arabic language, Islamic education, Arts...), photo, email, address, qualifications text, join date, status.
- Staff profile with tabs: Files (upload/download/soft-delete + "deleted files" bin with restore), Messages, side panel with info and permission checklist.
- Staff attendance via teacher app with geofence check against daycare location.

## 7. Curriculum / Calendar
- Calendar views: month, week, day. Filter by class and by type. Today button, next/prev.
- Lesson/activity entity: lesson name, description, unit, date, from-time, to-time, teacher, class, attachments (images, videos, PDF).
- "Add to calendar" form. Color-coded chips, "+N more" overflow.
- Side panel: monthly plan progress bars (children %, staff %, classes %, units %) + list of active teachers with specialty badges.
- Mobile: horizontal day strip + bottom-sheet details (lesson, description, unit, date, from/to, teacher, media gallery & file chips).

## 8. Attendance
- Children attendance: daily roster, statuses (Attended, Absent, Vacation, Departure, No record), check-in/out timestamps, who dropped off/picked up.
- QR flow: web "Check-in/Check-out" screen shows a rotating QR + 6-digit code (30-60 s TTL, server-signed). Teacher/parent mobile app scans QR or types code to record attendance.
- Staff attendance with geofence.
- Vacation requests by parents.

## 9. Enrollment Requests
- Public enrollment form on each daycare's public page. Table of requests with: id, child name + gender + age, guardian name + relationship, submitted date (Gregorian/Hijri + time), phone, email, status (Under review / Accepted / Rejected).
- KPI cards: total, under review, accepted, rejected. Filters: search (child/guardian/phone), status, date range with quick chips (Today, Last week, Last month, Last year).
- Row actions: Accept (creates child + guardian account + sends notification/WhatsApp-ready message), Reject (with reason). Show the daycare's terms.

## 10. Subscriptions & Payments
- Plans: name, price, billing period, services included (e.g. outdoor play, snacks, weekly report, daycare transport), status.
- Subscriptions: child, plan, start date, end date, amount, payment status (Paid / Unpaid / Overdue), payment method, account status (Active / Expired / Cancelled / Archived).
- KPI cards: total, paid, unpaid, cancelled. Six filters (child name, class, account status, plan, payment status, subscription status) + period filter.
- Row actions: Mark as paid, Send payment reminder, Archive child, Cancel subscription. Expandable rows, colored status pills, red-tinted expired rows.
- Side panel "Reminders" and "Plan details". Add-subscription modal.
- Parent in-app payment (when toggle enabled) via payment provider; webhook updates status; receipts (PDF).

## 11. Messaging
- Conversation list (search; tabs: All / Staff / Parents) and a chat pane. Each thread is linked to a child and guardian. Text, image, file, voice note attachments. Unread badges. Read receipts. New message modal. Real-time via WebSocket (Socket.IO) + push notifications.
- AI Daily Digest: button on a child thread that generates a short, warm daily summary (activities, meals, nap duration, play, mood) from that day's logs using an LLM (provider-agnostic service: configurable API key), shown in a modal ("Daily Story", editable) with "Share with family" and "Cancel". Arabic and English output.

## 12. Daily logs (teacher app)
- Per child per day: meals, nap (duration), diaper/toilet, mood, activities participated, notes, photos. These feed the Daily Digest and parent feed.

## 13. Reports
- Attendance report, financial report (revenue, unpaid), enrollment funnel, class occupancy. Date filters. Export CSV/PDF.

## 14. Documents
- Centralized files for daycare, staff, children with categories and expiry reminders (e.g. health certificate).

## 15. Notifications
- In-app bell + push (FCM/APNs via Expo) + email. Event triggers: attendance, new message, payment due/overdue, enrollment status, new calendar item, daily digest shared.

## 16. Public marketing website (apps/web, route group (marketing))
- Header: Home, About, Products (dropdown: Admin web, Parent app, Teacher app), Blog, Contact, language switch, search, Login, "Register now" CTA.
- Home: hero, the 4-step "how it works" cards with UI previews, features grid, app-store badges (Google Play, App Store, Huawei AppGallery placeholders), pricing, FAQ, floating WhatsApp contact button.
- Blog (markdown-based, CMS-less). Contact form.
- Per-daycare public page /d/[slug]: about, services, plans, photos, enrollment form.

## 17. Admin sidebar navigation
Dashboard, Classes/Units, Daycare profile, Staff & Children, Curriculum, Calendar, Attendance, Reports, Documents, Messages (with unread dot), Settings, fullscreen toggle, language/user menu, collapsible sidebar.

# UX / Design rules
- Rounded cards (16-24px), soft shadows, indigo->violet gradient primary buttons, light gray page background, pill status badges, KPI cards with gradient tint + icon.
- Breadcrumbs on every inner page. Skeleton loaders. Empty states. Toasts. Confirm dialogs.
- Fully responsive web. Mobile app uses bottom sheets, large touch targets.
- Accessibility: keyboard nav, labels, contrast.

# Non-functional
- Seed script with demo daycare (88 children, 25 staff, 12 classes) for the dashboard.
- Tests: unit tests for services, e2e for auth/enrollment/subscription flows, Playwright smoke test for web.
- Docker Compose for local dev; .env.example; README with run steps.
- Audit log table for sensitive actions. Soft deletes. Pagination everywhere.
