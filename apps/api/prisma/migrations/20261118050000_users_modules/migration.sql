-- AlterTable
ALTER TABLE "User" ADD COLUMN     "disabledAt" TIMESTAMP(3);


-- ---------- RLS: deactivated users see nothing ----------
CREATE OR REPLACE FUNCTION lk_super() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM "User" u
    WHERE u.id = lk_uid() AND u."isSuperAdmin" AND u."deletedAt" IS NULL AND u."disabledAt" IS NULL
  )
$$;

CREATE OR REPLACE FUNCTION lk_has_role(d uuid, roles text[]) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM "Membership" m JOIN "User" u ON u.id = m."userId"
    WHERE m."userId" = lk_uid() AND m."daycareId" = d AND m.status = 'ACTIVE'
      AND m."deletedAt" IS NULL AND m.role::text = ANY (roles)
      AND u."disabledAt" IS NULL AND u."deletedAt" IS NULL
  )
$$;

CREATE OR REPLACE FUNCTION lk_parent_children() RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT g."childId" FROM "ChildGuardian" g JOIN "User" u ON u.id = g."userId"
  WHERE g."userId" = lk_uid() AND u."disabledAt" IS NULL AND u."deletedAt" IS NULL
$$;

CREATE OR REPLACE FUNCTION lk_teacher_classes() RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT ct."classroomId" FROM "ClassTeacher" ct
  JOIN "Membership" m ON m.id = ct."membershipId"
  JOIN "User" u ON u.id = m."userId"
  WHERE m."userId" = lk_uid() AND m.status = 'ACTIVE' AND m."deletedAt" IS NULL AND u."disabledAt" IS NULL
$$;

-- ---------- Modules (feature switches): unsaved switch = default ----------
CREATE OR REPLACE FUNCTION lk_feature(d uuid, k text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(
    (SELECT f.enabled FROM "DaycareFeature" f WHERE f."daycareId" = d AND f.key = k LIMIT 1),
    k NOT IN ('staffGeofencedAttendance', 'dailyStoryAi')
  )
$$;

CREATE OR REPLACE FUNCTION lk_membership_role(mid uuid) RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT m.role::text FROM "Membership" m WHERE m.id = mid
$$;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO latif_rls;

-- A switched-off module's data is not reachable for that branch (data is kept).
DROP POLICY daily_report_access ON "DailyReport";
CREATE POLICY daily_report_access ON "DailyReport" FOR ALL TO latif_rls
  USING (lk_feature("daycareId", 'dailyReports') AND lk_child_visible("childId"))
  WITH CHECK (lk_feature("daycareId", 'dailyReports') AND lk_child_visible("childId"));

DROP POLICY subscription_office ON "Subscription";
DROP POLICY subscription_family_read ON "Subscription";
CREATE POLICY subscription_office ON "Subscription" FOR ALL TO latif_rls
  USING (lk_feature("daycareId", 'subscriptions') AND (lk_is_manager("daycareId") OR lk_staff_perm("daycareId", 'canManagePayments')))
  WITH CHECK (lk_feature("daycareId", 'subscriptions') AND (lk_is_manager("daycareId") OR lk_staff_perm("daycareId", 'canManagePayments')));
CREATE POLICY subscription_family_read ON "Subscription" FOR SELECT TO latif_rls
  USING (lk_feature("daycareId", 'subscriptions') AND "childId" IN (SELECT lk_parent_children()));

DROP POLICY plan_office ON "Plan";
CREATE POLICY plan_office ON "Plan" FOR ALL TO latif_rls
  USING (lk_feature("daycareId", 'subscriptions') AND (lk_is_manager("daycareId") OR lk_staff_perm("daycareId", 'canManagePayments')))
  WITH CHECK (lk_feature("daycareId", 'subscriptions') AND (lk_is_manager("daycareId") OR lk_staff_perm("daycareId", 'canManagePayments')));

DROP POLICY unit_staff ON "Unit";
DROP POLICY unit_item_staff ON "UnitItem";
CREATE POLICY unit_staff ON "Unit" FOR ALL TO latif_rls
  USING (lk_feature("daycareId", 'units') AND lk_is_staff("daycareId"))
  WITH CHECK (lk_feature("daycareId", 'units') AND lk_is_staff("daycareId"));
CREATE POLICY unit_item_staff ON "UnitItem" FOR ALL TO latif_rls
  USING (lk_feature("daycareId", 'units') AND lk_is_staff("daycareId"))
  WITH CHECK (lk_feature("daycareId", 'units') AND lk_is_staff("daycareId"));

-- ---------- Users: who may create / change whom ----------
-- General admin: anyone. Branch manager: teachers and parents of their own branch only.
-- Staff with "add staff": teachers of their branch. Anyone: their own row, without changing its role.
DROP POLICY membership_manage ON "Membership";
CREATE POLICY membership_read ON "Membership" FOR SELECT TO latif_rls
  USING ("userId" = lk_uid() OR lk_is_manager("daycareId") OR lk_staff_perm("daycareId", 'canAddStaff'));
CREATE POLICY membership_write ON "Membership" FOR ALL TO latif_rls
  USING (
    lk_super()
    OR (lk_has_role("daycareId", ARRAY['MANAGER']) AND role IN ('STAFF', 'PARENT'))
    OR (lk_staff_perm("daycareId", 'canAddStaff') AND role = 'STAFF')
    OR ("userId" = lk_uid() AND role::text = lk_membership_role(id))
  )
  WITH CHECK (
    lk_super()
    OR (lk_has_role("daycareId", ARRAY['MANAGER']) AND role IN ('STAFF', 'PARENT'))
    OR (lk_staff_perm("daycareId", 'canAddStaff') AND role = 'STAFF')
    OR ("userId" = lk_uid() AND role::text = lk_membership_role(id))
  );
