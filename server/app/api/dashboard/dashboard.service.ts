import { pool } from "../../common/services/sql.service";
import { type DashboardScope, type DashboardFilters, scopeCondition, filterConditions } from "./dashboard.scope";
import { type RowDataPacket } from "mysql2";

// A unit's division is reached via station_id -> stations.division_id,
// train_id -> trains.division_id, or cluster_id -> location_clusters.division_id
// — mirrors unit.service.ts's DIVISION_EXPR so cluster-located units aren't
// silently excluded from division-scoped dashboard queries.
const UNIT_JOIN =
  "LEFT JOIN stations st ON st.id = u.station_id LEFT JOIN trains tr ON tr.id = u.train_id LEFT JOIN location_clusters cl ON cl.id = u.cluster_id";
const UNIT_DIVISION_EXPR = "COALESCE(st.division_id, tr.division_id, cl.division_id)";

// A penalty's division is reached via its contractor or vendor (whichever is set).
const PENALTY_JOIN = "LEFT JOIN contractors c ON c.id = p.contractor_id LEFT JOIN vendors v ON v.id = p.vendor_id";
const PENALTY_DIVISION_EXPR = "IFNULL(c.division_id, v.division_id)";

const num = (v: unknown): number => Number(v ?? 0);
const NO_FILTERS: DashboardFilters = {};

// ─── GROUP 1 — REGISTERED UNITS ─────────────────────────────────────────────────
// "Idle" is derived, not a stored status: a unit that isn't inactive but has no
// contractor currently assigned. This keeps units_status's existing
// active/expiring/inactive/inspection_pending meaning untouched everywhere else.
export const getUnitsSummary = async (scope: DashboardScope, filters: DashboardFilters = NO_FILTERS) => {
  const cond = scopeCondition(scope, UNIT_DIVISION_EXPR);
  const fCond = filterConditions(filters, { createdAt: "u.created_at", unitId: "u.id", contractorId: "u.contractor_id" });
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT
       COUNT(*) AS total,
       SUM(CASE WHEN u.units_status <> 'inactive' AND u.contractor_id IS NOT NULL THEN 1 ELSE 0 END) AS active,
       SUM(CASE WHEN u.units_status <> 'inactive' AND u.contractor_id IS NULL THEN 1 ELSE 0 END) AS idle,
       SUM(CASE WHEN u.units_status = 'inactive' THEN 1 ELSE 0 END) AS inactive,
       MAX(u.updated_at) AS lastUpdated
     FROM units u
     ${UNIT_JOIN}
     WHERE ${cond.sql} ${fCond.sql}`,
    [...cond.params, ...fCond.params]
  );
  const r = rows[0] ?? {};
  return {
    total: num(r.total),
    active: num(r.active),
    idle: num(r.idle),
    inactive: num(r.inactive),
    lastUpdated: r.lastUpdated ?? null,
  };
};

// ─── GROUP 2 — REGISTERED CONTRACTORS ───────────────────────────────────────────
export const getContractorsSummary = async (scope: DashboardScope, filters: DashboardFilters = NO_FILTERS) => {
  const cond = scopeCondition(scope, "c.division_id");
  const fCond = filterConditions(filters, { createdAt: "c.created_at", contractorId: "c.id" });
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT
       COUNT(*) AS total,
       SUM(CASE WHEN c.contractors_status = 'active' THEN 1 ELSE 0 END) AS active,
       SUM(CASE WHEN c.contractors_status = 'blacklisted' THEN 1 ELSE 0 END) AS blacklisted,
       SUM(CASE WHEN c.contractors_status NOT IN ('active','blacklisted') THEN 1 ELSE 0 END) AS inactive,
       MAX(c.updated_at) AS lastUpdated
     FROM contractors c
     WHERE c.status = 1 AND ${cond.sql} ${fCond.sql}`,
    [...cond.params, ...fCond.params]
  );
  const r = rows[0] ?? {};
  return {
    total: num(r.total),
    active: num(r.active),
    inactive: num(r.inactive),
    blacklisted: num(r.blacklisted),
    lastUpdated: r.lastUpdated ?? null,
  };
};

