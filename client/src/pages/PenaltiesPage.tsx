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

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
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

  const [viewPenalty, setViewPenalty] = useState<Penalty | null>(null);
  const [editPenaltyTarget, setEditPenaltyTarget] = useState<Penalty | null>(null);
  const [resolvingId, setResolvingId] = useState<number | null>(null);

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
      const headers = [
        "Ref No",
        "Contractor / Vendor",
        "Unit / Location",
        "Penalty Type",
        "Reason",
        "Amount",
        "Date Raised",
        "Date Resolved",
        "Status",
      ];
      const rows = res.rows.map((p) => [
        p.penalty_code,
        p.contractor_name ?? p.vendor_name ?? "",
        p.unit_name ?? "",
        derivePenaltyType(p.reason),
        p.reason,
        p.amount,
        formatDate(p.issued_date),
        p.penalties_status !== "pending" ? formatDate(p.resolution_date) : "",
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

  async function updatePenalty(id: number, data: Partial<Penalty>) {
    await api.patch(`/penalties/${id}`, data);
    load();
  }

  // Direct resolve action — fires the API call immediately when an option is picked
  async function resolvePenalty(id: number, status: "recovered" | "waived") {
    setResolvingId(id);
    setError(null);
    try {
      await api.patch(`/penalties/${id}`, {
        penalties_status: status,
        resolution_date: new Date().toISOString(),
      });
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to update penalty status");
    } finally {
      setResolvingId(null);
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
              <th>Date Raised</th>
              <th>Date Resolved</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={10} className={styles.emptyCell}>
                  Loading…
                </td>
              </tr>
            ) : penalties.length === 0 ? (
              <tr>
                <td colSpan={10} className={styles.emptyCell}>
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
                  <td>{formatDate(p.issued_date)}</td>
                  <td>
                    {p.penalties_status !== "pending" ? formatDate(p.resolution_date) : "—"}
                  </td>
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
                  <td>
                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      <button
                        type="button"
                        className={styles.pageBtn}
                        title="View penalty"
                        onClick={() => setViewPenalty(p)}
                      >
                        <EyeIcon />
                      </button>
                      <button
                        type="button"
                        className={styles.pageBtn}
                        title="Edit penalty"
                        onClick={() => setEditPenaltyTarget(p)}
                      >
                        <EditIcon />
                      </button>
                      <ResolveActionMenu
                        penalty={p}
                        onResolve={resolvePenalty}
                        isResolving={resolvingId === p.id}
                      />
                    </div>
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

      {viewPenalty && (
        <div className={styles.modalOverlay} onClick={() => setViewPenalty(null)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h2 className={styles.modalTitle}>{viewPenalty.penalty_code}</h2>
            <div className={styles.formGrid}>
              <DetailItem
                label="Contractor / Vendor"
                value={viewPenalty.contractor_name ?? viewPenalty.vendor_name ?? "—"}
              />
              <DetailItem label="Unit / Location" value={viewPenalty.unit_name ?? "—"} />
              <DetailItem label="Penalty Type" value={derivePenaltyType(viewPenalty.reason)} />
              <DetailItem label="Amount" value={currency.format(viewPenalty.amount)} />
              <DetailItem label="Date Raised" value={formatDate(viewPenalty.issued_date)} />
              <DetailItem
                label="Date Resolved"
                value={
                  viewPenalty.penalties_status !== "pending"
                    ? formatDate(viewPenalty.resolution_date)
                    : "—"
                }
              />
              <DetailItem label="Status" value={STATUS_LABELS[viewPenalty.penalties_status]} />
              <div className={styles.fieldWide}>
                <div className={styles.fieldLabel}>Reason</div>
                <div className={styles.strong}>{viewPenalty.reason}</div>
              </div>
            </div>
            <div className={styles.modalActions}>
              <button className={styles.cancelBtn} onClick={() => setViewPenalty(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {editPenaltyTarget && (
        <EditPenaltyModal
          penalty={editPenaltyTarget}
          onClose={() => setEditPenaltyTarget(null)}
          onSaved={(data) => {
            updatePenalty(editPenaltyTarget.id, data);
            setEditPenaltyTarget(null);
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

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className={styles.fieldLabel}>{label}</div>
      <div className={styles.strong}>{value}</div>
    </div>
  );
}

function ResolveActionMenu({
  penalty,
  onResolve,
  isResolving,
}: {
  penalty: Penalty;
  onResolve: (id: number, status: "recovered" | "waived") => void;
  isResolving: boolean;
}) {
  const [open, setOpen] = useState(false);

  if (penalty.penalties_status !== "pending") return null;

  return (
    <div style={{ position: "relative", display: "inline-block" }}>
      <button
        type="button"
        className={styles.pageBtn}
        title="Update status"
        disabled={isResolving}
        onClick={() => setOpen((o) => !o)}
        style={{ opacity: isResolving ? 0.5 : 1, cursor: isResolving ? "not-allowed" : "pointer" }}
      >
        <StatusIcon />
      </button>

      {open && (
        <>
          <div style={{ position: "fixed", inset: 0, zIndex: 10 }} onClick={() => setOpen(false)} />
          <div
            style={{
              position: "absolute",
              top: "100%",
              right: 0,
              marginTop: 4,
              background: "var(--color-surface)",
              boxShadow: "var(--shadow-card)",
              borderRadius: 8,
              zIndex: 20,
              minWidth: 150,
              overflow: "hidden",
              border: "1px solid rgba(0,0,0,0.08)",
            }}
          >
            <button
              type="button"
              onClick={() => {
                onResolve(penalty.id, "recovered");
                setOpen(false);
              }}
              style={{
                display: "block",
                width: "100%",
                textAlign: "left",
                padding: "9px 14px",
                border: "none",
                background: "none",
                cursor: "pointer",
                fontSize: 13,
                color: "#16a34a",
                fontWeight: 500,
              }}
            >
              ✓ Mark Recovered
            </button>
            <button
              type="button"
              onClick={() => {
                onResolve(penalty.id, "waived");
                setOpen(false);
              }}
              style={{
                display: "block",
                width: "100%",
                textAlign: "left",
                padding: "9px 14px",
                border: "none",
                background: "none",
                cursor: "pointer",
                fontSize: 13,
                color: "#d97706",
                fontWeight: 500,
              }}
            >
              Waive Penalty
            </button>
          </div>
        </>
      )}
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

function EditPenaltyModal({
  penalty,
  onClose,
  onSaved,
}: {
  penalty: Penalty;
  onClose: () => void;
  onSaved: (data: Partial<Penalty>) => void;
}) {
  const [amount, setAmount] = useState(String(penalty.amount));
  const [reason, setReason] = useState(penalty.reason);
  const [penaltiesStatus, setPenaltiesStatus] = useState(penalty.penalties_status);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit() {
    setError(null);
    setIsSubmitting(true);
    try {
      onSaved({
        amount: Number(amount),
        reason,
        penalties_status: penaltiesStatus,
      });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to update penalty");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <h2 className={styles.modalTitle}>Edit {penalty.penalty_code}</h2>
        <div className={styles.formGrid}>
          <div className={styles.field}>
            <span className={styles.fieldLabel}>Amount (₹)</span>
            <input type="number" min="1" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div className={styles.field}>
            <span className={styles.fieldLabel}>Status</span>
            <select
              value={penaltiesStatus}
              onChange={(e) => setPenaltiesStatus(e.target.value as Penalty["penalties_status"])}
            >
              {Object.entries(STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div className={styles.fieldWide}>
            <div className={styles.field}>
              <span className={styles.fieldLabel}>Reason</span>
              <textarea value={reason} onChange={(e) => setReason(e.target.value)} />
            </div>
          </div>
        </div>
        {error && <div className={styles.errorBanner}>{error}</div>}
        <div className={styles.modalActions}>
          <button type="button" className={styles.cancelBtn} onClick={onClose}>
            Cancel
          </button>
          <button type="button" className={styles.addBtn} onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </div>
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

function EditIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
      <path
        d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17v3Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function StatusIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M8 12.5l2.5 2.5L16 9.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
