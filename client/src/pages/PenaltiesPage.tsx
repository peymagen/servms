import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { api, ApiError } from "../api/client";
import { getContractorsLite, getDivisions } from "../api/masters";
import type { Contractor, Division, Penalty } from "../types";
import Field from "../components/ui/Field";
import StatCard from "../components/ui/StatCard";
import Pagination from "../components/ui/Pagination";
import styles from "../styles/listPage.module.css";

function derivePenaltyType(reason: string): string {
  const r = reason.toUpperCase();
  if (r.includes("HYGIENE") || r.includes("EXPIRED")) return "HYGIENE LAPSE";
  if (r.includes("OVERCHARG")) return "OVERCHARGING";
  if (r.includes("VENDING") || r.includes("UNAUTHORIZ")) return "UNAUTHORIZED VENDING";
  return "OTHER";
}

const LIMIT = 10;

const STATUS_LABELS: Record<Penalty["penalties_status"], string> = {
  pending: "Pending",
  recovered: "Recovered",
  waived: "Waived",
};

interface Metrics {
  totalCases: number;
  totalImposed: number;
  totalRecovered: number;
  outstandingAmount: number;
  recoveryRate: number;
  alerts: Array<{ penalty_code: string; contractor_name: string; amount: string; reason: string }>;
}

const currency = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

