import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  useGetRolesQuery,
  useCreateRoleMutation,
  useEditRoleMutation,
  useDeleteRoleMutation,
  useUpdateRolePermissionsMutation,
} from "../api/roleApi";
import { useGetRolePermissionsQuery } from "../api/authApi";
import { MODULE_LABELS, MODULE_NAMES, type ModuleName, type Role, type RolePermission } from "../types";
import { roleLabel } from "../types/labels";
import Field from "../components/ui/Field";
import StatCard from "../components/ui/StatCard";
import Pagination from "../components/ui/Pagination";
import styles from "../styles/listPage.module.css";

const LIMIT = 10;

function categoryOf(roleName: string): "admin" | "field" {
  return roleName === "inspector" ? "field" : "admin";
}

type PermKey = "can_view" | "can_create" | "can_edit" | "can_delete" | "can_approve_reject" | "can_export";
const PERM_COLUMNS: Array<{ key: PermKey; label: string }> = [
  { key: "can_view", label: "View" },
  { key: "can_create", label: "Add / Create" },
  { key: "can_edit", label: "Edit / Update" },
  { key: "can_delete", label: "Delete" },
  { key: "can_approve_reject", label: "Approve / Reject" },
  { key: "can_export", label: "Export Data" },
];

export default function RoleManagementPage() {
  const [selectedRoleId, setSelectedRoleId] = useState<number | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<"all" | "admin" | "field">("all");
  const [offset, setOffset] = useState(0);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editRoleTarget, setEditRoleTarget] = useState<Role | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const { data: roles = [], isFetching: isLoading, error: loadError } = useGetRolesQuery();
  const [deleteRole] = useDeleteRoleMutation();
  const error = deleteError ?? (loadError ? "Unable to load roles" : null);

  useEffect(() => {
    if (!selectedRoleId && roles.length > 0) setSelectedRoleId(roles[0].id);
  }, [roles, selectedRoleId]);

  const totalUsers = roles.reduce((sum, r) => sum + (r.user_count ?? 0), 0);

  const filteredRoles = useMemo(
    () => (categoryFilter === "all" ? roles : roles.filter((r) => categoryOf(r.role_name) === categoryFilter)),
    [roles, categoryFilter]
  );
  const pagedRoles = useMemo(() => filteredRoles.slice(offset, offset + LIMIT), [filteredRoles, offset]);

  async function handleDelete(role: Role) {
    if (!window.confirm(`Delete role "${roleLabel(role.role_name)}"? This cannot be undone.`)) return;
    setDeleteError(null);
    try {
      await deleteRole(role.id).unwrap();
      if (selectedRoleId === role.id) setSelectedRoleId(null);
    } catch (err: any) {
      setDeleteError(err?.data?.message ?? err?.message ?? "Unable to delete role");
    }
  }

  return (
    <div>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Role Management</h1>
          <p className={styles.subtitle}>
            Define and manage system access levels and permissions for SERVMS personnel.
          </p>
        </div>
        <button className={styles.addBtn} onClick={() => setIsFormOpen(true)}>
          + Add New Role
        </button>
      </div>

      <div className={styles.statGrid}>
        <StatCard label="Total Roles" value={roles.length} />
        <StatCard label="Active Users" value={totalUsers} />
        <StatCard label="System Modules" value={MODULE_NAMES.length} />
      </div>

      <div className={styles.tabs} style={{ marginBottom: 12 }}>
        {(["all", "admin", "field"] as const).map((cat) => (
          <button
            key={cat}
            type="button"
            className={categoryFilter === cat ? styles.tabActive : styles.tab}
            onClick={() => {
              setOffset(0);
              setCategoryFilter(cat);
            }}
          >
            {cat === "all" ? "ALL" : cat === "admin" ? "ADMIN" : "FIELD"}
          </button>
        ))}
      </div>

      {error && <div className={styles.errorBanner}>{error}</div>}

      <div className={styles.tableWrap} style={{ marginBottom: 20 }}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Role Name</th>
              <th>Description</th>
              <th>User Count</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={5} className={styles.emptyCell}>
                  Loading…
                </td>
              </tr>
            ) : pagedRoles.length === 0 ? (
              <tr>
                <td colSpan={5} className={styles.emptyCell}>
                  No roles found.
                </td>
              </tr>
            ) : (
              pagedRoles.map((r) => (
                <tr
                  key={r.id}
                  onClick={() => setSelectedRoleId(r.id)}
                  style={{
                    cursor: "pointer",
                    background: r.id === selectedRoleId ? "var(--color-info-bg)" : undefined,
                  }}
                >
                  <td className={styles.strong}>{roleLabel(r.role_name)}</td>
                  <td>{r.description ?? "—"}</td>
                  <td>{r.user_count ?? 0} Users</td>
                  <td>
                    <span className={r.roles_status === "active" ? styles.statusGood : styles.statusBad}>
                      {r.roles_status}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: 8 }} onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        className={styles.pageBtn}
                        title="Edit role"
                        onClick={() => setEditRoleTarget(r)}
                      >
                        <EditIcon />
                      </button>
                      <button
                        type="button"
                        className={styles.pageBtn}
                        title="Delete role"
                        onClick={() => handleDelete(r)}
                      >
                        <TrashIcon />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        <Pagination total={filteredRoles.length} limit={LIMIT} offset={offset} onOffsetChange={setOffset} />
      </div>

      {selectedRoleId && (
        <PermissionMatrix
          roleId={selectedRoleId}
          roleName={roles.find((r) => r.id === selectedRoleId)?.role_name ?? ""}
        />
      )}

      {isFormOpen && <AddRoleModal onClose={() => setIsFormOpen(false)} onCreated={() => setIsFormOpen(false)} />}

      {editRoleTarget && (
        <EditRoleModal
          role={editRoleTarget}
          onClose={() => setEditRoleTarget(null)}
          onSaved={() => setEditRoleTarget(null)}
        />
      )}
    </div>
  );
}

