import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { api, ApiError } from "../api/client";
import { getDivisions, getStations, getRolesLite } from "../api/masters";
import { roleLabel } from "../types/labels";
import type { Division, ManagedUser, Station, Role } from "../types";
import Field from "../components/ui/Field";
import Pagination from "../components/ui/Pagination";
import styles from "../styles/listPage.module.css";

const LIMIT = 10;

export default function UserManagementPage() {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<number | "">("");
  const [statusFilter, setStatusFilter] = useState<"" | "active" | "inactive">("");
  const [divisionFilter, setDivisionFilter] = useState<number | "">("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [offset, setOffset] = useState(0);
  const [roles, setRoles] = useState<Role[]>([]);
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  function load() {
    setIsLoading(true);
    api
      .get<ManagedUser[]>("/users")
      .then(setUsers)
      .catch(() => setError("Unable to load users"))
      .finally(() => setIsLoading(false));
  }

  useEffect(load, []);
  useEffect(() => {
    getRolesLite().then(setRoles).catch(() => {});
    getDivisions().then(setDivisions).catch(() => {});
  }, []);

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
  const activePct = users.length > 0 ? Math.round((activeCount / users.length) * 100) : 0;

  async function toggleStatus(id: number) {
    try {
      await api.patch(`/users/${id}/toggle`);
      load();
    } catch {
      setError("Unable to toggle status");
    }
  }

  function handleExportCsv() {
    const headers = ["Employee ID", "Full Name", "Username", "Designation", "Role", "Division", "Status", "Last Login"];
    const rows = filteredUsers.map((u) => [
      u.employee_id,
      u.full_name,
      u.username,
      u.designation ?? "",
      roleLabel(u.role_name),
      u.division_name ?? "",
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
            Manage SERVMS personnel across HQ Admin, Divisional Admin, and Inspector roles.
          </p>
        </div>
        <button className={styles.addBtn} onClick={() => setIsFormOpen(true)}>
          + Add New User
        </button>
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
              <th>Status</th>
              <th>Last Login</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={7} className={styles.emptyCell}>
                  Loading…
                </td>
              </tr>
            ) : pagedUsers.length === 0 ? (
              <tr>
                <td colSpan={7} className={styles.emptyCell}>
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
                  <td>{u.division_name ?? "—"}</td>
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
                    <button className={styles.pageBtn} onClick={() => toggleStatus(u.id)}>
                      Toggle
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        <Pagination total={filteredUsers.length} limit={LIMIT} offset={offset} onOffsetChange={setOffset} />
      </div>

      <div className={styles.statGrid} style={{ marginTop: 20 }}>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>User Analytics</div>
          <div className={styles.statValue}>{activeCount}</div>
          <div style={{ height: 6, background: "var(--color-bg)", borderRadius: 999, marginTop: 8, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${activePct}%`, background: "var(--color-primary)" }} />
          </div>
          <div style={{ fontSize: 11, color: "var(--color-text-muted)", marginTop: 6 }}>
            {activePct}% of total registered users are currently active.
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Pending Requests</div>
          <div className={styles.statValue}>{String(inactiveCount).padStart(2, "0")}</div>
          <div style={{ fontSize: 11, color: "var(--color-text-muted)", margin: "6px 0" }}>
            Users deactivated / awaiting reactivation approval.
          </div>
          <button
            type="button"
            className={styles.pageBtn}
            onClick={() => {
              setOffset(0);
              setStatusFilter("inactive");
            }}
          >
            Review Requests
          </button>
        </div>
      </div>

      {isFormOpen && (
        <AddUserModal
          onClose={() => setIsFormOpen(false)}
          onCreated={() => {
            setIsFormOpen(false);
            load();
          }}
        />
      )}
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
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [designation, setDesignation] = useState("");
  const [email, setEmail] = useState("");
  const [mobile, setMobile] = useState("");
  const [roleId, setRoleId] = useState<number | "">("");
  const [divisionId, setDivisionId] = useState<number | "">("");
  const [stationId, setStationId] = useState<number | "">("");
  const [roles, setRoles] = useState<Role[]>([]);
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [stations, setStations] = useState<Station[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    getRolesLite().then(setRoles).catch(() => {});
    getDivisions().then(setDivisions).catch(() => {});
    getStations().then(setStations).catch(() => {});
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await api.post("/users", {
        employee_id: employeeId,
        username,
        password,
        full_name: fullName,
        designation: designation || undefined,
        email: email || undefined,
        mobile: mobile || undefined,
        role_id: roleId,
        division_id: divisionId || null,
        station_id: stationId || null,
      });
      onCreated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to create user");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <form className={styles.modal} onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit}>
        <h2 className={styles.modalTitle}>Add New User</h2>

        <div className={styles.formGrid}>
          <Field label="Employee ID">
            <input value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} required />
          </Field>
          <Field label="Username">
            <input value={username} onChange={(e) => setUsername(e.target.value)} required />
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
          <Field label="Email (optional)">
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Field label="Mobile (optional)">
            <input value={mobile} onChange={(e) => setMobile(e.target.value)} />
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
