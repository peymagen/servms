import { useMemo, useState, type ReactNode } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  useGetComplaintsQuery,
  useGetComplaintMetricsQuery,
  useEditComplaintMutation,
  downloadComplaintsReport,
  type UpdateComplaintBody,
  type ComplaintFilters,
} from "../api/complaintApi";
import { useGetDivisionsQuery, useGetStationsQuery, useGetUnitsLiteQuery } from "../api/mastersApi";
import { useGetTrainsQuery } from "../api/trainApi";
import { useGetComplaintSubtypesQuery, useGetComplaintTypesQuery } from "../api/complaintApi";
import { useAuth } from "../context/AuthContext";
import type { Complaint } from "../types";
import StatCard from "../components/ui/StatCard";
import Pagination from "../components/ui/Pagination";
import ComplaintDetailModal from "../components/complaints/ComplaintDetailModal";
import styles from "../styles/listPage.module.css";

const LIMIT = 10;

const STATUS_LABELS: Record<Complaint["complaints_status"], string> = {
  pending: "Pending",
  assigned: "Assigned",
  under_review: "Under Review",
  action_taken: "Action Taken",
  approved: "Approved",
  rejected: "Rejected",
  closed: "Closed",
};

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function BreakdownBar({ title, rows }: { title: string; rows: Array<{ label: string; count: number }> }) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <div style={{ background: "var(--color-surface)", borderRadius: "var(--radius-lg)", boxShadow: "var(--shadow-card)", padding: "14px 18px" }}>
      <h3 style={{ fontSize: 12.5, margin: "0 0 10px", color: "var(--color-text-muted)" }}>{title}</h3>
      {rows.length === 0 ? (
        <span className={styles.hint}>No data</span>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {rows.slice(0, 8).map((r) => (
            <div key={r.label} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11.5 }}>
              <span style={{ width: 110, flexShrink: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.label}</span>
              <div style={{ flex: 1, background: "var(--color-bg)", borderRadius: 4, height: 8 }}>
                <div style={{ width: `${(r.count / max) * 100}%`, background: "var(--color-primary)", height: 8, borderRadius: 4 }} />
              </div>
              <span style={{ width: 24, textAlign: "right" }}>{r.count}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ComplaintsPage() {
  const navigate = useNavigate();
  const { can } = useAuth();
  const [offset, setOffset] = useState(0);
  // Seeds initial filters from the URL once (e.g. the Dashboard's Pending
  // Action card links here as `/complaints?status=assigned&division_id=2`).
  const [searchParams] = useSearchParams();

  const [search, setSearch] = useState("");
  const [complaintRefNo, setComplaintRefNo] = useState("");
  const [source, setSource] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [divisionFilter, setDivisionFilter] = useState<number | "">(() => {
    const raw = searchParams.get("division_id");
    return raw ? Number(raw) : "";
  });
  const [stationFilter, setStationFilter] = useState<number | "">("");
  const [trainFilter, setTrainFilter] = useState<number | "">("");
  const [typeFilter, setTypeFilter] = useState<number | "">("");
  const [subtypeFilter, setSubtypeFilter] = useState<number | "">("");
  const [unitFilter, setUnitFilter] = useState<number | "">("");
  const [statusFilter, setStatusFilter] = useState(() => searchParams.get("status") ?? "");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [showMoreFilters, setShowMoreFilters] = useState(false);

  const [detailId, setDetailId] = useState<number | null>(null);
  const [editComplaintTarget, setEditComplaintTarget] = useState<Complaint | null>(null);
  const [error, setError] = useState<string | null>(null);

  const filters: ComplaintFilters = useMemo(
    () => ({
      limit: LIMIT,
      offset,
      search: search || undefined,
      complaint_ref_no: complaintRefNo || undefined,
      complaint_source: source || undefined,
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined,
      division_id: divisionFilter || undefined,
      station_id: stationFilter || undefined,
      train_id: trainFilter || undefined,
      complaint_type_id: typeFilter || undefined,
      complaint_subtype_id: subtypeFilter || undefined,
      unit_id: unitFilter || undefined,
      status: statusFilter || undefined,
      priority: priorityFilter || undefined,
    }),
    [
      offset, search, complaintRefNo, source, dateFrom, dateTo, divisionFilter, stationFilter,
      trainFilter, typeFilter, subtypeFilter, unitFilter, statusFilter, priorityFilter,
    ]
  );

  const { data: listData, isFetching: isLoading, refetch } = useGetComplaintsQuery(filters);
  const { data: metrics } = useGetComplaintMetricsQuery();
  const { data: divisions = [] } = useGetDivisionsQuery();
  const { data: stations = [] } = useGetStationsQuery(divisionFilter || undefined);
  const { data: trainsResult } = useGetTrainsQuery({ division_id: divisionFilter || undefined, limit: 500 });
  const { data: units = [] } = useGetUnitsLiteQuery();
  const { data: types = [] } = useGetComplaintTypesQuery();
  const { data: subtypes = [] } = useGetComplaintSubtypesQuery({ typeId: typeFilter || 0 }, { skip: !typeFilter });
  const [editComplaint] = useEditComplaintMutation();

  const complaints = listData?.rows ?? [];
  const total = listData?.total ?? 0;
  const canManageTypes = can("admin_module", "create") || can("complaint_management", "approve_reject");

  function handleClearFilters() {
    setOffset(0);
    setSearch("");
    setComplaintRefNo("");
    setSource("");
    setDateFrom("");
    setDateTo("");
    setDivisionFilter("");
    setStationFilter("");
    setTrainFilter("");
    setTypeFilter("");
    setSubtypeFilter("");
    setUnitFilter("");
    setStatusFilter("");
    setPriorityFilter("");
  }

  async function handleEditSave(data: UpdateComplaintBody) {
    if (!editComplaintTarget) return;
    try {
      await editComplaint({ id: editComplaintTarget.id, data }).unwrap();
      setEditComplaintTarget(null);
    } catch (err: any) {
      setError(err?.data?.message ?? err?.message ?? "Unable to update complaint");
    }
  }

  async function handleExport(format: "xlsx" | "csv") {
    try {
      await downloadComplaintsReport(filters, format);
    } catch (err: any) {
      setError(err?.message ?? "Unable to export report");
    }
  }

  return (
    <div>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Complaint Management</h1>
          <p className={styles.subtitle}>Register, track, and resolve complaints across the SERVMS network.</p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className={styles.cancelBtn} onClick={() => handleExport("csv")}>
            ⬇ CSV
          </button>
          <button className={styles.cancelBtn} onClick={() => handleExport("xlsx")}>
            ⬇ Excel
          </button>
          {can("complaint_management", "create") && (
            <button className={styles.cancelBtn} onClick={() => navigate("/complaints/import")}>
              ⇪ Import RailMadad
            </button>
          )}
          {canManageTypes && (
            <button className={styles.cancelBtn} onClick={() => navigate("/complaints/types")}>
              ⚙ Manage Types
            </button>
          )}
          <button className={styles.addBtn} onClick={() => navigate("/complaints/new")}>
            + New Complaint
          </button>
        </div>
      </div>

      <div className={styles.statGrid}>
        <StatCard label="Total Complaints" value={metrics?.total ?? "—"} />
        <StatCard label="Pending" value={metrics?.pending ?? "—"} />
        <StatCard label="Assigned" value={metrics?.assigned ?? "—"} />
        <StatCard label="Under Review" value={metrics?.underReview ?? "—"} />
        <StatCard label="Closed" value={metrics?.closed ?? "—"} />
        <StatCard label="Rejected" value={metrics?.rejected ?? "—"} />
        <StatCard label="Today's Complaints" value={metrics?.today ?? "—"} />
        <StatCard label="This Month" value={metrics?.thisMonth ?? "—"} />
      </div>

      {metrics && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 14, marginBottom: 16 }}>
          <BreakdownBar
            title="Division Wise"
            rows={metrics.divisionWise.map((r) => ({ label: r.division_name ?? "Unassigned", count: r.count }))}
          />
          <BreakdownBar
            title="Complaint Type Wise"
            rows={metrics.typeWise.map((r) => ({ label: r.complaint_type ?? "Uncategorized", count: r.count }))}
          />
          <BreakdownBar
            title="Status Wise"
            rows={metrics.statusWise.map((r) => ({ label: STATUS_LABELS[r.complaints_status as Complaint["complaints_status"]] ?? r.complaints_status, count: r.count }))}
          />
          <BreakdownBar title="Monthly Trend" rows={metrics.monthlyTrend.map((r) => ({ label: r.month, count: r.count }))} />
        </div>
      )}

      <div style={{ background: "var(--color-surface)", borderRadius: "var(--radius-lg)", boxShadow: "var(--shadow-card)", padding: "18px 20px", marginBottom: 16 }}>
        <div className={styles.filterRow}>
          <LabeledField label="Global Search">
            <input
              className={styles.searchInput}
              style={{ marginBottom: 0, maxWidth: "none" }}
              placeholder="Complaint code, description, complainant…"
              value={search}
              onChange={(e) => { setOffset(0); setSearch(e.target.value); }}
            />
          </LabeledField>
          <LabeledField label="Reference No.">
            <input className={styles.select} value={complaintRefNo} onChange={(e) => { setOffset(0); setComplaintRefNo(e.target.value); }} />
          </LabeledField>
          <LabeledField label="Source">
            <select className={styles.select} value={source} onChange={(e) => { setOffset(0); setSource(e.target.value); }}>
              <option value="">All Sources</option>
              <option value="railmadad">RailMadad</option>
              <option value="cpgrams">CPGRAMS</option>
              <option value="manual">Manual</option>
            </select>
          </LabeledField>
          <LabeledField label="Status">
            <select className={styles.select} value={statusFilter} onChange={(e) => { setOffset(0); setStatusFilter(e.target.value); }}>
              <option value="">All Statuses</option>
              {Object.entries(STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </LabeledField>
          <LabeledField label="Priority">
            <select className={styles.select} value={priorityFilter} onChange={(e) => { setOffset(0); setPriorityFilter(e.target.value); }}>
              <option value="">All Priorities</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </LabeledField>
          <LabeledField label="Division">
            <select className={styles.select} value={divisionFilter} onChange={(e) => { setOffset(0); setDivisionFilter(e.target.value ? Number(e.target.value) : ""); setStationFilter(""); setTrainFilter(""); }}>
              <option value="">All Divisions</option>
              {divisions.map((d) => <option key={d.id} value={d.id}>{d.division_name}</option>)}
            </select>
          </LabeledField>
          <div style={{ display: "flex", gap: 8, alignSelf: "flex-end" }}>
            <button type="button" className={styles.cancelBtn} onClick={() => setShowMoreFilters((s) => !s)}>
              {showMoreFilters ? "Fewer Filters" : "More Filters"}
            </button>
            <button type="button" className={styles.cancelBtn} onClick={handleClearFilters}>
              Clear
            </button>
            <button type="button" className={styles.addBtn} onClick={() => refetch()}>
              Apply
            </button>
          </div>
        </div>

        {showMoreFilters && (
          <div className={styles.filterRow} style={{ marginTop: 12 }}>
            <LabeledField label="Station">
              <select className={styles.select} value={stationFilter} onChange={(e) => { setOffset(0); setStationFilter(e.target.value ? Number(e.target.value) : ""); }}>
                <option value="">All Stations</option>
                {stations.map((s) => <option key={s.id} value={s.id}>{s.station_name}</option>)}
              </select>
            </LabeledField>
            <LabeledField label="Train">
              <select className={styles.select} value={trainFilter} onChange={(e) => { setOffset(0); setTrainFilter(e.target.value ? Number(e.target.value) : ""); }}>
                <option value="">All Trains</option>
                {(trainsResult?.rows ?? []).map((t) => <option key={t.id} value={t.id}>{t.train_number}</option>)}
              </select>
            </LabeledField>
            <LabeledField label="Concerned Unit">
              <select className={styles.select} value={unitFilter} onChange={(e) => { setOffset(0); setUnitFilter(e.target.value ? Number(e.target.value) : ""); }}>
                <option value="">All Units</option>
                {units.map((u) => <option key={u.id} value={u.id}>{u.unit_name}</option>)}
              </select>
            </LabeledField>
            <LabeledField label="Complaint Type">
              <select className={styles.select} value={typeFilter} onChange={(e) => { setOffset(0); setTypeFilter(e.target.value ? Number(e.target.value) : ""); setSubtypeFilter(""); }}>
                <option value="">All Types</option>
                {types.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
            </LabeledField>
            <LabeledField label="Complaint Sub-Type">
              <select className={styles.select} value={subtypeFilter} disabled={!typeFilter} onChange={(e) => { setOffset(0); setSubtypeFilter(e.target.value ? Number(e.target.value) : ""); }}>
                <option value="">All Sub-Types</option>
                {subtypes.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </LabeledField>
            <LabeledField label="Date Range">
              <div style={{ display: "flex", gap: 6 }}>
                <input type="date" className={styles.select} value={dateFrom} onChange={(e) => { setOffset(0); setDateFrom(e.target.value); }} />
                <input type="date" className={styles.select} value={dateTo} onChange={(e) => { setOffset(0); setDateTo(e.target.value); }} />
              </div>
            </LabeledField>
          </div>
        )}
      </div>

      {error && <div className={styles.errorBanner}>{error}</div>}

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Complaint</th>
              <th>Source</th>
              <th>Date</th>
              <th>Division</th>
              <th>Type / Sub-Type</th>
              <th>Concerned Unit</th>
              <th>Priority</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={9} className={styles.emptyCell}>Loading…</td></tr>
            ) : complaints.length === 0 ? (
              <tr><td colSpan={9} className={styles.emptyCell}>No complaints found.</td></tr>
            ) : (
              complaints.map((c) => (
                <tr key={c.id}>
                  <td className={styles.strong}>#{c.complaint_code}</td>
                  <td>{c.complaint_source.toUpperCase()}</td>
                  <td>{formatDate(c.complaint_date)}</td>
                  <td>{c.division_name ?? "—"}</td>
                  <td>{c.complaint_type_label ?? "—"}{c.complaint_subtype_label ? ` / ${c.complaint_subtype_label}` : ""}</td>
                  <td>{c.unit_name ?? "—"}</td>
                  <td>
                    <span className={`${styles.pill} ${c.priority === "high" ? styles.pillHigh : c.priority === "medium" ? styles.pillMedium : styles.pillLow}`}>
                      {c.priority.toUpperCase()}
                    </span>
                  </td>
                  <td>
                    <span className={c.complaints_status === "closed" || c.complaints_status === "approved" ? styles.statusGood : c.complaints_status === "rejected" ? styles.statusBad : styles.statusWarn}>
                      {STATUS_LABELS[c.complaints_status]}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      <button type="button" className={styles.pageBtn} title="View complaint" onClick={() => setDetailId(c.id)}>
                        <EyeIcon />
                      </button>
                      {can("complaint_management", "edit") && (
                        <button type="button" className={styles.pageBtn} title="Edit complaint" onClick={() => setEditComplaintTarget(c)}>
                          <EditIcon />
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

      {detailId !== null && <ComplaintDetailModal complaintId={detailId} onClose={() => setDetailId(null)} />}

      {editComplaintTarget && (
        <EditComplaintModal complaint={editComplaintTarget} onClose={() => setEditComplaintTarget(null)} onSaved={handleEditSave} />
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

function EditComplaintModal({
  complaint,
  onClose,
  onSaved,
}: {
  complaint: Complaint;
  onClose: () => void;
  onSaved: (data: UpdateComplaintBody) => void;
}) {
  const [description, setDescription] = useState(complaint.description);
  const [priority, setPriority] = useState(complaint.priority);
  const [complainantName, setComplainantName] = useState(complaint.complainant_name ?? "");
  const [complainantMobile, setComplainantMobile] = useState(complaint.complainant_mobile ?? "");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit() {
    setIsSubmitting(true);
    try {
      onSaved({
        description,
        priority,
        complainant_name: complainantName || undefined,
        complainant_mobile: complainantMobile || undefined,
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <h2 className={styles.modalTitle}>Edit #{complaint.complaint_code}</h2>
        <div className={styles.formGrid}>
          <div className={styles.field}>
            <span className={styles.fieldLabel}>Priority</span>
            <select value={priority} onChange={(e) => setPriority(e.target.value as Complaint["priority"])}>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>
          <div className={styles.field}>
            <span className={styles.fieldLabel}>Complainant Name</span>
            <input value={complainantName} onChange={(e) => setComplainantName(e.target.value)} />
          </div>
          <div className={styles.field}>
            <span className={styles.fieldLabel}>Complainant Mobile</span>
            <input value={complainantMobile} onChange={(e) => setComplainantMobile(e.target.value)} />
          </div>
          <div className={styles.fieldWide}>
            <div className={styles.field}>
              <span className={styles.fieldLabel}>Description</span>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
          </div>
        </div>
        <div className={styles.modalActions}>
          <button type="button" className={styles.cancelBtn} onClick={onClose}>Cancel</button>
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
      <path d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17v3Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}
