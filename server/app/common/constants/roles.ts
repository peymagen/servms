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
const DIVISION_SCOPED_ROLES: string[] = [ROLE.DIVISIONAL_ADMIN, ROLE.DIVISIONAL_SUB_ADMIN];

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
