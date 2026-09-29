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
// Complaint Cell is division-scoped since it has no per-record ownership
// concept — it's a division-level operational role, same shape as Divisional
// Admin/Sub-admin. Dealing Section is division-scoped too: each division has its
// own Dealing Section, which enters that division's Location Master and
// Contractor data (on top of its assignee scope for delegated inspections).
const DIVISION_SCOPED_ROLES: string[] = [
  ROLE.DIVISIONAL_ADMIN,
  ROLE.DIVISIONAL_SUB_ADMIN,
  ROLE.COMPLAINT_CELL,
  ROLE.DEALING_SECTION,
];

export const isDivisionScoped = (roleName: string | undefined | null): boolean =>
  !!roleName && DIVISION_SCOPED_ROLES.includes(roleName);

// A division-scoped account without a division would see nothing and write
// records with no division, so creating/editing one requires a division.
export const assertDivisionForScopedRole = (
  roleName: string | null | undefined,
  divisionId: unknown
): void => {
  if (isDivisionScoped(roleName) && (divisionId === undefined || divisionId === null || divisionId === "")) {
    throw createHttpError(400, "Division is required for this role");
  }
};

// Inspector sees only inspections they filed themselves (no division/org-wide
// view) — the Inspection Management Module's "View Own Inspections" rule.
const SELF_SCOPED_ROLES: string[] = [ROLE.INSPECTOR];

export const isSelfScoped = (roleName: string | undefined | null): boolean =>
  !!roleName && SELF_SCOPED_ROLES.includes(roleName);

// Roles that see only inspections currently delegated to them. Empty since
// Dealing Section was given Divisional Admin's powers (whole-division view).
const ASSIGNEE_SCOPED_ROLES: string[] = [];

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

  // A record with no division is HQ-level data — outside every division's reach.
  if (isDivisionScoped(roleName) && "division_id" in record) {
    if (record.division_id == null || Number(record.division_id) !== Number(user?.division_id)) {
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

// Stricter than assertRecordAccessible: a record with no division (HQ-level
// user, HQ-uploaded complaint) is also out of a division-scoped actor's reach.
// Used for write actions where the record must sit in the actor's own division.
export const assertOwnDivisionRecord = (
  user: { role_name?: string | null; division_id?: number | null } | undefined | null,
  record: { division_id?: number | null } | null | undefined
): void => {
  if (!record || !isDivisionScoped(user?.role_name)) return;
  if (record.division_id == null || Number(record.division_id) !== Number(user?.division_id)) {
    throw createHttpError(404, "Record not found");
  }
};

// Every division enters data only into its own division: for a division-scoped
// actor, a create/edit payload's division_id is overwritten with their own —
// whatever the form sent. HQ roles keep the division they picked.
export const pinToOwnDivision = (
  user: { role_name?: string | null; division_id?: number | null } | undefined | null,
  body: Record<string, any>
): void => {
  if (isDivisionScoped(user?.role_name)) {
    body.division_id = user?.division_id ?? null;
  }
};

// For records whose division comes from something they reference (a unit's
// station/train/cluster, a penalty's contractor) rather than a division_id field:
// a division-scoped actor may only reference things inside their own division.
export const assertInOwnDivision = (
  user: { role_name?: string | null; division_id?: number | null } | undefined | null,
  divisionId: number | null | undefined,
  what: string
): void => {
  if (isDivisionScoped(user?.role_name) && divisionId != null && Number(divisionId) !== Number(user?.division_id)) {
    throw createHttpError(403, `${what} belongs to a different division`);
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
