import { useEffect, useState } from "react";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { roleLabel } from "../types/labels";
import styles from "./DashboardPage.module.css";

interface DivisionPerf {
  divisionName: string;
  score: number;
  vendorCount: number;
}

interface DivisionServiceRow {
  id: number;
  code: string;
  name: string;
  vendors: number;
  compliance: number;
  score: string;
}

interface Alert {
  type: string;
  title: string;
  description: string;
  time: string;
}

interface DashboardStats {
  totalRegisteredVendors: number;
  activeContractors: number;
  penaltiesRecovered: number;
  pendingPenaltyOrders: number;
  pendingComplaints: number;
  divisionWisePerformance: DivisionPerf[];
  inspectionSummary: { satisfactory: number; minorIssues: number; criticalFailures: number };
  recentCriticalAlerts: Alert[];
  divisionServicePerformance: DivisionServiceRow[];
}

const currency = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 1,
  notation: "compact",
});

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

  const maxScore = Math.max(1, ...(stats?.divisionWisePerformance.map((d) => d.score) ?? [0]));

  return (
    <div>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>
            {user?.role_name === "admin" ? "Division Oversight" : "Division Oversight"}
          </h1>
          <p className={styles.subtitle}>
            Central Command Center for South Eastern Railway Vendor Operations
          </p>
        </div>
        <span className={styles.roleTag}>{user ? roleLabel(user.role_name) : ""}</span>
      </div>

      {error && <div className={styles.errorBanner}>{error}</div>}

      <div className={styles.statGrid}>
        <StatCard label="Total Registered Vendors" value={stats?.totalRegisteredVendors ?? "—"} />
        <StatCard label="Active Contractors" value={stats?.activeContractors ?? "—"} />
        <StatCard
          label="Penalties Recovered"
          value={stats ? currency.format(stats.penaltiesRecovered) : "—"}
        />
        <StatCard label="Pending Complaints" value={stats?.pendingComplaints ?? "—"} />
      </div>

      <div className={styles.panelGrid}>
        <section className={styles.panel}>
          <h2 className={styles.panelTitle}>Division-wise Performance</h2>
          {stats && stats.divisionWisePerformance.length > 0 ? (
            <div className={styles.barChart}>
              {stats.divisionWisePerformance.map((d) => (
                <div key={d.divisionName} className={styles.barCol}>
                  <div
                    className={styles.bar}
                    style={{ height: `${(d.score / maxScore) * 100}%` }}
                    title={`${d.vendorCount} vendors`}
                  />
                  <span className={styles.barLabel}>{d.divisionName}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className={styles.emptyState}>No division data yet.</p>
          )}
        </section>

        <section className={styles.panel}>
          <h2 className={styles.panelTitle}>Inspection Summary</h2>
          {stats && <DonutChart summary={stats.inspectionSummary} />}
        </section>
      </div>

      <div className={styles.panelGrid}>
        <section className={styles.panel}>
          <h2 className={styles.panelTitle}>Recent Critical Alerts</h2>
          <ul className={styles.alertList}>
            {stats?.recentCriticalAlerts.map((a, i) => (
              <li key={i} className={styles.alertItem}>
                <span className={a.type === "penalty" ? styles.dotWarn : styles.dotDanger} />
                <div>
                  <div className={styles.alertTitle}>{a.title}</div>
                  <div className={styles.alertDesc}>{a.description}</div>
                  <div className={styles.alertTime}>{a.time}</div>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className={styles.panel}>
          <h2 className={styles.panelTitle}>Division Service Performance</h2>
          <table className={styles.perfTable}>
            <thead>
              <tr>
                <th>Division</th>
                <th>Vendors</th>
                <th>Compliance</th>
                <th>Score</th>
              </tr>
            </thead>
            <tbody>
              {stats?.divisionServicePerformance.map((d) => (
                <tr key={d.id}>
                  <td>{d.name}</td>
                  <td>{d.vendors}</td>
                  <td>{d.compliance}%</td>
                  <td>
                    <span
                      className={
                        d.score === "EXCELLENT"
                          ? styles.scoreExcellent
                          : d.score === "GOOD"
                          ? styles.scoreGood
                          : d.score === "AVERAGE"
                          ? styles.scoreAverage
                          : styles.scorePoor
                      }
                    >
                      {d.score}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </div>
  );
}

function DonutChart({
  summary,
}: {
  summary: { satisfactory: number; minorIssues: number; criticalFailures: number };
}) {
  const total = summary.satisfactory + summary.minorIssues + summary.criticalFailures || 1;
  const satAngle = (summary.satisfactory / total) * 360;
  const minAngle = (summary.minorIssues / total) * 360;

  const gradient = `conic-gradient(
    var(--color-sidebar) 0deg ${satAngle}deg,
    var(--color-info) ${satAngle}deg ${satAngle + minAngle}deg,
    var(--color-danger) ${satAngle + minAngle}deg 360deg
  )`;

  return (
    <div className={styles.donutRow}>
      <div className={styles.donut} style={{ background: gradient }}>
        <div className={styles.donutHole} />
      </div>
      <ul className={styles.donutLegend}>
        <li>
          <span className={styles.dotSidebar} /> Satisfactory {summary.satisfactory}%
        </li>
        <li>
          <span className={styles.dotInfo} /> Minor Issues {summary.minorIssues}%
        </li>
        <li>
          <span className={styles.dotDanger} /> Critical Failures {summary.criticalFailures}%
        </li>
      </ul>
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
