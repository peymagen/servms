import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent, type ReactNode } from "react";
import { useAuth, useDivisionLock } from "../context/AuthContext";
import { useSearchParams } from "react-router-dom";
import {
  useGetUnitsQuery,
  useGetUnitMetricsQuery,
  useCreateUnitMutation,
  useEditUnitMutation,
  useDeleteUnitMutation,
} from "../api/unitApi";
import {
  useGetDivisionsQuery,
  useGetStationsQuery,
  useGetContractorsLiteQuery,
  useCreateStationMutation,
  useEditStationMutation,
  useDeleteStationMutation,
  useBulkImportStationsMutation,
  type StationBulkImportResult,
} from "../api/mastersApi";
import {
  useGetTrainsQuery,
  useCreateTrainMutation,
  useEditTrainMutation,
  useDeleteTrainMutation,
} from "../api/trainApi";
import {
  useGetClustersQuery,
  useCreateClusterMutation,
  useDeleteClusterMutation,
} from "../api/clusterApi";
import { useGetDropdownOptionsQuery } from "../api/dropdownApi";
import type { ClusterType, Station, Train, Unit, UnitLocationType } from "../types";
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
type TabKey = "stations" | "trains" | "clusters" | "units";

export default function LocationMastersPage() {
  const [tab, setTab] = useState<TabKey>("units");

  return (
    <div>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Location & Unit Management</h1>
          <p className={styles.subtitle}>
            Manage stations, trains, clusters, and the units linked to them.
          </p>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <TabButton label="Units" active={tab === "units"} onClick={() => setTab("units")} />
        <TabButton label="Stations" active={tab === "stations"} onClick={() => setTab("stations")} />
        <TabButton label="Trains" active={tab === "trains"} onClick={() => setTab("trains")} />
        <TabButton label="Clusters" active={tab === "clusters"} onClick={() => setTab("clusters")} />
      </div>

      {tab === "units" && <UnitsTab />}
      {tab === "stations" && <StationsTab />}
      {tab === "trains" && <TrainsTab />}
      {tab === "clusters" && <ClustersTab />}
    </div>
  );
}

function TabButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
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

function LabeledField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className={styles.field} style={{ flex: 1 }}>
      <span className={styles.fieldLabel}>{label}</span>
      {children}
    </div>
  );
}

function EditIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
      <path d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17v3Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
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

/* ═══════════════════════════════ UNITS TAB ═══════════════════════════════ */

