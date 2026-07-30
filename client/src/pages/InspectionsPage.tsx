import { useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import {
  useGetInspectionsQuery,
  useGetInspectionMetricsQuery,
  useDeleteInspectionMutation,
  downloadInspectionsReport,
  useGetInspectionCategoriesQuery,
  useGetInspectionTypesQuery,
  type InspectionFilters,
} from "../api/inspectionApi";
import { useGetDivisionsQuery, useGetStationsQuery, useGetUnitsLiteQuery } from "../api/mastersApi";
import { useGetTrainsQuery } from "../api/trainApi";
import { useAuth } from "../context/AuthContext";
import type { Inspection } from "../types";
import StatCard from "../components/ui/StatCard";
import Pagination from "../components/ui/Pagination";
import InspectionDetailModal from "../components/inspections/InspectionDetailModal";
import styles from "../styles/listPage.module.css";

const LIMIT = 10;

const STATUS_LABELS: Record<Inspection["inspection_status"], string> = {
  draft: "Draft",
  submitted: "Submitted",
  returned: "Returned",
  assigned: "Assigned",
  atr_submitted: "ATR Submitted",
  under_review: "Under Review",
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

export default function InspectionsPage() {
  const navigate = useNavigate();
  const { can } = useAuth();
  const [offset, setOffset] = useState(0);

  const [search, setSearch] = useState("");
  const [inspectionNo, setInspectionNo] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [divisionFilter, setDivisionFilter] = useState<number | "">("");
  const [stationFilter, setStationFilter] = useState<number | "">("");
  const [trainFilter, setTrainFilter] = useState<number | "">("");
  const [unitFilter, setUnitFilter] = useState<number | "">("");
  const [categoryFilter, setCategoryFilter] = useState<number | "">("");
  const [typeFilter, setTypeFilter] = useState<number | "">("");
  const [statusFilter, setStatusFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [showMoreFilters, setShowMoreFilters] = useState(false);

  const [detailId, setDetailId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleteInspection] = useDeleteInspectionMutation();

  const filters: InspectionFilters = useMemo(
    () => ({
      limit: LIMIT,
      offset,
      search: search || undefined,
      inspection_no: inspectionNo || undefined,
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined,
      division_id: divisionFilter || undefined,
      station_id: stationFilter || undefined,
      train_id: trainFilter || undefined,
      unit_id: unitFilter || undefined,
      inspection_category_id: categoryFilter || undefined,
      inspection_type_id: typeFilter || undefined,
      status: statusFilter || undefined,
      priority: priorityFilter || undefined,
    }),
    [
      offset, search, inspectionNo, dateFrom, dateTo, divisionFilter, stationFilter,
      trainFilter, unitFilter, categoryFilter, typeFilter, statusFilter, priorityFilter,
    ]
  );

  const { data: listData, isFetching: isLoading, refetch } = useGetInspectionsQuery(filters);
  const { data: metrics } = useGetInspectionMetricsQuery();
  const { data: divisions = [] } = useGetDivisionsQuery();
  const { data: stations = [] } = useGetStationsQuery(divisionFilter || undefined);
  const { data: trainsResult } = useGetTrainsQuery({ division_id: divisionFilter || undefined, limit: 500 });
  const { data: units = [] } = useGetUnitsLiteQuery();
  const { data: categories = [] } = useGetInspectionCategoriesQuery();
  const { data: types = [] } = useGetInspectionTypesQuery({ categoryId: categoryFilter || 0 }, { skip: !categoryFilter });

  const inspections = listData?.rows ?? [];
  const total = listData?.total ?? 0;
  const canManageTypes = can("inspection_management", "approve_reject");
  const canDelete = can("inspection_management", "delete");

  function handleClearFilters() {
    setOffset(0);
    setSearch("");
    setInspectionNo("");
    setDateFrom("");
    setDateTo("");
    setDivisionFilter("");
    setStationFilter("");
    setTrainFilter("");
    setUnitFilter("");
    setCategoryFilter("");
    setTypeFilter("");
    setStatusFilter("");
    setPriorityFilter("");
  }

  async function handleExport(format: "xlsx" | "csv") {
    try {
      await downloadInspectionsReport(filters, format);
    } catch (err: any) {
      setError(err?.message ?? "Unable to export report");
    }
  }

  async function handleDelete(id: number) {
    if (!window.confirm("Delete this inspection? This cannot be undone.")) return;
    try {
      await deleteInspection(id).unwrap();
    } catch (err: any) {
      setError(err?.data?.message ?? err?.message ?? "Unable to delete inspection");
    }
  }

  return (
    <div>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Inspection Management</h1>
          <p className={styles.subtitle}>Digital inspection filing, delegation, and Action Taken Report workflow.</p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className={styles.cancelBtn} onClick={() => handleExport("csv")}>
            ⬇ CSV
          </button>
          <button className={styles.cancelBtn} onClick={() => handleExport("xlsx")}>
            ⬇ Excel
          </button>
          {canManageTypes && (
            <button className={styles.cancelBtn} onClick={() => navigate("/inspections/types")}>
              ⚙ Manage Categories
            </button>
          )}
          {can("inspection_management", "create") && (
            <button className={styles.addBtn} onClick={() => navigate("/inspections/new")}>
              + New Inspection
            </button>
          )}
        </div>
      </div>

      <div className={styles.statGrid}>
        <StatCard label="Total Inspections" value={metrics?.total ?? "—"} />
        <StatCard label="Pending" value={metrics?.pending ?? "—"} />
        <StatCard label="Assigned" value={metrics?.assigned ?? "—"} />
        <StatCard label="Under Review" value={metrics?.underReview ?? "—"} />
        <StatCard label="ATR Pending" value={metrics?.atrPending ?? "—"} />
        <StatCard label="Approved" value={metrics?.approved ?? "—"} />
        <StatCard label="Closed" value={metrics?.closed ?? "—"} />
        <StatCard label="Rejected" value={metrics?.rejected ?? "—"} />
      </div>

      {metrics && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 14, marginBottom: 16 }}>
          <BreakdownBar title="Division Wise" rows={metrics.divisionWise.map((r) => ({ label: r.division_name ?? "Unassigned", count: r.count }))} />
          <BreakdownBar title="Unit Wise" rows={metrics.unitWise.map((r) => ({ label: r.unit_name ?? "—", count: r.count }))} />
          <BreakdownBar title="Category Wise" rows={metrics.categoryWise.map((r) => ({ label: r.inspection_category ?? "Uncategorized", count: r.count }))} />
          <BreakdownBar
            title="Status Wise"
            rows={metrics.statusWise.map((r) => ({ label: STATUS_LABELS[r.inspection_status as Inspection["inspection_status"]] ?? r.inspection_status, count: r.count }))}
          />
          <BreakdownBar title="Inspector Wise" rows={metrics.inspectorWise.map((r) => ({ label: r.inspector_name ?? "—", count: r.count }))} />
          <BreakdownBar title="Monthly Trend" rows={metrics.monthlyTrend.map((r) => ({ label: r.month, count: r.count }))} />
        </div>
      )}

      <div style={{ background: "var(--color-surface)", borderRadius: "var(--radius-lg)", boxShadow: "var(--shadow-card)", padding: "18px 20px", marginBottom: 16 }}>
        <div className={styles.filterRow}>
          <LabeledField label="Global Search">
            <input
              className={styles.searchInput}
              style={{ marginBottom: 0, maxWidth: "none" }}
              placeholder="Inspection no., official name, observations…"
              value={search}
              onChange={(e) => { setOffset(0); setSearch(e.target.value); }}
            />
          </LabeledField>
          <LabeledField label="Inspection No.">
            <input className={styles.select} value={inspectionNo} onChange={(e) => { setOffset(0); setInspectionNo(e.target.value); }} />
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
            <LabeledField label="Unit">
              <select className={styles.select} value={unitFilter} onChange={(e) => { setOffset(0); setUnitFilter(e.target.value ? Number(e.target.value) : ""); }}>
                <option value="">All Units</option>
                {units.map((u) => <option key={u.id} value={u.id}>{u.unit_name}</option>)}
              </select>
            </LabeledField>
            <LabeledField label="Inspection Category">
              <select className={styles.select} value={categoryFilter} onChange={(e) => { setOffset(0); setCategoryFilter(e.target.value ? Number(e.target.value) : ""); setTypeFilter(""); }}>
                <option value="">All Categories</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            </LabeledField>
            <LabeledField label="Inspection Type">
              <select className={styles.select} value={typeFilter} disabled={!categoryFilter} onChange={(e) => { setOffset(0); setTypeFilter(e.target.value ? Number(e.target.value) : ""); }}>
                <option value="">All Types</option>
                {types.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
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
              <th>Inspection No.</th>
              <th>Date</th>
              <th>Division</th>
              <th>Unit</th>
              <th>Category / Type</th>
              <th>Inspector</th>
              <th>Priority</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={9} className={styles.emptyCell}>Loading…</td></tr>
            ) : inspections.length === 0 ? (
              <tr><td colSpan={9} className={styles.emptyCell}>No inspections found.</td></tr>
            ) : (
              inspections.map((i) => (
                <tr key={i.id}>
                  <td className={styles.strong}>{i.inspection_no ?? `#${i.id}`}</td>
                  <td>{formatDate(i.inspection_date)}</td>
                  <td>{i.division_name ?? "—"}</td>
                  <td>{i.unit_name ?? "—"}</td>
                  <td>{i.inspection_category_label ?? "—"}{i.inspection_type_label ? ` / ${i.inspection_type_label}` : ""}</td>
                  <td>{i.inspector_name ?? "—"}</td>
                  <td>
                    <span className={`${styles.pill} ${i.priority === "high" ? styles.pillHigh : i.priority === "medium" ? styles.pillMedium : styles.pillLow}`}>
                      {i.priority.toUpperCase()}
                    </span>
                  </td>
                  <td>
                    <span className={i.inspection_status === "closed" || i.inspection_status === "approved" ? styles.statusGood : i.inspection_status === "rejected" ? styles.statusBad : styles.statusWarn}>
                      {STATUS_LABELS[i.inspection_status]}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      <button type="button" className={styles.pageBtn} title="View inspection" onClick={() => setDetailId(i.id)}>
                        <EyeIcon />
                      </button>
                      {i.inspection_status === "draft" || i.inspection_status === "returned" ? (
                        <button type="button" className={styles.pageBtn} title="Edit inspection" onClick={() => navigate(`/inspections/${i.id}/edit`)}>
                          <EditIcon />
                        </button>
                      ) : null}
                      {canDelete && (
                        <button type="button" className={styles.pageBtn} title="Delete" onClick={() => handleDelete(i.id)}>
                          ✕
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

      {detailId !== null && <InspectionDetailModal inspectionId={detailId} onClose={() => setDetailId(null)} />}
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
