import createHttpError from "http-errors";

// Canonical role_name slugs for the 8-role hierarchy. Keep in sync with
// server/seed.ts and server/migrations/001_phase1_roles_rbac_users_audit.sql.
export const ROLE = {
  SUPER_ADMIN_HQ: "super_admin_hq",
  HQ_ADMIN: "hq_admin",
  HQ_SUB_ADMIN: "hq_sub_admin",
  DIVISIONAL_ADMIN: "divisional_admin",
  DIVISIONAL_SUB_ADMIN: "divisional_sub_admin",
  INSPECTOR: "inspector",
  DEALING_SECTION: "dealing_section",
  COMPLAINT_CELL: "complaint_cell",
} as const;

// Roles whose data access is restricted to their own division (used to scope
// list/metrics queries by req.user.division_id across every operational module).
// Complaint Cell is division-scoped (not self/assignee-scoped like Inspector/
// Dealing Section) since it has no per-record ownership concept — it's a
// division-level operational role, same shape as Divisional Admin/Sub-admin.
const DIVISION_SCOPED_ROLES: string[] = [ROLE.DIVISIONAL_ADMIN, ROLE.DIVISIONAL_SUB_ADMIN, ROLE.COMPLAINT_CELL];

export const isDivisionScoped = (roleName: string | undefined | null): boolean =>
  !!roleName && DIVISION_SCOPED_ROLES.includes(roleName);

// Inspector sees only inspections they filed themselves (no division/org-wide
// view) — the Inspection Management Module's "View Own Inspections" rule.
const SELF_SCOPED_ROLES: string[] = [ROLE.INSPECTOR];

export const isSelfScoped = (roleName: string | undefined | null): boolean =>
  !!roleName && SELF_SCOPED_ROLES.includes(roleName);

// Dealing Section sees only inspections currently delegated to them.
const ASSIGNEE_SCOPED_ROLES: string[] = [ROLE.DEALING_SECTION];

export const isAssigneeScoped = (roleName: string | undefined | null): boolean =>
  !!roleName && ASSIGNEE_SCOPED_ROLES.includes(roleName);

// Guards a single fetched-by-id record against the requester's scope, for
// every "getById"-style read that isn't already filtered at the list-query
// level. Throws 404 (not 403) so a scoped-out user can't tell the difference
// between "doesn't exist" and "exists but isn't yours" — reused across every
// module's getById controller rather than reimplementing this per module.
// `record` is expected to already expose a `division_id` field (either a real
// column or, for units/penalties, the join-resolved value each service's
// SELECT already aliases as `division_id`).
export const assertRecordAccessible = (
  user: { role_name?: string | null; id?: number | null; division_id?: number | null } | undefined | null,
  record: Record<string, any> | null | undefined,
  opts: { ownerField?: string; assigneeField?: string } = {}
): void => {
  if (!record) return;
  const roleName = user?.role_name;

  if (isDivisionScoped(roleName) && record.division_id != null) {
    if (Number(record.division_id) !== Number(user?.division_id)) {
      throw createHttpError(404, "Record not found");
    }
  }
  if (opts.ownerField && isSelfScoped(roleName) && record[opts.ownerField] != null) {
    if (Number(record[opts.ownerField]) !== Number(user?.id)) {
      throw createHttpError(404, "Record not found");
    }
  }
  if (opts.assigneeField && isAssigneeScoped(roleName) && record[opts.assigneeField] != null) {
    if (Number(record[opts.assigneeField]) !== Number(user?.id)) {
      throw createHttpError(404, "Record not found");
    }
  }
};

// Admin-tier roles per the SRS: "All Admin role creation and management shall be
// controlled from Super Admin ID" — HQ/Divisional Admin accounts (and Super Admin
// itself) can only be created, edited, or disabled by super_admin_hq. This is
// deliberately narrower than the generic user_management permission, which
// hq_admin/divisional_admin also hold (needed for creating ordinary staff/sub-admin
// accounts) but must not extend to managing peer or superior admin accounts.
const ADMIN_TIER_ROLES: string[] = [ROLE.SUPER_ADMIN_HQ, ROLE.HQ_ADMIN, ROLE.DIVISIONAL_ADMIN];

export const isAdminTierRole = (roleName: string | undefined | null): boolean =>
  !!roleName && ADMIN_TIER_ROLES.includes(roleName);

// Call with the target user's CURRENT role_name (for edit/delete/disable) and/or
// the REQUESTED role_name (for create, or a PATCH that changes role_id) — pass
// whichever is relevant to the action being performed; either one landing in the
// Admin tier requires the actor to be Super Admin HQ.
export const assertCanManageAdminTier = (
  actingUser: { role_name?: string | null } | undefined | null,
  ...targetRoleNames: Array<string | null | undefined>
): void => {
  const touchesAdminTier = targetRoleNames.some((r) => isAdminTierRole(r));
  if (touchesAdminTier && actingUser?.role_name !== ROLE.SUPER_ADMIN_HQ) {
    throw createHttpError(403, "Only Super Admin HQ can create or manage Admin-tier accounts");
  }
};
