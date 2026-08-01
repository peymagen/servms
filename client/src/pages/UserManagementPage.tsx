import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { useGetUsersQuery, useCreateUserMutation, useToggleUserStatusMutation } from "../api/userApi";
import { useGetDivisionsQuery, useGetStationsQuery, useGetRolesLiteQuery, useGetZonesQuery } from "../api/mastersApi";
import { roleLabel } from "../types/labels";
import { useAuth } from "../context/AuthContext";
import type { DesignationGrade } from "../types";
import Field from "../components/ui/Field";
import Pagination from "../components/ui/Pagination";
import styles from "../styles/listPage.module.css";

const LIMIT = 10;

// Only these role_name slugs can grant Card Signing Authority, and only when
// designation_grade is JS or SS — mirrors the server-side rule in user.service.ts.
const SUB_ADMIN_ROLES = ["hq_sub_admin", "divisional_sub_admin"];
const SIGNING_ELIGIBLE_GRADES: DesignationGrade[] = ["JS", "SS"];

// Roles that see the "Active Users" / "Total Active in Last 7 Days" stat cards (per UAT doc).
const STATS_VISIBLE_ROLES = ["super_admin_hq", "hq_admin", "divisional_admin"];

const DESIGNATION_GRADE_LABELS: Record<DesignationGrade, string> = {
  JAG: "JAG",
  SG: "SG",
  SR_SUPERVISOR: "Sr. Supervisor",
  JS: "JS",
  SS: "SS",
  OTHER: "Other",
};

