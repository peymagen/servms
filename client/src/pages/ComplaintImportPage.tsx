import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  useImportRailMadadMutation,
  useGetImportHistoryQuery,
  useDeleteImportHistoryMutation,
  type ImportSummary,
} from "../api/complaintApi";
import { useAuth } from "../context/AuthContext";
import styles from "../styles/listPage.module.css";

function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

// Matches the server's requireAnyRole(["hq_admin","divisional_admin"]) gate on
// DELETE /complaints/import/history/:id — super_admin_hq passes via its own
// break-glass bypass, not by being listed here.
const CAN_DELETE_IMPORT_HISTORY_ROLES = ["hq_admin", "divisional_admin", "super_admin_hq"];

export default function ComplaintImportPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importRailMadad, { isLoading }] = useImportRailMadadMutation();
  const { data: history = [] } = useGetImportHistoryQuery();
  const [deleteImportHistory] = useDeleteImportHistoryMutation();
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canDeleteHistory = CAN_DELETE_IMPORT_HISTORY_ROLES.includes(user?.role_name ?? "");

  async function handleFileSelected(file: File | undefined) {
    if (!file) return;
    setError(null);
    setSummary(null);
    try {
      const result = await importRailMadad(file).unwrap();
      setSummary(result);
    } catch (err: any) {
      setError(err?.data?.message ?? err?.message ?? "Import failed");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleDeleteHistory(id: number, fileName: string) {
    if (!window.confirm(`Delete the import history record for "${fileName}"? This only removes the log entry — complaints already imported from it are not affected.`)) {
      return;
    }
    setError(null);
    try {
      await deleteImportHistory(id).unwrap();
    } catch (err: any) {
      setError(err?.data?.message ?? err?.message ?? "Unable to delete import history record");
    }
  }

  return (
    <div>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>RailMadad Excel Import</h1>
          <p className={styles.subtitle}>Bulk-register RailMadad complaints from an exported Excel sheet.</p>
        </div>
        <button className={styles.cancelBtn} onClick={() => navigate("/complaints")}>
          ← Back to Complaints
        </button>
      </div>

      {error && <div className={styles.errorBanner}>{error}</div>}

      <div style={{ background: "var(--color-surface)", borderRadius: "var(--radius-lg)", boxShadow: "var(--shadow-card)", padding: "24px", marginBottom: 20 }}>
        <label
          style={{
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6,
            border: "1.5px dashed var(--color-border)", borderRadius: "var(--radius-lg)", padding: "36px 20px",
            textAlign: "center", cursor: isLoading ? "not-allowed" : "pointer", color: "var(--color-text-muted)",
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            hidden
            disabled={isLoading}
            onChange={(e) => handleFileSelected(e.target.files?.[0])}
          />
          <div style={{ fontSize: 14, fontWeight: 700, color: "var(--color-text)" }}>
            {isLoading ? "Importing…" : "Click to upload RailMadad Excel export"}
          </div>
          <div style={{ fontSize: 12 }}>.xlsx or .xls — duplicate reference numbers are skipped automatically</div>
        </label>

        {summary && (
          <div style={{ marginTop: 20 }}>
            <div className={styles.statGrid}>
              <StatBlock label="Total Records" value={summary.totalRecords} />
              <StatBlock label="Imported" value={summary.importedCount} />
              <StatBlock label="Duplicates" value={summary.duplicateCount} />
              <StatBlock label="Failed" value={summary.failedCount} />
            </div>
            {summary.failed.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <h3 style={{ fontSize: 13 }}>Error Report</h3>
                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead>
                      <tr><th>Row</th><th>Reason</th></tr>
                    </thead>
                    <tbody>
                      {summary.failed.map((f, i) => (
                        <tr key={i}><td>{f.row}</td><td>{f.reason}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <h2 style={{ fontSize: 15, marginBottom: 10 }}>Import History</h2>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>File Name</th>
              <th>Imported By</th>
              <th>Date</th>
              <th>Total</th>
              <th>Imported</th>
              <th>Duplicates</th>
              <th>Failed</th>
              {canDeleteHistory && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {history.length === 0 ? (
              <tr><td colSpan={canDeleteHistory ? 8 : 7} className={styles.emptyCell}>No imports yet.</td></tr>
            ) : (
              history.map((h) => (
                <tr key={h.id}>
                  <td>{h.file_name}</td>
                  <td>{h.imported_by_name ?? "—"}</td>
                  <td>{formatDateTime(h.created_at)}</td>
                  <td>{h.total_records}</td>
                  <td>{h.imported_count}</td>
                  <td>{h.duplicate_count}</td>
                  <td>{h.failed_count}</td>
                  {canDeleteHistory && (
                    <td>
                      <button
                        type="button"
                        className={styles.cancelBtn}
                        title="Delete import history record"
                        onClick={() => handleDeleteHistory(h.id, h.file_name)}
                      >
                        Delete
                      </button>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatBlock({ label, value }: { label: string; value: number }) {
  return (
    <div className={styles.statCard}>
      <div className={styles.statLabel}>{label}</div>
      <div className={styles.statValue}>{value}</div>
    </div>
  );
}
