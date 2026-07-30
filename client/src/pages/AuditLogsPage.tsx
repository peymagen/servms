import { Fragment, useState } from "react";
import { useGetAuditLogsQuery, useGetAuditModulesQuery } from "../api/auditApi";
import { MODULE_LABELS, type ModuleName } from "../types";
import { roleLabel } from "../types/labels";
import Pagination from "../components/ui/Pagination";
import styles from "../styles/listPage.module.css";

const API_BASE = import.meta.env.VITE_API_BASE ?? "https://servms.peymagen.com/api";
const LIMIT = 20;

const ACTION_LABELS: Record<string, string> = {
  CREATE: "Create",
  UPDATE: "Update",
  DELETE: "Delete",
  APPROVE: "Approve",
  REJECT: "Reject",
  REVOKE: "Revoke",
  RECOVER: "Recover",
  TRANSFER: "Transfer",
  ISSUE: "Issue",
  RENEW: "Renew",
  DOWNLOAD: "Download",
  PRINT: "Print",
  EXPORT: "Export",
  LOGIN: "Login",
  LOGOUT: "Logout",
  PASSWORD_RESET: "Password Reset",
  STATUS_CHANGE: "Status Change",
};

async function downloadExport(format: "csv" | "pdf", filters: Record<string, string | undefined>) {
  const token = localStorage.getItem("servms_token");
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value) params.set(key, value);
  });
  const res = await fetch(`${API_BASE}/audit-logs/export/${format}?${params.toString()}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error("Export failed");
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `audit-logs.${format}`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function AuditLogsPage() {
  const [moduleFilter, setModuleFilter] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [recordIdFilter, setRecordIdFilter] = useState("");
  const [userIdFilter, setUserIdFilter] = useState("");
  const [fromFilter, setFromFilter] = useState("");
  const [toFilter, setToFilter] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [offset, setOffset] = useState(0);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const filters = {
    module: moduleFilter || undefined,
    action: actionFilter || undefined,
    record_id: recordIdFilter || undefined,
    user_id: userIdFilter || undefined,
    from: fromFilter || undefined,
    to: toFilter || undefined,
  };

  const { data: modules = [] } = useGetAuditModulesQuery();
  const { data: listData, isFetching: isLoading, error: loadError } = useGetAuditLogsQuery({
    ...filters,
    limit: LIMIT,
    offset,
  });
  const logs = listData?.rows ?? [];
  const total = listData?.total ?? 0;

  const actions = Object.keys(ACTION_LABELS);

  async function handleExport(format: "csv" | "pdf") {
    setIsExporting(true);
    setExportError(null);
    try {
      await downloadExport(format, filters);
    } catch {
      setExportError(`Unable to export audit logs as ${format.toUpperCase()}`);
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <div>
      <div style={{ fontSize: 12, color: "var(--color-text-muted)", marginBottom: 10 }}>
        Admin Console <strong style={{ color: "var(--color-text)" }}>&gt; Audit Logs</strong>
      </div>

      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Audit Logs</h1>
          <p className={styles.subtitle}>
            Complete trail of create/update/delete/approve/reject/transfer/issue/renew actions across SERVMS.
          </p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button type="button" className={styles.cancelBtn} onClick={() => setShowAdvanced((s) => !s)}>
            ⚏ {showAdvanced ? "Fewer Filters" : "Advanced Filters"}
          </button>
          <button className={styles.cancelBtn} onClick={() => handleExport("csv")} disabled={isExporting}>
            ⬇ Export Excel
          </button>
          <button className={styles.cancelBtn} onClick={() => handleExport("pdf")} disabled={isExporting}>
            ⬇ Export PDF
          </button>
        </div>
      </div>

      <div
        style={{
          background: "var(--color-surface)",
          borderRadius: "var(--radius-lg)",
          boxShadow: "var(--shadow-card)",
          padding: "18px 20px",
          marginBottom: 16,
        }}
      >
        <div className={styles.filterRow}>
          <div className={styles.field} style={{ flex: 1 }}>
            <span className={styles.fieldLabel}>Module</span>
            <select
              className={styles.select}
              value={moduleFilter}
              onChange={(e) => {
                setOffset(0);
                setModuleFilter(e.target.value);
              }}
            >
              <option value="">All Modules</option>
              {modules.map((m) => (
                <option key={m} value={m}>
                  {MODULE_LABELS[m as ModuleName] ?? m}
                </option>
              ))}
            </select>
          </div>
          <div className={styles.field} style={{ flex: 1 }}>
            <span className={styles.fieldLabel}>Action</span>
            <select
              className={styles.select}
              value={actionFilter}
              onChange={(e) => {
                setOffset(0);
                setActionFilter(e.target.value);
              }}
            >
              <option value="">All Actions</option>
              {actions.map((a) => (
                <option key={a} value={a}>
                  {ACTION_LABELS[a]}
                </option>
              ))}
            </select>
          </div>
        </div>

        {showAdvanced && (
          <div className={styles.filterRow}>
            <div className={styles.field} style={{ flex: 1 }}>
              <span className={styles.fieldLabel}>User ID</span>
              <input
                value={userIdFilter}
                onChange={(e) => {
                  setOffset(0);
                  setUserIdFilter(e.target.value);
                }}
                placeholder="Filter by user ID"
              />
            </div>
            <div className={styles.field} style={{ flex: 1 }}>
              <span className={styles.fieldLabel}>Record ID</span>
              <input
                value={recordIdFilter}
                onChange={(e) => {
                  setOffset(0);
                  setRecordIdFilter(e.target.value);
                }}
                placeholder="Filter by record ID"
              />
            </div>
            <div className={styles.field} style={{ flex: 1 }}>
              <span className={styles.fieldLabel}>From</span>
              <input
                type="date"
                value={fromFilter}
                onChange={(e) => {
                  setOffset(0);
                  setFromFilter(e.target.value);
                }}
              />
            </div>
            <div className={styles.field} style={{ flex: 1 }}>
              <span className={styles.fieldLabel}>To</span>
              <input
                type="date"
                value={toFilter}
                onChange={(e) => {
                  setOffset(0);
                  setToFilter(e.target.value);
                }}
              />
            </div>
          </div>
        )}
      </div>

      {(loadError || exportError) && (
        <div className={styles.errorBanner}>{exportError ?? "Unable to load audit logs"}</div>
      )}

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Module</th>
              <th>Action</th>
              <th>Record</th>
              <th>Performed By</th>
              <th>Role</th>
              <th>IP Address</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={8} className={styles.emptyCell}>
                  Loading…
                </td>
              </tr>
            ) : logs.length === 0 ? (
              <tr>
                <td colSpan={8} className={styles.emptyCell}>
                  No audit log entries found.
                </td>
              </tr>
            ) : (
              logs.map((log) => (
                <Fragment key={log.id}>
                  <tr key={log.id}>
                    <td>{new Date(log.created_at).toLocaleString()}</td>
                    <td>{MODULE_LABELS[log.module_name as ModuleName] ?? log.module_name ?? "—"}</td>
                    <td>
                      <span className={styles.roleTag}>{ACTION_LABELS[log.action] ?? log.action}</span>
                    </td>
                    <td>{log.record_id ?? "—"}</td>
                    <td>{log.user_full_name ?? log.user_username ?? "System"}</td>
                    <td>{log.role_name ? roleLabel(log.role_name) : "—"}</td>
                    <td>{log.ip_address ?? "—"}</td>
                    <td>
                      {(log.old_data || log.new_data) && (
                        <button
                          type="button"
                          className={styles.pageBtn}
                          onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                        >
                          {expandedId === log.id ? "Hide" : "Details"}
                        </button>
                      )}
                    </td>
                  </tr>
                  {expandedId === log.id && (
                    <tr>
                      <td colSpan={8} style={{ background: "var(--color-bg)" }}>
                        <div style={{ display: "flex", gap: 24, padding: "8px 4px", fontSize: 12 }}>
                          {log.old_data && (
                            <div style={{ flex: 1 }}>
                              <strong>Old Data</strong>
                              <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
                                {formatJson(log.old_data)}
                              </pre>
                            </div>
                          )}
                          {log.new_data && (
                            <div style={{ flex: 1 }}>
                              <strong>New Data</strong>
                              <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
                                {formatJson(log.new_data)}
                              </pre>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))
            )}
          </tbody>
        </table>
        <Pagination total={total} limit={LIMIT} offset={offset} onOffsetChange={setOffset} />
      </div>
    </div>
  );
}

function formatJson(raw: string): string {
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
}
