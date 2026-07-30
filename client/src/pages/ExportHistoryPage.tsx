import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useGetExportHistoryQuery } from "../api/reportApi";
import Pagination from "../components/ui/Pagination";
import styles from "../styles/listPage.module.css";

const LIMIT = 20;

function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function ExportHistoryPage() {
  const navigate = useNavigate();
  const [offset, setOffset] = useState(0);
  const { data, isFetching } = useGetExportHistoryQuery({ limit: LIMIT, offset });
  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;

  return (
    <div>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Export History</h1>
          <p className={styles.subtitle}>Every report export generated across the system.</p>
        </div>
        <button className={styles.cancelBtn} onClick={() => navigate("/reports")}>
          ← Back to Reports
        </button>
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Module</th>
              <th>Report</th>
              <th>Format</th>
              <th>Rows</th>
              <th>Exported By</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            {isFetching ? (
              <tr><td colSpan={6} className={styles.emptyCell}>Loading…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={6} className={styles.emptyCell}>No exports yet.</td></tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id}>
                  <td className={styles.strong}>{r.module_key}</td>
                  <td>{r.template_name ?? "Ad-hoc"}</td>
                  <td>{r.export_format.toUpperCase()}</td>
                  <td>{r.row_count}</td>
                  <td>{r.exported_by_name ?? "—"}</td>
                  <td>{formatDateTime(r.created_at)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        <Pagination total={total} limit={LIMIT} offset={offset} onOffsetChange={setOffset} />
      </div>
    </div>
  );
}