export default function UserManagementPage() {
  const { user: currentUser, can } = useAuth();
  const canCreate = can("user_management", "create");
  const canEdit = can("user_management", "edit");
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<number | "">("");
  const [statusFilter, setStatusFilter] = useState<"" | "active" | "inactive">("");
  const [divisionFilter, setDivisionFilter] = useState<number | "">("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [offset, setOffset] = useState(0);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [toggleError, setToggleError] = useState<string | null>(null);

  const { data: users = [], isFetching: isLoading, error: loadError } = useGetUsersQuery();
  const { data: roles = [] } = useGetRolesLiteQuery();
  const { data: divisions = [] } = useGetDivisionsQuery();
  const [toggleUserStatus] = useToggleUserStatusMutation();
  const error = toggleError ?? (loadError ? "Unable to load users" : null);

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      if (search) {
        const q = search.toLowerCase();
        const matches =
          u.full_name.toLowerCase().includes(q) ||
          u.username.toLowerCase().includes(q) ||
          u.employee_id.toLowerCase().includes(q);
        if (!matches) return false;
      }
      if (roleFilter && u.role_id !== roleFilter) return false;
      if (statusFilter && u.users_status !== statusFilter) return false;
      if (divisionFilter && u.division_id !== divisionFilter) return false;
      return true;
    });
  }, [users, search, roleFilter, statusFilter, divisionFilter]);

  const pagedUsers = useMemo(
    () => filteredUsers.slice(offset, offset + LIMIT),
    [filteredUsers, offset]
  );

  const activeCount = users.filter((u) => u.users_status === "active").length;
  const inactiveCount = users.length - activeCount;
  const activeLast7Days = useMemo(() => {
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return users.filter(
      (u) => u.users_status === "active" && u.last_login_at && new Date(u.last_login_at).getTime() >= cutoff
    ).length;
  }, [users]);
  const showStats = !!currentUser && STATS_VISIBLE_ROLES.includes(currentUser.role_name);

  async function toggleStatus(id: number) {
    setToggleError(null);
    try {
      await toggleUserStatus(id).unwrap();
    } catch {
      setToggleError("Unable to toggle status");
    }
  }

  function handleExportCsv() {
    const headers = ["Employee ID", "HRMS ID", "Full Name", "Username", "Designation", "Role", "Division", "Zone", "Status", "Last Login"];
    const rows = filteredUsers.map((u) => [
      u.employee_id,
      u.hrms_id ?? "",
      u.full_name,
      u.username,
      u.designation ?? "",
      roleLabel(u.role_name),
      u.division_name ?? "",
      u.zone_name ?? "",
      u.users_status,
      u.last_login_at ? new Date(u.last_login_at).toLocaleString() : "Never",
    ]);
    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "user-management.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <div style={{ fontSize: 12, color: "var(--color-text-muted)", marginBottom: 10 }}>
        Admin Console <strong style={{ color: "var(--color-text)" }}>&gt; User Management</strong>
      </div>

      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>User Management</h1>
          <p className={styles.subtitle}>
            Manage SERVMS personnel across the HQ and Divisional role hierarchy.
          </p>
        </div>
        {canCreate && (
          <button className={styles.addBtn} onClick={() => setIsFormOpen(true)}>
            + Add New User
          </button>
        )}
      </div>

      <div
        style={{
          background: "var(--color-surface)",
          borderRadius: "var(--radius-lg)",
          boxShadow: "var(--shadow-card)",
          padding: "18px 20px 4px",
          marginBottom: 16,
        }}
      >
        <div className={styles.filterRow}>
          <LabeledField label="Search">
            <input
              className={styles.searchInput}
              style={{ marginBottom: 0, maxWidth: "none" }}
              placeholder="Search by name or Employee ID…"
              value={search}
              onChange={(e) => {
                setOffset(0);
                setSearch(e.target.value);
              }}
            />
          </LabeledField>
          <LabeledField label="Role">
            <select
              className={styles.select}
              value={roleFilter}
              onChange={(e) => {
                setOffset(0);
                setRoleFilter(e.target.value ? Number(e.target.value) : "");
              }}
            >
              <option value="">All Roles</option>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {roleLabel(r.role_name)}
                </option>
              ))}
            </select>
          </LabeledField>
          <LabeledField label="Status">
            <select
              className={styles.select}
              value={statusFilter}
              onChange={(e) => {
                setOffset(0);
                setStatusFilter(e.target.value as "" | "active" | "inactive");
              }}
            >
              <option value="">All</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </LabeledField>
          <button
            type="button"
            className={styles.cancelBtn}
            style={{ alignSelf: "flex-end" }}
            onClick={() => setShowAdvanced((s) => !s)}
          >
            ⚲ {showAdvanced ? "Fewer Filters" : "Advanced Filters"}
          </button>
          <button type="button" className={styles.cancelBtn} style={{ alignSelf: "flex-end" }} onClick={handleExportCsv}>
            ⬇ Export CSV
          </button>
        </div>

        {showAdvanced && (
          <div className={styles.filterRow}>
            <LabeledField label="Division">
              <select
                className={styles.select}
                value={divisionFilter}
                onChange={(e) => {
                  setOffset(0);
                  setDivisionFilter(e.target.value ? Number(e.target.value) : "");
                }}
              >
                <option value="">All Divisions</option>
                {divisions.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.division_name}
                  </option>
                ))}
              </select>
            </LabeledField>
          </div>
        )}
      </div>

      {error && <div className={styles.errorBanner}>{error}</div>}

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>User</th>
              <th>Designation</th>
              <th>Role</th>
              <th>Division</th>
              <th>Signing Authority</th>
              <th>Status</th>
              <th>Last Login</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={8} className={styles.emptyCell}>
                  Loading…
                </td>
              </tr>
            ) : pagedUsers.length === 0 ? (
              <tr>
                <td colSpan={8} className={styles.emptyCell}>
                  No users found.
                </td>
              </tr>
            ) : (
              pagedUsers.map((u) => (
                <tr key={u.id}>
                  <td>
                    <div className={styles.userCell}>
                      <div className={styles.avatar}>{u.full_name.charAt(0)}</div>
                      <div>
                        <div className={styles.strong}>{u.full_name}</div>
                        <div className={styles.sub}>
                          {u.employee_id} · {u.username}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td>{u.designation ?? "—"}</td>
                  <td>
                    <span className={styles.roleTag}>{roleLabel(u.role_name)}</span>
                  </td>
                  <td>{u.division_name ?? u.zone_name ?? "—"}</td>
                  <td>{u.card_signing_authority ? "Yes" : "—"}</td>
                  <td>
                    <span
                      className={
                        u.users_status === "active" ? styles.statusGood : styles.statusBad
                      }
                    >
                      {u.users_status.charAt(0).toUpperCase() + u.users_status.slice(1)}
                    </span>
                  </td>
                  <td>{u.last_login_at ? new Date(u.last_login_at).toLocaleString() : "Never"}</td>
                  <td>
                    {canEdit && (
                      <button className={styles.pageBtn} onClick={() => toggleStatus(u.id)}>
                        Toggle
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        <Pagination total={filteredUsers.length} limit={LIMIT} offset={offset} onOffsetChange={setOffset} />
      </div>

      {showStats && (
        <div className={styles.statGrid} style={{ marginTop: 20 }}>
          <div className={styles.statCard}>
            <div className={styles.statLabel}>Active Users</div>
            <div className={styles.statValue}>{activeCount}</div>
            <div style={{ fontSize: 11, color: "var(--color-text-muted)", marginTop: 6 }}>
              {inactiveCount} inactive of {users.length} total registered users.
            </div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statLabel}>Total Active in Last 7 Days</div>
            <div className={styles.statValue}>{String(activeLast7Days).padStart(2, "0")}</div>
            <div style={{ fontSize: 11, color: "var(--color-text-muted)", marginTop: 6 }}>
              Users who logged in within the past 7 days.
            </div>
          </div>
        </div>
      )}

      {isFormOpen && <AddUserModal onClose={() => setIsFormOpen(false)} onCreated={() => setIsFormOpen(false)} />}
    </div>
  );
}

function LabeledField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className={styles.field} style={{ flex: 1 }}>
      <span className={styles.fieldLabel}>{label}</span>
      {children}
    </div>
  );
}

function AddUserModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [employeeId, setEmployeeId] = useState("");
  const [hrmsId, setHrmsId] = useState("");
  const [username, setUsername] = useState("");
  const [usernameTouched, setUsernameTouched] = useState(false);
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [designation, setDesignation] = useState("");
  const [designationGrade, setDesignationGrade] = useState<DesignationGrade | "">("");
  const [cardSigningAuthority, setCardSigningAuthority] = useState(false);
  const [signatureFile, setSignatureFile] = useState<File | null>(null);
  const [email, setEmail] = useState("");
  const [mobile, setMobile] = useState("");
  const [roleId, setRoleId] = useState<number | "">("");
  const [divisionId, setDivisionId] = useState<number | "">("");
  const [zoneId, setZoneId] = useState<number | "">("");
  const [stationId, setStationId] = useState<number | "">("");
  const [error, setError] = useState<string | null>(null);

  const { data: roles = [] } = useGetRolesLiteQuery();
  const { data: divisions = [] } = useGetDivisionsQuery();
  const { data: stations = [] } = useGetStationsQuery();
  const { data: zones = [] } = useGetZonesQuery();
  const [createUser, { isLoading: isSubmitting }] = useCreateUserMutation();

  const selectedRole = roles.find((r) => r.id === roleId);
  const isSubAdminRole = !!selectedRole && SUB_ADMIN_ROLES.includes(selectedRole.role_name);
  const isSigningEligible =
    isSubAdminRole && !!designationGrade && SIGNING_ELIGIBLE_GRADES.includes(designationGrade as DesignationGrade);

  function handleEmployeeIdChange(value: string) {
    setEmployeeId(value);
    if (!usernameTouched) setUsername(value);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await createUser({
        employee_id: employeeId,
        username,
        password,
        full_name: fullName,
        hrms_id: hrmsId || undefined,
        designation: designation || undefined,
        designation_grade: designationGrade || undefined,
        card_signing_authority: isSigningEligible && cardSigningAuthority,
        email: email || undefined,
        mobile: mobile || undefined,
        role_id: Number(roleId),
        division_id: divisionId ? Number(divisionId) : undefined,
        zone_id: zoneId ? Number(zoneId) : undefined,
        station_id: stationId ? Number(stationId) : undefined,
        signature: signatureFile ?? undefined,
      }).unwrap();
      onCreated();
    } catch (err: any) {
      setError(err?.data?.message ?? err?.message ?? "Unable to create user");
    }
  }

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <form className={styles.modal} onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit}>
        <h2 className={styles.modalTitle}>Add New User</h2>

        <div className={styles.formGrid}>
          <Field label="Employee Number">
            <input value={employeeId} onChange={(e) => handleEmployeeIdChange(e.target.value)} required />
          </Field>
          <Field label="Username">
            <input
              value={username}
              onChange={(e) => {
                setUsernameTouched(true);
                setUsername(e.target.value);
              }}
              required
            />
          </Field>
          <Field label="HRMS ID">
            <input value={hrmsId} onChange={(e) => setHrmsId(e.target.value)} />
          </Field>
          <Field label="Temporary Password">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
          </Field>
          <Field label="Full Name">
            <input value={fullName} onChange={(e) => setFullName(e.target.value)} required />
          </Field>
          <Field label="Designation">
            <input value={designation} onChange={(e) => setDesignation(e.target.value)} />
          </Field>
          <Field label="Designation Grade">
            <select
              value={designationGrade}
              onChange={(e) => setDesignationGrade(e.target.value as DesignationGrade | "")}
            >
              <option value="">Select grade</option>
              {(Object.keys(DESIGNATION_GRADE_LABELS) as DesignationGrade[]).map((g) => (
                <option key={g} value={g}>
                  {DESIGNATION_GRADE_LABELS[g]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Email (optional)">
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Field label="Mobile Number">
            <input value={mobile} onChange={(e) => setMobile(e.target.value)} required />
          </Field>
          <Field label="Role">
            <select
              value={roleId}
              onChange={(e) => setRoleId(e.target.value ? Number(e.target.value) : "")}
              required
            >
              <option value="">Select role</option>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {roleLabel(r.role_name)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Zone (optional)">
            <select value={zoneId} onChange={(e) => setZoneId(e.target.value ? Number(e.target.value) : "")}>
              <option value="">None</option>
              {zones.map((z) => (
                <option key={z.id} value={z.id}>
                  {z.zone_name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Division (optional)">
            <select
              value={divisionId}
              onChange={(e) => setDivisionId(e.target.value ? Number(e.target.value) : "")}
            >
              <option value="">None</option>
              {divisions.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.division_name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Station (optional)">
            <select
              value={stationId}
              onChange={(e) => setStationId(e.target.value ? Number(e.target.value) : "")}
            >
              <option value="">None</option>
              {stations.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.station_name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Card Signing Authority">
            <select
              value={isSigningEligible && cardSigningAuthority ? "yes" : "no"}
              onChange={(e) => setCardSigningAuthority(e.target.value === "yes")}
              disabled={!isSigningEligible}
            >
              <option value="no">No</option>
              <option value="yes">Yes</option>
            </select>
            {!isSigningEligible && (
              <span style={{ fontSize: 11, color: "var(--color-text-muted)" }}>
                Only JS/SS-graded HQ or Divisional Sub Admins can be signing authorities.
              </span>
            )}
          </Field>
          <Field label="Signature Upload" wide>
            <input
              type="file"
              accept=".jpg,.jpeg,.png"
              onChange={(e) => setSignatureFile(e.target.files?.[0] ?? null)}
            />
          </Field>
        </div>

        {error && <div className={styles.errorBanner}>{error}</div>}

        <div className={styles.modalActions}>
          <button type="button" className={styles.cancelBtn} onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className={styles.addBtn} disabled={isSubmitting}>
            {isSubmitting ? "Creating…" : "Create User"}
          </button>
        </div>
      </form>
    </div>
  );
}
