import { useState, type FormEvent } from "react";
import {
  useGetRenewalsQuery,
  useCreateRenewalMutation,
  useUpdateRenewalStatusMutation,
} from "../api/renewalApi";
import { useGetVendorsLiteQuery } from "../api/mastersApi";
import { RENEWAL_TYPE_LABELS, type RenewalType, type VendorRenewal } from "../types";
import Field from "../components/ui/Field";
import Pagination from "../components/ui/Pagination";
import styles from "../styles/listPage.module.css";

const LIMIT = 10;
const ALLOWED_DOC_EXTENSIONS = [".pdf", ".jpg", ".jpeg", ".png"];
const MAX_DOC_SIZE = 5 * 1024 * 1024;

function validateDocFile(file: File): string | null {
  const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
  if (!ALLOWED_DOC_EXTENSIONS.includes(ext)) {
    return "Only PDF, JPG, and PNG files are supported.";
  }
  if (file.size > MAX_DOC_SIZE) {
    return "File is too large. Maximum size is 5MB.";
  }
  return null;
}

const STATUS_LABELS: Record<VendorRenewal["renewals_status"], string> = {
  draft: "Draft",
  pending_approval: "Pending Approval",
  approved: "Approved",
  rejected: "Rejected",
};

export default function RenewalsPage() {
  const [offset, setOffset] = useState(0);
  const [isFormOpen, setIsFormOpen] = useState(false);

  const { data: listData, isFetching: isLoading, error: loadError } = useGetRenewalsQuery({ limit: LIMIT, offset });
  const [updateRenewalStatus] = useUpdateRenewalStatusMutation();

  const renewals = listData?.rows ?? [];
  const total = listData?.total ?? 0;
  const error = loadError ? "Unable to load renewals" : null;

  async function updateStatus(id: number, status: "approved" | "rejected") {
    await updateRenewalStatus({ id, renewals_status: status }).unwrap();
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
          + Renewal
        </button>
      </div>

      {error && <div className={styles.errorBanner}>{error}</div>}

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Vendor</th>
              <th>Renewal Type</th>
              <th>Renewal Period</th>
              <th>New Expiry</th>
              <th>Reference</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={7} className={styles.emptyCell}>
                  Loading…
                </td>
              </tr>
            ) : renewals.length === 0 ? (
              <tr>
                <td colSpan={7} className={styles.emptyCell}>
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
                  <td>{RENEWAL_TYPE_LABELS[r.renewal_type] ?? "—"}</td>
                  <td>{r.renewal_period ?? "—"}</td>
                  <td>{r.new_expiry ? new Date(r.new_expiry).toLocaleDateString() : "—"}</td>
                  <td>
                    {r.renewal_type !== "medical" && (
                      <div>
                        {r.pvr_number ? `PVR: ${r.pvr_number}` : "PVR: —"}
                        {r.pvr_document ? " (doc uploaded)" : ""}
                      </div>
                    )}
                    {r.renewal_type !== "pvr" && (
                      <div className={styles.sub}>
                        {r.medical_number ? `Medical No: ${r.medical_number}` : "Medical No: —"}
                        {r.medical_fitness_doc ? " (doc uploaded)" : ""}
                      </div>
                    )}
                  </td>
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

      {isFormOpen && <NewRenewalModal onClose={() => setIsFormOpen(false)} onCreated={() => setIsFormOpen(false)} />}
    </div>
  );
}

function NewRenewalModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [vendorId, setVendorId] = useState<number | "">("");
  const [renewalPeriod, setRenewalPeriod] = useState("3 Years Extension (Standard)");
  const [renewalType, setRenewalType] = useState<RenewalType>("pvr");
  const [newExpiry, setNewExpiry] = useState("");
  const [pvrNumber, setPvrNumber] = useState("");
  const [pvrIssueDate, setPvrIssueDate] = useState("");
  const [pvrDoc, setPvrDoc] = useState<File | null>(null);
  const [medicalIssueDate, setMedicalIssueDate] = useState("");
  const [medicalNumber, setMedicalNumber] = useState("");
  const [medicalDoc, setMedicalDoc] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: vendors = [] } = useGetVendorsLiteQuery();
  const [createRenewal, { isLoading: isSubmitting }] = useCreateRenewalMutation();

  const showPvrFields = renewalType === "pvr" || renewalType === "both";
  const showMedicalFields = renewalType === "medical" || renewalType === "both";

  function handleDocChange(file: File | null, setter: (f: File | null) => void) {
    if (file) {
      const validationError = validateDocFile(file);
      if (validationError) {
        setError(validationError);
        setter(null);
        return;
      }
    }
    setError(null);
    setter(file);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await createRenewal({
        vendor_id: Number(vendorId),
        renewal_period: renewalPeriod,
        renewal_type: renewalType,
        new_expiry: newExpiry || undefined,
        pvr_number: showPvrFields ? pvrNumber || undefined : undefined,
        pvr_issue_date: showPvrFields ? pvrIssueDate || undefined : undefined,
        pvr_document: showPvrFields ? pvrDoc ?? undefined : undefined,
        medical_issue_date: showMedicalFields ? medicalIssueDate || undefined : undefined,
        medical_number: showMedicalFields ? medicalNumber || undefined : undefined,
        medical_fitness_doc: showMedicalFields ? medicalDoc ?? undefined : undefined,
        renewals_status: "pending_approval",
      }).unwrap();
      onCreated();
    } catch (err: any) {
      setError(err?.data?.message ?? err?.message ?? "Unable to submit renewal");
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
          <Field label="Renewal Type" wide>
            <select value={renewalType} onChange={(e) => setRenewalType(e.target.value as RenewalType)}>
              <option value="pvr">Police Verification Report (PVR)</option>
              <option value="medical">Medical Certificate</option>
              <option value="both">Both (PVR + Medical Certificate)</option>
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
          {showPvrFields && (
            <>
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
              <Field label="PVR Document">
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={(e) => handleDocChange(e.target.files?.[0] ?? null, setPvrDoc)}
                />
              </Field>
            </>
          )}
          {showMedicalFields && (
            <>
              <Field label="Medical Certificate No.">
                <input
                  value={medicalNumber}
                  onChange={(e) => setMedicalNumber(e.target.value)}
                  placeholder="e.g. MED/KGP/2026/1029"
                />
              </Field>
              <Field label="Medical Certificate Issue Date">
                <input
                  type="date"
                  value={medicalIssueDate}
                  onChange={(e) => setMedicalIssueDate(e.target.value)}
                />
              </Field>
              <Field label="Medical Certificate Document">
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={(e) => handleDocChange(e.target.files?.[0] ?? null, setMedicalDoc)}
                />
              </Field>
            </>
          )}
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
