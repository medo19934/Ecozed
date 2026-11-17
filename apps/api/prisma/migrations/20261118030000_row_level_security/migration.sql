-- Row Level Security (deny by default).
-- The API's per-request client (PrismaService.scoped) runs every query as role "latif_rls"
-- with the verified user id in "app.user_id". Who may see what is derived from the database
-- itself (memberships, class assignments, guardianship) — never from client-supplied roles.
-- The owner connection (auth, system jobs, PrismaService.raw) is unaffected.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'latif_rls') THEN
    CREATE ROLE latif_rls NOLOGIN;
  END IF;
END $$;
GRANT latif_rls TO CURRENT_USER;
GRANT USAGE ON SCHEMA public TO latif_rls;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO latif_rls;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO latif_rls;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO latif_rls;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO latif_rls;

-- ---------- helpers (SECURITY DEFINER: read memberships without recursion) ----------

CREATE OR REPLACE FUNCTION lk_uid() RETURNS uuid
LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('app.user_id', true), '')::uuid $$;

CREATE OR REPLACE FUNCTION lk_super() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM "User" u WHERE u.id = lk_uid() AND u."isSuperAdmin" AND u."deletedAt" IS NULL)
$$;

CREATE OR REPLACE FUNCTION lk_has_role(d uuid, roles text[]) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM "Membership" m
    WHERE m."userId" = lk_uid() AND m."daycareId" = d AND m.status = 'ACTIVE'
      AND m."deletedAt" IS NULL AND m.role::text = ANY (roles)
  )
$$;

