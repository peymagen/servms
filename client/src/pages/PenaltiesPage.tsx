import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  useGetPenaltiesQuery,
  useGetPenaltyMetricsQuery,
  useCreatePenaltyMutation,
  useEditPenaltyMutation,
  useApprovePenaltyMutation,
  useRejectPenaltyMutation,
  useRevokePenaltyMutation,
  useUpdatePenaltyRecoveryMutation,
  useVerifyPenaltyRecoveryMutation,
  useUploadPenaltyDocumentMutation,
  useLazyGetPenaltiesQuery,
} from "../api/penaltyApi";
import {
  useGetContractorsLiteQuery,
  useGetDivisionsQuery,
  useGetVendorsLiteQuery,
  useGetComplaintsLiteQuery,
  useGetInspectionsLiteQuery,
} from "../api/mastersApi";
import type {
  Penalty,
  PenaltyApprovalStatus,
  PenaltyDocumentType,
  PenaltyRecoveryStatus,
  PenaltyReferenceType,
} from "../types";
import Field from "../components/ui/Field";
import StatCard from "../components/ui/StatCard";
import Pagination from "../components/ui/Pagination";
import styles from "../styles/listPage.module.css";

const LIMIT = 10;

const RECOVERY_ORDER: PenaltyRecoveryStatus[] = ["pending", "partially_recovered", "recovered", "closed"];

const APPROVAL_LABELS: Record<PenaltyApprovalStatus, string> = {
  pending_approval: "Pending Approval",
  approved: "Approved",
  rejected: "Rejected",
  revoked: "Revoked",
};

const RECOVERY_LABELS: Record<PenaltyRecoveryStatus, string> = {
  pending: "Pending",
  partially_recovered: "Partially Recovered",
  recovered: "Recovered",
  closed: "Closed",
};

const DOCUMENT_TYPE_LABELS: Record<PenaltyDocumentType, string> = {
  penalty_order: "Penalty Order",
  approval: "Approval Document",
  recovery_receipt: "Recovery Receipt / Proof",
  other: "Supporting Document",
};

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

const currency = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

function approvalBadgeClass(status: PenaltyApprovalStatus): string {
  if (status === "approved") return styles.statusGood;
  if (status === "pending_approval") return styles.statusWarn;
  return styles.statusBad;
}

function recoveryBadgeClass(status: PenaltyRecoveryStatus): string {
  if (status === "recovered" || status === "closed") return styles.statusGood;
  if (status === "partially_recovered") return styles.statusWarn;
  return styles.statusBad;
}