// ─── GROUP 3 — REGISTERED VENDORS ───────────────────────────────────────────────
export const getVendorsSummary = async (scope: DashboardScope, filters: DashboardFilters = NO_FILTERS) => {
  const cond = scopeCondition(scope, "v.division_id");
  const fCond = filterConditions(filters, {
    createdAt: "v.created_at",
    unitId: "v.unit_id",
    contractorId: "v.contractor_id",
    vendorId: "v.id",
  });
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT
       COUNT(*) AS total,
       SUM(CASE WHEN v.vendor_status = 'active' THEN 1 ELSE 0 END) AS active,
       SUM(CASE WHEN v.vendor_status = 'blacklisted' THEN 1 ELSE 0 END) AS blacklisted,
       SUM(CASE WHEN v.vendor_status NOT IN ('active','blacklisted') THEN 1 ELSE 0 END) AS inactive,
       MAX(v.updated_at) AS lastUpdated
     FROM vendors v
     WHERE v.status = 1 AND ${cond.sql} ${fCond.sql}`,
    [...cond.params, ...fCond.params]
  );
  const r = rows[0] ?? {};
  return {
    total: num(r.total),
    active: num(r.active),
    inactive: num(r.inactive),
    blacklisted: num(r.blacklisted),
    lastUpdated: r.lastUpdated ?? null,
  };
};

// ─── GROUP 4 — PENALTY ───────────────────────────────────────────────────────────
// The 4 "Due" pendency buckets are mutually exclusive tiers (0-7 / 8-14 / 15-30 /
// overdue) so they sum to the Due subgroup total, unlike the Critical Alerts
// panel's cumulative "expiring within N days" windows (see getCriticalAlerts).
export const getPenaltySummary = async (scope: DashboardScope, filters: DashboardFilters = NO_FILTERS) => {
  const cond = scopeCondition(scope, PENALTY_DIVISION_EXPR);
  const fCond = filterConditions(filters, {
    createdAt: "p.created_at",
    unitId: "p.unit_id",
    contractorId: "p.contractor_id",
    vendorId: "p.vendor_id",
  });
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT
       COUNT(*) AS imposed_count,
       SUM(p.amount) AS imposed_amount,
       SUM(CASE WHEN p.recovery_status = 'recovered' THEN 1 ELSE 0 END) AS recovered_count,
       SUM(CASE WHEN p.recovery_status = 'recovered' THEN p.recovery_amount ELSE 0 END) AS recovered_amount,
       SUM(CASE WHEN p.recovery_status IN ('pending','partially_recovered') THEN 1 ELSE 0 END) AS due_count,
       SUM(CASE WHEN p.recovery_status IN ('pending','partially_recovered')
                 AND p.due_date IS NOT NULL AND p.due_date < CURDATE() THEN 1 ELSE 0 END) AS overdue,
       SUM(CASE WHEN p.recovery_status IN ('pending','partially_recovered')
                 AND p.due_date >= CURDATE() AND p.due_date <= DATE_ADD(CURDATE(), INTERVAL 7 DAY)
                 THEN 1 ELSE 0 END) AS due_7,
       SUM(CASE WHEN p.recovery_status IN ('pending','partially_recovered')
                 AND p.due_date > DATE_ADD(CURDATE(), INTERVAL 7 DAY)
                 AND p.due_date <= DATE_ADD(CURDATE(), INTERVAL 14 DAY) THEN 1 ELSE 0 END) AS due_14,
       SUM(CASE WHEN p.recovery_status IN ('pending','partially_recovered')
                 AND p.due_date > DATE_ADD(CURDATE(), INTERVAL 14 DAY)
                 AND p.due_date <= DATE_ADD(CURDATE(), INTERVAL 30 DAY) THEN 1 ELSE 0 END) AS due_30,
       MAX(p.updated_at) AS lastUpdated
     FROM penalties p
     ${PENALTY_JOIN}
     WHERE p.status = 1 AND ${cond.sql} ${fCond.sql}`,
    [...cond.params, ...fCond.params]
  );
  const r = rows[0] ?? {};
  return {
    imposed: { count: num(r.imposed_count), amount: num(r.imposed_amount) },
    recovered: { count: num(r.recovered_count), amount: num(r.recovered_amount) },
    due: {
      count: num(r.due_count),
      within7Days: num(r.due_7),
      within14Days: num(r.due_14),
      within30Days: num(r.due_30),
      overdue: num(r.overdue),
    },
    lastUpdated: r.lastUpdated ?? null,
  };
};

