import { useMemo, useState, type ReactNode } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  useGetContractorsQuery,
  useGetContractorMetricsQuery,
  useGetContractorUnitsQuery,
  useEditContractorMutation,
  useChangeContractorStatusMutation,
  useAssignUnitMutation,
  useUnassignUnitMutation,
} from "../api/contractorApi";
import { useGetDivisionsQuery, useGetUnitsLiteQuery } from "../api/mastersApi";
import { useGetAuditLogsQuery } from "../api/auditApi";
import type { Contractor } from "../types";
import StatCard from "../components/ui/StatCard";
import Pagination from "../components/ui/Pagination";
import Field from "../components/ui/Field";
import styles from "../styles/listPage.module.css";

const LIMIT = 10;

const STATUS_LABELS: Record<Contractor["contractors_status"], string> = {
  active: "Active",
  pending_approval: "Pending Approval",
  suspended: "Suspended",
  expired: "Expired",
  blacklisted: "Blacklisted",
};

function statusBadgeClass(status: Contractor["contractors_status"]): string {
  if (status === "active") return styles.statusGood;
  if (status === "pending_approval") return styles.statusWarn;
  return styles.statusBad;
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

const currency = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

export default function ContractorManagementPage() {
  const navigate = useNavigate();
  const { can } = useAuth();
  const canEdit = can("contractor_management", "edit");
  const canChangeStatus = can("contractor_management", "approve_reject");

  const [offset, setOffset] = useState(0);
  // Seeds initial filters from the URL once (e.g. the Dashboard's Registered
  // Contractors card links here as `/contractors?status=blacklisted&division_id=2`).
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<Contractor["contractors_status"] | "">(
    () => (searchParams.get("status") as Contractor["contractors_status"] | "") || ""
  );
  const [divisionFilter, setDivisionFilter] = useState<number | "">(() => {
    const raw = searchParams.get("division_id");
    return raw ? Number(raw) : "";
  });
  const [showAdvanced, setShowAdvanced] = useState(() => searchParams.has("status"));
  const [detailContractor, setDetailContractor] = useState<Contractor | null>(null);

  const filters = useMemo(
    () => ({
      limit: LIMIT,
      offset,
      search: search || undefined,
      status: statusFilter || undefined,
      division_id: divisionFilter || undefined,
    }),
    [offset, search, statusFilter, divisionFilter]
  );

  const { data: listData, isFetching } = useGetContractorsQuery(filters);
  const { data: metrics } = useGetContractorMetricsQuery();
  const { data: divisions = [] } = useGetDivisionsQuery();

  const contractors = listData?.rows ?? [];
  const total = listData?.total ?? 0;

  return (
    <div>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Master Contractor Listing</h1>
          <p className={styles.subtitle}>
            Manage catering and service contractors, contract terms, linked units, and status.
          </p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button type="button" className={styles.cancelBtn} onClick={() => setShowAdvanced((s) => !s)}>
            ⚏ {showAdvanced ? "Fewer Filters" : "Advanced Filters"}
          </button>
          <button className={styles.addBtn} onClick={() => navigate("/contractors/new")}>
            + Onboard New Contractor
          </button>
        </div>
      </div>

      <div className={styles.statGrid}>
        <StatCard label="Total Active" value={metrics?.totalActive ?? "—"} />
        <StatCard label="Expiring Soon" value={metrics?.expiringSoon ?? "—"} />
        <StatCard label="Fees Overdue" value={metrics?.feesOverdue ?? "—"} />
        <StatCard label="Total Vendors" value={metrics?.totalVendors ?? "—"} />
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
              placeholder="Search contractors…"
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
                  setStatusFilter(e.target.value as Contractor["contractors_status"] | "");
                }}
              >
                <option value="">All</option>
                {/* "inactive" is the Dashboard's rollup of pending_approval/suspended/expired
                    (see contractor.service.ts's getContractors), not a real Contractor status,
                    so it's added here rather than to STATUS_LABELS (used for per-row badges). */}
                <option value="inactive">Inactive (Non-Active)</option>
                {Object.entries(STATUS_LABELS).map(([value, label]) => (
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
          </div>
        )}
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Contractor Name</th>
              <th>License Number</th>
              <th>Contract Value</th>
              <th>Award Date</th>
              <th>Status</th>
              <th>Vendor Count</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {isFetching ? (
              <tr>
                <td colSpan={7} className={styles.emptyCell}>
                  Loading…
                </td>
              </tr>
            ) : contractors.length === 0 ? (
              <tr>
                <td colSpan={7} className={styles.emptyCell}>
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
                  <td>{c.annual_contract_value ? currency.format(c.annual_contract_value) : "—"}</td>
                  <td>{formatDate(c.award_date)}</td>
                  <td>
                    <span className={statusBadgeClass(c.contractors_status)}>{STATUS_LABELS[c.contractors_status]}</span>
                  </td>
                  <td>{c.vendor_count ?? 0}</td>
                  <td>
                    <button type="button" className={styles.pageBtn} onClick={() => setDetailContractor(c)}>
                      View / Manage
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        <Pagination total={total} limit={LIMIT} offset={offset} onOffsetChange={setOffset} />
      </div>

      {detailContractor && (
        <ContractorDetailModal
          contractor={detailContractor}
          canEdit={canEdit}
          canChangeStatus={canChangeStatus}
          onClose={() => setDetailContractor(null)}
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

type Tab = "overview" | "units" | "history";

function ContractorDetailModal({
  contractor,
  canEdit,
  canChangeStatus,
  onClose,
}: {
  contractor: Contractor;
  canEdit: boolean;
  canChangeStatus: boolean;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<Tab>("overview");

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} style={{ maxWidth: 720 }} onClick={(e) => e.stopPropagation()}>
        <h2 className={styles.modalTitle}>{contractor.company_name}</h2>
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          {(["overview", "units", "history"] as Tab[]).map((t) => (
            <button
              key={t}
              type="button"
              className={styles.pageBtn}
              style={tab === t ? { background: "var(--color-primary)", color: "#fff" } : undefined}
              onClick={() => setTab(t)}
            >
              {t === "overview" ? "Overview" : t === "units" ? "Linked Units" : "History"}
            </button>
          ))}
        </div>

        {tab === "overview" && <OverviewTab contractor={contractor} canEdit={canEdit} canChangeStatus={canChangeStatus} />}
        {tab === "units" && <UnitsTab contractor={contractor} canEdit={canEdit} />}
        {tab === "history" && <HistoryTab contractor={contractor} />}

        <div className={styles.modalActions}>
          <button className={styles.cancelBtn} onClick={onClose}>
            Close
          </button>
        </div>
      </div>
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

function OverviewTab({
  contractor,
  canEdit,
  canChangeStatus,
}: {
  contractor: Contractor;
  canEdit: boolean;
  canChangeStatus: boolean;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editContractor, { isLoading: isSaving }] = useEditContractorMutation();
  const [changeStatus, { isLoading: isChangingStatus }] = useChangeContractorStatusMutation();
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    primary_contact_name: contractor.primary_contact_name ?? "",
    primary_contact_mobile: contractor.primary_contact_mobile ?? "",
    official_email: contractor.official_email ?? "",
    license_number: contractor.license_number ?? "",
    license_validity_date: contractor.license_validity_date?.slice(0, 10) ?? "",
    annual_registration_fee: String(contractor.annual_registration_fee ?? ""),
    award_date: contractor.award_date?.slice(0, 10) ?? "",
    tenure_months: String(contractor.tenure_months ?? ""),
    annual_contract_value: String(contractor.annual_contract_value ?? ""),
  });

  async function handleSave() {
    setError(null);
    try {
      await editContractor({
        id: contractor.id,
        data: {
          primary_contact_name: form.primary_contact_name || undefined,
          primary_contact_mobile: form.primary_contact_mobile || undefined,
          official_email: form.official_email || undefined,
          license_number: form.license_number || undefined,
          license_validity_date: form.license_validity_date || undefined,
          annual_registration_fee: form.annual_registration_fee ? Number(form.annual_registration_fee) : undefined,
          award_date: form.award_date || undefined,
          tenure_months: form.tenure_months ? Number(form.tenure_months) : undefined,
          annual_contract_value: form.annual_contract_value ? Number(form.annual_contract_value) : undefined,
        },
      }).unwrap();
      setIsEditing(false);
    } catch (err: any) {
      setError(err?.data?.message ?? err?.message ?? "Unable to update contractor");
    }
  }

  async function handleStatusChange(newStatus: Contractor["contractors_status"]) {
    setError(null);
    try {
      await changeStatus({ id: contractor.id, contractors_status: newStatus }).unwrap();
    } catch (err: any) {
      setError(err?.data?.message ?? err?.message ?? "Unable to change status");
    }
  }

  if (!isEditing) {
    return (
      <div>
        <div className={styles.formGrid}>
          <DetailItem label="Primary Contact" value={contractor.primary_contact_name ?? "—"} />
          <DetailItem label="Mobile" value={contractor.primary_contact_mobile ?? "—"} />
          <DetailItem label="Email" value={contractor.official_email ?? "—"} />
          <DetailItem label="License Number" value={contractor.license_number ?? "—"} />
          <DetailItem label="License Validity" value={formatDate(contractor.license_validity_date)} />
          <DetailItem label="Annual Registration Fee" value={currency.format(contractor.annual_registration_fee ?? 0)} />
          <DetailItem label="Award Date" value={formatDate(contractor.award_date)} />
          <DetailItem label="Tenure" value={contractor.tenure_months ? `${contractor.tenure_months} months` : "—"} />
          <DetailItem label="Annual Contract Value" value={currency.format(contractor.annual_contract_value ?? 0)} />
          <DetailItem label="Status" value={STATUS_LABELS[contractor.contractors_status]} />
        </div>
        {error && <div className={styles.errorBanner}>{error}</div>}
        <div className={styles.modalActions} style={{ justifyContent: "flex-start", flexWrap: "wrap" }}>
          {canEdit && (
            <button type="button" className={styles.addBtn} onClick={() => setIsEditing(true)}>
              Edit Contract Details
            </button>
          )}
          {canChangeStatus && contractor.contractors_status !== "active" && (
            <button
              type="button"
              className={styles.pageBtn}
              disabled={isChangingStatus}
              onClick={() => handleStatusChange("active")}
            >
              Mark Active
            </button>
          )}
          {canChangeStatus && contractor.contractors_status === "active" && (
            <button
              type="button"
              className={styles.pageBtn}
              disabled={isChangingStatus}
              onClick={() => handleStatusChange("suspended")}
            >
              Suspend
            </button>
          )}
          {canChangeStatus && contractor.contractors_status !== "expired" && (
            <button
              type="button"
              className={styles.pageBtn}
              disabled={isChangingStatus}
              onClick={() => handleStatusChange("expired")}
            >
              Mark Expired
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className={styles.formGrid}>
        <Field label="Primary Contact">
          <input
            value={form.primary_contact_name}
            onChange={(e) => setForm((f) => ({ ...f, primary_contact_name: e.target.value }))}
          />
        </Field>
        <Field label="Mobile">
          <input
            value={form.primary_contact_mobile}
            onChange={(e) => setForm((f) => ({ ...f, primary_contact_mobile: e.target.value }))}
          />
        </Field>
        <Field label="Email">
          <input value={form.official_email} onChange={(e) => setForm((f) => ({ ...f, official_email: e.target.value }))} />
        </Field>
        <Field label="License Number">
          <input value={form.license_number} onChange={(e) => setForm((f) => ({ ...f, license_number: e.target.value }))} />
        </Field>
        <Field label="License Validity">
          <input
            type="date"
            value={form.license_validity_date}
            onChange={(e) => setForm((f) => ({ ...f, license_validity_date: e.target.value }))}
          />
        </Field>
        <Field label="Annual Registration Fee">
          <input
            type="number"
            value={form.annual_registration_fee}
            onChange={(e) => setForm((f) => ({ ...f, annual_registration_fee: e.target.value }))}
          />
        </Field>
        <Field label="Award Date">
          <input type="date" value={form.award_date} onChange={(e) => setForm((f) => ({ ...f, award_date: e.target.value }))} />
        </Field>
        <Field label="Tenure (months)">
          <input type="number" value={form.tenure_months} onChange={(e) => setForm((f) => ({ ...f, tenure_months: e.target.value }))} />
        </Field>
        <Field label="Annual Contract Value">
          <input
            type="number"
            value={form.annual_contract_value}
            onChange={(e) => setForm((f) => ({ ...f, annual_contract_value: e.target.value }))}
          />
        </Field>
      </div>
      {error && <div className={styles.errorBanner}>{error}</div>}
      <div className={styles.modalActions}>
        <button type="button" className={styles.cancelBtn} onClick={() => setIsEditing(false)}>
          Cancel
        </button>
        <button type="button" className={styles.addBtn} onClick={handleSave} disabled={isSaving}>
          {isSaving ? "Saving…" : "Save Changes"}
        </button>
      </div>
    </div>
  );
}

function UnitsTab({ contractor, canEdit }: { contractor: Contractor; canEdit: boolean }) {
  const { data: units = [], isFetching } = useGetContractorUnitsQuery(contractor.id);
  const { data: allUnits = [] } = useGetUnitsLiteQuery();
  const [assignUnit, { isLoading: isAssigning }] = useAssignUnitMutation();
  const [unassignUnit] = useUnassignUnitMutation();
  const [selectedUnitId, setSelectedUnitId] = useState<number | "">("");
  const [error, setError] = useState<string | null>(null);

  const linkedIds = new Set(units.map((u) => u.id));
  const availableUnits = allUnits.filter((u) => !linkedIds.has(u.id) && !u.contractor_id);

  async function handleAssign() {
    if (!selectedUnitId) return;
    setError(null);
    try {
      await assignUnit({ id: contractor.id, unit_id: Number(selectedUnitId) }).unwrap();
      setSelectedUnitId("");
    } catch (err: any) {
      setError(err?.data?.message ?? err?.message ?? "Unable to link unit");
    }
  }

  async function handleUnassign(unitId: number) {
    setError(null);
    try {
      await unassignUnit({ id: contractor.id, unitId }).unwrap();
    } catch (err: any) {
      setError(err?.data?.message ?? err?.message ?? "Unable to unlink unit");
    }
  }

  return (
    <div>
      {canEdit && (
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <select value={selectedUnitId} onChange={(e) => setSelectedUnitId(e.target.value ? Number(e.target.value) : "")}>
            <option value="">Select an unassigned unit…</option>
            {availableUnits.map((u) => (
              <option key={u.id} value={u.id}>
                {u.unit_name} ({u.unit_code})
              </option>
            ))}
          </select>
          <button type="button" className={styles.addBtn} onClick={handleAssign} disabled={!selectedUnitId || isAssigning}>
            + Link Unit
          </button>
        </div>
      )}
      {error && <div className={styles.errorBanner}>{error}</div>}
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Unit</th>
            <th>Station</th>
            <th>Status</th>
            {canEdit && <th>Actions</th>}
          </tr>
        </thead>
        <tbody>
          {isFetching ? (
            <tr>
              <td colSpan={canEdit ? 4 : 3} className={styles.emptyCell}>
                Loading…
              </td>
            </tr>
          ) : units.length === 0 ? (
            <tr>
              <td colSpan={canEdit ? 4 : 3} className={styles.emptyCell}>
                No units linked to this contractor.
              </td>
            </tr>
          ) : (
            units.map((u) => (
              <tr key={u.id}>
                <td className={styles.strong}>{u.unit_name}</td>
                <td>{u.station_name ?? "—"}</td>
                <td>{u.units_status}</td>
                {canEdit && (
                  <td>
                    <button type="button" className={styles.pageBtn} onClick={() => handleUnassign(u.id)}>
                      Unlink
                    </button>
                  </td>
                )}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function HistoryTab({ contractor }: { contractor: Contractor }) {
  const { data: listData, isFetching } = useGetAuditLogsQuery({
    module: "contractor",
    record_id: String(contractor.id),
    limit: 50,
  });
  const logs = listData?.rows ?? [];

  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>When</th>
            <th>Action</th>
            <th>By</th>
            <th>Details</th>
          </tr>
        </thead>
        <tbody>
          {isFetching ? (
            <tr>
              <td colSpan={4} className={styles.emptyCell}>
                Loading…
              </td>
            </tr>
          ) : logs.length === 0 ? (
            <tr>
              <td colSpan={4} className={styles.emptyCell}>
                No history recorded yet.
              </td>
            </tr>
          ) : (
            logs.map((log) => (
              <tr key={log.id}>
                <td>{new Date(log.created_at).toLocaleString("en-IN")}</td>
                <td>
                  <span className={styles.roleTag}>{log.action}</span>
                </td>
                <td>{log.user_full_name ?? "—"}</td>
                <td className={styles.sub}>{log.details ?? "—"}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
