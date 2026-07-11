import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { api, ApiError } from "../api/client";
import { DIVISION_LABELS, type Division, type Unit, type UnitStatus } from "../types";
import styles from "../styles/listPage.module.css";

const DIVISIONS: Division[] = ["ADRA", "RANCHI", "CHAKRADHARPUR", "KHARAGPUR"];

const STATUS_LABELS: Record<UnitStatus, string> = {
  ACTIVE: "Active",
  EXPIRING: "Expiring",
  INACTIVE: "Inactive",
  PENDING: "Pending",
};

export default function LocationMastersPage() {
  const [units, setUnits] = useState<Unit[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [search, setSearch] = useState("");

  function load() {
    setIsLoading(true);
    api
      .get<Unit[]>("/units")
      .then(setUnits)
      .catch(() => setError("Unable to load units"))
      .finally(() => setIsLoading(false));
  }

  useEffect(load, []);

  const filtered = useMemo(
    () =>
      units.filter(
        (u) =>
          !search ||
          u.unitName.toLowerCase().includes(search.toLowerCase()) ||
          u.unitCode.toLowerCase().includes(search.toLowerCase()) ||
          u.station.toLowerCase().includes(search.toLowerCase())
      ),
    [units, search]
  );

  const activeClusters = new Set(units.map((u) => u.clusterName).filter(Boolean)).size;
  const unassigned = units.filter((u) => !u.inspectorName).length;

  return (
    <div>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Location Masters</h1>
          <p className={styles.subtitle}>
            Manage and audit railway station service points and clusters.
          </p>
        </div>
        <button className={styles.addBtn} onClick={() => setIsFormOpen(true)}>
          + Add New Location
        </button>
      </div>

      <div className={styles.statGrid}>
        <StatCard label="Total Units" value={units.length} />
        <StatCard label="Active Clusters" value={activeClusters} />
        <StatCard label="Unassigned Inspector" value={unassigned} />
      </div>

      <input
        className={styles.searchInput}
        placeholder="Search master data…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {error && <div className={styles.errorBanner}>{error}</div>}

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Station</th>
              <th>Platform</th>
              <th>Cluster</th>
              <th>Inspector</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={5} className={styles.emptyCell}>
                  Loading…
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className={styles.emptyCell}>
                  No units found.
                </td>
              </tr>
            ) : (
              filtered.map((u) => (
                <tr key={u.id}>
                  <td>
                    <div className={styles.strong}>{u.station}</div>
                    <div className={styles.sub}>
                      {u.unitName} · {u.unitCode}
                    </div>
                  </td>
                  <td>{u.platformLocation ?? "—"}</td>
                  <td>{u.clusterName ?? "—"}</td>
                  <td>
                    {u.inspectorName ?? (
                      <span className={styles.statusBad}>Unassigned</span>
                    )}
                  </td>
                  <td>
                    <span
                      className={
                        u.status === "ACTIVE"
                          ? styles.statusGood
                          : u.status === "EXPIRING"
                          ? styles.statusWarn
                          : u.status === "PENDING"
                          ? styles.statusWarn
                          : styles.statusBad
                      }
                    >
                      {STATUS_LABELS[u.status]}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {isFormOpen && (
        <AddUnitModal
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

function AddUnitModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [station, setStation] = useState("");
  const [platformLocation, setPlatformLocation] = useState("");
  const [division, setDivision] = useState<Division>("ADRA");
  const [clusterName, setClusterName] = useState("");
  const [unitName, setUnitName] = useState("");
  const [unitCode, setUnitCode] = useState("");
  const [inspectorName, setInspectorName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await api.post("/units", {
        station,
        platformLocation: platformLocation || undefined,
        division,
        clusterName: clusterName || undefined,
        unitName,
        unitCode,
        inspectorName: inspectorName || undefined,
      });
      onCreated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to create unit");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <form className={styles.modal} onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit}>
        <h2 className={styles.modalTitle}>Unit Configuration</h2>
        <div className={styles.formGrid}>
          <Field label="Station">
            <input value={station} onChange={(e) => setStation(e.target.value)} required />
          </Field>
          <Field label="Platform / Location">
            <input
              value={platformLocation}
              onChange={(e) => setPlatformLocation(e.target.value)}
              placeholder="e.g. Platform No 4, North End"
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
          <Field label="Cluster Name">
            <input
              value={clusterName}
              onChange={(e) => setClusterName(e.target.value)}
              placeholder="Enter assigned cluster"
            />
          </Field>
          <Field label="Unit Name">
            <input
              value={unitName}
              onChange={(e) => setUnitName(e.target.value)}
              placeholder="e.g. Tea Stall / Catering Booth"
              required
            />
          </Field>
          <Field label="Unit Code / ID">
            <input
              value={unitCode}
              onChange={(e) => setUnitCode(e.target.value)}
              placeholder="Unique identification code"
              required
            />
          </Field>
          <Field label="Inspector (optional)">
            <input value={inspectorName} onChange={(e) => setInspectorName(e.target.value)} />
          </Field>
        </div>

        {error && <div className={styles.errorBanner}>{error}</div>}

        <div className={styles.modalActions}>
          <button type="button" className={styles.cancelBtn} onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className={styles.addBtn} disabled={isSubmitting}>
            {isSubmitting ? "Saving…" : "Save Unit Details"}
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