-- General admin, or manager of this branch.
CREATE OR REPLACE FUNCTION lk_is_manager(d uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT lk_super() OR lk_has_role(d, ARRAY['MANAGER'])
$$;

-- Any staff (manager or teacher) of this branch, or general admin.
CREATE OR REPLACE FUNCTION lk_is_staff(d uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT lk_super() OR lk_has_role(d, ARRAY['MANAGER', 'STAFF'])
$$;

CREATE OR REPLACE FUNCTION lk_is_member(d uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT lk_super() OR lk_has_role(d, ARRAY['MANAGER', 'STAFF', 'PARENT'])
$$;

-- A teacher holding an explicit permission flag in this branch.
CREATE OR REPLACE FUNCTION lk_staff_perm(d uuid, perm text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM "Membership" m
    WHERE m."userId" = lk_uid() AND m."daycareId" = d AND m.role = 'STAFF' AND m.status = 'ACTIVE'
      AND m."deletedAt" IS NULL AND perm = ANY (m.permissions)
  )
$$;

CREATE OR REPLACE FUNCTION lk_teacher_classes() RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT ct."classroomId" FROM "ClassTeacher" ct
  JOIN "Membership" m ON m.id = ct."membershipId"
  WHERE m."userId" = lk_uid() AND m.status = 'ACTIVE' AND m."deletedAt" IS NULL
$$;

CREATE OR REPLACE FUNCTION lk_parent_children() RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT g."childId" FROM "ChildGuardian" g WHERE g."userId" = lk_uid()
$$;

CREATE OR REPLACE FUNCTION lk_my_memberships() RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT m.id FROM "Membership" m WHERE m."userId" = lk_uid()
$$;

-- Child visibility: branch manager/admin; teacher of the child's class; office staff with
-- payments or enrollment permission; the child's own guardians.
CREATE OR REPLACE FUNCTION lk_child_ok(child_daycare uuid, child_class uuid, child_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT lk_is_manager(child_daycare)
    OR (child_class IS NOT NULL AND child_class IN (SELECT lk_teacher_classes()))
    OR lk_staff_perm(child_daycare, 'canManagePayments')
    OR lk_staff_perm(child_daycare, 'canManageEnrollment')
    OR child_id IN (SELECT lk_parent_children())
$$;

CREATE OR REPLACE FUNCTION lk_child_visible(c uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM "Child" ch WHERE ch.id = c AND lk_child_ok(ch."daycareId", ch."classroomId", ch.id))
$$;

GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO latif_rls;

-- ---------- enable RLS (no policy = no rows) ----------

ALTER TABLE "Child" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ChildGuardian" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ChildAttendance" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DailyReport" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "VacationRequest" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AttendanceEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Subscription" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Plan" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AdmissionRequest" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Classroom" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ClassTeacher" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Membership" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StaffAttendance" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Document" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Unit" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "UnitItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DaycareFeature" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AuditLog" ENABLE ROW LEVEL SECURITY;

-- ---------- policies ----------

CREATE POLICY child_access ON "Child" FOR ALL TO latif_rls
  USING (lk_child_ok("daycareId", "classroomId", id))
  WITH CHECK (lk_child_ok("daycareId", "classroomId", id) OR lk_is_staff("daycareId"));

CREATE POLICY guardian_access ON "ChildGuardian" FOR ALL TO latif_rls
  USING (lk_child_visible("childId")) WITH CHECK (lk_child_visible("childId"));
CREATE POLICY child_attendance_access ON "ChildAttendance" FOR ALL TO latif_rls
  USING (lk_child_visible("childId")) WITH CHECK (lk_child_visible("childId"));
CREATE POLICY daily_report_access ON "DailyReport" FOR ALL TO latif_rls
  USING (lk_child_visible("childId")) WITH CHECK (lk_child_visible("childId"));
CREATE POLICY vacation_access ON "VacationRequest" FOR ALL TO latif_rls
  USING (lk_child_visible("childId")) WITH CHECK (lk_child_visible("childId"));

CREATE POLICY attendance_event_access ON "AttendanceEvent" FOR ALL TO latif_rls
  USING (
    lk_is_manager("daycareId")
    OR ("childId" IS NOT NULL AND lk_child_visible("childId"))
    OR ("membershipId" IS NOT NULL AND "membershipId" IN (SELECT lk_my_memberships()))
  )
  WITH CHECK (lk_is_member("daycareId"));

CREATE POLICY subscription_office ON "Subscription" FOR ALL TO latif_rls
  USING (lk_is_manager("daycareId") OR lk_staff_perm("daycareId", 'canManagePayments'))
  WITH CHECK (lk_is_manager("daycareId") OR lk_staff_perm("daycareId", 'canManagePayments'));
CREATE POLICY subscription_family_read ON "Subscription" FOR SELECT TO latif_rls
  USING ("childId" IN (SELECT lk_parent_children()));

CREATE POLICY plan_office ON "Plan" FOR ALL TO latif_rls
  USING (lk_is_manager("daycareId") OR lk_staff_perm("daycareId", 'canManagePayments'))
  WITH CHECK (lk_is_manager("daycareId") OR lk_staff_perm("daycareId", 'canManagePayments'));

CREATE POLICY admission_office ON "AdmissionRequest" FOR ALL TO latif_rls
  USING (lk_is_manager("daycareId") OR lk_staff_perm("daycareId", 'canManageEnrollment'))
  WITH CHECK (lk_is_manager("daycareId") OR lk_staff_perm("daycareId", 'canManageEnrollment'));
CREATE POLICY admission_requester ON "AdmissionRequest" FOR ALL TO latif_rls
  USING ("requestedById" = lk_uid()) WITH CHECK ("requestedById" = lk_uid());

-- Branch structure: readable by the branch's staff, writable by staff (API checks permissions).
CREATE POLICY classroom_staff ON "Classroom" FOR ALL TO latif_rls
  USING (lk_is_staff("daycareId")) WITH CHECK (lk_is_staff("daycareId"));
CREATE POLICY classroom_family_read ON "Classroom" FOR SELECT TO latif_rls
  USING (id IN (SELECT ch."classroomId" FROM "Child" ch WHERE ch.id IN (SELECT lk_parent_children())));
CREATE POLICY class_teacher_staff ON "ClassTeacher" FOR ALL TO latif_rls
  USING (lk_is_staff("daycareId")) WITH CHECK (lk_is_staff("daycareId"));
CREATE POLICY unit_staff ON "Unit" FOR ALL TO latif_rls
  USING (lk_is_staff("daycareId")) WITH CHECK (lk_is_staff("daycareId"));
CREATE POLICY unit_item_staff ON "UnitItem" FOR ALL TO latif_rls
  USING (lk_is_staff("daycareId")) WITH CHECK (lk_is_staff("daycareId"));
CREATE POLICY feature_read ON "DaycareFeature" FOR SELECT TO latif_rls USING (lk_is_member("daycareId"));
CREATE POLICY feature_write ON "DaycareFeature" FOR ALL TO latif_rls
  USING (lk_is_manager("daycareId")) WITH CHECK (lk_is_manager("daycareId"));

-- People: own membership; managers / staff-admins of the branch; staff see colleagues (not families).
CREATE POLICY membership_manage ON "Membership" FOR ALL TO latif_rls
  USING ("userId" = lk_uid() OR lk_is_manager("daycareId") OR lk_staff_perm("daycareId", 'canAddStaff'))
  WITH CHECK ("userId" = lk_uid() OR lk_is_manager("daycareId") OR lk_staff_perm("daycareId", 'canAddStaff'));
CREATE POLICY membership_colleagues ON "Membership" FOR SELECT TO latif_rls
  USING (lk_is_staff("daycareId") AND role <> 'PARENT');

CREATE POLICY staff_attendance_access ON "StaffAttendance" FOR ALL TO latif_rls
  USING ("membershipId" IN (SELECT lk_my_memberships()) OR lk_is_manager("daycareId") OR lk_staff_perm("daycareId", 'canManageAttendance'))
  WITH CHECK ("membershipId" IN (SELECT lk_my_memberships()) OR lk_is_manager("daycareId") OR lk_staff_perm("daycareId", 'canManageAttendance'));

CREATE POLICY document_access ON "Document" FOR ALL TO latif_rls
  USING (lk_is_manager("daycareId") OR lk_staff_perm("daycareId", 'canAddStaff') OR "ownerId" IN (SELECT lk_my_memberships()))
  WITH CHECK (lk_is_manager("daycareId") OR lk_staff_perm("daycareId", 'canAddStaff'));

CREATE POLICY audit_read ON "AuditLog" FOR SELECT TO latif_rls
  USING (lk_super() OR ("daycareId" IS NOT NULL AND lk_is_manager("daycareId")));
CREATE POLICY audit_append ON "AuditLog" FOR INSERT TO latif_rls WITH CHECK (true);
