import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { api, ApiError } from "../api/client";
import { useAuth } from "../context/AuthContext";
import {
  DIVISION_LABELS,
  ROLE_LABELS,
  type Division,
  type ManagedUser,
  type Role,
} from "../types";
import styles from "./UserManagementPage.module.css";

const DIVISIONS: Division[] = ["ADRA", "RANCHI", "CHAKRADHARPUR", "KHARAGPUR"];
const ROLES: Role[] = ["SUPER_ADMIN", "ADMIN", "DIVISION_ADDITIONAL_ADMIN"];

export default function UserManagementPage() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<Role | "ALL">("ALL");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  function loadUsers() {
    setIsLoading(true);
    api
      .get<ManagedUser[]>("/users")
      .then(setUsers)
      .catch(() => setError("Unable to load users"))
      .finally(() => setIsLoading(false));
  }

  useEffect(loadUsers, []);

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const matchesSearch =
        !search ||
        u.fullName.toLowerCase().includes(search.toLowerCase()) ||
        u.employeeId.toLowerCase().includes(search.toLowerCase());
      const matchesRole = roleFilter === "ALL" || u.role === roleFilter;
      return matchesSearch && matchesRole;
    });
  }, [users, search, roleFilter]);

  const canManage =
    currentUser?.role === "SUPER_ADMIN" || currentUser?.role === "ADMIN";

  return (
    <div>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>User Management</h1>
          <p className={styles.subtitle}>
            Manage SERVMS personnel across Super Admin, Admin, and Division
            Additional Admin roles.
          </p>
        </div>
        {canManage && (
          <button className={styles.addBtn} onClick={() => setIsFormOpen(true)}>
            + Add New User
          </button>
        )}
      </div>

      <div className={styles.filterRow}>
        <input
          className={styles.searchInput}
          placeholder="Search by name or Employee ID…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className={styles.select}
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value as Role | "ALL")}
        >
          <option value="ALL">All Roles</option>
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABELS[r]}
            </option>
          ))}
        </select>
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
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={6} className={styles.emptyCell}>
                  Loading…
                </td>
              </tr>
            ) : filteredUsers.length === 0 ? (
              <tr>
                <td colSpan={6} className={styles.emptyCell}>
                  No users found.
                </td>
              </tr>
            ) : (
              filteredUsers.map((u) => (
                <tr key={u.id}>
                  <td>
                    <div className={styles.userCell}>
                      <div className={styles.avatar}>{u.fullName.charAt(0)}</div>
                      <div>
                        <div className={styles.userName}>{u.fullName}</div>
                        <div className={styles.userSub}>{u.employeeId}</div>
                      </div>
                    </div>
                  </td>
                  <td>{u.designation ?? "—"}</td>
                  <td>
                    <span className={styles.roleTag}>{ROLE_LABELS[u.role]}</span>
                  </td>
                  <td>{u.division ? DIVISION_LABELS[u.division] : "—"}</td>
                  <td>
                    <span
                      className={
                        u.status === "ACTIVE" ? styles.statusActive : styles.statusInactive
                      }
                    >
                      {u.status === "ACTIVE" ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td>{u.lastLogin ? new Date(u.lastLogin).toLocaleString() : "Never"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {isFormOpen && (
        <AddUserModal
          onClose={() => setIsFormOpen(false)}
          onCreated={() => {
            setIsFormOpen(false);
            loadUsers();
          }}
        />
      )}
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
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [designation, setDesignation] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("ADMIN");
  const [division, setDivision] = useState<Division>("ADRA");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await api.post("/users", {
        employeeId,
        password,
        fullName,
        designation: designation || undefined,
        email: email || undefined,
        role,
        division: role === "DIVISION_ADDITIONAL_ADMIN" ? division : undefined,
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
      <form
        className={styles.modal}
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
      >
        <h2 className={styles.modalTitle}>Add New User</h2>

        <div className={styles.formGrid}>
          <Field label="Employee ID">
            <input
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              required
            />
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
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>
          <Field label="Role">
            <select value={role} onChange={(e) => setRole(e.target.value as Role)}>
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                </option>
              ))}
            </select>
          </Field>
          {role === "DIVISION_ADDITIONAL_ADMIN" && (
            <Field label="Division">
              <select
                value={division}
                onChange={(e) => setDivision(e.target.value as Division)}
              >
                {DIVISIONS.map((d) => (
                  <option key={d} value={d}>
                    {DIVISION_LABELS[d]}
                  </option>
                ))}
              </select>
            </Field>
          )}
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

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className={styles.field}>
      <span className={styles.fieldLabel}>{label}</span>
      {children}
    </label>
  );
}
