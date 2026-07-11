import { useEffect, useState, type FormEvent } from "react";
import { api, ApiError } from "../api/client";
import type { Vendor, VendorRenewal } from "../types";
import Field from "../components/ui/Field";
import Pagination from "../components/ui/Pagination";
import styles from "../styles/listPage.module.css";

const LIMIT = 10;

const STATUS_LABELS: Record<VendorRenewal["renewals_status"], string> = {
  draft: "Draft",
  pending_approval: "Pending Approval",
  approved: "Approved",
  rejected: "Rejected",
};

export default function RenewalsPage() {
  const [renewals, setRenewals] = useState<VendorRenewal[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  function load() {
    setIsLoading(true);
    api
      .get<{ total: number; rows: VendorRenewal[] }>(
        `/renewals?limit=${LIMIT}&offset=${offset}`
      )
      .then((res) => {
        setRenewals(res.rows);
        setTotal(res.total);
      })
      .catch(() => setError("Unable to load renewals"))
      .finally(() => setIsLoading(false));
  }

  useEffect(load, [offset]);

  async function updateStatus(id: number, status: "approved" | "rejected") {
    await api.patch(`/renewals/${id}`, { renewals_status: status });
    load();
  }

  return (
    <div>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Vendor ID Renewal</h1>
          <p className={styles.subtitle}>
            Submit and approve extended validity requests for vendor identity cards.
          </p>
        </div>
        <button className={styles.addBtn} onClick={() => setIsFormOpen(true)}>
          + Submit Renewal
        </button>
      </div>

      {error && <div className={styles.errorBanner}>{error}</div>}

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Vendor</th>
              <th>Renewal Period</th>
              <th>New Expiry</th>
              <th>PVR Number</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={6} className={styles.emptyCell}>
                  Loading…
                </td>
              </tr>
            ) : renewals.length === 0 ? (
              <tr>
                <td colSpan={6} className={styles.emptyCell}>
                  No renewal requests yet.
                </td>
              </tr>
            ) : (
              renewals.map((r) => (
                <tr key={r.id}>
                  <td>
                    <div className={styles.strong}>{r.full_name}</div>
                    <div className={styles.sub}>{r.vendor_code}</div>
                  </td>
                  <td>{r.renewal_period ?? "—"}</td>
                  <td>{r.new_expiry ? new Date(r.new_expiry).toLocaleDateString() : "—"}</td>
                  <td>{r.pvr_number ?? "—"}</td>
                  <td>
                    <span
                      className={
                        r.renewals_status === "approved"
                          ? styles.statusGood
                          : r.renewals_status === "rejected"
                          ? styles.statusBad
                          : styles.statusWarn
                      }
                    >
                      {STATUS_LABELS[r.renewals_status]}
                    </span>
                  </td>
                  <td>
                    {r.renewals_status === "pending_approval" ? (
                      <div style={{ display: "flex", gap: 6 }}>
                        <button className={styles.pageBtn} onClick={() => updateStatus(r.id, "approved")}>
                          Approve
                        </button>
                        <button className={styles.pageBtn} onClick={() => updateStatus(r.id, "rejected")}>
                          Reject
                        </button>
                      </div>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        <Pagination total={total} limit={LIMIT} offset={offset} onOffsetChange={setOffset} />
      </div>

      {isFormOpen && (
        <NewRenewalModal
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

function NewRenewalModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [vendorId, setVendorId] = useState<number | "">("");
  const [renewalPeriod, setRenewalPeriod] = useState("3 Years Extension (Standard)");
  const [newExpiry, setNewExpiry] = useState("");
  const [pvrNumber, setPvrNumber] = useState("");
  const [pvrIssueDate, setPvrIssueDate] = useState("");
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    api
      .get<{ total: number; rows: Vendor[] }>("/vendors?limit=100")
      .then((res) => setVendors(res.rows))
      .catch(() => {});
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await api.post("/renewals", {
        vendor_id: vendorId,
        renewal_period: renewalPeriod,
        new_expiry: newExpiry || undefined,
        pvr_number: pvrNumber || undefined,
        pvr_issue_date: pvrIssueDate || undefined,
        renewals_status: "pending_approval",
      });
      onCreated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to submit renewal");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <form className={styles.modal} onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit}>
        <h2 className={styles.modalTitle}>Vendor ID Renewal</h2>
        <div className={styles.formGrid}>
          <Field label="Vendor" wide>
            <select
              value={vendorId}
              onChange={(e) => setVendorId(e.target.value ? Number(e.target.value) : "")}
              required
            >
              <option value="">Select vendor</option>
              {vendors.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.full_name} ({v.vendor_code})
                </option>
              ))}
            </select>
          </Field>
          <Field label="Renewal Period">
            <select value={renewalPeriod} onChange={(e) => setRenewalPeriod(e.target.value)}>
              <option>1 Year Extension</option>
              <option>3 Years Extension (Standard)</option>
              <option>5 Years Extension</option>
            </select>
          </Field>
          <Field label="New Projected Expiry">
            <input type="date" value={newExpiry} onChange={(e) => setNewExpiry(e.target.value)} required />
          </Field>
          <Field label="PVR Number">
            <input
              value={pvrNumber}
              onChange={(e) => setPvrNumber(e.target.value)}
              placeholder="e.g. PVR/KGP/2026/1029"
            />
          </Field>
          <Field label="PVR Issue Date">
            <input type="date" value={pvrIssueDate} onChange={(e) => setPvrIssueDate(e.target.value)} />
          </Field>
        </div>

        {error && <div className={styles.errorBanner}>{error}</div>}

        <div className={styles.modalActions}>
          <button type="button" className={styles.cancelBtn} onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className={styles.addBtn} disabled={isSubmitting}>
            {isSubmitting ? "Submitting…" : "Submit for Approval"}
          </button>
        </div>
      </form>
    </div>
  );
}
