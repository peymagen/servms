import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { api } from "../api/client";
import { DIVISION_LABELS, ROLE_LABELS, type Division } from "../types";
import styles from "./DashboardPage.module.css";

interface DashboardStats {
  totalUsers: number;
  activeUsers: number;
  totalContractors: number;
  totalVendors: number;
  pendingComplaints: number;
  divisionBreakdown: Array<{ division: Division; count: number }>;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<DashboardStats>("/dashboard/stats")
      .then(setStats)
      .catch(() => setError("Unable to load dashboard stats"));
  }, []);

  const maxCount = Math.max(1, ...(stats?.divisionBreakdown.map((d) => d.count) ?? [0]));

  return (
    <div>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>
            {user?.role === "DIVISION_ADDITIONAL_ADMIN"
              ? `${user.division ? DIVISION_LABELS[user.division] : ""} Division Overview`
              : "Division Oversight"}
          </h1>
          <p className={styles.subtitle}>
            Central Command Center for South Eastern Railway Vendor Operations
          </p>
        </div>
        <span className={styles.roleTag}>{user ? ROLE_LABELS[user.role] : ""}</span>
      </div>

      {error && <div className={styles.errorBanner}>{error}</div>}

      <div className={styles.statGrid}>
        <StatCard label="Total Registered Users" value={stats?.totalUsers ?? "—"} />
        <StatCard label="Total Vendors" value={stats?.totalVendors ?? "—"} />
        <StatCard label="Total Contractors" value={stats?.totalContractors ?? "—"} />
        <StatCard label="Pending Complaints" value={stats?.pendingComplaints ?? "—"} />
      </div>

      <div className={styles.panelGrid}>
        <section className={styles.panel}>
          <h2 className={styles.panelTitle}>Division-wise User Distribution</h2>
          {stats && stats.divisionBreakdown.length > 0 ? (
            <div className={styles.barChart}>
              {stats.divisionBreakdown.map((d) => (
                <div key={d.division} className={styles.barCol}>
                  <div
                    className={styles.bar}
                    style={{ height: `${(d.count / maxCount) * 100}%` }}
                  />
                  <span className={styles.barLabel}>{DIVISION_LABELS[d.division]}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className={styles.emptyState}>No division data yet.</p>
          )}
        </section>

        <section className={styles.panel}>
          <h2 className={styles.panelTitle}>Modules</h2>
          <ul className={styles.moduleList}>
            <li>
              <span className={styles.dotDone} /> User Management
            </li>
            <li>
              <span className={styles.dotDone} /> Location Masters
            </li>
            <li>
              <span className={styles.dotDone} /> Vendor / Contractor Management
            </li>
            <li>
              <span className={styles.dotDone} /> ID Card / QR Management
            </li>
            <li>
              <span className={styles.dotDone} /> Complaints & Penalties
            </li>
            <li>
              <span className={styles.dotDone} /> Reports
            </li>
          </ul>
        </section>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: number | string;
  hint?: string;
}) {
  return (
    <div className={styles.statCard}>
      <div className={styles.statLabel}>{label}</div>
      <div className={styles.statValue}>{value}</div>
      {hint && <div className={styles.statHint}>{hint}</div>}
    </div>
  );
}
