import { useMemo, useState, type ReactNode } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ASSET_BASE } from "../store/apiSlice";
import { useAuth } from "../context/AuthContext";
import {
  useGetVendorsQuery,
  useGetVendorMetricsQuery,
  useLazyGetVendorsQuery,
  useTransferVendorUnitMutation,
  useTransferVendorContractorMutation,
  useUpdatePoliceVerificationMutation,
  useUpdateMedicalVerificationMutation,
  useChangeVendorStatusMutation,
  useGetVendorDocumentsQuery,
  useUploadVendorDocumentMutation,
} from "../api/vendorApi";
import { useGetContractorsLiteQuery, useGetDivisionsQuery, useGetUnitsLiteQuery } from "../api/mastersApi";
import { VENDOR_TYPE_LABELS, type Vendor, type VendorDocument, type VendorDocumentType, type VerificationStatus } from "../types";
import StatCard from "../components/ui/StatCard";
import Pagination from "../components/ui/Pagination";
import styles from "../styles/listPage.module.css";

const LIMIT = 10;
const ALLOWED_DOC_EXTENSIONS = [".pdf", ".jpg", ".jpeg", ".png"];
const MAX_DOC_SIZE = 5 * 1024 * 1024;

const DOCUMENT_TYPES: { type: VendorDocumentType; label: string }[] = [
  { type: "AADHAAR", label: "Aadhaar Document" },
  { type: "MEDICAL", label: "Medical Verification Document" },
  { type: "POLICE_VERIFICATION", label: "Police Verification Document" },
];

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

function statusClass(status: VerificationStatus): string {
  if (status === "verified") return styles.statusGood;
  if (status === "pending") return styles.statusWarn;
  return styles.statusBad;
}

