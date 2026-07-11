import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { api, ApiError } from "../api/client";
import { getDivisions, getStations, getContractorsLite } from "../api/masters";
import type { Contractor, Division, Station, Unit } from "../types";
import Field from "../components/ui/Field";
import StatCard from "../components/ui/StatCard";
import Pagination from "../components/ui/Pagination";
import styles from "../styles/listPage.module.css";

const STATUS_LABELS: Record<Unit["units_status"], string> = {
  active: "Active",
  expiring: "Expiring",
  inactive: "Inactive",
  inspection_pending: "Pending",
};

const LIMIT = 10;

interface Metrics {
  totalStations: number;
  activeClusters: number;
  inspectors: number;
  unassigned: number;
}

export default function LocationMastersPage() {
  const [units, setUnits] = useState<Unit[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);

  const [search, setSearch] = useState("");
  const [divisionFilter, setDivisionFilter] = useState<number | "">("");
  const [stationFilter, setStationFilter] = useState<number | "">("");
  const [statusFilter, setStatusFilter] = useState<"" | "active" | "inspection_pending">("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [clusterFilter, setClusterFilter] = useState("");
  const [contractTypeFilter, setContractTypeFilter] = useState("");

  const [divisions, setDivisions] = useState<Division[]>([]);
  const [stations, setStations] = useState<Station[]>([]);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editUnitTarget, setEditUnitTarget] = useState<Unit | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  function buildParams(limit: number, offsetVal: number) {
    const params = new URLSearchParams({ limit: String(limit), offset: String(offsetVal) });
    if (search) params.set("search", search);
    if (divisionFilter) params.set("division_id", String(divisionFilter));
    if (stationFilter) params.set("station_id", String(stationFilter));
    if (statusFilter) params.set("units_status", statusFilter);
    if (clusterFilter) params.set("cluster_name", clusterFilter);
    if (contractTypeFilter) params.set("contract_type", contractTypeFilter);
    return params;
  }

  function load() {
    setIsLoading(true);
    api
      .get<{ total: number; rows: Unit[] }>(`/units?${buildParams(LIMIT, offset).toString()}`)
      .then((res) => {
        setUnits(res.rows);
        setTotal(res.total);
      })
      .catch(() => setError("Unable to load units"))
      .finally(() => setIsLoading(false));
  }

  useEffect(load, [offset, search, divisionFilter, stationFilter, statusFilter, clusterFilter, contractTypeFilter]);
  useEffect(() => {
    api.get<Metrics>("/units/metrics").then(setMetrics).catch(() => {});
    getDivisions().then(setDivisions).catch(() => {});
  }, []);

  useEffect(() => {
    getStations(divisionFilter || undefined)
      .then(setStations)
      .catch(() => {});
  }, [divisionFilter]);

  async function handleDelete(unit: Unit) {
    if (!window.confirm(`Deactivate location "${unit.unit_name}"?`)) return;
    try {
      await api.delete(`/units/${unit.id}`);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to deactivate location");
    }
  }

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
        <StatCard label="Total Stations" value={metrics?.totalStations ?? "—"} />
        <StatCard label="Active Clusters" value={metrics?.activeClusters ?? "—"} />
        <StatCard label="Inspectors" value={metrics?.inspectors ?? "—"} />
        <StatCard label="Unassigned" value={metrics?.unassigned ?? "—"} />
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
              placeholder="Search Master Data…"
              value={search}
              onChange={(e) => {
                setOffset(0);
                setSearch(e.target.value);
              }}
            />
          </LabeledField>
          <LabeledField label="Division">
            <select
              className={styles.select}
              value={divisionFilter}
              onChange={(e) => {
                setOffset(0);
                setDivisionFilter(e.target.value ? Number(e.target.value) : "");
                setStationFilter("");
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
          <LabeledField label="Station">
            <select
              className={styles.select}
              value={stationFilter}
              onChange={(e) => {
                setOffset(0);
                setStationFilter(e.target.value ? Number(e.target.value) : "");
              }}
            >
              <option value="">All Stations</option>
              {stations.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.station_name}
                </option>
              ))}
            </select>
          </LabeledField>
        </div>

        <div className={styles.filterRow}>
          <LabeledField label="Status">
            <div style={{ display: "flex", gap: 8 }}>
              <StatusToggle
                label="Active"
                active={statusFilter === "active"}
                onClick={() => {
                  setOffset(0);
                  setStatusFilter((s) => (s === "active" ? "" : "active"));
                }}
              />
              <StatusToggle
                label="Pending"
                active={statusFilter === "inspection_pending"}
                onClick={() => {
                  setOffset(0);
                  setStatusFilter((s) => (s === "inspection_pending" ? "" : "inspection_pending"));
                }}
              />
            </div>
          </LabeledField>
          <div style={{ flex: 1 }} />
          <button
            type="button"
            className={styles.cancelBtn}
            style={{ alignSelf: "flex-end" }}
            onClick={() => setShowAdvanced((s) => !s)}
          >
            ⚲ {showAdvanced ? "Fewer Filters" : "Advanced Filters"}
          </button>
        </div>

        {showAdvanced && (
          <div className={styles.filterRow}>
            <LabeledField label="Cluster Name">
              <input
                className={styles.select}
                placeholder="Filter by cluster…"
                value={clusterFilter}
                onChange={(e) => {
                  setOffset(0);
                  setClusterFilter(e.target.value);
                }}
              />
            </LabeledField>
            <LabeledField label="Contract Type">
              <select
                className={styles.select}
                value={contractTypeFilter}
                onChange={(e) => {
                  setOffset(0);
                  setContractTypeFilter(e.target.value);
                }}
              >
                <option value="">All Types</option>
                <option value="long_term">Long Term</option>
                <option value="short_term">Short Term</option>
                <option value="temporary">Temporary</option>
              </select>
            </LabeledField>
          </div>
        )}
      </div>

      {error && <div className={styles.errorBanner}>{error}</div>}

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Station</th>
              <th>Platform No.</th>
              <th>Cluster Name</th>
              <th>Description</th>
              <th>Inspector</th>
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
            ) : units.length === 0 ? (
              <tr>
                <td colSpan={7} className={styles.emptyCell}>
                  No locations found.
                </td>
              </tr>
            ) : (
              units.map((u) => (
                <tr key={u.id}>
                  <td>
                    <div className={styles.strong}>
                      {u.station_name ?? "—"} {u.station_code ? `(${u.station_code})` : ""}
                    </div>
                    <div className={styles.sub}>{u.division_name ?? "—"}</div>
                  </td>
                  <td>{u.platform_location ?? "—"}</td>
                  <td>{u.cluster_name ? <span className={styles.roleTag}>{u.cluster_name}</span> : "—"}</td>
                  <td>{u.area_description ?? "—"}</td>
                  <td>
                    {u.inspector_name ? (
                      <div className={styles.userCell}>
                        <div className={styles.avatar}>{u.inspector_name.charAt(0)}</div>
                        <div>{u.inspector_name}</div>
                      </div>
                    ) : (
                      <span className={styles.statusBad}>Unassigned</span>
                    )}
                  </td>
                  <td>
                    <span
                      className={
                        u.units_status === "active"
                          ? styles.statusGood
                          : u.units_status === "inactive"
                          ? styles.statusBad
                          : styles.statusWarn
                      }
                    >
                      • {STATUS_LABELS[u.units_status]}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        type="button"
                        className={styles.pageBtn}
                        title="Edit location"
                        onClick={() => setEditUnitTarget(u)}
                      >
                        <EditIcon />
                      </button>
                      <button
                        type="button"
                        className={styles.pageBtn}
                        title="Deactivate location"
                        onClick={() => handleDelete(u)}
                      >
                        <TrashIcon />
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

      {isFormOpen && (
        <UnitFormModal
          onClose={() => setIsFormOpen(false)}
          onSaved={() => {
            setIsFormOpen(false);
            load();
          }}
        />
      )}

      {editUnitTarget && (
        <UnitFormModal
          unit={editUnitTarget}
          onClose={() => setEditUnitTarget(null)}
          onSaved={() => {
            setEditUnitTarget(null);
            load();
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

function StatusToggle({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: "8px 18px",
        borderRadius: "var(--radius-md)",
        fontSize: 13.5,
        fontWeight: 600,
        border: active ? "1px solid var(--color-primary)" : "1px solid var(--color-border)",
        background: active ? "var(--color-primary)" : "var(--color-bg)",
        color: active ? "#fff" : "var(--color-text)",
        cursor: "pointer",
      }}
    >
      {label}
    </button>
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

function TrashIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
      <path
        d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m-9 0 1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function UnitFormModal({
  unit,
  onClose,
  onSaved,
}: {
  unit?: Unit;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!unit;
  const [unitCode, setUnitCode] = useState(unit?.unit_code ?? "");
  const [unitName, setUnitName] = useState(unit?.unit_name ?? "");
  const [stationId, setStationId] = useState<number | "">(unit?.station_id ?? "");
  const [platformLocation, setPlatformLocation] = useState(unit?.platform_location ?? "");
  const [clusterName, setClusterName] = useState(unit?.cluster_name ?? "");
  const [areaDescription, setAreaDescription] = useState(unit?.area_description ?? "");
  const [contractType, setContractType] = useState<Unit["contract_type"]>(unit?.contract_type ?? "long_term");
  const [contractorId, setContractorId] = useState<number | "">(unit?.contractor_id ?? "");
  const [monthlyFee, setMonthlyFee] = useState(unit?.monthly_fee ? String(unit.monthly_fee) : "");
  const [unitsStatus, setUnitsStatus] = useState<Unit["units_status"]>(unit?.units_status ?? "active");
  const [stations, setStations] = useState<Station[]>([]);
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    getStations().then(setStations).catch(() => {});
    getContractorsLite().then(setContractors).catch(() => {});
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      if (isEdit && unit) {
        await api.patch(`/units/${unit.id}`, {
          unit_name: unitName,
          station_id: stationId,
          platform_location: platformLocation || undefined,
          cluster_name: clusterName || undefined,
          area_description: areaDescription || undefined,
          contract_type: contractType,
          contractor_id: contractorId || undefined,
          monthly_fee: monthlyFee ? Number(monthlyFee) : undefined,
          units_status: unitsStatus,
        });
      } else {
        await api.post("/units", {
          unit_code: unitCode,
          unit_name: unitName,
          station_id: stationId,
          platform_location: platformLocation || undefined,
          cluster_name: clusterName || undefined,
          area_description: areaDescription || undefined,
          contract_type: contractType,
          contractor_id: contractorId || undefined,
          monthly_fee: monthlyFee ? Number(monthlyFee) : undefined,
        });
      }
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to save location");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <form className={styles.modal} onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit}>
        <h2 className={styles.modalTitle}>{isEdit ? "Edit Location" : "Unit Configuration"}</h2>
        <div className={styles.formGrid}>
          <Field label="Station">
            <select
              value={stationId}
              onChange={(e) => setStationId(e.target.value ? Number(e.target.value) : "")}
              required
            >
              <option value="">Select Railway Station</option>
              {stations.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.station_name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Platform / Location">
            <input
              value={platformLocation ?? ""}
              onChange={(e) => setPlatformLocation(e.target.value)}
              placeholder="e.g. Platform No 4, North End"
            />
          </Field>
          <Field label="Cluster Name">
            <input
              value={clusterName ?? ""}
              onChange={(e) => setClusterName(e.target.value)}
              placeholder="Enter assigned cluster"
            />
          </Field>
          <Field label="Contract Type">
            <select
              value={contractType}
              onChange={(e) => setContractType(e.target.value as Unit["contract_type"])}
            >
              <option value="long_term">Long Term</option>
              <option value="short_term">Short Term</option>
              <option value="temporary">Temporary</option>
            </select>
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
              disabled={isEdit}
            />
          </Field>
          <Field label="Contractor (optional)">
            <select
              value={contractorId}
              onChange={(e) => setContractorId(e.target.value ? Number(e.target.value) : "")}
            >
              <option value="">None</option>
              {contractors.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.company_name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Monthly Fee (₹)">
            <input
              type="number"
              min="0"
              value={monthlyFee}
              onChange={(e) => setMonthlyFee(e.target.value)}
            />
          </Field>
          <Field label="Description">
            <input
              value={areaDescription ?? ""}
              onChange={(e) => setAreaDescription(e.target.value)}
              placeholder="e.g. Cleaning and sanitation services"
            />
          </Field>
          {isEdit && (
            <Field label="Status">
              <select
                value={unitsStatus}
                onChange={(e) => setUnitsStatus(e.target.value as Unit["units_status"])}
              >
                <option value="active">Active</option>
                <option value="expiring">Expiring</option>
                <option value="inactive">Inactive</option>
                <option value="inspection_pending">Pending</option>
              </select>
            </Field>
          )}
        </div>

        {error && <div className={styles.errorBanner}>{error}</div>}

        <div className={styles.modalActions}>
          <button type="button" className={styles.cancelBtn} onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className={styles.addBtn} disabled={isSubmitting}>
            {isSubmitting ? "Saving…" : isEdit ? "Save Changes" : "Save Unit Details"}
          </button>
        </div>
      </form>
    </div>
  );
}
