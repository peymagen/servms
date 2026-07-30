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
