import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { ReportsSummary } from "../types";
import styles from "../styles/listPage.module.css";

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Pending",
  UNDER_INVESTIGATION: "Under Investigation",
  RESOLVED: "Resolved",
};

const currency = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

export default function ReportsPage() {
  const [summary, setSummary] = useState<ReportsSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<ReportsSummary>("/reports/summary")
      .then(setSummary)
      .catch(() => setError("Unable to load reports"));
  }, []);

  function downloadJson() {
    if (!summary) return;
    const blob = new Blob([JSON.stringify(summary, null, 2)], {
      type: "application/json",
    });
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
          <p className={styles.subtitle}>
            Aggregate summary across users, vendors, contractors, units, complaints, and
            penalties.
          </p>
        </div>
        <button className={styles.addBtn} onClick={downloadJson} disabled={!summary}>
          Export Summary
        </button>
      </div>

      {error && <div className={styles.errorBanner}>{error}</div>}

      <div className={styles.statGrid}>
        <StatCard label="Total Users" value={summary?.totalUsers ?? "—"} />
        <StatCard label="Total Contractors" value={summary?.totalContractors ?? "—"} />
        <StatCard label="Total Vendors" value={summary?.totalVendors ?? "—"} />
        <StatCard label="Total Units" value={summary?.totalUnits ?? "—"} />
      </div>

      <div className={styles.statGrid}>
        <StatCard
          label="Total Penalties Imposed"
          value={summary ? currency.format(summary.totalPenaltyAmount) : "—"}
        />
        <StatCard
          label="Total Recovered"
          value={summary ? currency.format(summary.totalRecoveredAmount) : "—"}
        />
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Complaint Status</th>
              <th>Count</th>
            </tr>
          </thead>
          <tbody>
            {!summary || summary.complaintsByStatus.length === 0 ? (
              <tr>
                <td colSpan={2} className={styles.emptyCell}>
                  No complaint data yet.
                </td>
              </tr>
            ) : (
              summary.complaintsByStatus.map((c) => (
                <tr key={c.status}>
                  <td>{STATUS_LABELS[c.status] ?? c.status}</td>
                  <td>{c.count}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className={styles.statCard}>
      <div className={styles.statLabel}>{label}</div>
      <div className={styles.statValue}>{value}</div>
    </div>
  );
}
