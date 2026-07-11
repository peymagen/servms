export const ROLE_LABELS: Record<string, string> = {
  superadmin: "HQ Admin",
  admin: "Divisional Admin",
  inspector: "Inspector",
};

export function roleLabel(roleName: string): string {
  return ROLE_LABELS[roleName] ?? roleName;
}
