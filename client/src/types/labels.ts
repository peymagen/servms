export const ROLE_LABELS: Record<string, string> = {
  super_admin_hq: "Super Admin HQ",
  hq_admin: "HQ Admin",
  hq_sub_admin: "HQ Sub Admin",
  divisional_admin: "Divisional Admin",
  divisional_sub_admin: "Divisional Sub Admin",
  inspector: "Inspector",
  dealing_section: "Dealing Section",
  complaint_cell: "Complaint Cell",
};

export function roleLabel(roleName: string): string {
  return ROLE_LABELS[roleName] ?? roleName;
}

// Mirrors the server's DIVISION_SCOPED_ROLES (server/app/common/constants/roles.ts) —
// these roles only ever work inside their own division, so UI division pickers are
// locked to it (the server enforces this regardless).
const DIVISION_SCOPED_ROLES = ["divisional_admin", "divisional_sub_admin", "complaint_cell", "dealing_section"];

export function isDivisionScopedRole(roleName: string | null | undefined): boolean {
  return !!roleName && DIVISION_SCOPED_ROLES.includes(roleName);
}