// ─── GROUP 5 — PENDING ACTION ───────────────────────────────────────────────────
// "Pending ATR" mirrors the Inspection module's existing dashboard convention
// (inspection_status = 'assigned' means the Dealing Section owes an ATR) and
// extends the same idea to Complaints (assigned/under_review means the
// complaint has moved past intake but has no accepted ATR yet).
export const getPendingActionSummary = async (scope: DashboardScope, filters: DashboardFilters = NO_FILTERS) => {
  const complaintCond = scopeCondition(scope, "cm.division_id");
  const inspectionCond = scopeCondition(scope, "i.division_id");
  const unitCond = scopeCondition(scope, UNIT_DIVISION_EXPR);
  const complaintFCond = filterConditions(filters, { createdAt: "cm.created_at", unitId: "cm.unit_id" });
  const inspectionFCond = filterConditions(filters, { createdAt: "i.created_at", unitId: "i.unit_id" });
  const unitFCond = filterConditions(filters, { createdAt: "u.created_at", unitId: "u.id", contractorId: "u.contractor_id" });

  const [[complaintRows], [inspectionRows], [licenseRows]] = await Promise.all([
    pool.execute<RowDataPacket[]>(
      `SELECT COUNT(*) AS count, MAX(cm.updated_at) AS lastUpdated
       FROM complaints cm
       WHERE cm.status = 1 AND cm.complaints_status IN ('assigned','under_review')
         AND ${complaintCond.sql} ${complaintFCond.sql}`,
      [...complaintCond.params, ...complaintFCond.params]
    ),
    pool.execute<RowDataPacket[]>(
      `SELECT COUNT(*) AS count, MAX(i.updated_at) AS lastUpdated
       FROM inspections i
       WHERE i.status = 1 AND i.inspection_status = 'assigned'
         AND ${inspectionCond.sql} ${inspectionFCond.sql}`,
      [...inspectionCond.params, ...inspectionFCond.params]
    ),
    pool.execute<RowDataPacket[]>(
      `SELECT
         SUM(CASE WHEN u.license_period_end IS NOT NULL AND u.license_period_end < CURDATE() THEN 1 ELSE 0 END) AS overdue,
         SUM(CASE WHEN u.license_period_end >= CURDATE() AND u.license_period_end <= DATE_ADD(CURDATE(), INTERVAL 7 DAY)
                   THEN 1 ELSE 0 END) AS due_7,
         SUM(CASE WHEN u.license_period_end > DATE_ADD(CURDATE(), INTERVAL 7 DAY)
                   AND u.license_period_end <= DATE_ADD(CURDATE(), INTERVAL 14 DAY) THEN 1 ELSE 0 END) AS due_14
       FROM units u
       ${UNIT_JOIN}
       WHERE ${unitCond.sql} ${unitFCond.sql}`,
      [...unitCond.params, ...unitFCond.params]
    ),
  ]);

  const lic = licenseRows[0] ?? {};
  return {
    complaintsPendingAtr: { count: num(complaintRows[0]?.count), lastUpdated: complaintRows[0]?.lastUpdated ?? null },
    inspectionsPendingAtr: { count: num(inspectionRows[0]?.count), lastUpdated: inspectionRows[0]?.lastUpdated ?? null },
    licenseFeeUpdationDue: {
      within7Days: num(lic.due_7),
      within14Days: num(lic.due_14),
      overdue: num(lic.overdue),
    },
  };
};

