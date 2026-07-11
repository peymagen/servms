import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { getDivisions } from "../api/masters";
import type { Division, Unit, Vendor } from "../types";
import StatCard from "../components/ui/StatCard";
import Pagination from "../components/ui/Pagination";
import styles from "../styles/listPage.module.css";

const LIMIT = 10;

interface Metrics {
  totalActiveVendors: number;
  aadhaarVerified: number;
  expiredMedicals: number;
  awaitingApproval: number;
}

export default function VendorManagementPage() {
  const navigate = useNavigate();
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);

  const [search, setSearch] = useState("");
  const [divisionFilter, setDivisionFilter] = useState<number | "">("");
  const [aadhaarFilter, setAadhaarFilter] = useState("");
  const [validityFilter, setValidityFilter] = useState("");
  const [unitFilter, setUnitFilter] = useState<number | "">("");
  const [showMoreFilters, setShowMoreFilters] = useState(false);

  const [divisions, setDivisions] = useState<Division[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [viewVendor, setViewVendor] = useState<Vendor | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);

  function buildParams(limit: number, offsetVal: number) {
    const params = new URLSearchParams({ limit: String(limit), offset: String(offsetVal) });
    if (search) params.set("search", search);
    if (divisionFilter) params.set("division_id", String(divisionFilter));
    if (unitFilter) params.set("unit_id", String(unitFilter));
    if (aadhaarFilter) params.set("aadhaar_status", aadhaarFilter);
    if (validityFilter) params.set("status", validityFilter);
    return params;
  }

  function load() {
    setIsLoading(true);
    api
      .get<{ total: number; rows: Vendor[] }>(`/vendors?${buildParams(LIMIT, offset).toString()}`)
      .then((res) => {
        setVendors(res.rows);
        setTotal(res.total);
      })
      .catch(() => setError("Unable to load vendors"))
      .finally(() => setIsLoading(false));
  }

  useEffect(load, [offset, search, divisionFilter, aadhaarFilter, validityFilter, unitFilter]);
  useEffect(() => {
    api.get<Metrics>("/vendors/metrics").then(setMetrics).catch(() => {});
    getDivisions().then(setDivisions).catch(() => {});
    api
      .get<{ total: number; rows: Unit[] }>("/units?limit=200")
      .then((res) => setUnits(res.rows))
      .catch(() => {});
  }, []);

  const filteredUnits = useMemo(
    () => (divisionFilter ? units.filter((u) => u.division_id === divisionFilter) : units),
    [units, divisionFilter]
  );

  async function handleExport() {
    setIsExporting(true);
    try {
      const params = buildParams(2000, 0);
      const res = await api.get<{ total: number; rows: Vendor[] }>(`/vendors?${params.toString()}`);
      const headers = [
        "Vendor ID",
        "Vendor Name",
        "Contractor Entity",
        "Unit",
        "Division",
        "Aadhaar Status",
        "Validity End",
        "Status",
      ];
      const rows = res.rows.map((v) => [
        v.vendor_code,
        v.full_name,
        v.contractor_name ?? "",
        v.unit_name ?? "",
        v.division_name ?? "",
        v.aadhar_linked ? "Verified" : "Pending",
        v.validity_end ? new Date(v.validity_end).toLocaleDateString() : "",
        v.vendor_status,
      ]);
      const csv = [headers, ...rows]
        .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
        .join("\n");
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "vendor-master-listing.csv";
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError("Unable to export vendors");
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <div>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Vendor Master Listing</h1>
          <p className={styles.subtitle}>
            Manage and monitor all active commercial vendors across S.E. Railway zones.
          </p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button className={styles.cancelBtn} onClick={handleExport} disabled={isExporting}>
            {isExporting ? "Exporting…" : "⬇ Export to Excel"}
          </button>
          <button className={styles.addBtn} onClick={() => navigate("/vendors/new")}>
            + Onboard New Vendor
          </button>
        </div>
      </div>

      <div
        style={{
          background: "var(--color-surface)",
          borderRadius: "var(--radius-lg)",
          boxShadow: "var(--shadow-card)",
          padding: "18px 20px 4px",
          marginBottom: 16,
        }}
      >
        <div className={styles.filterRow}>
          <LabeledField label="Search Database">
            <input
              className={styles.searchInput}
              style={{ marginBottom: 0, maxWidth: "none" }}
              placeholder="Vendor ID, Name, or Contractor…"
              value={search}
              onChange={(e) => {
                setOffset(0);
                setSearch(e.target.value);
              }}
            />
          </LabeledField>
          <LabeledField label="Unit / Division">
            <select
              className={styles.select}
              value={divisionFilter}
              onChange={(e) => {
                setOffset(0);
                setDivisionFilter(e.target.value ? Number(e.target.value) : "");
                setUnitFilter("");
              }}
            >
              <option value="">All Divisions</option>
              {divisions.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.division_name}
                </option>
              ))}
            </select>
          </LabeledField>
          <LabeledField label="Aadhaar Status">
            <select
              className={styles.select}
              value={aadhaarFilter}
              onChange={(e) => {
                setOffset(0);
                setAadhaarFilter(e.target.value);
              }}
            >
              <option value="">Any Status</option>
              <option value="verified">Verified</option>
              <option value="pending">Pending</option>
            </select>
          </LabeledField>
        </div>

        <div className={styles.filterRow}>
          <LabeledField label="Validity">
            <select
              className={styles.select}
              value={validityFilter}
              onChange={(e) => {
                setOffset(0);
                setValidityFilter(e.target.value);
              }}
            >
              <option value="">All</option>
              <option value="active">Active</option>
              <option value="pending">Pending</option>
              <option value="expired">Expired</option>
            </select>
          </LabeledField>
          <button
            type="button"
            className={styles.cancelBtn}
            style={{ alignSelf: "flex-end" }}
            onClick={() => setShowMoreFilters((s) => !s)}
          >
            ⚲ {showMoreFilters ? "Fewer Filters" : "More Filters"}
          </button>
        </div>

        {showMoreFilters && (
          <div className={styles.filterRow}>
            <LabeledField label="Unit">
              <select
                className={styles.select}
                value={unitFilter}
                onChange={(e) => {
                  setOffset(0);
                  setUnitFilter(e.target.value ? Number(e.target.value) : "");
                }}
              >
                <option value="">All Units</option>
                {filteredUnits.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.unit_name}
                  </option>
                ))}
              </select>
            </LabeledField>
          </div>
        )}
      </div>

      {error && <div className={styles.errorBanner}>{error}</div>}

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Vendor ID</th>
              <th>Vendor Name</th>
              <th>Contractor Entity</th>
              <th>Unit</th>
              <th>Aadhaar Status</th>
              <th>Medical Validity</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={8} className={styles.emptyCell}>
                  Loading…
                </td>
              </tr>
            ) : vendors.length === 0 ? (
              <tr>
                <td colSpan={8} className={styles.emptyCell}>
                  No vendors found.
                </td>
              </tr>
            ) : (
              vendors.map((v) => (
                <tr key={v.id}>
                  <td className={styles.strong}>{v.vendor_code}</td>
                  <td>
                    <div className={styles.userCell}>
                      <div className={styles.avatar}>{v.full_name.charAt(0)}</div>
                      <div>{v.full_name}</div>
                    </div>
                  </td>
                  <td>{v.contractor_name ?? "—"}</td>
                  <td>{v.unit_name ?? "—"}</td>
                  <td>
                    <span className={v.aadhar_linked ? styles.statusGood : styles.statusWarn}>
                      {v.aadhar_linked ? "Verified" : "Pending"}
                    </span>
                  </td>
                  <td>
                    {v.medical_fitness_status === "completed" ? (
                      <span className={styles.statusGood}>
                        {v.validity_end ? new Date(v.validity_end).toLocaleDateString() : "Completed"}
                      </span>
                    ) : (
                      <span className={styles.statusWarn}>Pending</span>
                    )}
                  </td>
                  <td>
                    <span
                      className={
                        v.vendor_status === "active"
                          ? styles.statusGood
                          : v.vendor_status === "expired"
                          ? styles.statusBad
                          : styles.statusWarn
                      }
                    >
                      {v.vendor_status.charAt(0).toUpperCase() + v.vendor_status.slice(1)}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        type="button"
                        className={styles.pageBtn}
                        title="View vendor"
                        onClick={() => setViewVendor(v)}
                      >
                        <EyeIcon />
                      </button>
                      <button
                        type="button"
                        className={styles.pageBtn}
                        title="ID Card / QR"
                        onClick={() => navigate(`/id-cards?vendor=${v.id}`)}
                      >
                        <QrIcon />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        <Pagination total={total} limit={LIMIT} offset={offset} onOffsetChange={setOffset} />
      </div>

      <div className={styles.statGrid} style={{ marginTop: 20 }}>
        <StatCard label="Total Active Vendors" value={metrics?.totalActiveVendors ?? "—"} />
        <StatCard label="Aadhaar Verified" value={metrics?.aadhaarVerified ?? "—"} />
        <StatCard label="Expired Medicals" value={metrics?.expiredMedicals ?? "—"} />
        <StatCard label="Awaiting Approval" value={metrics?.awaitingApproval ?? "—"} />
      </div>

      {viewVendor && (
        <div className={styles.modalOverlay} onClick={() => setViewVendor(null)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h2 className={styles.modalTitle}>{viewVendor.full_name}</h2>
            <div className={styles.formGrid}>
              <DetailItem label="Vendor Code" value={viewVendor.vendor_code} />
              <DetailItem label="Vendor Type" value={viewVendor.vendor_type} />
              <DetailItem label="Mobile" value={viewVendor.mobile_number ?? "—"} />
              <DetailItem label="Email" value={viewVendor.email ?? "—"} />
              <DetailItem label="Contractor" value={viewVendor.contractor_name ?? "—"} />
              <DetailItem label="Division" value={viewVendor.division_name ?? "—"} />
              <DetailItem label="Station" value={viewVendor.station_name ?? "—"} />
              <DetailItem label="Unit" value={viewVendor.unit_name ?? "—"} />
              <DetailItem
                label="Aadhaar Status"
                value={viewVendor.aadhar_linked ? "Verified" : "Pending"}
              />
              <DetailItem
                label="Validity"
                value={
                  viewVendor.validity_start && viewVendor.validity_end
                    ? `${new Date(viewVendor.validity_start).toLocaleDateString()} — ${new Date(
                        viewVendor.validity_end
                      ).toLocaleDateString()}`
                    : "—"
                }
              />
              <DetailItem label="Status" value={viewVendor.vendor_status} />
            </div>
            <div className={styles.modalActions}>
              <button className={styles.cancelBtn} onClick={() => setViewVendor(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function LabeledField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className={styles.field} style={{ flex: 1 }}>
      <span className={styles.fieldLabel}>{label}</span>
      {children}
    </div>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className={styles.fieldLabel}>{label}</div>
      <div className={styles.strong}>{value}</div>
    </div>
  );
}

function EyeIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function QrIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.6" />
      <rect x="14" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.6" />
      <rect x="3" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.6" />
      <path d="M14 14h3v3M20 14v3h-3M14 20h3M20 20v-3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