function statusLabel(status: VerificationStatus): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export default function VendorManagementPage() {
  const navigate = useNavigate();
  const { can } = useAuth();
  const canEdit = can("vendor_management", "edit");
  const canApprove = can("vendor_management", "approve_reject");
  const [changeVendorStatus] = useChangeVendorStatusMutation();
  const [offset, setOffset] = useState(0);
  // Seeds initial filters from the URL once (e.g. the Dashboard's Registered
  // Vendors card links here as `/vendors?status=blacklisted&division_id=2`).
  const [searchParams] = useSearchParams();

  const [search, setSearch] = useState("");
  const [divisionFilter, setDivisionFilter] = useState<number | "">(() => {
    const raw = searchParams.get("division_id");
    return raw ? Number(raw) : "";
  });
  const [validityFilter, setValidityFilter] = useState(() => searchParams.get("status") ?? "");
  const [unitFilter, setUnitFilter] = useState<number | "">("");
  const [showMoreFilters, setShowMoreFilters] = useState(false);

  const [viewVendor, setViewVendor] = useState<Vendor | null>(null);
  const [docsVendor, setDocsVendor] = useState<Vendor | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const filters = useMemo(
    () => ({
      limit: LIMIT,
      offset,
      search: search || undefined,
      division_id: divisionFilter || undefined,
      unit_id: unitFilter || undefined,
      status: validityFilter || undefined,
    }),
    [offset, search, divisionFilter, unitFilter, validityFilter]
  );

  const { data: listData, isFetching: isLoading, error: loadError } = useGetVendorsQuery(filters);
  const { data: metrics } = useGetVendorMetricsQuery();
  const { data: divisions = [] } = useGetDivisionsQuery();
  const { data: units = [] } = useGetUnitsLiteQuery();
  const [triggerExport] = useLazyGetVendorsQuery();

  const vendors = listData?.rows ?? [];
  const total = listData?.total ?? 0;
  const error = loadError ? "Unable to load vendors" : null;

  const filteredUnits = useMemo(
    () => (divisionFilter ? units.filter((u) => u.division_id === divisionFilter) : units),
    [units, divisionFilter]
  );

  // Live view/document modals re-render automatically once RTK Query invalidates the
  // relevant tags after a mutation — reopen from the freshest `vendors` row by id.
  const liveViewVendor = viewVendor ? vendors.find((v) => v.id === viewVendor.id) ?? viewVendor : null;
  const liveDocsVendor = docsVendor ? vendors.find((v) => v.id === docsVendor.id) ?? docsVendor : null;

  async function handleExport() {
    setIsExporting(true);
    setExportError(null);
    try {
      const res = await triggerExport({ ...filters, limit: 2000, offset: 0 }).unwrap();
      const headers = [
        "Vendor ID",
        "Vendor Name",
        "Contractor Entity",
        "Unit",
        "Division",
        "Police Verification",
        "Medical Verification",
        "Validity End",
        "Status",
      ];
      const rows = res.rows.map((v) => [
        v.vendor_code,
        v.full_name,
        v.contractor_name ?? "",
        v.unit_name ?? "",
        v.division_name ?? "",
        statusLabel(v.police_verification_status),
        statusLabel(v.medical_verification_status),
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
      setExportError("Unable to export vendors");
    } finally {
      setIsExporting(false);
    }
  }

  async function handleStatusChange(vendorId: number, vendor_status: Vendor["vendor_status"]) {
    if (vendor_status === "blacklisted" && !window.confirm("Blacklist this vendor? This should only be done for serious violations.")) {
      return;
    }
    try {
      await changeVendorStatus({ id: vendorId, vendor_status }).unwrap();
    } catch {
      window.alert("Unable to update vendor status");
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
              <option value="blacklisted">Blacklisted</option>
              {/* "inactive" is the Dashboard's rollup of pending/expired (see
                  vendor.service.ts's getVendors), not a real vendor_status value. */}
              <option value="inactive">Inactive (Non-Active)</option>
            </select>
          </LabeledField>
        </div>

        <div className={styles.filterRow}>
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

      {(error || exportError) && <div className={styles.errorBanner}>{error || exportError}</div>}

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Vendor ID</th>
              <th>Vendor Name</th>
              <th>Contractor Entity</th>
              <th>Unit</th>
              <th>Verification</th>
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
            ) : vendors.length === 0 ? (
              <tr>
                <td colSpan={6} className={styles.emptyCell}>
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
                    <div className={statusClass(v.police_verification_status)}>
                      Police: {statusLabel(v.police_verification_status)}
                    </div>
                    <div className={statusClass(v.medical_verification_status)}>
                      Medical: {statusLabel(v.medical_verification_status)}
                    </div>
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
                      {canEdit && (
                        <button
                          type="button"
                          className={styles.pageBtn}
                          title="Edit vendor"
                          onClick={() => navigate(`/vendors/${v.id}/edit`)}
                        >
                          <PencilIcon />
                        </button>
                      )}
                      <button
                        type="button"
                        className={styles.pageBtn}
                        title="View Documents"
                        onClick={() => setDocsVendor(v)}
                      >
                        <FolderIcon />
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
        <StatCard label="Police Verified" value={metrics?.policeVerified ?? "—"} />
        <StatCard label="Expired Medicals" value={metrics?.expiredMedicals ?? "—"} />
        <StatCard label="Expired PVR" value={metrics?.expiredPvr ?? "—"} />
        <StatCard label="Expiring Soon (30 days)" value={metrics?.expiringSoon ?? "—"} />
        <StatCard label="Awaiting Approval" value={metrics?.awaitingApproval ?? "—"} />
      </div>

      {liveViewVendor && (
        <VendorDetailModal
          vendor={liveViewVendor}
          canEdit={canEdit}
          canApprove={canApprove}
          onStatusChange={handleStatusChange}
          onClose={() => setViewVendor(null)}
        />
      )}

      {liveDocsVendor && <VendorDocumentsModal vendor={liveDocsVendor} onClose={() => setDocsVendor(null)} />}
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

// ─── VENDOR DETAIL + VERIFICATION MODAL ─────────────────────────────────────────
function VendorDetailModal({
  vendor,
  canEdit,
  canApprove,
  onStatusChange,
  onClose,
}: {
  vendor: Vendor;
  canEdit: boolean;
  canApprove: boolean;
  onStatusChange: (vendorId: number, status: Vendor["vendor_status"]) => void;
  onClose: () => void;
}) {
  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} style={{ maxWidth: 760 }} onClick={(e) => e.stopPropagation()}>
        <h2 className={styles.modalTitle}>{vendor.full_name}</h2>
        <div className={styles.formGrid}>
          <DetailItem label="Vendor Code" value={vendor.vendor_code} />
          <DetailItem label="Vendor Type" value={VENDOR_TYPE_LABELS[vendor.vendor_type]} />
          <DetailItem label="Mobile" value={vendor.mobile_number ?? "—"} />
          <DetailItem label="Blood Group" value={vendor.blood_group ?? "—"} />
          <DetailItem label="Address" value={vendor.address ?? "—"} />
          <DetailItem label="Contractor" value={vendor.contractor_name ?? "—"} />
          <DetailItem label="Division" value={vendor.division_name ?? "—"} />
          <DetailItem label="Station" value={vendor.station_name ?? "—"} />
          <DetailItem label="Unit" value={vendor.unit_name ?? "—"} />
          <DetailItem
            label="Validity"
            value={
              vendor.validity_start && vendor.validity_end
                ? `${new Date(vendor.validity_start).toLocaleDateString()} — ${new Date(
                    vendor.validity_end
                  ).toLocaleDateString()}`
                : "—"
            }
          />
          {canApprove ? (
            <div>
              <div className={styles.fieldLabel}>Status</div>
              <select
                className={styles.select}
                value={vendor.vendor_status}
                onChange={(e) => onStatusChange(vendor.id, e.target.value as Vendor["vendor_status"])}
              >
                <option value="active">Active</option>
                <option value="pending">Pending</option>
                <option value="expired">Expired</option>
                <option value="blacklisted">Blacklisted</option>
              </select>
            </div>
          ) : (
            <DetailItem label="Status" value={vendor.vendor_status} />
          )}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 22 }}>
          <VerificationCard
            title="Police Verification"
            vendorId={vendor.id}
            kind="police"
            status={vendor.police_verification_status}
            number={vendor.police_verification_number}
            issueDate={vendor.police_verification_issue_date}
            validTill={vendor.police_verification_valid_till}
            remarks={vendor.police_verification_remarks}
            document={vendor.police_verification_document}
          />
          <VerificationCard
            title="Medical Verification"
            vendorId={vendor.id}
            kind="medical"
            status={vendor.medical_verification_status}
            number={vendor.medical_verification_number}
            issueDate={vendor.medical_verification_issue_date}
            validTill={vendor.medical_verification_valid_till}
            remarks={vendor.medical_verification_remarks}
            document={vendor.medical_verification_document}
          />
        </div>

        {canEdit && <TransferSection vendor={vendor} />}

        <div className={styles.modalActions}>
          <button className={styles.cancelBtn} onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function TransferSection({ vendor }: { vendor: Vendor }) {
  const { data: contractors = [] } = useGetContractorsLiteQuery();
  const { data: units = [] } = useGetUnitsLiteQuery();
  const [transferUnit, { isLoading: isTransferringUnit }] = useTransferVendorUnitMutation();
  const [transferContractor, { isLoading: isTransferringContractor }] = useTransferVendorContractorMutation();
  const [targetUnitId, setTargetUnitId] = useState<number | "">("");
  const [targetContractorId, setTargetContractorId] = useState<number | "">("");
  const [error, setError] = useState<string | null>(null);

  async function handleUnitTransfer() {
    if (!targetUnitId) return;
    setError(null);
    try {
      await transferUnit({ id: vendor.id, unit_id: Number(targetUnitId) }).unwrap();
      setTargetUnitId("");
    } catch (err: any) {
      setError(err?.data?.message ?? err?.message ?? "Unable to transfer unit");
    }
  }

  async function handleContractorTransfer() {
    if (!targetContractorId) return;
    setError(null);
    try {
      await transferContractor({ id: vendor.id, contractor_id: Number(targetContractorId) }).unwrap();
      setTargetContractorId("");
    } catch (err: any) {
      setError(err?.data?.message ?? err?.message ?? "Unable to transfer contractor");
    }
  }

  return (
    <div style={{ marginTop: 22, border: "1px solid var(--color-border)", borderRadius: "var(--radius-lg)", padding: 16 }}>
      <h3 style={{ margin: "0 0 12px", fontSize: 14 }}>Transfer</h3>
      {error && <div className={styles.errorBanner}>{error}</div>}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div>
          <div className={styles.fieldLabel}>Transfer to Unit</div>
          <div style={{ display: "flex", gap: 8 }}>
            <select value={targetUnitId} onChange={(e) => setTargetUnitId(e.target.value ? Number(e.target.value) : "")}>
              <option value="">Select unit…</option>
              {units.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.unit_name}
                </option>
              ))}
            </select>
            <button
              type="button"
              className={styles.pageBtn}
              disabled={!targetUnitId || isTransferringUnit}
              onClick={handleUnitTransfer}
            >
              Transfer
            </button>
          </div>
        </div>
        <div>
          <div className={styles.fieldLabel}>Transfer to Contractor</div>
          <div style={{ display: "flex", gap: 8 }}>
            <select
              value={targetContractorId}
              onChange={(e) => setTargetContractorId(e.target.value ? Number(e.target.value) : "")}
            >
              <option value="">Select contractor…</option>
              {contractors.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.company_name}
                </option>
              ))}
            </select>
            <button
              type="button"
              className={styles.pageBtn}
              disabled={!targetContractorId || isTransferringContractor}
              onClick={handleContractorTransfer}
            >
              Transfer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function VerificationCard({
  title,
  vendorId,
  kind,
  status,
  number,
  issueDate,
  validTill,
  remarks,
  document,
}: {
  title: string;
  vendorId: number;
  kind: "police" | "medical";
  status: VerificationStatus;
  number: string | null;
  issueDate: string | null;
  validTill: string | null;
  remarks: string | null;
  document: string | null;
}) {
  const [updatePolice, { isLoading: isSavingPolice }] = useUpdatePoliceVerificationMutation();
  const [updateMedical, { isLoading: isSavingMedical }] = useUpdateMedicalVerificationMutation();
  const saving = kind === "police" ? isSavingPolice : isSavingMedical;
  const numberLabel = kind === "police" ? "Police Verification Number" : "Medical Fitness Certificate Number";

  const [editing, setEditing] = useState(false);
  const [formStatus, setFormStatus] = useState<VerificationStatus>(status);
  const [formNumber, setFormNumber] = useState(number ?? "");
  const [formIssueDate, setFormIssueDate] = useState(issueDate ?? "");
  const [formValidTill, setFormValidTill] = useState(validTill ?? "");
  const [formRemarks, setFormRemarks] = useState(remarks ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  function startEdit() {
    setFormStatus(status);
    setFormNumber(number ?? "");
    setFormIssueDate(issueDate ?? "");
    setFormValidTill(validTill ?? "");
    setFormRemarks(remarks ?? "");
    setFile(null);
    setError(null);
    setEditing(true);
  }

  async function save() {
    setError(null);
    if (!formNumber.trim()) {
      setError(`${numberLabel} is required.`);
      return;
    }
    if (formValidTill && formIssueDate && formValidTill < formIssueDate) {
      setError("Valid till date cannot be before the issue date.");
      return;
    }
    if (file) {
      const docError = validateDocFile(file);
      if (docError) {
        setError(docError);
        return;
      }
    }
    try {
      const mutation = kind === "police" ? updatePolice : updateMedical;
      await mutation({
        id: vendorId,
        status: formStatus,
        number: formNumber,
        issue_date: formIssueDate || undefined,
        valid_till: formValidTill || undefined,
        remarks: formRemarks,
        document: file ?? undefined,
      }).unwrap();
      setEditing(false);
    } catch (err: any) {
      setError(err?.data?.message ?? err?.message ?? "Unable to update verification");
    }
  }

  return (
    <section
      style={{
        border: "1px solid var(--color-border)",
        borderRadius: "var(--radius-lg)",
        padding: 16,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <h3 style={{ margin: 0, fontSize: 14 }}>{title}</h3>
        <span className={statusClass(status)}>{statusLabel(status)}</span>
      </div>

      {!editing ? (
        <>
          <div className={styles.formGrid} style={{ gridTemplateColumns: "1fr 1fr" }}>
            <DetailItem label={numberLabel} value={number || "—"} />
          </div>
          <div className={styles.formGrid} style={{ gridTemplateColumns: "1fr 1fr", marginTop: 10 }}>
            <DetailItem label="Issue Date" value={issueDate ? new Date(issueDate).toLocaleDateString() : "—"} />
            <DetailItem label="Valid Till" value={validTill ? new Date(validTill).toLocaleDateString() : "—"} />
          </div>
          <div style={{ marginTop: 10 }}>
            <div className={styles.fieldLabel}>Remarks</div>
            <div>{remarks || "—"}</div>
          </div>
          <div style={{ marginTop: 10 }}>
            <div className={styles.fieldLabel}>Document</div>
            {document ? (
              <div style={{ display: "flex", gap: 10 }}>
                <a href={`${ASSET_BASE}${document}`} target="_blank" rel="noreferrer">
                  View
                </a>
                <a href={`${ASSET_BASE}${document}`} download>
                  Download
                </a>
              </div>
            ) : (
              <span className={styles.sub}>Not uploaded</span>
            )}
          </div>
          <button type="button" className={styles.cancelBtn} style={{ marginTop: 12 }} onClick={startEdit}>
            Update Verification
          </button>
        </>
      ) : (
        <>
          {error && <div className={styles.errorBanner}>{error}</div>}
          <div className={styles.field} style={{ marginBottom: 10 }}>
            <span className={styles.fieldLabel}>Verification Status</span>
            <select value={formStatus} onChange={(e) => setFormStatus(e.target.value as VerificationStatus)}>
              <option value="pending">Pending</option>
              <option value="verified">Verified</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
          <div className={styles.field} style={{ marginBottom: 10 }}>
            <span className={styles.fieldLabel}>{numberLabel}</span>
            <input value={formNumber} onChange={(e) => setFormNumber(e.target.value)} required />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
            <div className={styles.field}>
              <span className={styles.fieldLabel}>Issue Date</span>
              <input type="date" value={formIssueDate} onChange={(e) => setFormIssueDate(e.target.value)} />
            </div>
            <div className={styles.field}>
              <span className={styles.fieldLabel}>Valid Till Date</span>
              <input type="date" value={formValidTill} onChange={(e) => setFormValidTill(e.target.value)} />
            </div>
          </div>
          <div className={styles.field} style={{ marginBottom: 10 }}>
            <span className={styles.fieldLabel}>Remarks (optional)</span>
            <textarea value={formRemarks} onChange={(e) => setFormRemarks(e.target.value)} />
          </div>
          <div className={styles.field} style={{ marginBottom: 10 }}>
            <span className={styles.fieldLabel}>Replace Document</span>
            <input
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" className={styles.addBtn} onClick={save} disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </button>
            <button type="button" className={styles.cancelBtn} onClick={() => setEditing(false)} disabled={saving}>
              Cancel
            </button>
          </div>
        </>
      )}
    </section>
  );
}

// ─── VENDOR DOCUMENTS MODAL ──────────────────────────────────────────────────────
function VendorDocumentsModal({ vendor, onClose }: { vendor: Vendor; onClose: () => void }) {
  const { data: documents = [], isFetching: isLoading, error: loadError } = useGetVendorDocumentsQuery(vendor.id);
  const [uploadDocument] = useUploadVendorDocumentMutation();
  const [error, setError] = useState<string | null>(loadError ? "Unable to load vendor documents" : null);
  const [uploadingType, setUploadingType] = useState<VendorDocumentType | null>(null);
  const [previewDoc, setPreviewDoc] = useState<VendorDocument | null>(null);

  async function handleUpload(documentType: VendorDocumentType, file: File | null) {
    if (!file) return;
    setError(null);
    const docError = validateDocFile(file);
    if (docError) {
      setError(docError);
      return;
    }
    setUploadingType(documentType);
    try {
      await uploadDocument({ id: vendor.id, documentType, file }).unwrap();
    } catch (err: any) {
      setError(err?.data?.message ?? err?.message ?? "Unable to upload document");
    } finally {
      setUploadingType(null);
    }
  }

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} style={{ maxWidth: 680 }} onClick={(e) => e.stopPropagation()}>
        <h2 className={styles.modalTitle}>Vendor Documents</h2>
        <div className={styles.formGrid} style={{ marginBottom: 18 }}>
          <DetailItem label="Vendor Name" value={vendor.full_name} />
          <DetailItem label="Vendor ID" value={vendor.vendor_code} />
          <DetailItem label="Vendor Type" value={VENDOR_TYPE_LABELS[vendor.vendor_type]} />
        </div>

        {error && <div className={styles.errorBanner}>{error}</div>}

        {isLoading ? (
          <div className={styles.sub}>Loading documents…</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {DOCUMENT_TYPES.map(({ type, label }) => {
              const doc = documents.find((d) => d.document_type === type);
              return (
                <div
                  key={type}
                  style={{
                    border: "1px solid var(--color-border)",
                    borderRadius: "var(--radius-md)",
                    padding: 14,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 12,
                  }}
                >
                  <div>
                    <div className={styles.strong}>{doc?.original_name || label}</div>
                    <div className={styles.sub}>{label}</div>
                    {doc ? (
                      <div className={styles.sub}>
                        Uploaded {new Date(doc.uploaded_at).toLocaleDateString()}
                        {doc.uploaded_by_name ? ` by ${doc.uploaded_by_name}` : ""}
                      </div>
                    ) : (
                      <div className={styles.sub}>Not uploaded</div>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    {doc && (
                      <>
                        <button
                          type="button"
                          className={styles.pageBtn}
                          onClick={() => setPreviewDoc(doc)}
                        >
                          View
                        </button>
                        <a className={styles.pageBtn} href={`${ASSET_BASE}${doc.document_path}`} download>
                          Download
                        </a>
                      </>
                    )}
                    <label className={styles.pageBtn} style={{ cursor: "pointer" }}>
                      {uploadingType === type ? "Uploading…" : doc ? "Replace" : "Upload"}
                      <input
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png"
                        hidden
                        disabled={uploadingType === type}
                        onChange={(e) => handleUpload(type, e.target.files?.[0] ?? null)}
                      />
                    </label>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className={styles.modalActions}>
          <button className={styles.cancelBtn} onClick={onClose}>
            Close
          </button>
        </div>
      </div>

      {previewDoc && <DocumentPreviewModal document={previewDoc} onClose={() => setPreviewDoc(null)} />}
    </div>
  );
}

function DocumentPreviewModal({ document: doc, onClose }: { document: VendorDocument; onClose: () => void }) {
  const url = `${ASSET_BASE}${doc.document_path}`;
  const ext = doc.document_path.slice(doc.document_path.lastIndexOf(".")).toLowerCase();
  const isPdf = ext === ".pdf";
  const isImage = [".jpg", ".jpeg", ".png"].includes(ext);

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} style={{ maxWidth: 820 }} onClick={(e) => e.stopPropagation()}>
        <h2 className={styles.modalTitle}>{doc.original_name || "Document Preview"}</h2>
        <div style={{ background: "var(--color-bg)", borderRadius: "var(--radius-md)", overflow: "hidden" }}>
          {isPdf && <iframe src={url} title="Document preview" style={{ width: "100%", height: "70vh", border: "none" }} />}
          {isImage && <img src={url} alt={doc.original_name ?? "Document preview"} style={{ width: "100%", display: "block" }} />}
          {!isPdf && !isImage && (
            <div style={{ padding: 24, textAlign: "center" }}>
              <p className={styles.sub}>No inline preview available for this file type.</p>
              <a className={styles.pageBtn} href={url} target="_blank" rel="noreferrer">
                Open in new tab
              </a>
            </div>
          )}
        </div>
        <div className={styles.modalActions}>
          <a className={styles.cancelBtn} href={url} download>
            Download
          </a>
          <button className={styles.addBtn} onClick={onClose}>
            Close
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

function PencilIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
      <path d="M4 20h4L19 9l-4-4L4 16v4Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M13.5 6.5l4 4" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function FolderIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
      <path
        d="M3 6.5a1.5 1.5 0 0 1 1.5-1.5H9l2 2h8.5A1.5 1.5 0 0 1 21 8.5v9A1.5 1.5 0 0 1 19.5 19h-15A1.5 1.5 0 0 1 3 17.5v-11Z"
        stroke="currentColor"
        strokeWidth="1.6"
      />
    </svg>
  );
}

function QrIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.6" />
      <rect x="14" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.6" />
      <rect x="3" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.6" />
      <path d="M14 14h3v3M20 14v3h-3M14 20h3M20 20v-3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