// ─── CRITICAL ALERTS ─────────────────────────────────────────────────────────────
// Every window here is a cumulative "expiring within N days" count (not the
// mutually-exclusive tiers used by the Penalty group's Due subgroup) since each
// alert stands on its own rather than summing into a parent total. "Due Soon"
// uses a 30-day window (not specified exactly in the SRS; documented default).
export const getCriticalAlerts = async (
  scope: DashboardScope,
  penaltyOverdueCount: number,
  filters: DashboardFilters = NO_FILTERS
) => {
  const contractorCond = scopeCondition(scope, "c.division_id");
  const unitCond = scopeCondition(scope, UNIT_DIVISION_EXPR);
  const vendorCond = scopeCondition(scope, "v.division_id");
  const contractorFCond = filterConditions(filters, { createdAt: "c.created_at", contractorId: "c.id" });
  const unitFCond = filterConditions(filters, { createdAt: "u.created_at", unitId: "u.id", contractorId: "u.contractor_id" });
  const vendorFCond = filterConditions(filters, {
    createdAt: "v.created_at",
    unitId: "v.unit_id",
    contractorId: "v.contractor_id",
    vendorId: "v.id",
  });

  const [[contractRows], [unitRows], [vendorRows]] = await Promise.all([
    pool.execute<RowDataPacket[]>(
      `SELECT
         SUM(CASE WHEN c.contract_end_date IS NOT NULL AND c.contract_end_date < CURDATE() THEN 1 ELSE 0 END) AS expired,
         SUM(CASE WHEN c.contract_end_date >= CURDATE() AND c.contract_end_date <= DATE_ADD(CURDATE(), INTERVAL 7 DAY)
                   THEN 1 ELSE 0 END) AS expiring7,
         SUM(CASE WHEN c.contract_end_date >= CURDATE() AND c.contract_end_date <= DATE_ADD(CURDATE(), INTERVAL 30 DAY)
                   THEN 1 ELSE 0 END) AS expiring30
       FROM contractors c
       WHERE c.status = 1 AND ${contractorCond.sql} ${contractorFCond.sql}`,
      [...contractorCond.params, ...contractorFCond.params]
    ),
    pool.execute<RowDataPacket[]>(
      `SELECT
         SUM(CASE WHEN u.license_period_end IS NOT NULL AND u.license_period_end < CURDATE() THEN 1 ELSE 0 END) AS license_expired,
         SUM(CASE WHEN u.license_period_end >= CURDATE() AND u.license_period_end <= DATE_ADD(CURDATE(), INTERVAL 30 DAY)
                   THEN 1 ELSE 0 END) AS license_due_soon,
         SUM(CASE WHEN u.electric_bill_valid_till IS NOT NULL AND u.electric_bill_valid_till < CURDATE() THEN 1 ELSE 0 END) AS electric_expired,
         SUM(CASE WHEN u.electric_bill_valid_till >= CURDATE() AND u.electric_bill_valid_till <= DATE_ADD(CURDATE(), INTERVAL 30 DAY)
                   THEN 1 ELSE 0 END) AS electric_due_soon,
         SUM(CASE WHEN u.fssai_valid_till IS NOT NULL AND u.fssai_valid_till < CURDATE() THEN 1 ELSE 0 END) AS fssai_expired,
         SUM(CASE WHEN u.fssai_valid_till >= CURDATE() AND u.fssai_valid_till <= DATE_ADD(CURDATE(), INTERVAL 30 DAY)
                   THEN 1 ELSE 0 END) AS fssai_due_soon
       FROM units u
       ${UNIT_JOIN}
       WHERE ${unitCond.sql} ${unitFCond.sql}`,
      [...unitCond.params, ...unitFCond.params]
    ),
    pool.execute<RowDataPacket[]>(
      `SELECT
         SUM(CASE WHEN v.police_verification_valid_till IS NOT NULL AND v.police_verification_valid_till < CURDATE()
                   THEN 1 ELSE 0 END) AS pvr_expired,
         SUM(CASE WHEN v.police_verification_valid_till >= CURDATE()
                   AND v.police_verification_valid_till <= DATE_ADD(CURDATE(), INTERVAL 30 DAY) THEN 1 ELSE 0 END) AS pvr_due_soon,
         SUM(CASE WHEN v.medical_verification_valid_till IS NOT NULL AND v.medical_verification_valid_till < CURDATE()
                   THEN 1 ELSE 0 END) AS medical_expired,
         SUM(CASE WHEN v.medical_verification_valid_till >= CURDATE()
                   AND v.medical_verification_valid_till <= DATE_ADD(CURDATE(), INTERVAL 30 DAY) THEN 1 ELSE 0 END) AS medical_due_soon
       FROM vendors v
       WHERE v.status = 1 AND ${vendorCond.sql} ${vendorFCond.sql}`,
      [...vendorCond.params, ...vendorFCond.params]
    ),
  ]);

  const cr = contractRows[0] ?? {};
  const ur = unitRows[0] ?? {};
  const vr = vendorRows[0] ?? {};

  return {
    contractExpiry: { expired: num(cr.expired), expiring7Days: num(cr.expiring7), expiring30Days: num(cr.expiring30) },
    unitCompliance: {
      licenseFees: { expired: num(ur.license_expired), dueSoon: num(ur.license_due_soon) },
      electricBill: { expired: num(ur.electric_expired), dueSoon: num(ur.electric_due_soon) },
      fssai: { expired: num(ur.fssai_expired), dueSoon: num(ur.fssai_due_soon) },
    },
    vendorCompliance: {
      pvr: { expired: num(vr.pvr_expired), dueSoon: num(vr.pvr_due_soon) },
      medical: { expired: num(vr.medical_expired), dueSoon: num(vr.medical_due_soon) },
    },
    penaltyOverdue: { total: penaltyOverdueCount },
  };
};

