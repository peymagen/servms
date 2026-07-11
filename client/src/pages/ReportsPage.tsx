import { useEffect, useState } from "react";
import { api } from "../api/client";
import StatCard from "../components/ui/StatCard";
import styles from "../styles/listPage.module.css";

interface VendorMetrics {
  totalActiveVendors: number;
  aadhaarVerified: number;
  expiredMedicals: number;
  awaitingApproval: number;
}
interface ContractorMetrics {
  totalActive: number;
  expiringSoon: number;
  feesOverdue: number;
  totalVendors: number;
}
interface ComplaintMetrics {
  openComplaints: number;
  pendingATR: number;
  avgResolutionTime: number;
}
interface PenaltyMetrics {
  totalCases: number;
  totalImposed: number;
  totalRecovered: number;
  outstandingAmount: number;
  recoveryRate: number;
}

const currency = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

export default function ReportsPage() {
  const [vendor, setVendor] = useState<VendorMetrics | null>(null);
  const [contractor, setContractor] = useState<ContractorMetrics | null>(null);
  const [complaint, setComplaint] = useState<ComplaintMetrics | null>(null);
  const [penalty, setPenalty] = useState<PenaltyMetrics | null>(null);

  useEffect(() => {
    api.get<VendorMetrics>("/vendors/metrics").then(setVendor).catch(() => {});
    api.get<ContractorMetrics>("/contractors/metrics").then(setContractor).catch(() => {});
    api.get<ComplaintMetrics>("/complaints/metrics").then(setComplaint).catch(() => {});
    api.get<PenaltyMetrics>("/penalties/metrics").then(setPenalty).catch(() => {});
  }, []);

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
          <p className={styles.subtitle}>
            Aggregate summary across vendors, contractors, complaints, and penalties.
          </p>
        </div>
        <button className={styles.addBtn} onClick={exportSummary}>
          Export Summary
        </button>
      </div>

      <h2 style={{ fontSize: 14, margin: "0 0 10px" }}>Vendor Management</h2>
      <div className={styles.statGrid}>
        <StatCard label="Total Active Vendors" value={vendor?.totalActiveVendors ?? "—"} />
        <StatCard label="Aadhaar Verified" value={vendor?.aadhaarVerified ?? "—"} />
        <StatCard label="Expired Medicals" value={vendor?.expiredMedicals ?? "—"} />
        <StatCard label="Awaiting Approval" value={vendor?.awaitingApproval ?? "—"} />
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
        <StatCard label="Open Complaints" value={complaint?.openComplaints ?? "—"} />
        <StatCard label="Pending ATR" value={complaint?.pendingATR ?? "—"} />
        <StatCard
          label="Avg. Resolution Time"
          value={complaint ? `${complaint.avgResolutionTime} hrs` : "—"}
        />
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
