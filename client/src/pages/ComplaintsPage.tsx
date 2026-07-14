import { useEffect, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiError } from "../api/client";
import { getDivisions } from "../api/masters";
import type { Complaint, Division } from "../types";
import StatCard from "../components/ui/StatCard";
import Pagination from "../components/ui/Pagination";
import styles from "../styles/listPage.module.css";

const LIMIT = 10;

const STATUS_LABELS: Record<Complaint["complaints_status"], string> = {
  open: "Pending",
  investigating: "Under Investigation",
  resolved: "Resolved",
  rejected: "Rejected",
};

interface Metrics {
  openComplaints: number;
  pendingATR: number;
  avgResolutionTime: number;
  categoryDistribution: Array<{ category: string; count: number }>;
}

export default function ComplaintsPage() {
  const navigate = useNavigate();
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);

  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [divisionFilter, setDivisionFilter] = useState<number | "">("");

  const [divisions, setDivisions] = useState<Division[]>([]);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [viewComplaint, setViewComplaint] = useState<Complaint | null>(null);
  const [editComplaintTarget, setEditComplaintTarget] = useState<Complaint | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  function buildParams(limit: number, offsetVal: number) {
    const params = new URLSearchParams({ limit: String(limit), offset: String(offsetVal) });
    if (search) params.set("search", search);
    if (dateFrom) params.set("date_from", dateFrom);
    if (dateTo) params.set("date_to", dateTo);
    if (divisionFilter) params.set("division_id", String(divisionFilter));
    return params;
  }

  function load() {
    setIsLoading(true);
    api
      .get<{ total: number; rows: Complaint[] }>(`/complaints?${buildParams(LIMIT, offset).toString()}`)
      .then((res) => {
        setComplaints(res.rows);
        setTotal(res.total);
      })
      .catch(() => setError("Unable to load complaints"))
      .finally(() => setIsLoading(false));
  }

  useEffect(load, [offset, search, dateFrom, dateTo, divisionFilter]);
  useEffect(() => {
    api.get<Metrics>("/complaints/metrics").then(setMetrics).catch(() => {});
    getDivisions().then(setDivisions).catch(() => {});
  }, []);

  function handleClearFilters() {
    setOffset(0);
    setSearch("");
    setDateFrom("");
    setDateTo("");
    setDivisionFilter("");
  }

  async function updateStatus(id: number, data: Partial<Complaint>) {
    await api.patch(`/complaints/${id}`, data);
    load();
  }

  return (
    <div>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Complaint Tracking</h1>
          <p className={styles.subtitle}>
            Lodge and track vendor-related grievances across the SERVMS network.
          </p>
        </div>
        <button className={styles.addBtn} onClick={() => navigate("/complaints/new")}>
          + New Complaint
        </button>
      </div>

      <div className={styles.statGrid}>
        <StatCard label="Open Complaints" value={metrics?.openComplaints ?? "—"} />
        <StatCard label="Pending ATR" value={metrics?.pendingATR ?? "—"} />
        <StatCard
          label="Avg. Resolution Time"
          value={metrics ? `${metrics.avgResolutionTime} hrs` : "—"}
        />
      </div>

      <div
        style={{
          background: "var(--color-surface)",
          borderRadius: "var(--radius-lg)",
          boxShadow: "var(--shadow-card)",
          padding: "18px 20px",
          marginBottom: 16,
        }}
      >
        <div className={styles.filterRow}>
          <LabeledField label="Search Complaints">
            <input
              className={styles.searchInput}
              style={{ marginBottom: 0, maxWidth: "none" }}
              placeholder="ID, Vendor, or Category…"
              value={search}
              onChange={(e) => {
                setOffset(0);
                setSearch(e.target.value);
              }}
            />
          </LabeledField>
          <LabeledField label="Date Range">
            <div style={{ display: "flex", gap: 6 }}>
              <input
                type="date"
                className={styles.select}
                value={dateFrom}
                onChange={(e) => {
                  setOffset(0);
                  setDateFrom(e.target.value);
                }}
              />
              <input
                type="date"
                className={styles.select}
                value={dateTo}
                onChange={(e) => {
                  setOffset(0);
                  setDateTo(e.target.value);
                }}
              />
            </div>
          </LabeledField>
          <LabeledField label="Division/Unit">
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
          <div style={{ display: "flex", gap: 8, alignSelf: "flex-end" }}>
            <button type="button" className={styles.cancelBtn} onClick={handleClearFilters}>
              Clear Filters
            </button>
            <button type="button" className={styles.addBtn} onClick={load}>
              Apply
            </button>
          </div>
        </div>
      </div>

      {error && <div className={styles.errorBanner}>{error}</div>}

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Complaint ID</th>
              <th>Date</th>
              <th>Unit / Station</th>
              <th>Category</th>
              <th>Priority</th>
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
            ) : complaints.length === 0 ? (
              <tr>
                <td colSpan={7} className={styles.emptyCell}>
                  No complaints found.
                </td>
              </tr>
            ) : (
              complaints.map((c) => (
                <tr key={c.id}>
                  <td className={styles.strong}>#{c.complaint_code}</td>
                  <td>{c.occurrence_date ? new Date(c.occurrence_date).toLocaleDateString() : "—"}</td>
                  <td>{c.unit_name ?? c.station_name ?? "—"}</td>
                  <td>{c.category}</td>
                  <td>
                    <span
                      className={`${styles.pill} ${
                        c.priority === "high"
                          ? styles.pillHigh
                          : c.priority === "medium"
                          ? styles.pillMedium
                          : styles.pillLow
                      }`}
                    >
                      {c.priority.toUpperCase()}
                    </span>
                  </td>
                  <td>
                    <span
                      className={
                        c.complaints_status === "resolved"
                          ? styles.statusGood
                          : c.complaints_status === "rejected"
                          ? styles.statusBad
                          : styles.statusWarn
                      }
                    >
                      {STATUS_LABELS[c.complaints_status]}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        type="button"
                        className={styles.pageBtn}
                        title="View complaint"
                        onClick={() => setViewComplaint(c)}
                      >
                        <EyeIcon />
                      </button>
                      <button
                        type="button"
                        className={styles.pageBtn}
                        title="Edit complaint"
                        onClick={() => setEditComplaintTarget(c)}
                      >
                        <EditIcon />
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

      {viewComplaint && (
        <div className={styles.modalOverlay} onClick={() => setViewComplaint(null)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h2 className={styles.modalTitle}>#{viewComplaint.complaint_code}</h2>
            <div className={styles.formGrid}>
              <DetailItem label="Category" value={viewComplaint.category} />
              <DetailItem
                label="Priority"
                value={viewComplaint.priority.charAt(0).toUpperCase() + viewComplaint.priority.slice(1)}
              />
              <DetailItem
                label="Date"
                value={
                  viewComplaint.occurrence_date
                    ? new Date(viewComplaint.occurrence_date).toLocaleDateString()
                    : "—"
                }
              />
              <DetailItem label="Unit / Station" value={viewComplaint.unit_name ?? viewComplaint.station_name ?? "—"} />
              <DetailItem label="Division" value={viewComplaint.division_name ?? "—"} />
              <DetailItem label="Location" value={viewComplaint.location_text ?? "—"} />
              <DetailItem label="Registered By" value={viewComplaint.registered_by_name ?? "—"} />
              <DetailItem label="Status" value={STATUS_LABELS[viewComplaint.complaints_status]} />
              <div className={styles.fieldWide}>
                <div className={styles.fieldLabel}>Description</div>
                <div className={styles.strong}>{viewComplaint.description}</div>
              </div>
            </div>
            <div className={styles.modalActions}>
              <button className={styles.cancelBtn} onClick={() => setViewComplaint(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {editComplaintTarget && (
        <EditComplaintModal
          complaint={editComplaintTarget}
          onClose={() => setEditComplaintTarget(null)}
          onSaved={(data) => {
            updateStatus(editComplaintTarget.id, data);
            setEditComplaintTarget(null);
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

function EditComplaintModal({
  complaint,
  onClose,
  onSaved,
}: {
  complaint: Complaint;
  onClose: () => void;
  onSaved: (data: Partial<Complaint>) => void;
}) {
  const [category, setCategory] = useState(complaint.category);
  const [priority, setPriority] = useState(complaint.priority);
  const [complaintsStatus, setComplaintsStatus] = useState(complaint.complaints_status);
  const [description, setDescription] = useState(complaint.description);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit() {
    setError(null);
    setIsSubmitting(true);
    try {
      onSaved({
        category,
        priority,
        complaints_status: complaintsStatus,
        description,
      });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to update complaint");
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
            <span className={styles.fieldLabel}>Category</span>
            <input value={category} onChange={(e) => setCategory(e.target.value)} />
          </div>
          <div className={styles.field}>
            <span className={styles.fieldLabel}>Priority</span>
            <select value={priority} onChange={(e) => setPriority(e.target.value as Complaint["priority"])}>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>
          <div className={styles.field}>
            <span className={styles.fieldLabel}>Status</span>
            <select
              value={complaintsStatus}
              onChange={(e) => setComplaintsStatus(e.target.value as Complaint["complaints_status"])}
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
              <span className={styles.fieldLabel}>Description</span>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} />
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