// ─── DASHBOARD SUMMARY — all 5 groups + alerts in one round trip ──────────────
export const getDashboardSummary = async (scope: DashboardScope, filters: DashboardFilters = NO_FILTERS) => {
  const [units, contractors, vendors, penalty, pendingAction] = await Promise.all([
    getUnitsSummary(scope, filters),
    getContractorsSummary(scope, filters),
    getVendorsSummary(scope, filters),
    getPenaltySummary(scope, filters),
    getPendingActionSummary(scope, filters),
  ]);
  const criticalAlerts = await getCriticalAlerts(scope, penalty.due.overdue, filters);

  return { view: scope.view, units, contractors, vendors, penalty, pendingAction, criticalAlerts };
};

// ─── LAZY GRAPH DATA — subgroup breakdown for exactly one clicked card ────────
export type DashboardGroupKey = "units" | "contractors" | "vendors" | "penalty" | "pending_action";

export const getGroupGraphData = async (
  group: DashboardGroupKey,
  scope: DashboardScope,
  filters: DashboardFilters = NO_FILTERS
) => {
  switch (group) {
    case "units": {
      const s = await getUnitsSummary(scope, filters);
      return [
        { label: "Active", value: s.active },
        { label: "Idle", value: s.idle },
        { label: "Inactive", value: s.inactive },
      ];
    }
    case "contractors": {
      const s = await getContractorsSummary(scope, filters);
      return [
        { label: "Active", value: s.active },
        { label: "Inactive", value: s.inactive },
        { label: "Blacklisted", value: s.blacklisted },
      ];
    }
    case "vendors": {
      const s = await getVendorsSummary(scope, filters);
      return [
        { label: "Active", value: s.active },
        { label: "Inactive", value: s.inactive },
        { label: "Blacklisted", value: s.blacklisted },
      ];
    }
    case "penalty": {
      const s = await getPenaltySummary(scope, filters);
      return [
        { label: "Imposed", value: s.imposed.count },
        { label: "Recovered", value: s.recovered.count },
        { label: "Due Within 7 Days", value: s.due.within7Days },
        { label: "Due Within 14 Days", value: s.due.within14Days },
        { label: "Due Within 30 Days", value: s.due.within30Days },
        { label: "Overdue", value: s.due.overdue },
      ];
    }
    case "pending_action": {
      const s = await getPendingActionSummary(scope, filters);
      return [
        { label: "Complaints Pending ATR", value: s.complaintsPendingAtr.count },
        { label: "Inspections Pending ATR", value: s.inspectionsPendingAtr.count },
        { label: "License Fee Due Within 7 Days", value: s.licenseFeeUpdationDue.within7Days },
        { label: "License Fee Due Within 14 Days", value: s.licenseFeeUpdationDue.within14Days },
        { label: "License Fee Overdue", value: s.licenseFeeUpdationDue.overdue },
      ];
    }
    default:
      return [];
  }
};
