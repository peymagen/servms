import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  useGetDashboardSummaryQuery,
  useLazyGetDashboardGraphDataQuery,
  useGetDashboardToggleOptionsQuery,
  useTrackDashboardInteractionMutation,
  DASHBOARD_POLL_INTERVAL_MS,
  type DashboardGroupKey,
} from "../api/dashboardApi";
import { useGetDivisionsQuery, useGetUnitsLiteQuery, useGetContractorsLiteQuery, useGetVendorsLiteQuery } from "../api/mastersApi";
import MiniChart from "../components/ui/MiniChart";
import { roleLabel } from "../types/labels";
import styles from "./DashboardPage.module.css";

const HQ_ROLES = ["hq_admin", "hq_sub_admin"];

function isoDate(daysOffset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysOffset);
  return d.toISOString().split("T")[0]!;
}

function buildPath(base: string, params: Record<string, string | number | undefined>): string {
  const qs = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== "")
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join("&");
  return qs ? `${base}?${qs}` : base;
}

function formatTimestamp(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

interface Subgroup {
  label: string;
  value: number;
  path: string;
}

interface GroupCard {
  key: DashboardGroupKey;
  title: string;
  total: number;
  lastUpdated: string | null;
  subgroups: Subgroup[];
}

export default function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isHq = !!user && HQ_ROLES.includes(user.role_name);

  const [view, setView] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [unitId, setUnitId] = useState<number | "">("");
  const [contractorId, setContractorId] = useState<number | "">("");
  const [vendorId, setVendorId] = useState<number | "">("");
  const [openGroup, setOpenGroup] = useState<DashboardGroupKey | null>(null);
  const [chartType, setChartType] = useState<"bar" | "pie" | "doughnut">("doughnut");

  const { data: toggleOptions = [] } = useGetDashboardToggleOptionsQuery(undefined, { skip: !isHq });
  const { data: divisions = [] } = useGetDivisionsQuery();
  const { data: units = [] } = useGetUnitsLiteQuery();
  const { data: contractors = [] } = useGetContractorsLiteQuery();
  const { data: vendors = [] } = useGetVendorsLiteQuery();
  const [trackInteraction] = useTrackDashboardInteractionMutation();

  const queryParams = useMemo(
    () => ({
      view: isHq && view ? view : undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      unit_id: unitId || undefined,
      contractor_id: contractorId || undefined,
      vendor_id: vendorId || undefined,
    }),
    [isHq, view, dateFrom, dateTo, unitId, contractorId, vendorId]
  );

  const { data: summary, error: loadError, isFetching } = useGetDashboardSummaryQuery(queryParams, {
    pollingInterval: DASHBOARD_POLL_INTERVAL_MS,
  });
  const [fetchGraphData, { data: graphData, isFetching: isGraphLoading }] = useLazyGetDashboardGraphDataQuery();

  const error = loadError ? "Unable to load dashboard data" : null;

  // The HQ toggle picks a division code / "Zone" / "HQ"; only a concrete
  // single division_id can be threaded into subgroup drill-through links.
  // "Zone" and "HQ" (multi-division / no-division rollups) intentionally omit
  // division_id from nav links — the target listing pages have no concept of
  // a zone-rollup or "no division" filter today, so those links fall back to
  // the caller's normal (org-wide, permission-scoped) view.
  const divisionId = useMemo((): number | undefined => {
    if (!isHq) return user?.division_id ?? undefined;
    if (!view) return undefined;
    const match = divisions.find((d) => d.division_code === view);
    return match?.id;
  }, [isHq, view, divisions, user]);

  function toggleGroup(group: DashboardGroupKey) {
    if (openGroup === group) {
      setOpenGroup(null);
      return;
    }
    setOpenGroup(group);
    fetchGraphData({ group, ...queryParams });
  }

  function goToSubgroup(path: string, label: string) {
    trackInteraction({ action: "subgroup_click", details: `${path} (${label})` });
    navigate(path);
  }

  function goToAlert(path: string, label: string) {
    trackInteraction({ action: "alert_click", details: `${path} (${label})` });
    navigate(path);
  }

  const groups: GroupCard[] = summary
    ? [
        {
          key: "units",
          title: "Registered Units",
          total: summary.units.total,
          lastUpdated: summary.units.lastUpdated,
          subgroups: [
            { label: "Active", value: summary.units.active, path: buildPath("/locations", { status: "active", division_id: divisionId }) },
            { label: "Idle", value: summary.units.idle, path: buildPath("/locations", { status: "idle", division_id: divisionId }) },
            { label: "Inactive", value: summary.units.inactive, path: buildPath("/locations", { status: "inactive", division_id: divisionId }) },
          ],
        },
        {
          key: "contractors",
          title: "Registered Contractors",
          total: summary.contractors.total,
          lastUpdated: summary.contractors.lastUpdated,
          subgroups: [
            { label: "Active", value: summary.contractors.active, path: buildPath("/contractors", { status: "active", division_id: divisionId }) },
            { label: "Inactive", value: summary.contractors.inactive, path: buildPath("/contractors", { status: "inactive", division_id: divisionId }) },
            { label: "Blacklisted", value: summary.contractors.blacklisted, path: buildPath("/contractors", { status: "blacklisted", division_id: divisionId }) },
          ],
        },
        {
          key: "vendors",
          title: "Registered Vendors",
          total: summary.vendors.total,
          lastUpdated: summary.vendors.lastUpdated,
          subgroups: [
            { label: "Active", value: summary.vendors.active, path: buildPath("/vendors", { status: "active", division_id: divisionId }) },
            { label: "Inactive", value: summary.vendors.inactive, path: buildPath("/vendors", { status: "inactive", division_id: divisionId }) },
            { label: "Blacklisted", value: summary.vendors.blacklisted, path: buildPath("/vendors", { status: "blacklisted", division_id: divisionId }) },
          ],
        },
        {
          key: "penalty",
          title: "Penalty",
          total: summary.penalty.imposed.count,
          lastUpdated: summary.penalty.lastUpdated,
          subgroups: [
            { label: "Imposed", value: summary.penalty.imposed.count, path: buildPath("/penalties", { division_id: divisionId }) },
            { label: "Recovered", value: summary.penalty.recovered.count, path: buildPath("/penalties", { recovery_status: "recovered", division_id: divisionId }) },
            {
              label: "Due Within 7 Days",
              value: summary.penalty.due.within7Days,
              path: buildPath("/penalties", { recovery_status: "pending", dueDateFrom: isoDate(0), dueDateTo: isoDate(7), division_id: divisionId }),
            },
            {
              label: "Due Within 14 Days",
              value: summary.penalty.due.within14Days,
              path: buildPath("/penalties", { recovery_status: "pending", dueDateFrom: isoDate(8), dueDateTo: isoDate(14), division_id: divisionId }),
            },
            {
              label: "Due Within 30 Days",
              value: summary.penalty.due.within30Days,
              path: buildPath("/penalties", { recovery_status: "pending", dueDateFrom: isoDate(15), dueDateTo: isoDate(30), division_id: divisionId }),
            },
            {
              label: "Overdue",
              value: summary.penalty.due.overdue,
              path: buildPath("/penalties", { recovery_status: "pending", dueDateTo: isoDate(-1), division_id: divisionId }),
            },
          ],
        },
        {
          key: "pending_action",
          title: "Pending Action",
          total:
            summary.pendingAction.complaintsPendingAtr.count +
            summary.pendingAction.inspectionsPendingAtr.count +
            summary.pendingAction.licenseFeeUpdationDue.within7Days +
            summary.pendingAction.licenseFeeUpdationDue.within14Days +
            summary.pendingAction.licenseFeeUpdationDue.overdue,
          lastUpdated: summary.pendingAction.complaintsPendingAtr.lastUpdated,
          subgroups: [
            {
              label: "Complaints Pending ATR",
              value: summary.pendingAction.complaintsPendingAtr.count,
              path: buildPath("/complaints", { status: "assigned", division_id: divisionId }),
            },
            {
              label: "Inspections Pending ATR",
              value: summary.pendingAction.inspectionsPendingAtr.count,
              path: buildPath("/inspections", { status: "assigned", division_id: divisionId }),
            },
            {
              // Location Masters has no license-fee-due filter yet, so this
              // link is division-scoped only rather than pendency-filtered.
              label: "License Fee Due Within 7 Days",
              value: summary.pendingAction.licenseFeeUpdationDue.within7Days,
              path: buildPath("/locations", { division_id: divisionId }),
            },
            {
              label: "License Fee Due Within 14 Days",
              value: summary.pendingAction.licenseFeeUpdationDue.within14Days,
              path: buildPath("/locations", { division_id: divisionId }),
            },
            {
              label: "License Fee Overdue",
              value: summary.pendingAction.licenseFeeUpdationDue.overdue,
              path: buildPath("/locations", { division_id: divisionId }),
            },
          ],
        },
      ]
    : [];

  const alertGroups = summary
    ? [
        {
          title: "Contract Expiry",
          rows: [
            { label: "Expired Contracts", value: summary.criticalAlerts.contractExpiry.expired },
            { label: "Expiring within 7 Days", value: summary.criticalAlerts.contractExpiry.expiring7Days },
            { label: "Expiring within 30 Days", value: summary.criticalAlerts.contractExpiry.expiring30Days },
          ],
          path: buildPath("/contractors", { division_id: divisionId }),
        },
        {
          title: "Unit Compliance — License Fees",
          rows: [
            { label: "Expired", value: summary.criticalAlerts.unitCompliance.licenseFees.expired },
            { label: "Due Soon", value: summary.criticalAlerts.unitCompliance.licenseFees.dueSoon },
          ],
          path: buildPath("/locations", { division_id: divisionId }),
        },
        {
          title: "Unit Compliance — Electric Bill",
          rows: [
            { label: "Expired", value: summary.criticalAlerts.unitCompliance.electricBill.expired },
            { label: "Due Soon", value: summary.criticalAlerts.unitCompliance.electricBill.dueSoon },
          ],
          path: buildPath("/locations", { division_id: divisionId }),
        },
        {
          title: "Unit Compliance — FSSAI",
          rows: [
            { label: "Expired", value: summary.criticalAlerts.unitCompliance.fssai.expired },
            { label: "Due Soon", value: summary.criticalAlerts.unitCompliance.fssai.dueSoon },
          ],
          path: buildPath("/locations", { division_id: divisionId }),
        },
        {
          title: "Vendor Compliance — PVR",
          rows: [
            { label: "Expired", value: summary.criticalAlerts.vendorCompliance.pvr.expired },
            { label: "Due Soon", value: summary.criticalAlerts.vendorCompliance.pvr.dueSoon },
          ],
          path: buildPath("/vendors", { division_id: divisionId }),
        },
        {
          title: "Vendor Compliance — Medical",
          rows: [
            { label: "Expired", value: summary.criticalAlerts.vendorCompliance.medical.expired },
            { label: "Due Soon", value: summary.criticalAlerts.vendorCompliance.medical.dueSoon },
          ],
          path: buildPath("/vendors", { division_id: divisionId }),
        },
        {
          title: "Penalty Overdue",
          rows: [{ label: "Total Overdue", value: summary.criticalAlerts.penaltyOverdue.total }],
          path: buildPath("/penalties", { recovery_status: "pending", dueDateTo: isoDate(-1), division_id: divisionId }),
        },
      ]
    : [];

  return (
    <div>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Dashboard</h1>
          <p className={styles.subtitle}>Role-scoped overview of units, contractors, vendors, penalties, and pending actions.</p>
        </div>
        <span className={styles.roleTag}>{user ? roleLabel(user.role_name) : ""}</span>
      </div>

      {isHq && toggleOptions.length > 0 && (
        <div className={styles.toggleBar}>
          <button type="button" className={!view ? styles.toggleBtnActive : styles.toggleBtn} onClick={() => setView("")}>
            All
          </button>
          {toggleOptions.map((opt) => (
            <button
              key={opt}
              type="button"
              className={view === opt ? styles.toggleBtnActive : styles.toggleBtn}
              onClick={() => setView(opt)}
            >
              {opt}
            </button>
          ))}
        </div>
      )}

      <div className={styles.filterBar}>
        <label className={styles.filterField}>
          <span>From</span>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        </label>
        <label className={styles.filterField}>
          <span>To</span>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        </label>
        <label className={styles.filterField}>
          <span>Unit</span>
          <select value={unitId} onChange={(e) => setUnitId(e.target.value ? Number(e.target.value) : "")}>
            <option value="">All Units</option>
            {units.map((u) => (
              <option key={u.id} value={u.id}>
                {u.unit_name}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.filterField}>
          <span>Contractor</span>
          <select value={contractorId} onChange={(e) => setContractorId(e.target.value ? Number(e.target.value) : "")}>
            <option value="">All Contractors</option>
            {contractors.map((c) => (
              <option key={c.id} value={c.id}>
                {c.company_name}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.filterField}>
          <span>Vendor</span>
          <select value={vendorId} onChange={(e) => setVendorId(e.target.value ? Number(e.target.value) : "")}>
            <option value="">All Vendors</option>
            {vendors.map((v) => (
              <option key={v.id} value={v.id}>
                {v.full_name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {error && <div className={styles.errorBanner}>{error}</div>}

      <div className={styles.cardGrid}>
        {groups.map((group) => (
          <div key={group.key} className={styles.card}>
            <button type="button" className={styles.cardHeader} onClick={() => toggleGroup(group.key)}>
              <span className={styles.cardIcon} aria-hidden="true" />
              <div className={styles.cardHeaderText}>
                <span className={styles.cardTitle}>{group.title}</span>
                <span className={styles.cardTotal}>{group.total}</span>
              </div>
              <span className={styles.cardExpandHint}>{openGroup === group.key ? "▲" : "▼"}</span>
            </button>
            <div className={styles.cardSubgroups}>
              {group.subgroups.map((sg) => (
                <button
                  key={sg.label}
                  type="button"
                  className={styles.subgroupBtn}
                  onClick={() => goToSubgroup(sg.path, sg.label)}
                >
                  <span>{sg.label}</span>
                  <strong>{sg.value}</strong>
                </button>
              ))}
            </div>
            <div className={styles.cardFooter}>Last updated: {formatTimestamp(group.lastUpdated)}</div>

            {openGroup === group.key && (
              <div className={styles.chartArea}>
                <div className={styles.chartTypeRow}>
                  {(["doughnut", "pie", "bar"] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      className={chartType === t ? styles.chartTypeBtnActive : styles.chartTypeBtn}
                      onClick={() => setChartType(t)}
                    >
                      {t}
                    </button>
                  ))}
                </div>
                {isGraphLoading ? (
                  <p className={styles.emptyState}>Loading chart…</p>
                ) : graphData && graphData.length > 0 ? (
                  <MiniChart type={chartType} data={graphData} onSliceClick={(label) => {
                    const sg = group.subgroups.find((s) => s.label.startsWith(label) || label.startsWith(s.label));
                    if (sg) goToSubgroup(sg.path, sg.label);
                  }} />
                ) : (
                  <p className={styles.emptyState}>No data to chart.</p>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      <section className={styles.alertsPanel}>
        <h2 className={styles.panelTitle}>Critical Alerts</h2>
        <div className={styles.alertsGrid}>
          {alertGroups.map((ag) => (
            <div key={ag.title} className={styles.alertCard}>
              <div className={styles.alertCardTitle}>{ag.title}</div>
              <div className={styles.alertRows}>
                {ag.rows.map((row) => (
                  <button
                    key={row.label}
                    type="button"
                    className={styles.alertRow}
                    onClick={() => goToAlert(ag.path, `${ag.title} — ${row.label}`)}
                  >
                    <span>{row.label}</span>
                    <strong className={row.value > 0 ? styles.alertValueWarn : styles.alertValue}>{row.value}</strong>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {isFetching && !summary && <p className={styles.emptyState}>Loading dashboard…</p>}
    </div>
  );
}