export default function PenaltiesPage() {
  const { can, user } = useAuth();
  const canApprove = can("penalty_management", "approve_reject");
  const canEdit = can("penalty_management", "edit");
  const canCreate = can("penalty_management", "create");
  // Recovery entry is Dealing-Section-exclusive server-side (super_admin_hq always
  // bypasses too) — gated separately from canEdit since Dealing Section holds no
  // generic penalty_management edit permission at all.
  const isDealingSection = user?.role_name === "dealing_section" || user?.role_name === "super_admin_hq";

  const [offset, setOffset] = useState(0);
  // Seeds initial filters from the URL once (e.g. the Dashboard's Penalty card
  // links here as `/penalties?recovery_status=pending&dueDateTo=2026-08-07&division_id=2`).
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const [approvalFilter, setApprovalFilter] = useState<PenaltyApprovalStatus | "">("");
  const [recoveryFilter, setRecoveryFilter] = useState<PenaltyRecoveryStatus | "">(
    () => (searchParams.get("recovery_status") as PenaltyRecoveryStatus | "") || ""
  );
  const [divisionFilter, setDivisionFilter] = useState<number | "">(() => {
    const raw = searchParams.get("division_id");
    return raw ? Number(raw) : "";
  });
  const [contractorFilter, setContractorFilter] = useState<number | "">("");
  const [vendorFilter, setVendorFilter] = useState<number | "">("");
  const [dueDateFrom, setDueDateFrom] = useState(() => searchParams.get("dueDateFrom") ?? "");
  const [dueDateTo, setDueDateTo] = useState(() => searchParams.get("dueDateTo") ?? "");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [viewPenalty, setViewPenalty] = useState<Penalty | null>(null);
  const [editPenaltyTarget, setEditPenaltyTarget] = useState<Penalty | null>(null);
  const [approveTarget, setApproveTarget] = useState<Penalty | null>(null);
  const [recoveryTarget, setRecoveryTarget] = useState<Penalty | null>(null);
  const [verifyTarget, setVerifyTarget] = useState<Penalty | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<Penalty | null>(null);

  const filters = useMemo(
    () => ({
      limit: LIMIT,
      offset,
      search: search || undefined,
      approval_status: approvalFilter || undefined,
      recovery_status: recoveryFilter || undefined,
      division_id: divisionFilter || undefined,
      contractor_id: contractorFilter || undefined,
      vendor_id: vendorFilter || undefined,
      due_date_from: dueDateFrom || undefined,
      due_date_to: dueDateTo || undefined,
    }),
    [offset, search, approvalFilter, recoveryFilter, divisionFilter, contractorFilter, vendorFilter, dueDateFrom, dueDateTo]
  );

  const { data: listData, isFetching } = useGetPenaltiesQuery(filters);
  const { data: metrics } = useGetPenaltyMetricsQuery();
  const { data: contractors = [] } = useGetContractorsLiteQuery();
  const { data: divisions = [] } = useGetDivisionsQuery();
  const { data: vendors = [] } = useGetVendorsLiteQuery(contractorFilter || undefined);
  const [triggerExport] = useLazyGetPenaltiesQuery();

  const [rejectPenalty, { isLoading: isRejecting }] = useRejectPenaltyMutation();

  const penalties = listData?.rows ?? [];
  const total = listData?.total ?? 0;

  async function handleExport() {
    setIsExporting(true);
    try {
      const res = await triggerExport({ ...filters, limit: 2000, offset: 0 }).unwrap();
      const headers = [
        "Ref No",
        "Reference",
        "Contractor / Vendor",
        "Unit",
        "Amount",
        "Due Date",
        "Approval Status",
        "Recovery Status",
        "Date of Receipt",
        "MR Number",
        "Order Number",
      ];
      const rows = res.rows.map((p) => [
        p.penalty_code,
        p.reference_type ? `${p.reference_type}${p.complaint_code ? `: ${p.complaint_code}` : ""}` : "",
        p.contractor_name ?? p.vendor_name ?? "",
        p.unit_name ?? "",
        p.amount,
        formatDate(p.due_date),
        APPROVAL_LABELS[p.approval_status],
        RECOVERY_LABELS[p.recovery_status],
        formatDate(p.recovery_date),
        p.mr_number ?? "",
        p.order_number ?? "",
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

  async function handleReject(id: number) {
    setError(null);
    try {
      await rejectPenalty({ id }).unwrap();
    } catch (err: any) {
      setError(err?.data?.message ?? err?.message ?? "Unable to reject penalty");
    }
  }

  return (
    <div>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Penalty Management & Recovery Ledger</h1>
          <p className={styles.subtitle}>
            Impose, approve, and track penalties from complaints or inspections through to
            recovery.
          </p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button type="button" className={styles.cancelBtn} onClick={() => setShowAdvanced((s) => !s)}>
            ⚏ {showAdvanced ? "Fewer Filters" : "Advanced Filters"}
          </button>
          <button className={styles.cancelBtn} onClick={handleExport} disabled={isExporting}>
            {isExporting ? "Exporting…" : "⬆ Export Ledger"}
          </button>
          {canCreate && (
            <button className={styles.addBtn} onClick={() => setIsFormOpen(true)} disabled={contractors.length === 0}>
              + New Penalty Order
            </button>
          )}
        </div>
      </div>

      <div className={styles.statGrid}>
        <StatCard label="Total Penalties Imposed" value={metrics ? currency.format(metrics.totalImposed) : "—"} />
        <StatCard label="Total Recovered" value={metrics ? currency.format(metrics.totalRecovered) : "—"} />
        <StatCard label="Outstanding Amount" value={metrics ? currency.format(metrics.outstandingAmount) : "—"} />
        <StatCard label="Overdue Amount" value={metrics ? currency.format(metrics.overdueAmount) : "—"} />
        <StatCard label="Recovery Rate" value={metrics ? `${metrics.recoveryRate}%` : "—"} />
      </div>

      <div className={styles.statGrid} style={{ marginTop: -4 }}>
        <StatCard label="Pending — Within 7 Days" value={metrics?.pendingCategories.within7Days ?? "—"} />
        <StatCard label="Pending — Within 14 Days" value={metrics?.pendingCategories.within14Days ?? "—"} />
        <StatCard label="Pending — Within 30 Days" value={metrics?.pendingCategories.within30Days ?? "—"} />
        <StatCard label="Pending — Over 30 Days" value={metrics?.pendingCategories.over30Days ?? "—"} />
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
          <>
            <div className={styles.filterRow}>
              <LabeledField label="Approval Status">
                <select
                  className={styles.select}
                  value={approvalFilter}
                  onChange={(e) => {
                    setOffset(0);
                    setApprovalFilter(e.target.value as PenaltyApprovalStatus | "");
                  }}
                >
                  <option value="">All</option>
                  {Object.entries(APPROVAL_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </LabeledField>
              <LabeledField label="Recovery Status">
                <select
                  className={styles.select}
                  value={recoveryFilter}
                  onChange={(e) => {
                    setOffset(0);
                    setRecoveryFilter(e.target.value as PenaltyRecoveryStatus | "");
                  }}
                >
                  <option value="">All</option>
                  {Object.entries(RECOVERY_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
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
              <LabeledField label="Contractor">
                <select
                  className={styles.select}
                  value={contractorFilter}
                  onChange={(e) => {
                    setOffset(0);
                    setContractorFilter(e.target.value ? Number(e.target.value) : "");
                    setVendorFilter("");
                  }}
                >
                  <option value="">All Contractors</option>
                  {contractors.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.company_name}
                    </option>
                  ))}
                </select>
              </LabeledField>
              <LabeledField label="Vendor">
                <select
                  className={styles.select}
                  value={vendorFilter}
                  onChange={(e) => {
                    setOffset(0);
                    setVendorFilter(e.target.value ? Number(e.target.value) : "");
                  }}
                >
                  <option value="">All Vendors</option>
                  {vendors.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.full_name}
                    </option>
                  ))}
                </select>
              </LabeledField>
            </div>
            <div className={styles.filterRow}>
              <LabeledField label="Due Date From">
                <input
                  type="date"
                  className={styles.select}
                  value={dueDateFrom}
                  onChange={(e) => {
                    setOffset(0);
                    setDueDateFrom(e.target.value);
                  }}
                />
              </LabeledField>
              <LabeledField label="Due Date To">
                <input
                  type="date"
                  className={styles.select}
                  value={dueDateTo}
                  onChange={(e) => {
                    setOffset(0);
                    setDueDateTo(e.target.value);
                  }}
                />
              </LabeledField>
            </div>
          </>
        )}
      </div>

      {error && <div className={styles.errorBanner}>{error}</div>}

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Ref No</th>
              <th>Contractor / Vendor</th>
              <th>Unit</th>
              <th>Amount</th>
              <th>Due Date</th>
              <th>Approval</th>
              <th>Recovery</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {isFetching ? (
              <tr>
                <td colSpan={8} className={styles.emptyCell}>
                  Loading…
                </td>
              </tr>
            ) : penalties.length === 0 ? (
              <tr>
                <td colSpan={8} className={styles.emptyCell}>
                  No penalties recorded.
                </td>
              </tr>
            ) : (
              penalties.map((p) => (
                <tr key={p.id}>
                  <td className={styles.strong}>{p.penalty_code}</td>
                  <td>{p.contractor_name ?? p.vendor_name ?? "—"}</td>
                  <td>{p.unit_name ?? "—"}</td>
                  <td>{currency.format(p.amount)}</td>
                  <td>{formatDate(p.due_date)}</td>
                  <td>
                    <span className={approvalBadgeClass(p.approval_status)}>
                      {APPROVAL_LABELS[p.approval_status]}
                    </span>
                  </td>
                  <td>
                    <span className={recoveryBadgeClass(p.recovery_status)}>
                      {RECOVERY_LABELS[p.recovery_status]}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                      <button type="button" className={styles.pageBtn} title="View penalty" onClick={() => setViewPenalty(p)}>
                        <EyeIcon />
                      </button>
                      {canEdit && p.approval_status !== "revoked" && (
                        <button type="button" className={styles.pageBtn} title="Edit penalty" onClick={() => setEditPenaltyTarget(p)}>
                          <EditIcon />
                        </button>
                      )}
                      {canApprove && p.approval_status === "pending_approval" && (
                        <>
                          <button
                            type="button"
                            className={styles.pageBtn}
                            title="Approve"
                            onClick={() => setApproveTarget(p)}
                          >
                            ✓
                          </button>
                          <button
                            type="button"
                            className={styles.pageBtn}
                            title="Reject"
                            disabled={isRejecting}
                            onClick={() => handleReject(p.id)}
                          >
                            ✕
                          </button>
                        </>
                      )}
                      {canApprove && p.approval_status === "approved" && (
                        <button type="button" className={styles.pageBtn} title="Revoke" onClick={() => setRevokeTarget(p)}>
                          Revoke
                        </button>
                      )}
                      {isDealingSection && p.approval_status === "approved" && p.recovery_status !== "recovered" && p.recovery_status !== "closed" && (
                        <button type="button" className={styles.pageBtn} title="Record recovery" onClick={() => setRecoveryTarget(p)}>
                          <StatusIcon />
                        </button>
                      )}
                      {isDealingSection &&
                        p.recovery_status === "recovered" &&
                        p.recovery_verification_status === "rejected" && (
                          <button type="button" className={styles.pageBtn} title="Resubmit recovery" onClick={() => setRecoveryTarget(p)}>
                            <StatusIcon />
                          </button>
                        )}
                      {canApprove && p.recovery_status === "recovered" && p.recovery_verification_status === "pending" && (
                        <button type="button" className={styles.pageBtn} title="Verify recovery documents" onClick={() => setVerifyTarget(p)}>
                          Verify
                        </button>
                      )}
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
        <NewPenaltyModal contractors={contractors} onClose={() => setIsFormOpen(false)} onCreated={() => setIsFormOpen(false)} />
      )}

      {viewPenalty && <ViewPenaltyModal penalty={viewPenalty} onClose={() => setViewPenalty(null)} />}

      {editPenaltyTarget && (
        <EditPenaltyModal penalty={editPenaltyTarget} onClose={() => setEditPenaltyTarget(null)} />
      )}

      {approveTarget && (
        <ApproveModal penalty={approveTarget} onClose={() => setApproveTarget(null)} />
      )}

      {recoveryTarget && (
        <RecoveryModal penalty={recoveryTarget} onClose={() => setRecoveryTarget(null)} />
      )}

      {verifyTarget && (
        <VerifyRecoveryModal penalty={verifyTarget} onClose={() => setVerifyTarget(null)} />
      )}

      {revokeTarget && <RevokeModal penalty={revokeTarget} onClose={() => setRevokeTarget(null)} />}
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

function ViewPenaltyModal({ penalty, onClose }: { penalty: Penalty; onClose: () => void }) {
  const { can, user } = useAuth();
  const canUpload = can("penalty_management", "approve_reject") || user?.role_name === "dealing_section";
  const [uploadDocument, { isLoading: isUploading }] = useUploadPenaltyDocumentMutation();
  const [docType, setDocType] = useState<PenaltyDocumentType>("penalty_order");
  const [uploadError, setUploadError] = useState<string | null>(null);

  async function handleUpload(file: File | null) {
    if (!file) return;
    setUploadError(null);
    try {
      await uploadDocument({ id: penalty.id, file, documentType: docType }).unwrap();
    } catch (err: any) {
      setUploadError(err?.data?.message ?? err?.message ?? "Unable to upload document");
    }
  }

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <h2 className={styles.modalTitle}>{penalty.penalty_code}</h2>
        <div className={styles.formGrid}>
          <DetailItem label="Contractor / Vendor" value={penalty.contractor_name ?? penalty.vendor_name ?? "—"} />
          <DetailItem label="Unit / Location" value={penalty.unit_name ?? "—"} />
          <DetailItem
            label="Reference"
            value={
              penalty.reference_type === "complaint"
                ? `Complaint ${penalty.complaint_code ?? ""}`
                : penalty.reference_type === "inspection"
                ? `Inspection on ${formatDate(penalty.inspection_date)}`
                : "—"
            }
          />
          <DetailItem label="Amount" value={currency.format(penalty.amount)} />
          <DetailItem label="Date Raised" value={formatDate(penalty.issued_date)} />
          <DetailItem label="Due Date" value={formatDate(penalty.due_date)} />
          <DetailItem label="Approval Status" value={APPROVAL_LABELS[penalty.approval_status]} />
          <DetailItem label="Approved By" value={penalty.approved_by_name ?? "—"} />
          <DetailItem label="Penalty Imposition Date" value={formatDate(penalty.approved_at)} />
          <DetailItem label="Recovery Status" value={RECOVERY_LABELS[penalty.recovery_status]} />
          <DetailItem label="Recovery Amount" value={currency.format(penalty.recovery_amount)} />
          <DetailItem label="Date of Receipt" value={formatDate(penalty.recovery_date)} />
          <DetailItem label="Payment Reference" value={penalty.payment_reference ?? "—"} />
          <DetailItem
            label="Document Verification"
            value={
              penalty.recovery_verification_status === "not_applicable"
                ? "—"
                : `${penalty.recovery_verification_status[0]!.toUpperCase()}${penalty.recovery_verification_status.slice(1)}${
                    penalty.recovery_verified_by_name ? ` by ${penalty.recovery_verified_by_name}` : ""
                  }`
            }
          />
          <DetailItem label="MR Number / Date" value={`${penalty.mr_number ?? "—"} / ${formatDate(penalty.mr_date)}`} />
          <DetailItem label="Order Number / Date" value={`${penalty.order_number ?? "—"} / ${formatDate(penalty.order_date)}`} />
          {penalty.approval_status === "revoked" && (
            <DetailItem label="Revoke Reason" value={penalty.revoke_reason ?? "—"} />
          )}
          <div className={styles.fieldWide}>
            <div className={styles.fieldLabel}>Reason</div>
            <div className={styles.strong}>{penalty.reason}</div>
          </div>
          {penalty.remarks && (
            <div className={styles.fieldWide}>
              <div className={styles.fieldLabel}>Remarks</div>
              <div className={styles.strong}>{penalty.remarks}</div>
            </div>
          )}
        </div>

        <div style={{ marginTop: 18, borderTop: "1px solid var(--color-border)", paddingTop: 14 }}>
          <div className={styles.fieldLabel} style={{ marginBottom: 8 }}>Documents</div>
          {penalty.documents && penalty.documents.length > 0 ? (
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {penalty.documents.map((doc) => (
                <li key={doc.id} style={{ marginBottom: 4 }}>
                  <a href={doc.document_path} target="_blank" rel="noreferrer">
                    {doc.original_name ?? doc.document_path}
                  </a>{" "}
                  <span className={styles.sub}>
                    ({DOCUMENT_TYPE_LABELS[doc.document_type]}
                    {doc.uploaded_by_name ? ` — ${doc.uploaded_by_name}` : ""}, {formatDate(doc.uploaded_at)})
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <div className={styles.sub}>No documents uploaded yet.</div>
          )}

          {canUpload && (
            <div style={{ display: "flex", gap: 8, marginTop: 10, alignItems: "center", flexWrap: "wrap" }}>
              <select
                className={styles.select}
                value={docType}
                onChange={(e) => setDocType(e.target.value as PenaltyDocumentType)}
              >
                {Object.entries(DOCUMENT_TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              <label className={styles.pageBtn} style={{ cursor: isUploading ? "not-allowed" : "pointer" }}>
                {isUploading ? "Uploading…" : "Upload"}
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  hidden
                  disabled={isUploading}
                  onChange={(e) => handleUpload(e.target.files?.[0] ?? null)}
                />
              </label>
            </div>
          )}
          {uploadError && <div className={styles.errorBanner} style={{ marginTop: 8 }}>{uploadError}</div>}
        </div>

        <div className={styles.modalActions}>
          <button className={styles.cancelBtn} onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function ApproveModal({ penalty, onClose }: { penalty: Penalty; onClose: () => void }) {
  const [approvePenalty, { isLoading: isSubmitting }] = useApprovePenaltyMutation();
  const [dueDate, setDueDate] = useState(penalty.due_date?.slice(0, 10) ?? "");
  const [orderNumber, setOrderNumber] = useState(penalty.order_number ?? "");
  const [orderDate, setOrderDate] = useState(penalty.order_date?.slice(0, 10) ?? "");
  const [remarks, setRemarks] = useState(penalty.remarks ?? "");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await approvePenalty({
        id: penalty.id,
        data: {
          due_date: dueDate || undefined,
          order_number: orderNumber || undefined,
          order_date: orderDate || undefined,
          remarks: remarks || undefined,
        },
      }).unwrap();
      onClose();
    } catch (err: any) {
      setError(err?.data?.message ?? err?.message ?? "Unable to approve penalty");
    }
  }

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <form className={styles.modal} onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit}>
        <h2 className={styles.modalTitle}>Approve {penalty.penalty_code}</h2>
        <p className={styles.sub}>Confirm the recovery due date and penalty order details at the moment of imposition.</p>
        <div className={styles.formGrid}>
          <Field label="Recovery Due Date">
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </Field>
          <Field label="Penalty Order Number">
            <input value={orderNumber} onChange={(e) => setOrderNumber(e.target.value)} />
          </Field>
          <Field label="Order Date">
            <input type="date" value={orderDate} onChange={(e) => setOrderDate(e.target.value)} />
          </Field>
          <div className={styles.fieldWide}>
            <Field label="Remarks">
              <textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} />
            </Field>
          </div>
        </div>
        {error && <div className={styles.errorBanner}>{error}</div>}
        <div className={styles.modalActions}>
          <button type="button" className={styles.cancelBtn} onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className={styles.addBtn} disabled={isSubmitting}>
            {isSubmitting ? "Approving…" : "Approve Penalty"}
          </button>
        </div>
      </form>
    </div>
  );
}

function VerifyRecoveryModal({ penalty, onClose }: { penalty: Penalty; onClose: () => void }) {
  const [verifyRecovery, { isLoading: isSubmitting }] = useVerifyPenaltyRecoveryMutation();
  const [remarks, setRemarks] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleDecision(decision: "verified" | "rejected") {
    setError(null);
    try {
      await verifyRecovery({ id: penalty.id, data: { decision, remarks: remarks || undefined } }).unwrap();
      onClose();
    } catch (err: any) {
      setError(err?.data?.message ?? err?.message ?? "Unable to record verification decision");
    }
  }

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <h2 className={styles.modalTitle}>Verify Recovery — {penalty.penalty_code}</h2>
        <div className={styles.formGrid}>
          <DetailItem label="Recovery Amount" value={currency.format(penalty.recovery_amount)} />
          <DetailItem label="Date of Receipt" value={formatDate(penalty.recovery_date)} />
          <DetailItem label="Payment Reference" value={penalty.payment_reference ?? "—"} />
        </div>
        <div className={styles.fieldWide} style={{ marginTop: 10 }}>
          <div className={styles.fieldLabel} style={{ marginBottom: 8 }}>Recovery Documents</div>
          {penalty.documents?.filter((d) => d.document_type === "recovery_receipt").length ? (
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {penalty.documents
                .filter((d) => d.document_type === "recovery_receipt")
                .map((doc) => (
                  <li key={doc.id}>
                    <a href={doc.document_path} target="_blank" rel="noreferrer">
                      {doc.original_name ?? doc.document_path}
                    </a>
                  </li>
                ))}
            </ul>
          ) : (
            <div className={styles.sub}>No recovery-proof documents uploaded — verify with caution.</div>
          )}
        </div>
        <div className={styles.fieldWide} style={{ marginTop: 10 }}>
          <Field label="Remarks (optional)">
            <textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} />
          </Field>
        </div>
        {error && <div className={styles.errorBanner}>{error}</div>}
        <div className={styles.modalActions}>
          <button type="button" className={styles.cancelBtn} onClick={onClose}>
            Cancel
          </button>
          <button type="button" className={styles.pageBtn} disabled={isSubmitting} onClick={() => handleDecision("rejected")}>
            Reject
          </button>
          <button type="button" className={styles.addBtn} disabled={isSubmitting} onClick={() => handleDecision("verified")}>
            {isSubmitting ? "Saving…" : "Verify & Close"}
          </button>
        </div>
      </div>
    </div>
  );
}

function NewPenaltyModal({
  contractors,
  onClose,
  onCreated,
}: {
  contractors: { id: number; company_name: string }[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [createPenalty, { isLoading: isSubmitting }] = useCreatePenaltyMutation();
  const [referenceType, setReferenceType] = useState<PenaltyReferenceType | "">("");
  const [complaintId, setComplaintId] = useState<number | "">("");
  const [inspectionId, setInspectionId] = useState<number | "">("");
  const [contractorId, setContractorId] = useState<number | "">("");
  const [vendorId, setVendorId] = useState<number | "">("");
  const [unitId, setUnitId] = useState("");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [error, setError] = useState<string | null>(null);

  const { data: vendors = [] } = useGetVendorsLiteQuery(contractorId || undefined);
  const { data: complaints = [] } = useGetComplaintsLiteQuery(undefined, { skip: referenceType !== "complaint" });
  const { data: inspections = [] } = useGetInspectionsLiteQuery(undefined, { skip: referenceType !== "inspection" });

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await createPenalty({
        reference_type: referenceType || undefined,
        complaint_id: referenceType === "complaint" && complaintId ? Number(complaintId) : undefined,
        inspection_id: referenceType === "inspection" && inspectionId ? Number(inspectionId) : undefined,
        contractor_id: Number(contractorId),
        vendor_id: vendorId ? Number(vendorId) : undefined,
        unit_id: unitId ? Number(unitId) : undefined,
        amount: Number(amount),
        reason,
        due_date: dueDate || undefined,
      }).unwrap();
      onCreated();
    } catch (err: any) {
      setError(err?.data?.message ?? err?.message ?? "Unable to create penalty");
    }
  }

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <form className={styles.modal} onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit}>
        <h2 className={styles.modalTitle}>New Penalty Order</h2>
        <div className={styles.formGrid}>
          <Field label="Origin (optional)">
            <select
              value={referenceType}
              onChange={(e) => setReferenceType(e.target.value as PenaltyReferenceType | "")}
            >
              <option value="">None</option>
              <option value="complaint">Complaint</option>
              <option value="inspection">Inspection</option>
            </select>
          </Field>
          {referenceType === "complaint" && (
            <Field label="Complaint">
              <select value={complaintId} onChange={(e) => setComplaintId(e.target.value ? Number(e.target.value) : "")}>
                <option value="">Select complaint</option>
                {complaints.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.complaint_code}
                  </option>
                ))}
              </select>
            </Field>
          )}
          {referenceType === "inspection" && (
            <Field label="Inspection">
              <select value={inspectionId} onChange={(e) => setInspectionId(e.target.value ? Number(e.target.value) : "")}>
                <option value="">Select inspection</option>
                {inspections.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.unit_name ?? `Unit #${i.unit_id}`} — {formatDate(i.inspection_date)}
                  </option>
                ))}
              </select>
            </Field>
          )}
          <Field label="Contractor">
            <select
              value={contractorId}
              onChange={(e) => {
                setContractorId(e.target.value ? Number(e.target.value) : "");
                setVendorId("");
              }}
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
          <Field label="Vendor (optional)">
            <select value={vendorId} onChange={(e) => setVendorId(e.target.value ? Number(e.target.value) : "")}>
              <option value="">None</option>
              {vendors.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.full_name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Unit ID (optional)">
            <input type="number" value={unitId} onChange={(e) => setUnitId(e.target.value)} />
          </Field>
          <Field label="Amount (₹)">
            <input type="number" min="1" value={amount} onChange={(e) => setAmount(e.target.value)} required />
          </Field>
          <Field label="Due Date">
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </Field>
          <div className={styles.fieldWide}>
            <Field label="Reason">
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Insects found in food preparation area."
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

function EditPenaltyModal({ penalty, onClose }: { penalty: Penalty; onClose: () => void }) {
  const [editPenalty, { isLoading: isSubmitting }] = useEditPenaltyMutation();
  const [amount, setAmount] = useState(String(penalty.amount));
  const [reason, setReason] = useState(penalty.reason);
  const [dueDate, setDueDate] = useState(penalty.due_date?.slice(0, 10) ?? "");
  const [remarks, setRemarks] = useState(penalty.remarks ?? "");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    setError(null);
    try {
      await editPenalty({
        id: penalty.id,
        data: { amount: Number(amount), reason, due_date: dueDate || undefined, remarks: remarks || undefined },
      }).unwrap();
      onClose();
    } catch (err: any) {
      setError(err?.data?.message ?? err?.message ?? "Unable to update penalty");
    }
  }

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <h2 className={styles.modalTitle}>Edit {penalty.penalty_code}</h2>
        <div className={styles.formGrid}>
          <Field label="Amount (₹)">
            <input type="number" min="1" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </Field>
          <Field label="Due Date">
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </Field>
          <div className={styles.fieldWide}>
            <Field label="Reason">
              <textarea value={reason} onChange={(e) => setReason(e.target.value)} />
            </Field>
          </div>
          <div className={styles.fieldWide}>
            <Field label="Remarks">
              <textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} />
            </Field>
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