function UnitsTab() {
  const { can } = useAuth();
  const canCreate = can("unit_management", "create");
  const canEdit = can("unit_management", "edit");
  const canDelete = can("unit_management", "delete");
  // Seeds initial filters from the URL once (e.g. the Dashboard's Registered
  // Units card links here as `/locations?status=idle&division_id=2`) without
  // migrating this page to fully URL-synced state.
  const [searchParams] = useSearchParams();
  const [offset, setOffset] = useState(0);
  const [search, setSearch] = useState("");
  const [divisionFilter, setDivisionFilter] = useState<number | "">(() => {
    const raw = searchParams.get("division_id");
    return raw ? Number(raw) : "";
  });
  const [locationTypeFilter, setLocationTypeFilter] = useState<UnitLocationType | "">("");
  const [statusFilter, setStatusFilter] = useState<"" | "active" | "idle" | "inactive" | "inspection_pending">(
    () => (searchParams.get("status") as "" | "active" | "idle" | "inactive" | "inspection_pending") || ""
  );
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [contractTypeFilter, setContractTypeFilter] = useState("");

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editUnitTarget, setEditUnitTarget] = useState<Unit | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const filters = useMemo(
    () => ({
      limit: LIMIT,
      offset,
      search: search || undefined,
      division_id: divisionFilter || undefined,
      location_type: locationTypeFilter || undefined,
      units_status: statusFilter || undefined,
      contract_type: (contractTypeFilter || undefined) as any,
    }),
    [offset, search, divisionFilter, locationTypeFilter, statusFilter, contractTypeFilter]
  );

  const { data: listData, isFetching: isLoading, error: loadError } = useGetUnitsQuery(filters);
  const { data: metrics } = useGetUnitMetricsQuery();
  const { data: divisions = [] } = useGetDivisionsQuery();
  const [deleteUnit] = useDeleteUnitMutation();

  const units = listData?.rows ?? [];
  const total = listData?.total ?? 0;
  const error = deleteError ?? (loadError ? "Unable to load units" : null);

  async function handleDelete(unit: Unit) {
    if (!window.confirm(`Deactivate unit "${unit.unit_name}"?`)) return;
    setDeleteError(null);
    try {
      await deleteUnit(unit.id).unwrap();
    } catch (err: any) {
      setDeleteError(err?.data?.message ?? err?.message ?? "Unable to deactivate unit");
    }
  }

  function locationLabel(u: Unit) {
    if (u.location_type === "station") return u.station_name ? `${u.station_name} (${u.station_code ?? "—"})` : "—";
    if (u.location_type === "train") return u.train_name ? `${u.train_name} (${u.train_number ?? "—"})` : "—";
    return u.cluster_display_name ?? "—";
  }

  return (
    <div>
      <div className={styles.header}>
        <div />
        {canCreate && (
          <button className={styles.addBtn} onClick={() => setIsFormOpen(true)}>
            + Add New Unit
          </button>
        )}
      </div>

      <div className={styles.statGrid}>
        <StatCard label="Total Stations" value={metrics?.totalStations ?? "—"} />
        <StatCard label="Active Units" value={metrics?.activeClusters ?? "—"} />
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
              placeholder="Search unit name, code, station, or train…"
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
          <LabeledField label="Location Type">
            <select
              className={styles.select}
              value={locationTypeFilter}
              onChange={(e) => {
                setOffset(0);
                setLocationTypeFilter(e.target.value as UnitLocationType | "");
              }}
            >
              <option value="">All</option>
              <option value="station">Station</option>
              <option value="train">Train</option>
              <option value="cluster">Cluster</option>
            </select>
          </LabeledField>
        </div>

        <div className={styles.filterRow}>
          <LabeledField label="Status">
            <div style={{ display: "flex", gap: 8 }}>
              <TabButton
                label="Active"
                active={statusFilter === "active"}
                onClick={() => {
                  setOffset(0);
                  setStatusFilter((s) => (s === "active" ? "" : "active"));
                }}
              />
              <TabButton
                label="Pending"
                active={statusFilter === "inspection_pending"}
                onClick={() => {
                  setOffset(0);
                  setStatusFilter((s) => (s === "inspection_pending" ? "" : "inspection_pending"));
                }}
              />
              <TabButton
                label="Idle"
                active={statusFilter === "idle"}
                onClick={() => {
                  setOffset(0);
                  setStatusFilter((s) => (s === "idle" ? "" : "idle"));
                }}
              />
              <TabButton
                label="Inactive"
                active={statusFilter === "inactive"}
                onClick={() => {
                  setOffset(0);
                  setStatusFilter((s) => (s === "inactive" ? "" : "inactive"));
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
                <option value="earning">Earning</option>
                <option value="expenditure">Expenditure</option>
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
              <th>Unit</th>
              <th>Location</th>
              <th>Contract Type</th>
              <th>Category</th>
              <th>Inspector</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={7} className={styles.emptyCell}>Loading…</td>
              </tr>
            ) : units.length === 0 ? (
              <tr>
                <td colSpan={7} className={styles.emptyCell}>No units found.</td>
              </tr>
            ) : (
              units.map((u) => (
                <tr key={u.id}>
                  <td>
                    <div className={styles.strong}>{u.unit_name}</div>
                    <div className={styles.sub}>{u.unit_code}</div>
                  </td>
                  <td>
                    <div className={styles.strong}>{locationLabel(u)}</div>
                    <div className={styles.sub}>
                      {u.location_type} · {u.division_name ?? "—"}
                    </div>
                  </td>
                  <td>
                    {u.contract_type ? (
                      <span className={styles.roleTag}>{u.contract_type === "earning" ? "Earning" : "Expenditure"}</span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td>{u.contract_category_label ?? "—"}</td>
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
                      {canEdit && (
                        <button type="button" className={styles.pageBtn} title="Edit unit" onClick={() => setEditUnitTarget(u)}>
                          <EditIcon />
                        </button>
                      )}
                      {canDelete && (
                        <button type="button" className={styles.pageBtn} title="Deactivate unit" onClick={() => handleDelete(u)}>
                          <TrashIcon />
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

      {isFormOpen && <UnitFormModal onClose={() => setIsFormOpen(false)} onSaved={() => setIsFormOpen(false)} />}
      {editUnitTarget && (
        <UnitFormModal unit={editUnitTarget} onClose={() => setEditUnitTarget(null)} onSaved={() => setEditUnitTarget(null)} />
      )}
    </div>
  );
}

function UnitFormModal({ unit, onClose, onSaved }: { unit?: Unit; onClose: () => void; onSaved: () => void }) {
  const isEdit = !!unit;

  // Field order per UAT: Division → Station/Train/Cluster → Contract Type → Contract
  // Category → Unit Name/Code → Area (if applicable) → Sketch (if Earning).
  const { locked: divisionLocked, ownDivisionId } = useDivisionLock();
  const [divisionId, setDivisionId] = useState<number | "">(unit?.division_id ?? ownDivisionId);

  useEffect(() => {
    if (divisionLocked && ownDivisionId) setDivisionId(ownDivisionId);
  }, [divisionLocked, ownDivisionId]);
  const [locationType, setLocationType] = useState<UnitLocationType>(unit?.location_type ?? "station");
  const [stationId, setStationId] = useState<number | "">(unit?.station_id ?? "");
  const [trainId, setTrainId] = useState<number | "">(unit?.train_id ?? "");
  const [clusterId, setClusterId] = useState<number | "">(unit?.cluster_id ?? "");
  const [contractType, setContractType] = useState<Unit["contract_type"]>(unit?.contract_type ?? "earning");
  const [contractCategoryId, setContractCategoryId] = useState<number | "">(unit?.contract_category_id ?? "");
  const [unitName, setUnitName] = useState(unit?.unit_name ?? "");
  const [unitCode, setUnitCode] = useState(unit?.unit_code ?? "");
  const [areaDescription, setAreaDescription] = useState(unit?.area_description ?? "");
  const [contractorId, setContractorId] = useState<number | "">(unit?.contractor_id ?? "");
  const [annualFee, setAnnualFee] = useState(unit?.annual_fee ? String(unit.annual_fee) : "");
  const [unitsStatus, setUnitsStatus] = useState<Unit["units_status"]>(unit?.units_status ?? "active");
  const [sketchFile, setSketchFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: divisions = [] } = useGetDivisionsQuery();
  const { data: stations = [] } = useGetStationsQuery(divisionId || undefined);
  const { data: trainData } = useGetTrainsQuery({ division_id: divisionId || undefined, limit: 200 });
  const { data: clusterData } = useGetClustersQuery({ division_id: divisionId || undefined, limit: 200 });
  const { data: categories = [] } = useGetDropdownOptionsQuery({ category: "contract_category", division_id: divisionId || undefined });
  const { data: contractors = [] } = useGetContractorsLiteQuery();
  const [createUnit, { isLoading: isCreating }] = useCreateUnitMutation();
  const [editUnit, { isLoading: isEditing }] = useEditUnitMutation();
  const isSubmitting = isCreating || isEditing;
  const isEarning = contractType === "earning";

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const payload = {
        unit_name: unitName,
        location_type: locationType,
        station_id: locationType === "station" ? Number(stationId) : undefined,
        train_id: locationType === "train" ? Number(trainId) : undefined,
        cluster_id: locationType === "cluster" ? Number(clusterId) : undefined,
        contract_type: contractType ?? undefined,
        contract_category_id: contractCategoryId ? Number(contractCategoryId) : undefined,
        area_description: areaDescription || undefined,
        sketch_map_file: sketchFile ?? undefined,
        contractor_id: contractorId ? Number(contractorId) : undefined,
        annual_fee: annualFee ? Number(annualFee) : undefined,
        units_status: unitsStatus,
      };
      if (isEdit && unit) {
        await editUnit({ id: unit.id, data: payload }).unwrap();
      } else {
        await createUnit({ ...payload, unit_code: unitCode }).unwrap();
      }
      onSaved();
    } catch (err: any) {
      setError(err?.data?.message ?? err?.message ?? "Unable to save unit");
    }
  }

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <form className={styles.modal} onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit}>
        <h2 className={styles.modalTitle}>{isEdit ? "Edit Unit" : "New Unit"}</h2>
        <div className={styles.formGrid}>
          <Field label="Division">
            <select
              value={divisionId}
              onChange={(e) => {
                setDivisionId(e.target.value ? Number(e.target.value) : "");
                setStationId("");
                setTrainId("");
                setClusterId("");
              }}
              required
              disabled={isEdit || divisionLocked}
            >
              <option value="">Select Division</option>
              {divisions.map((d) => (
                <option key={d.id} value={d.id}>{d.division_name}</option>
              ))}
            </select>
          </Field>

          <Field label="Location Type">
            <select
              value={locationType}
              onChange={(e) => setLocationType(e.target.value as UnitLocationType)}
              disabled={isEdit}
            >
              <option value="station">Station</option>
              <option value="train">Train</option>
              <option value="cluster">Cluster</option>
            </select>
          </Field>

          {locationType === "station" && (
            <Field label="Station">
              <select value={stationId} onChange={(e) => setStationId(e.target.value ? Number(e.target.value) : "")} required>
                <option value="">Select Station</option>
                {stations.map((s) => (
                  <option key={s.id} value={s.id}>{s.station_name}</option>
                ))}
              </select>
            </Field>
          )}
          {locationType === "train" && (
            <Field label="Train">
              <select value={trainId} onChange={(e) => setTrainId(e.target.value ? Number(e.target.value) : "")} required>
                <option value="">Select Train</option>
                {(trainData?.rows ?? []).map((t) => (
                  <option key={t.id} value={t.id}>{t.train_name} ({t.train_number})</option>
                ))}
              </select>
            </Field>
          )}
          {locationType === "cluster" && (
            <Field label="Cluster">
              <select value={clusterId} onChange={(e) => setClusterId(e.target.value ? Number(e.target.value) : "")} required>
                <option value="">Select Cluster</option>
                {(clusterData?.rows ?? []).map((c) => (
                  <option key={c.id} value={c.id}>{c.cluster_name}</option>
                ))}
              </select>
            </Field>
          )}

          <Field label="Contract Type">
            <select value={contractType ?? ""} onChange={(e) => setContractType(e.target.value as Unit["contract_type"])} required>
              <option value="earning">Earning</option>
              <option value="expenditure">Expenditure</option>
            </select>
          </Field>

          <Field label="Contract Category">
            <select value={contractCategoryId} onChange={(e) => setContractCategoryId(e.target.value ? Number(e.target.value) : "")}>
              <option value="">Select Category</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
            </select>
          </Field>

          <Field label="Unit Name">
            <input value={unitName} onChange={(e) => setUnitName(e.target.value)} placeholder="e.g. Tea Stall / Catering Booth" required />
          </Field>
          <Field label="Unit Code / ID">
            <input value={unitCode} onChange={(e) => setUnitCode(e.target.value)} placeholder="Unique identification code" required disabled={isEdit} />
          </Field>

          {isEarning && (
            <>
              <Field label="Area (sq. ft.)">
                <input value={areaDescription ?? ""} onChange={(e) => setAreaDescription(e.target.value)} placeholder="e.g. 120 sq. ft." />
              </Field>
              <Field label="Sketch (attachment)">
                <input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => setSketchFile(e.target.files?.[0] ?? null)} />
                {unit?.sketch_map_file && !sketchFile && (
                  <span className={styles.sub}>Current file on record — choose a new one to replace it.</span>
                )}
              </Field>
            </>
          )}

          <Field label="Contractor (optional)">
            <select value={contractorId} onChange={(e) => setContractorId(e.target.value ? Number(e.target.value) : "")}>
              <option value="">None</option>
              {contractors.map((c) => (
                <option key={c.id} value={c.id}>{c.company_name}</option>
              ))}
            </select>
          </Field>
          <Field label="Annual License Fee (₹)">
            <input type="number" min="0" value={annualFee} onChange={(e) => setAnnualFee(e.target.value)} />
          </Field>

          {isEdit && (
            <Field label="Status">
              <select value={unitsStatus} onChange={(e) => setUnitsStatus(e.target.value as Unit["units_status"])}>
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
          <button type="button" className={styles.cancelBtn} onClick={onClose}>Cancel</button>
          <button type="submit" className={styles.addBtn} disabled={isSubmitting}>
            {isSubmitting ? "Saving…" : isEdit ? "Save Changes" : "Save Unit"}
          </button>
        </div>
      </form>
    </div>
  );
}

/* ═══════════════════════════════ STATIONS TAB ═══════════════════════════════ */

function StationsTab() {
  const { can } = useAuth();
  const canCreate = can("location_management", "create");
  const canEdit = can("location_management", "edit");
  const canDelete = can("location_management", "delete");
  const [divisionFilter, setDivisionFilter] = useState<number | "">("");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Station | null>(null);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: divisions = [] } = useGetDivisionsQuery();
  const { data: stations = [], isFetching } = useGetStationsQuery(divisionFilter || undefined);
  const [deleteStation] = useDeleteStationMutation();

  async function handleDelete(s: Station) {
    if (!window.confirm(`Remove station "${s.station_name}"?`)) return;
    setError(null);
    try {
      await deleteStation(s.id).unwrap();
    } catch (err: any) {
      setError(err?.data?.message ?? err?.message ?? "Unable to remove station");
    }
  }

  return (
    <div>
      <div className={styles.header}>
        <div />
        <div style={{ display: "flex", gap: 10 }}>
          {canCreate && (
            <button className={styles.cancelBtn} onClick={() => setIsImportOpen(true)}>⬆ Bulk Import</button>
          )}
          {canCreate && (
            <button className={styles.addBtn} onClick={() => setIsFormOpen(true)}>+ Add Station</button>
          )}
        </div>
      </div>

      <div className={styles.filterRow} style={{ marginBottom: 12 }}>
        <LabeledField label="Division">
          <select className={styles.select} value={divisionFilter} onChange={(e) => setDivisionFilter(e.target.value ? Number(e.target.value) : "")}>
            <option value="">All Divisions</option>
            {divisions.map((d) => (
              <option key={d.id} value={d.id}>{d.division_name}</option>
            ))}
          </select>
        </LabeledField>
      </div>

      {error && <div className={styles.errorBanner}>{error}</div>}

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Station Name</th>
              <th>Station Code</th>
              <th>Division</th>
              <th>No. of Platforms</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {isFetching ? (
              <tr><td colSpan={5} className={styles.emptyCell}>Loading…</td></tr>
            ) : stations.length === 0 ? (
              <tr><td colSpan={5} className={styles.emptyCell}>No stations found.</td></tr>
            ) : (
              stations.map((s) => (
                <tr key={s.id}>
                  <td className={styles.strong}>{s.station_name}</td>
                  <td>{s.station_code}</td>
                  <td>{s.division_name ?? "—"}</td>
                  <td>{s.platform_count ?? "—"}</td>
                  <td>
                    <div style={{ display: "flex", gap: 8 }}>
                      {canEdit && (
                        <button type="button" className={styles.pageBtn} title="Edit station" onClick={() => setEditTarget(s)}>
                          <EditIcon />
                        </button>
                      )}
                      {canDelete && (
                        <button type="button" className={styles.pageBtn} title="Remove station" onClick={() => handleDelete(s)}>
                          <TrashIcon />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {isFormOpen && <StationFormModal onClose={() => setIsFormOpen(false)} onSaved={() => setIsFormOpen(false)} />}
      {editTarget && <StationFormModal station={editTarget} onClose={() => setEditTarget(null)} onSaved={() => setEditTarget(null)} />}
      {isImportOpen && <StationBulkImportModal onClose={() => setIsImportOpen(false)} />}
    </div>
  );
}

function StationFormModal({ station, onClose, onSaved }: { station?: Station; onClose: () => void; onSaved: () => void }) {
  const isEdit = !!station;
  const { locked: divisionLocked, ownDivisionId } = useDivisionLock();
  const [divisionId, setDivisionId] = useState<number | "">(station?.division_id ?? ownDivisionId);

  useEffect(() => {
    if (divisionLocked && ownDivisionId) setDivisionId(ownDivisionId);
  }, [divisionLocked, ownDivisionId]);
  const [stationName, setStationName] = useState(station?.station_name ?? "");
  const [stationCode, setStationCode] = useState(station?.station_code ?? "");
  const [platformCount, setPlatformCount] = useState(station?.platform_count ? String(station.platform_count) : "");
  const [error, setError] = useState<string | null>(null);

  const { data: divisions = [] } = useGetDivisionsQuery();
  const [createStation, { isLoading: isCreating }] = useCreateStationMutation();
  const [editStation, { isLoading: isEditing }] = useEditStationMutation();
  const isSubmitting = isCreating || isEditing;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const payload = {
        division_id: Number(divisionId),
        station_name: stationName,
        station_code: stationCode,
        platform_count: platformCount ? Number(platformCount) : undefined,
      };
      if (isEdit && station) {
        await editStation({ id: station.id, data: payload }).unwrap();
      } else {
        await createStation(payload).unwrap();
      }
      onSaved();
    } catch (err: any) {
      setError(err?.data?.message ?? err?.message ?? "Unable to save station");
    }
  }

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <form className={styles.modal} onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit}>
        <h2 className={styles.modalTitle}>{isEdit ? "Edit Station" : "New Station"}</h2>
        <div className={styles.formGrid}>
          <Field label="Division">
            <select value={divisionId} disabled={divisionLocked} onChange={(e) => setDivisionId(e.target.value ? Number(e.target.value) : "")} required>
              <option value="">Select Division</option>
              {divisions.map((d) => (
                <option key={d.id} value={d.id}>{d.division_name}</option>
              ))}
            </select>
          </Field>
          <Field label="Station Name">
            <input value={stationName} onChange={(e) => setStationName(e.target.value)} required />
          </Field>
          <Field label="Station Code">
            <input value={stationCode} onChange={(e) => setStationCode(e.target.value)} required disabled={isEdit} />
          </Field>
          <Field label="No. of Platforms">
            <input type="number" min="1" value={platformCount} onChange={(e) => setPlatformCount(e.target.value)} required />
          </Field>
        </div>
        {error && <div className={styles.errorBanner}>{error}</div>}
        <div className={styles.modalActions}>
          <button type="button" className={styles.cancelBtn} onClick={onClose}>Cancel</button>
          <button type="submit" className={styles.addBtn} disabled={isSubmitting}>{isSubmitting ? "Saving…" : "Save Station"}</button>
        </div>
      </form>
    </div>
  );
}

function StationBulkImportModal({ onClose }: { onClose: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<StationBulkImportResult | null>(null);
  const [bulkImport, { isLoading }] = useBulkImportStationsMutation();

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    setFile(e.target.files?.[0] ?? null);
  }

  async function handleImport() {
    if (!file) return;
    setError(null);
    setResult(null);
    try {
      const res = await bulkImport(file).unwrap();
      setResult(res);
    } catch (err: any) {
      setError(err?.data?.message ?? err?.message ?? "Import failed");
    }
  }

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <h2 className={styles.modalTitle}>Bulk Import Stations</h2>
        <p className={styles.sub}>
          Upload a single-sheet Excel workbook (.xlsx) with columns exactly titled: <strong>Division</strong>,{" "}
          <strong>Station Name</strong>, <strong>Station Code</strong>, <strong>No of Platforms</strong>.
        </p>
        <input type="file" accept=".xlsx,.xls" onChange={handleFileChange} style={{ marginTop: 12 }} />

        {error && <div className={styles.errorBanner}>{error}</div>}

        {result && (
          <div style={{ marginTop: 14 }}>
            <p>
              Imported <strong>{result.insertedCount}</strong>, skipped <strong>{result.skippedCount}</strong>.
            </p>
            {result.skipped.length > 0 && (
              <ul style={{ fontSize: 12.5, color: "var(--color-text-muted)", maxHeight: 140, overflowY: "auto" }}>
                {result.skipped.map((s, i) => (
                  <li key={i}>Row {s.row}: {s.reason}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div className={styles.modalActions}>
          <button type="button" className={styles.cancelBtn} onClick={onClose}>Close</button>
          <button type="button" className={styles.addBtn} onClick={handleImport} disabled={!file || isLoading}>
            {isLoading ? "Importing…" : "Import"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════ TRAINS TAB ═══════════════════════════════ */

function TrainsTab() {
  const { can } = useAuth();
  const canCreate = can("location_management", "create");
  const canEdit = can("location_management", "edit");
  const canDelete = can("location_management", "delete");
  const [divisionFilter, setDivisionFilter] = useState<number | "">("");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Train | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: divisions = [] } = useGetDivisionsQuery();
  const { data, isFetching } = useGetTrainsQuery({ division_id: divisionFilter || undefined, limit: 200 });
  const [deleteTrain] = useDeleteTrainMutation();
  const trains = data?.rows ?? [];

  async function handleDelete(t: Train) {
    if (!window.confirm(`Remove train "${t.train_name}"?`)) return;
    setError(null);
    try {
      await deleteTrain(t.id).unwrap();
    } catch (err: any) {
      setError(err?.data?.message ?? err?.message ?? "Unable to remove train");
    }
  }

  return (
    <div>
      <div className={styles.header}>
        <div />
        {canCreate && (
          <button className={styles.addBtn} onClick={() => setIsFormOpen(true)}>+ Add Train</button>
        )}
      </div>

      <div className={styles.filterRow} style={{ marginBottom: 12 }}>
        <LabeledField label="Owning Division">
          <select className={styles.select} value={divisionFilter} onChange={(e) => setDivisionFilter(e.target.value ? Number(e.target.value) : "")}>
            <option value="">All Divisions</option>
            {divisions.map((d) => (
              <option key={d.id} value={d.id}>{d.division_name}</option>
            ))}
          </select>
        </LabeledField>
      </div>

      {error && <div className={styles.errorBanner}>{error}</div>}

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Train</th>
              <th>Route</th>
              <th>Opposite Direction</th>
              <th>Owning Division</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {isFetching ? (
              <tr><td colSpan={5} className={styles.emptyCell}>Loading…</td></tr>
            ) : trains.length === 0 ? (
              <tr><td colSpan={5} className={styles.emptyCell}>No trains found.</td></tr>
            ) : (
              trains.map((t) => (
                <tr key={t.id}>
                  <td>
                    <div className={styles.strong}>{t.train_name}</div>
                    <div className={styles.sub}>{t.train_number}</div>
                  </td>
                  <td>{t.source} → {t.destination}</td>
                  <td className={styles.sub}>
                    {t.opposite_train_number ? `${t.opposite_train_name} (${t.opposite_train_number})` : "—"}
                    {t.opposite_source ? ` · ${t.opposite_source} → ${t.opposite_destination}` : ""}
                  </td>
                  <td>{t.division_name ?? "—"}</td>
                  <td>
                    <div style={{ display: "flex", gap: 8 }}>
                      {canEdit && (
                        <button type="button" className={styles.pageBtn} title="Edit train" onClick={() => setEditTarget(t)}>
                          <EditIcon />
                        </button>
                      )}
                      {canDelete && (
                        <button type="button" className={styles.pageBtn} title="Remove train" onClick={() => handleDelete(t)}>
                          <TrashIcon />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {isFormOpen && <TrainFormModal onClose={() => setIsFormOpen(false)} onSaved={() => setIsFormOpen(false)} />}
      {editTarget && <TrainFormModal train={editTarget} onClose={() => setEditTarget(null)} onSaved={() => setEditTarget(null)} />}
    </div>
  );
}

function TrainFormModal({ train, onClose, onSaved }: { train?: Train; onClose: () => void; onSaved: () => void }) {
  const isEdit = !!train;
  const { locked: divisionLocked, ownDivisionId } = useDivisionLock();
  const [divisionId, setDivisionId] = useState<number | "">(train?.division_id ?? ownDivisionId);

  useEffect(() => {
    if (divisionLocked && ownDivisionId) setDivisionId(ownDivisionId);
  }, [divisionLocked, ownDivisionId]);
  const [trainNumber, setTrainNumber] = useState(train?.train_number ?? "");
  const [trainName, setTrainName] = useState(train?.train_name ?? "");
  const [source, setSource] = useState(train?.source ?? "");
  const [destination, setDestination] = useState(train?.destination ?? "");
  const [oppNumber, setOppNumber] = useState(train?.opposite_train_number ?? "");
  const [oppName, setOppName] = useState(train?.opposite_train_name ?? "");
  const [oppSource, setOppSource] = useState(train?.opposite_source ?? "");
  const [oppDestination, setOppDestination] = useState(train?.opposite_destination ?? "");
  const [error, setError] = useState<string | null>(null);

  const { data: divisions = [] } = useGetDivisionsQuery();
  const [createTrain, { isLoading: isCreating }] = useCreateTrainMutation();
  const [editTrain, { isLoading: isEditing }] = useEditTrainMutation();
  const isSubmitting = isCreating || isEditing;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const payload = {
        division_id: Number(divisionId),
        train_number: trainNumber,
        train_name: trainName,
        source,
        destination,
        opposite_train_number: oppNumber || undefined,
        opposite_train_name: oppName || undefined,
        opposite_source: oppSource || undefined,
        opposite_destination: oppDestination || undefined,
      };
      if (isEdit && train) {
        await editTrain({ id: train.id, data: payload }).unwrap();
      } else {
        await createTrain(payload).unwrap();
      }
      onSaved();
    } catch (err: any) {
      setError(err?.data?.message ?? err?.message ?? "Unable to save train");
    }
  }

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <form className={styles.modal} onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit}>
        <h2 className={styles.modalTitle}>{isEdit ? "Edit Train" : "New Train"}</h2>
        <div className={styles.formGrid}>
          <Field label="Owning Division">
            <select value={divisionId} disabled={divisionLocked} onChange={(e) => setDivisionId(e.target.value ? Number(e.target.value) : "")} required>
              <option value="">Select Division</option>
              {divisions.map((d) => (
                <option key={d.id} value={d.id}>{d.division_name}</option>
              ))}
            </select>
          </Field>
          <Field label="Train Number">
            <input value={trainNumber} onChange={(e) => setTrainNumber(e.target.value)} required disabled={isEdit} />
          </Field>
          <Field label="Train Name">
            <input value={trainName} onChange={(e) => setTrainName(e.target.value)} required />
          </Field>
          <Field label="Source">
            <input value={source} onChange={(e) => setSource(e.target.value)} required />
          </Field>
          <Field label="Destination">
            <input value={destination} onChange={(e) => setDestination(e.target.value)} required />
          </Field>
          <Field label="Opposite Direction Train Number">
            <input value={oppNumber ?? ""} onChange={(e) => setOppNumber(e.target.value)} />
          </Field>
          <Field label="Opposite Direction Train Name">
            <input value={oppName ?? ""} onChange={(e) => setOppName(e.target.value)} />
          </Field>
          <Field label="Opposite Direction Source">
            <input value={oppSource ?? ""} onChange={(e) => setOppSource(e.target.value)} />
          </Field>
          <Field label="Opposite Direction Destination">
            <input value={oppDestination ?? ""} onChange={(e) => setOppDestination(e.target.value)} />
          </Field>
        </div>
        {error && <div className={styles.errorBanner}>{error}</div>}
        <div className={styles.modalActions}>
          <button type="button" className={styles.cancelBtn} onClick={onClose}>Cancel</button>
          <button type="submit" className={styles.addBtn} disabled={isSubmitting}>{isSubmitting ? "Saving…" : "Save Train"}</button>
        </div>
      </form>
    </div>
  );
}

/* ═══════════════════════════════ CLUSTERS TAB ═══════════════════════════════ */

function ClustersTab() {
  const { can } = useAuth();
  const canCreate = can("location_management", "create");
  const canDelete = can("location_management", "delete");
  const [divisionFilter, setDivisionFilter] = useState<number | "">("");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: divisions = [] } = useGetDivisionsQuery();
  const { data, isFetching } = useGetClustersQuery({ division_id: divisionFilter || undefined, limit: 200 });
  const [deleteCluster] = useDeleteClusterMutation();
  const clusters = data?.rows ?? [];

  async function handleDelete(id: number, name: string) {
    if (!window.confirm(`Remove cluster "${name}"?`)) return;
    setError(null);
    try {
      await deleteCluster(id).unwrap();
    } catch (err: any) {
      setError(err?.data?.message ?? err?.message ?? "Unable to remove cluster");
    }
  }

  return (
    <div>
      <div className={styles.header}>
        <div />
        {canCreate && (
          <button className={styles.addBtn} onClick={() => setIsFormOpen(true)}>+ Create Cluster</button>
        )}
      </div>

      <div className={styles.filterRow} style={{ marginBottom: 12 }}>
        <LabeledField label="Division">
          <select className={styles.select} value={divisionFilter} onChange={(e) => setDivisionFilter(e.target.value ? Number(e.target.value) : "")}>
            <option value="">All Divisions</option>
            {divisions.map((d) => (
              <option key={d.id} value={d.id}>{d.division_name}</option>
            ))}
          </select>
        </LabeledField>
      </div>

      {error && <div className={styles.errorBanner}>{error}</div>}

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Cluster Name</th>
              <th>Type</th>
              <th>Division</th>
              <th>Members</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {isFetching ? (
              <tr><td colSpan={5} className={styles.emptyCell}>Loading…</td></tr>
            ) : clusters.length === 0 ? (
              <tr><td colSpan={5} className={styles.emptyCell}>No clusters found.</td></tr>
            ) : (
              clusters.map((c) => (
                <tr key={c.id}>
                  <td className={styles.strong}>{c.cluster_name}</td>
                  <td><span className={styles.roleTag}>{c.cluster_type === "station" ? "Station Cluster" : "Train Cluster"}</span></td>
                  <td>{c.division_name ?? "—"}</td>
                  <td>{c.member_count ?? 0}</td>
                  <td>
                    {canDelete && (
                      <button type="button" className={styles.pageBtn} title="Remove cluster" onClick={() => handleDelete(c.id, c.cluster_name)}>
                        <TrashIcon />
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {isFormOpen && <ClusterFormModal onClose={() => setIsFormOpen(false)} onSaved={() => setIsFormOpen(false)} />}
    </div>
  );
}

function ClusterFormModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { locked: divisionLocked, ownDivisionId } = useDivisionLock();
  const [divisionId, setDivisionId] = useState<number | "">(ownDivisionId);

  useEffect(() => {
    if (divisionLocked && ownDivisionId) setDivisionId(ownDivisionId);
  }, [divisionLocked, ownDivisionId]);
  const [clusterType, setClusterType] = useState<ClusterType>("station");
  const [clusterName, setClusterName] = useState("");
  const [memberIds, setMemberIds] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);

  const { data: divisions = [] } = useGetDivisionsQuery();
  const { data: stations = [] } = useGetStationsQuery(divisionId || undefined);
  const { data: trainData } = useGetTrainsQuery({ division_id: divisionId || undefined, limit: 200 });
  const [createCluster, { isLoading }] = useCreateClusterMutation();

  const memberOptions = clusterType === "station" ? stations : trainData?.rows ?? [];

  function toggleMember(id: number) {
    setMemberIds((prev) => (prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (memberIds.length === 0) {
      setError("Select at least one member");
      return;
    }
    try {
      await createCluster({ division_id: Number(divisionId), cluster_name: clusterName, cluster_type: clusterType, member_ids: memberIds }).unwrap();
      onSaved();
    } catch (err: any) {
      setError(err?.data?.message ?? err?.message ?? "Unable to create cluster");
    }
  }

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <form className={styles.modal} onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit}>
        <h2 className={styles.modalTitle}>New Cluster</h2>
        <div className={styles.formGrid}>
          <Field label="Division">
            <select
              value={divisionId}
              disabled={divisionLocked}
              onChange={(e) => {
                setDivisionId(e.target.value ? Number(e.target.value) : "");
                setMemberIds([]);
              }}
              required
            >
              <option value="">Select Division</option>
              {divisions.map((d) => (
                <option key={d.id} value={d.id}>{d.division_name}</option>
              ))}
            </select>
          </Field>
          <Field label="Cluster Type">
            <select
              value={clusterType}
              onChange={(e) => {
                setClusterType(e.target.value as ClusterType);
                setMemberIds([]);
              }}
            >
              <option value="station">Station Cluster</option>
              <option value="train">Train Cluster</option>
            </select>
          </Field>
          <Field label="Cluster Name" wide>
            <input value={clusterName} onChange={(e) => setClusterName(e.target.value)} required />
          </Field>

          <div className={styles.fieldWide}>
            <div className={styles.fieldLabel}>
              Select {clusterType === "station" ? "Stations" : "Trains"} ({memberIds.length} selected)
            </div>
            <div style={{ maxHeight: 180, overflowY: "auto", border: "1px solid var(--color-border)", borderRadius: 8, padding: 8 }}>
              {!divisionId ? (
                <p className={styles.sub}>Select a division first.</p>
              ) : memberOptions.length === 0 ? (
                <p className={styles.sub}>No {clusterType === "station" ? "stations" : "trains"} found in this division.</p>
              ) : (
                memberOptions.map((m) => (
                  <label key={m.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0", fontSize: 13.5 }}>
                    <input type="checkbox" checked={memberIds.includes(m.id)} onChange={() => toggleMember(m.id)} />
                    {"station_name" in m ? m.station_name : `${(m as Train).train_name} (${(m as Train).train_number})`}
                  </label>
                ))
              )}
            </div>
          </div>
        </div>
        {error && <div className={styles.errorBanner}>{error}</div>}
        <div className={styles.modalActions}>
          <button type="button" className={styles.cancelBtn} onClick={onClose}>Cancel</button>
          <button type="submit" className={styles.addBtn} disabled={isLoading}>{isLoading ? "Saving…" : "Create Cluster"}</button>
        </div>
      </form>
    </div>
  );
}
