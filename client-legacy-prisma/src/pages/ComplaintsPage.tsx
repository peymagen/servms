import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { api, ApiError } from "../api/client";
import {
  DIVISION_LABELS,
  type Complaint,
  type ComplaintPriority,
  type ComplaintStatus,
  type Division,
} from "../types";
import styles from "../styles/listPage.module.css";

const DIVISIONS: Division[] = ["ADRA", "RANCHI", "CHAKRADHARPUR", "KHARAGPUR"];
const PRIORITIES: ComplaintPriority[] = ["LOW", "MEDIUM", "HIGH"];

const STATUS_LABELS: Record<ComplaintStatus, string> = {
  PENDING: "Pending",
  UNDER_INVESTIGATION: "Under Investigation",
  RESOLVED: "Resolved",
};

export default function ComplaintsPage() {
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [search, setSearch] = useState("");

  function load() {
    setIsLoading(true);
    api
      .get<Complaint[]>("/complaints")
      .then(setComplaints)
      .catch(() => setError("Unable to load complaints"))
      .finally(() => setIsLoading(false));
  }

  useEffect(load, []);

  const filtered = useMemo(
    () =>
      complaints.filter(
        (c) =>
          !search ||
          c.unitStation.toLowerCase().includes(search.toLowerCase()) ||
          c.category.toLowerCase().includes(search.toLowerCase())
      ),
    [complaints, search]
  );

  const open = complaints.filter((c) => c.status !== "RESOLVED").length;
  const avgHint = complaints.length === 0 ? "—" : `${complaints.length} total`;

  return (
    <div>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Complaint Tracking</h1>
          <p className={styles.subtitle}>
            Lodge and track vendor-related grievances across the SERVMS network.
          </p>
        </div>
        <button className={styles.addBtn} onClick={() => setIsFormOpen(true)}>
          + New Complaint
        </button>
      </div>

      <div className={styles.statGrid}>
        <StatCard label="Open Complaints" value={open} />
        <StatCard label="Total Logged" value={avgHint} />
      </div>

      <input
        className={styles.searchInput}
        placeholder="Search by unit/station or category…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {error && <div className={styles.errorBanner}>{error}</div>}

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Unit / Station</th>
              <th>Category</th>
              <th>Priority</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={4} className={styles.emptyCell}>
                  Loading…
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={4} className={styles.emptyCell}>
                  No complaints found.
                </td>
              </tr>
            ) : (
              filtered.map((c) => (
                <tr key={c.id}>
                  <td>
                    <div className={styles.strong}>{c.unitStation}</div>
                    <div className={styles.sub}>{c.description}</div>
                  </td>
                  <td>{c.category}</td>
                  <td>
                    <span
                      className={`${styles.pill} ${
                        c.priority === "HIGH"
                          ? styles.pillHigh
                          : c.priority === "MEDIUM"
                          ? styles.pillMedium
                          : styles.pillLow
                      }`}
                    >
                      {c.priority}
                    </span>
                  </td>
                  <td>
                    <span
                      className={
                        c.status === "RESOLVED"
                          ? styles.statusGood
                          : c.status === "UNDER_INVESTIGATION"
                          ? styles.statusWarn
                          : styles.statusBad
                      }
                    >
                      {STATUS_LABELS[c.status]}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {isFormOpen && (
        <NewComplaintModal
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

function NewComplaintModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [unitStation, setUnitStation] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [division, setDivision] = useState<Division>("ADRA");
  const [priority, setPriority] = useState<ComplaintPriority>("MEDIUM");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await api.post("/complaints", {
        unitStation,
        category,
        description,
        division,
        priority,
      });
      onCreated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to register complaint");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <form className={styles.modal} onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit}>
        <h2 className={styles.modalTitle}>Complaint Registration</h2>
        <div className={styles.formGrid}>
          <Field label="Unit / Location">
            <input
              value={unitStation}
              onChange={(e) => setUnitStation(e.target.value)}
              placeholder="e.g. Shalimar Station, Platform 2"
              required
            />
          </Field>
          <Field label="Category">
            <input
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="e.g. Food Quality & Hygiene"
              required
            />
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
          <Field label="Priority">
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as ComplaintPriority)}
            >
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </Field>
          <div className={styles.fieldWide}>
            <Field label="Detailed Description">
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Provide a clear and concise description of the incident…"
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
            {isSubmitting ? "Submitting…" : "Submit Complaint"}
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
