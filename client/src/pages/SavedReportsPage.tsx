import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  useGetReportTemplatesQuery,
  useDeleteReportTemplateMutation,
  useEditReportTemplateMutation,
  exportGeneratedReport,
} from "../api/reportApi";
import { useAuth } from "../context/AuthContext";
import styles from "../styles/listPage.module.css";

function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function SavedReportsPage() {
  const navigate = useNavigate();
  const { user, can } = useAuth();
  const { data: templates = [], isFetching } = useGetReportTemplatesQuery();
  const [deleteTemplate] = useDeleteReportTemplateMutation();
  const [editTemplate] = useEditReportTemplateMutation();
  const [error, setError] = useState<string | null>(null);
  const [exportingId, setExportingId] = useState<number | null>(null);

  const canDelete = can("reports", "delete");
  const canEdit = can("reports", "edit");

  async function handleDelete(id: number) {
    if (!window.confirm("Delete this saved report?")) return;
    try {
      await deleteTemplate(id).unwrap();
    } catch (err: any) {
      setError(err?.data?.message ?? err?.message ?? "Unable to delete report");
    }
  }

  async function handleToggleShare(id: number, current: number) {
    try {
      await editTemplate({ id, data: { is_shared: current !== 1 } }).unwrap();
    } catch (err: any) {
      setError(err?.data?.message ?? err?.message ?? "Unable to update sharing");
    }
  }

  async function handleQuickExport(id: number, moduleKey: string, fieldsJson: string, format: "xlsx" | "csv") {
    setError(null);
    setExportingId(id);
    try {
      const fields = JSON.parse(fieldsJson || "[]");
      await exportGeneratedReport({ module_key: moduleKey, fields, format, report_template_id: id });
    } catch (err: any) {
      setError(err?.message ?? "Unable to export report");
    } finally {
      setExportingId(null);
    }
  }

  return (
    <div>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Saved Reports</h1>
          <p className={styles.subtitle}>Your saved report templates and those shared by other users.</p>
        </div>
        <button className={styles.addBtn} onClick={() => navigate("/reports/builder")}>
          + New Report
        </button>
      </div>

      {error && <div className={styles.errorBanner}>{error}</div>}

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Name</th>
              <th>Module</th>
              <th>Created By</th>
              <th>Shared</th>
              <th>Usage</th>
              <th>Last Used</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {isFetching ? (
              <tr><td colSpan={7} className={styles.emptyCell}>Loading…</td></tr>
            ) : templates.length === 0 ? (
              <tr><td colSpan={7} className={styles.emptyCell}>No saved reports yet.</td></tr>
            ) : (
              templates.map((t) => (
                <tr key={t.id}>
                  <td className={styles.strong}>{t.name}</td>
                  <td>{t.module_key}</td>
                  <td>{t.created_by_name ?? "—"}</td>
                  <td>{t.is_shared ? "Shared" : "Private"}</td>
                  <td>{t.usage_count}</td>
                  <td>{formatDateTime(t.last_used_at)}</td>
                  <td>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      <button className={styles.pageBtn} onClick={() => navigate(`/reports/builder?template=${t.id}`)}>
                        Open
                      </button>
                      <button
                        className={styles.pageBtn}
                        disabled={exportingId === t.id}
                        onClick={() => handleQuickExport(t.id, t.module_key, t.fields, "xlsx")}
                      >
                        ⬇ Excel
                      </button>
                      {(canEdit || t.created_by === user?.id) && (
                        <button className={styles.pageBtn} onClick={() => handleToggleShare(t.id, t.is_shared)}>
                          {t.is_shared ? "Unshare" : "Share"}
                        </button>
                      )}
                      {(canDelete || t.created_by === user?.id) && (
                        <button className={styles.pageBtn} onClick={() => handleDelete(t.id)}>
                          ✕
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
