import { useNavigate } from "react-router-dom";
import { useGetVendorMetricsQuery } from "../api/vendorApi";
import { useGetContractorMetricsQuery } from "../api/contractorApi";
import { useGetComplaintMetricsQuery } from "../api/complaintApi";
import { useGetPenaltyMetricsQuery } from "../api/penaltyApi";
import { useGetReportDashboardQuery } from "../api/reportApi";
import { useAuth } from "../context/AuthContext";
import StatCard from "../components/ui/StatCard";
import styles from "../styles/listPage.module.css";

const currency = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function ReportsPage() {
  const navigate = useNavigate();
  const { can } = useAuth();
  const { data: vendor } = useGetVendorMetricsQuery();
  const { data: contractor } = useGetContractorMetricsQuery();
  const { data: complaint } = useGetComplaintMetricsQuery();
  const { data: penalty } = useGetPenaltyMetricsQuery();
  const { data: reportDashboard } = useGetReportDashboardQuery();

  function exportSummary() {
    const summary = { vendor, contractor, complaint, penalty, generatedAt: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(summary, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "servms-report-summary.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Reports</h1>
          <p className={styles.subtitle}>Custom report builder, saved reports, exports, and master data import — all in one place.</p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className={styles.cancelBtn} onClick={exportSummary}>
            Export Summary
          </button>
          {can("reports", "create") && (
            <button className={styles.addBtn} onClick={() => navigate("/reports/builder")}>
              + New Report
            </button>
          )}
        </div>
      </div>

      <div className={styles.statGrid}>
        <StatCard label="Total Reports Generated" value={reportDashboard?.totalTemplates ?? "—"} />
        <StatCard label="Total Exports" value={reportDashboard?.totalExports ?? "—"} />
        <StatCard label="Modules Reported On" value={reportDashboard?.moduleWise.length ?? "—"} />
        <StatCard label="Most Used Report" value={reportDashboard?.mostUsed[0]?.name ?? "—"} />
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 20 }}>
        <button className={styles.cancelBtn} onClick={() => navigate("/reports/builder")}>
          🛠 Report Builder
        </button>
        <button className={styles.cancelBtn} onClick={() => navigate("/reports/saved")}>
          📁 Saved Reports
        </button>
        <button className={styles.cancelBtn} onClick={() => navigate("/reports/exports")}>
          🕘 Export History
        </button>
        {can("reports", "create") && (
          <button className={styles.cancelBtn} onClick={() => navigate("/reports/import")}>
            ⇪ Import Management
          </button>
        )}
      </div>

      {reportDashboard && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
          <div style={{ background: "var(--color-surface)", borderRadius: "var(--radius-lg)", boxShadow: "var(--shadow-card)", padding: "14px 18px" }}>
            <h3 style={{ fontSize: 13, margin: "0 0 10px" }}>Recent Exports</h3>
            {reportDashboard.recentExports.length === 0 ? (
              <span className={styles.hint}>No exports yet.</span>
            ) : (
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5 }}>
                {reportDashboard.recentExports.slice(0, 6).map((e) => (
                  <li key={e.id}>
                    {e.template_name ?? e.module_key} ({e.export_format.toUpperCase()}) — {e.row_count} rows by {e.exported_by_name ?? "—"} —{" "}
                    {formatDateTime(e.created_at)}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div style={{ background: "var(--color-surface)", borderRadius: "var(--radius-lg)", boxShadow: "var(--shadow-card)", padding: "14px 18px" }}>
            <h3 style={{ fontSize: 13, margin: "0 0 10px" }}>Most Used Reports</h3>
            {reportDashboard.mostUsed.length === 0 ? (
              <span className={styles.hint}>No usage yet.</span>
            ) : (
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5 }}>
                {reportDashboard.mostUsed.map((r) => (
                  <li key={r.id}>
                    {r.name} ({r.module_key}) — used {r.usage_count} time(s)
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      <h2 style={{ fontSize: 14, margin: "0 0 10px" }}>Vendor Management</h2>
      <div className={styles.statGrid}>
        <StatCard label="Total Active Vendors" value={vendor?.totalActiveVendors ?? "—"} />
        <StatCard label="Police Verified" value={vendor?.policeVerified ?? "—"} />
        <StatCard label="Expired Medicals" value={vendor?.expiredMedicals ?? "—"} />
        <StatCard label="Expiring Soon" value={vendor?.expiringSoon ?? "—"} />
      </div>

      <h2 style={{ fontSize: 14, margin: "0 0 10px" }}>Contractor Database</h2>
      <div className={styles.statGrid}>
        <StatCard label="Total Active" value={contractor?.totalActive ?? "—"} />
        <StatCard label="Expiring Soon" value={contractor?.expiringSoon ?? "—"} />
        <StatCard label="Fees Overdue" value={contractor?.feesOverdue ?? "—"} />
        <StatCard label="Total Vendors" value={contractor?.totalVendors ?? "—"} />
      </div>

      <h2 style={{ fontSize: 14, margin: "0 0 10px" }}>Complaints & Grievances</h2>
      <div className={styles.statGrid}>
        <StatCard label="Total Complaints" value={complaint?.total ?? "—"} />
        <StatCard label="Pending" value={complaint?.pending ?? "—"} />
        <StatCard label="Action Taken" value={complaint?.actionTaken ?? "—"} />
        <StatCard label="Closed" value={complaint?.closed ?? "—"} />
      </div>

      <h2 style={{ fontSize: 14, margin: "0 0 10px" }}>Penalties & Fines</h2>
      <div className={styles.statGrid}>
        <StatCard label="Total Cases" value={penalty?.totalCases ?? "—"} />
        <StatCard label="Total Imposed" value={penalty ? currency.format(penalty.totalImposed) : "—"} />
        <StatCard label="Total Recovered" value={penalty ? currency.format(penalty.totalRecovered) : "—"} />
        <StatCard label="Recovery Rate" value={penalty ? `${penalty.recoveryRate}%` : "—"} />
      </div>
    </div>
  );
}
