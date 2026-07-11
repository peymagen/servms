import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import type { Contractor } from "../types";
import StatCard from "../components/ui/StatCard";
import Pagination from "../components/ui/Pagination";
import styles from "../styles/listPage.module.css";

const LIMIT = 10;

interface Metrics {
  totalActive: number;
  expiringSoon: number;
  feesOverdue: number;
  totalVendors: number;
}

export default function ContractorManagementPage() {
  const navigate = useNavigate();
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [search, setSearch] = useState("");
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  function load() {
    setIsLoading(true);
    const params = new URLSearchParams({ limit: String(LIMIT), offset: String(offset) });
    if (search) params.set("search", search);
    api
      .get<{ total: number; rows: Contractor[] }>(`/contractors?${params.toString()}`)
      .then((res) => {
        setContractors(res.rows);
        setTotal(res.total);
      })
      .catch(() => setError("Unable to load contractors"))
      .finally(() => setIsLoading(false));
  }

  useEffect(load, [offset, search]);
  useEffect(() => {
    api.get<Metrics>("/contractors/metrics").then(setMetrics).catch(() => {});
  }, []);

  return (
    <div>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Master Contractor Listing</h1>
          <p className={styles.subtitle}>
            Manage catering and service contractors across South Eastern Railway divisions.
          </p>
        </div>
        <button className={styles.addBtn} onClick={() => navigate("/contractors/new")}>
          + Onboard New Contractor
        </button>
      </div>

      <div className={styles.statGrid}>
        <StatCard label="Total Active" value={metrics?.totalActive ?? "—"} />
        <StatCard label="Expiring Soon" value={metrics?.expiringSoon ?? "—"} />
        <StatCard label="Fees Overdue" value={metrics?.feesOverdue ?? "—"} />
        <StatCard label="Total Vendors" value={metrics?.totalVendors ?? "—"} />
      </div>

      <input
        className={styles.searchInput}
        placeholder="Search contractors…"
        value={search}
        onChange={(e) => {
          setOffset(0);
          setSearch(e.target.value);
        }}
      />

      {error && <div className={styles.errorBanner}>{error}</div>}

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Contractor Name</th>
              <th>License Number</th>
              <th>Validity Date</th>
              <th>Fee Status</th>
              <th>Vendor Count</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={5} className={styles.emptyCell}>
                  Loading…
                </td>
              </tr>
            ) : contractors.length === 0 ? (
              <tr>
                <td colSpan={5} className={styles.emptyCell}>
                  No contractors found.
                </td>
              </tr>
            ) : (
              contractors.map((c) => (
                <tr key={c.id}>
                  <td>
                    <div className={styles.strong}>{c.company_name}</div>
                    <div className={styles.sub}>{c.division_name ?? "—"}</div>
                  </td>
                  <td>{c.license_number ?? "—"}</td>
                  <td>
                    {c.license_validity_date
                      ? new Date(c.license_validity_date).toLocaleDateString()
                      : "—"}
                  </td>
                  <td>
                    <span className={c.fee_status === "paid" ? styles.statusGood : styles.statusBad}>
                      {c.fee_status === "paid" ? "Paid" : "Overdue"}
                    </span>
                  </td>
                  <td>{c.vendor_count ?? 0}</td>
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