function RecoveryModal({ penalty, onClose }: { penalty: Penalty; onClose: () => void }) {
  const [updateRecovery, { isLoading: isSubmitting }] = useUpdatePenaltyRecoveryMutation();
  const [uploadDocument, { isLoading: isUploading }] = useUploadPenaltyDocumentMutation();
  // "closed" is never a Dealing Section option — recovery entry can only reach
  // "recovered"; an Admin/Divisional Admin verifies it to "closed" separately.
  const currentIndex = RECOVERY_ORDER.indexOf(penalty.recovery_status);
  const availableStatuses = RECOVERY_ORDER.slice(currentIndex, RECOVERY_ORDER.indexOf("recovered") + 1);

  const [recoveryStatus, setRecoveryStatus] = useState<Exclude<PenaltyRecoveryStatus, "closed">>(
    (availableStatuses[availableStatuses.length > 1 ? 1 : 0] ?? penalty.recovery_status) as Exclude<PenaltyRecoveryStatus, "closed">
  );
  const [recoveryAmount, setRecoveryAmount] = useState(String(penalty.recovery_amount || ""));
  const [recoveryDate, setRecoveryDate] = useState("");
  const [paymentReference, setPaymentReference] = useState(penalty.payment_reference ?? "");
  const [mrNumber, setMrNumber] = useState(penalty.mr_number ?? "");
  const [mrDate, setMrDate] = useState(penalty.mr_date?.slice(0, 10) ?? "");
  const [remarks, setRemarks] = useState(penalty.remarks ?? "");
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await updateRecovery({
        id: penalty.id,
        data: {
          recovery_status: recoveryStatus,
          recovery_amount: recoveryAmount ? Number(recoveryAmount) : undefined,
          recovery_date: recoveryDate || undefined,
          payment_reference: paymentReference || undefined,
          mr_number: mrNumber || undefined,
          mr_date: mrDate || undefined,
          remarks: remarks || undefined,
        },
      }).unwrap();
      if (receiptFile) {
        await uploadDocument({ id: penalty.id, file: receiptFile, documentType: "recovery_receipt" }).unwrap();
      }
      onClose();
    } catch (err: any) {
      setError(err?.data?.message ?? err?.message ?? "Unable to update recovery status");
    }
  }

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <form className={styles.modal} onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit}>
        <h2 className={styles.modalTitle}>Record Recovery — {penalty.penalty_code}</h2>
        <div className={styles.formGrid}>
          <Field label="Recovery Status">
            <select value={recoveryStatus} onChange={(e) => setRecoveryStatus(e.target.value as Exclude<PenaltyRecoveryStatus, "closed">)}>
              {availableStatuses.map((s) => (
                <option key={s} value={s}>
                  {RECOVERY_LABELS[s]}
                </option>
              ))}
            </select>
          </Field>
          <Field label={`Recovery Amount (of ₹${penalty.amount})`}>
            <input
              type="number"
              min="0"
              max={penalty.amount}
              value={recoveryAmount}
              onChange={(e) => setRecoveryAmount(e.target.value)}
            />
          </Field>
          <Field label="Date of Receipt">
            <input type="date" value={recoveryDate} onChange={(e) => setRecoveryDate(e.target.value)} />
          </Field>
          <Field label="Payment Reference Details">
            <input
              value={paymentReference}
              onChange={(e) => setPaymentReference(e.target.value)}
              placeholder="e.g. UTR/Cheque/Challan number"
            />
          </Field>
          <Field label="MR Number">
            <input value={mrNumber} onChange={(e) => setMrNumber(e.target.value)} />
          </Field>
          <Field label="MR Date">
            <input type="date" value={mrDate} onChange={(e) => setMrDate(e.target.value)} />
          </Field>
          <Field label="Payment Receipt / Recovery Proof">
            <input
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={(e) => setReceiptFile(e.target.files?.[0] ?? null)}
            />
          </Field>
          <div className={styles.fieldWide}>
            <Field label="Remarks">
              <textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} />
            </Field>
          </div>
        </div>
        {error && <div className={styles.errorBanner}>{error}</div>}
        <div className={styles.modalActions}>
          <button type="button" className={styles.cancelBtn} onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className={styles.addBtn} disabled={isSubmitting || isUploading}>
            {isSubmitting || isUploading ? "Saving…" : "Save Recovery Entry"}
          </button>
        </div>
      </form>
    </div>
  );
}

function RevokeModal({ penalty, onClose }: { penalty: Penalty; onClose: () => void }) {
  const [revokePenalty, { isLoading: isSubmitting }] = useRevokePenaltyMutation();
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await revokePenalty({ id: penalty.id, reason }).unwrap();
      onClose();
    } catch (err: any) {
      setError(err?.data?.message ?? err?.message ?? "Unable to revoke penalty");
    }
  }

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <form className={styles.modal} onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit}>
        <h2 className={styles.modalTitle}>Revoke {penalty.penalty_code}</h2>
        <div className={styles.formGrid}>
          <div className={styles.fieldWide}>
            <Field label="Revocation Reason">
              <textarea value={reason} onChange={(e) => setReason(e.target.value)} required />
            </Field>
          </div>
        </div>
        {error && <div className={styles.errorBanner}>{error}</div>}
        <div className={styles.modalActions}>
          <button type="button" className={styles.cancelBtn} onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className={styles.addBtn} disabled={isSubmitting}>
            {isSubmitting ? "Revoking…" : "Revoke Penalty"}
          </button>
        </div>
      </form>
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
      <path d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17v3Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}

function StatusIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
      <path d="M8 12.5l2.5 2.5L16 9.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