export default function PenaltiesPage() {
  const [penalties, setPenalties] = useState<Penalty[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [divisionFilter, setDivisionFilter] = useState<number | "">("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);

  function buildParams(limit: number, offsetVal: number) {
    const params = new URLSearchParams({ limit: String(limit), offset: String(offsetVal) });
    if (search) params.set("search", search);
    if (statusFilter) params.set("status", statusFilter);
    if (divisionFilter) params.set("division_id", String(divisionFilter));
    return params;
  }

  function load() {
    setIsLoading(true);
    api
      .get<{ total: number; rows: Penalty[] }>(`/penalties?${buildParams(LIMIT, offset).toString()}`)
      .then((res) => {
        setPenalties(res.rows);
        setTotal(res.total);
      })
      .catch(() => setError("Unable to load penalties"))
      .finally(() => setIsLoading(false));
  }

  useEffect(load, [offset, search, statusFilter, divisionFilter]);
  useEffect(() => {
    api.get<Metrics>("/penalties/metrics").then(setMetrics).catch(() => {});
    getContractorsLite().then(setContractors).catch(() => {});
    getDivisions().then(setDivisions).catch(() => {});
  }, []);

  async function handleExport() {
    setIsExporting(true);
    try {
      const params = buildParams(2000, 0);
      const res = await api.get<{ total: number; rows: Penalty[] }>(`/penalties?${params.toString()}`);
      const headers = ["Ref No", "Contractor / Vendor", "Unit / Location", "Penalty Type", "Reason", "Amount", "Status"];
      const rows = res.rows.map((p) => [
        p.penalty_code,
        p.contractor_name ?? p.vendor_name ?? "",
        p.unit_name ?? "",
        derivePenaltyType(p.reason),
        p.reason,
        p.amount,
        STATUS_LABELS[p.penalties_status],
      ]);
      const csv = [headers, ...rows]
        .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
        .join("\n");
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "penalty-recovery-ledger.csv";
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError("Unable to export penalty ledger");
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <div>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Penalty Management & Recovery Ledger</h1>
          <p className={styles.subtitle}>
            Real-time oversight of financial penalties, recovery tracking, and outstanding
            settlements.
          </p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button
            type="button"
            className={styles.cancelBtn}
            onClick={() => setShowAdvanced((s) => !s)}
          >
            ⚏ {showAdvanced ? "Fewer Filters" : "Advanced Filters"}
          </button>
          <button className={styles.cancelBtn} onClick={handleExport} disabled={isExporting}>
            {isExporting ? "Exporting…" : "⬆ Export Ledger"}
          </button>
          <button
            className={styles.addBtn}
            onClick={() => setIsFormOpen(true)}
            disabled={contractors.length === 0}
          >
            + New Penalty Order
          </button>
        </div>
      </div>

      <div className={styles.statGrid}>
        <StatCard label="Total Penalties Imposed" value={metrics ? currency.format(metrics.totalImposed) : "—"} />
        <StatCard label="Total Recovered" value={metrics ? currency.format(metrics.totalRecovered) : "—"} />
        <StatCard label="Outstanding Amount" value={metrics ? currency.format(metrics.outstandingAmount) : "—"} />
        <StatCard label="Recovery Rate" value={metrics ? `${metrics.recoveryRate}%` : "—"} />
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
          <LabeledField label="Search">
            <input
              className={styles.searchInput}
              style={{ marginBottom: 0, maxWidth: "none" }}
              placeholder="Search vendor, contractor, or reference number…"
              value={search}
              onChange={(e) => {
                setOffset(0);
                setSearch(e.target.value);
              }}
            />
          </LabeledField>
        </div>

        {showAdvanced && (
          <div className={styles.filterRow}>
            <LabeledField label="Status">
              <select
                className={styles.select}
                value={statusFilter}
                onChange={(e) => {
                  setOffset(0);
                  setStatusFilter(e.target.value);
                }}
              >
                <option value="">All</option>
                <option value="pending">Pending</option>
                <option value="recovered">Recovered</option>
                <option value="waived">Waived</option>
              </select>
            </LabeledField>
            <LabeledField label="Division">
              <select
                className={styles.select}
                value={divisionFilter}
                onChange={(e) => {
                  setOffset(0);
                  setDivisionFilter(e.target.value ? Number(e.target.value) : "");
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
          </div>
        )}
      </div>

      {error && <div className={styles.errorBanner}>{error}</div>}

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Ref No</th>
              <th>Contractor / Vendor</th>
              <th>Unit / Location</th>
              <th>Penalty Type</th>
              <th>Reason</th>
              <th>Amount</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={7} className={styles.emptyCell}>
                  Loading…
                </td>
              </tr>
            ) : penalties.length === 0 ? (
              <tr>
                <td colSpan={7} className={styles.emptyCell}>
                  No penalties recorded.
                </td>
              </tr>
            ) : (
              penalties.map((p) => (
                <tr key={p.id}>
                  <td className={styles.strong}>{p.penalty_code}</td>
                  <td>{p.contractor_name ?? p.vendor_name ?? "—"}</td>
                  <td>{p.unit_name ?? "—"}</td>
                  <td>
                    <span className={styles.roleTag}>{derivePenaltyType(p.reason)}</span>
                  </td>
                  <td className={styles.sub} style={{ maxWidth: 220 }}>
                    {p.reason}
                  </td>
                  <td>{currency.format(p.amount)}</td>
                  <td>
                    <span
                      className={
                        p.penalties_status === "recovered"
                          ? styles.statusGood
                          : p.penalties_status === "waived"
                          ? styles.statusWarn
                          : styles.statusBad
                      }
                    >
                      {STATUS_LABELS[p.penalties_status]}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        <Pagination total={total} limit={LIMIT} offset={offset} onOffsetChange={setOffset} />
      </div>

      {isFormOpen && (
        <NewPenaltyModal
          contractors={contractors}
          onClose={() => setIsFormOpen(false)}
          onCreated={() => {
            setIsFormOpen(false);
            load();
          }}
        />
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

function NewPenaltyModal({
  contractors,
  onClose,
  onCreated,
}: {
  contractors: Contractor[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [contractorId, setContractorId] = useState<number | "">("");
  const [unitId, setUnitId] = useState("");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await api.post("/penalties", {
        contractor_id: contractorId,
        unit_id: unitId ? Number(unitId) : undefined,
        amount: Number(amount),
        reason,
      });
      onCreated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to create penalty");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <form className={styles.modal} onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit}>
        <h2 className={styles.modalTitle}>New Penalty Order</h2>
        <div className={styles.formGrid}>
          <Field label="Contractor">
            <select
              value={contractorId}
              onChange={(e) => setContractorId(e.target.value ? Number(e.target.value) : "")}
              required
            >
              <option value="">Select contractor</option>
              {contractors.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.company_name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Unit ID (optional)">
            <input type="number" value={unitId} onChange={(e) => setUnitId(e.target.value)} />
          </Field>
          <Field label="Amount (₹)">
            <input
              type="number"
              min="1"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </Field>
          <div className={styles.fieldWide}>
            <Field label="Reason">
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. HYGIENE LAPSE: Insects found in food preparation area."
                required
              />
            </Field>
          </div>
        </div>

        {error && <div className={styles.errorBanner}>{error}</div>}

        <div className={styles.modalActions}>
          <button type="button" className={styles.cancelBtn} onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className={styles.addBtn} disabled={isSubmitting}>
            {isSubmitting ? "Submitting…" : "Impose Penalty"}
          </button>
        </div>
      </form>
    </div>
  );
}