function EditRoleModal({
  role,
  onClose,
  onSaved,
}: {
  role: Role;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [description, setDescription] = useState(role.description ?? "");
  const [rolesStatus, setRolesStatus] = useState(role.roles_status);
  const [error, setError] = useState<string | null>(null);
  const [editRole, { isLoading: isSubmitting }] = useEditRoleMutation();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await editRole({ id: role.id, data: { description: description || undefined, roles_status: rolesStatus } }).unwrap();
      onSaved();
    } catch (err: any) {
      setError(err?.data?.message ?? err?.message ?? "Unable to update role");
    }
  }

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <form className={styles.modal} onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit}>
        <h2 className={styles.modalTitle}>Edit Role — {roleLabel(role.role_name)}</h2>
        <div className={styles.formGrid}>
          <Field label="Description" wide>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} />
          </Field>
          <Field label="Status">
            <select value={rolesStatus} onChange={(e) => setRolesStatus(e.target.value as Role["roles_status"])}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </Field>
        </div>
        {error && <div className={styles.errorBanner}>{error}</div>}
        <div className={styles.modalActions}>
          <button type="button" className={styles.cancelBtn} onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className={styles.addBtn} disabled={isSubmitting}>
            {isSubmitting ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </form>
    </div>
  );
}

function EditIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
      <path
        d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17v3Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
      <path
        d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m-9 0 1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PermissionMatrix({ roleId, roleName }: { roleId: number; roleName: string }) {
  const { data: serverPermissions = [], isFetching: isLoading, refetch } = useGetRolePermissionsQuery(roleId);
  const [updateRolePermissions, { isLoading: isSaving }] = useUpdateRolePermissionsMutation();
  const [saved, setSaved] = useState(false);
  const [permissions, setPermissions] = useState<RolePermission[]>([]);

  useEffect(() => {
    setPermissions(serverPermissions);
    setSaved(false);
  }, [serverPermissions]);

  function loadPermissions() {
    setSaved(false);
    refetch();
  }

  function toggle(moduleName: ModuleName, key: PermKey) {
    setPermissions((prev) =>
      prev.map((p) => (p.module_name === moduleName ? { ...p, [key]: !p[key] } : p))
    );
  }

  const allChecked = permissions.length > 0 && permissions.every((p) => PERM_COLUMNS.every((c) => Boolean(p[c.key])));

  function toggleSelectAll() {
    const next = !allChecked;
    setPermissions((prev) =>
      prev.map((p) => ({
        ...p,
        can_view: next,
        can_create: next,
        can_edit: next,
        can_delete: next,
        can_approve_reject: next,
        can_export: next,
      }))
    );
  }

  async function handleSave() {
    await updateRolePermissions({
      roleId,
      permissions: permissions.map((p) => ({
        module_name: p.module_name,
        can_view: Boolean(p.can_view),
        can_create: Boolean(p.can_create),
        can_edit: Boolean(p.can_edit),
        can_delete: Boolean(p.can_delete),
        can_approve_reject: Boolean(p.can_approve_reject),
        can_export: Boolean(p.can_export),
      })),
    }).unwrap();
    setSaved(true);
  }

  return (
    <div className={styles.tableWrap}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 16px 0" }}>
        <h2 className={styles.title} style={{ fontSize: 16, margin: 0 }}>
          Permission Matrix — {roleLabel(roleName)}
        </h2>
        <div style={{ display: "flex", gap: 10 }}>
          <button type="button" className={styles.cancelBtn} onClick={loadPermissions} disabled={isLoading}>
            Reset to Default
          </button>
          <button className={styles.addBtn} onClick={handleSave} disabled={isSaving || isLoading}>
            {isSaving ? "Saving…" : saved ? "Saved ✓" : "Save Changes"}
          </button>
        </div>
      </div>
      <div style={{ padding: "10px 16px 0", display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
        <input type="checkbox" checked={allChecked} onChange={toggleSelectAll} disabled={isLoading} />
        <span>Select All</span>
      </div>
      <table className={styles.table} style={{ marginTop: 12 }}>
        <thead>
          <tr>
            <th>Module Name</th>
            {PERM_COLUMNS.map((c) => (
              <th key={c.key}>{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {isLoading ? (
            <tr>
              <td colSpan={7} className={styles.emptyCell}>
                Loading…
              </td>
            </tr>
          ) : (
            permissions.map((perm) => (
              <tr key={perm.module_name}>
                <td className={styles.strong}>{MODULE_LABELS[perm.module_name]}</td>
                {PERM_COLUMNS.map((c) => (
                  <td key={c.key}>
                    <input
                      type="checkbox"
                      checked={Boolean(perm[c.key])}
                      onChange={() => toggle(perm.module_name, c.key)}
                    />
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function AddRoleModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [roleName, setRoleName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [createRole, { isLoading: isSubmitting }] = useCreateRoleMutation();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await createRole({ role_name: roleName, description: description || undefined }).unwrap();
      onCreated();
    } catch (err: any) {
      setError(err?.data?.message ?? err?.message ?? "Unable to create role");
    }
  }

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <form className={styles.modal} onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit}>
        <h2 className={styles.modalTitle}>Add New Role</h2>
        <div className={styles.formGrid}>
          <Field label="Role Name" wide>
            <input value={roleName} onChange={(e) => setRoleName(e.target.value)} required />
          </Field>
          <Field label="Description" wide>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} />
          </Field>
        </div>
        {error && <div className={styles.errorBanner}>{error}</div>}
        <div className={styles.modalActions}>
          <button type="button" className={styles.cancelBtn} onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className={styles.addBtn} disabled={isSubmitting}>
            {isSubmitting ? "Creating…" : "Create Role"}
          </button>
        </div>
      </form>
    </div>
  );
}
