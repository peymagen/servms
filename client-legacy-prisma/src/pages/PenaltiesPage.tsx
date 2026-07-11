import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { api, ApiError } from "../api/client";
import {
  DIVISION_LABELS,
  type Division,
  type Penalty,
  type PenaltyStatus,
  type Vendor,
} from "../types";
import styles from "../styles/listPage.module.css";

const DIVISIONS: Division[] = ["ADRA", "RANCHI", "CHAKRADHARPUR", "KHARAGPUR"];

const STATUS_LABELS: Record<PenaltyStatus, string> = {
  PENDING: "Pending",
  RECOVERED: "Recovered",
  OVERDUE: "Overdue",
};

const currency = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

export default function PenaltiesPage() {
  const [penalties, setPenalties] = useState<Penalty[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [search, setSearch] = useState("");

  function load() {
    setIsLoading(true);
    Promise.all([api.get<Penalty[]>("/penalties"), api.get<Vendor[]>("/vendors")])
      .then(([p, v]) => {
        setPenalties(p);
        setVendors(v);
      })
      .catch(() => setError("Unable to load penalties"))
      .finally(() => setIsLoading(false));
  }

  useEffect(load, []);

  const filtered = useMemo(
    () =>
      penalties.filter(
        (p) =>
          !search ||
          p.vendorName.toLowerCase().includes(search.toLowerCase()) ||
          p.refNo.toLowerCase().includes(search.toLowerCase())
      ),
    [penalties, search]
  );

  const totalImposed = penalties.reduce((sum, p) => sum + p.amount, 0);
  const totalRecovered = penalties
    .filter((p) => p.status === "RECOVERED")
    .reduce((sum, p) => sum + p.amount, 0);
  const outstanding = totalImposed - totalRecovered;

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
        <button
          className={styles.addBtn}
          onClick={() => setIsFormOpen(true)}
          disabled={vendors.length === 0}
        >
          + New Penalty Order
        </button>
      </div>

      <div className={styles.statGrid}>
        <StatCard label="Total Penalties Imposed" value={currency.format(totalImposed)} />
        <StatCard label="Total Recovered" value={currency.format(totalRecovered)} />
        <StatCard label="Outstanding Amount" value={currency.format(outstanding)} />
      </div>

      <input
        className={styles.searchInput}
        placeholder="Search vendor or reference number…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {error && <div className={styles.errorBanner}>{error}</div>}
      {!isLoading && vendors.length === 0 && (
        <p className={styles.sub} style={{ marginBottom: 14 }}>
          Add a vendor first before imposing penalties.
        </p>
      )}

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Ref No</th>
              <th>Vendor</th>
              <th>Unit / Location</th>
              <th>Penalty Type</th>
              <th>Amount</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={6} className={styles.emptyCell}>
                  Loading…
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className={styles.emptyCell}>
                  No penalties recorded.
                </td>
              </tr>
            ) : (
              filtered.map((p) => (
                <tr key={p.id}>
                  <td className={styles.strong}>{p.refNo}</td>
                  <td>{p.vendorName}</td>
                  <td>{p.unitLocation}</td>
                  <td>{p.penaltyType}</td>
                  <td>{currency.format(p.amount)}</td>
                  <td>
                    <span
                      className={
                        p.status === "RECOVERED"
                          ? styles.statusGood
                          : p.status === "OVERDUE"
                          ? styles.statusBad
                          : styles.statusWarn
                      }
                    >
                      {STATUS_LABELS[p.status]}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {isFormOpen && (
        <NewPenaltyModal
          vendors={vendors}
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

function NewPenaltyModal({
  vendors,
  onClose,
  onCreated,
}: {
  vendors: Vendor[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [refNo, setRefNo] = useState("");
  const [vendorId, setVendorId] = useState(vendors[0]?.id ?? "");
  const [unitLocation, setUnitLocation] = useState("");
  const [division, setDivision] = useState<Division>(vendors[0]?.division ?? "ADRA");
  const [penaltyType, setPenaltyType] = useState("");
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedVendor = vendors.find((v) => v.id === vendorId);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await api.post("/penalties", {
        refNo,
        vendorId,
        vendorName: selectedVendor?.fullName ?? "",
        unitLocation,
        division,
        penaltyType,
        amount: Number(amount),
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
          <Field label="Reference Number">
            <input
              value={refNo}
              onChange={(e) => setRefNo(e.target.value)}
              placeholder="e.g. PNL-2026-0001"
              required
            />
          </Field>
          <Field label="Vendor">
            <select value={vendorId} onChange={(e) => setVendorId(e.target.value)}>
              {vendors.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.fullName} ({v.vendorCode})
                </option>
              ))}
            </select>
          </Field>
          <Field label="Division">
            <select value={division} onChange={(e) => setDivision(e.target.value as Division)}>
              {DIVISIONS.map((d) => (
                <option key={d} value={d}>
                  {DIVISION_LABELS[d]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Unit / Location">
            <input
              value={unitLocation}
              onChange={(e) => setUnitLocation(e.target.value)}
              required
            />
          </Field>
          <Field label="Penalty Type">
            <input
              value={penaltyType}
              onChange={(e) => setPenaltyType(e.target.value)}
              placeholder="e.g. Hygiene Lapse"
              required
            />
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

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className={styles.statCard}>
      <div className={styles.statLabel}>{label}</div>
      <div className={styles.statValue}>{value}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className={styles.field}>
      <span className={styles.fieldLabel}>{label}</span>
      {children}
    </label>
  );
}
