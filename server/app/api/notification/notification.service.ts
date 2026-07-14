import { pool } from "../../common/services/sql.service";
import { relativeTime } from "../../common/helper/time.helper";
import { type RowDataPacket } from "mysql2";

export type NotificationModule = "vendor_master" | "complaints" | "penalties" | "user_management";
export type NotificationSeverity = "critical" | "warning" | "info";

export interface NotificationItem {
  id: string;
  module: NotificationModule;
  moduleLabel: string;
  severity: NotificationSeverity;
  title: string;
  description: string;
  time: string;
  sortAt: number;
}

const MODULE_LABELS: Record<NotificationModule, string> = {
  vendor_master: "Vendor Master",
  complaints: "Complaints",
  penalties: "Penalties",
  user_management: "User Management",
};

const SEVERITY_WEIGHT: Record<NotificationSeverity, number> = {
  critical: 0,
  warning: 1,
  info: 2,
};

function daysUntil(target: Date): number {
  return Math.ceil((target.getTime() - Date.now()) / (1000 * 3600 * 24));
}

export const getNotifications = async (opts: {
  divisionId?: number;
  module?: NotificationModule | "all";
  limit?: number;
}) => {
  const divisionId = opts.divisionId;
  const items: NotificationItem[] = [];

  // ── Vendor Master: contractor licenses expiring within 30 days (or already expired) ──
  const [licenseRows] = await pool.execute<RowDataPacket[]>(
    `SELECT id, company_name, license_validity_date, updated_at
     FROM contractors
     WHERE status = 1 AND license_validity_date IS NOT NULL
       AND license_validity_date <= DATE_ADD(CURDATE(), INTERVAL 30 DAY)
       ${divisionId ? "AND division_id = ?" : ""}
     ORDER BY license_validity_date ASC
     LIMIT 15`,
    divisionId ? [divisionId] : []
  );
  licenseRows.forEach((row) => {
    const daysLeft = daysUntil(new Date(row.license_validity_date));
    const updatedAt = new Date(row.updated_at);
    items.push({
      id: `license-${row.id}`,
      module: "vendor_master",
      moduleLabel: MODULE_LABELS.vendor_master,
      severity: daysLeft <= 7 ? "critical" : "warning",
      title: "Vendor License Expiry",
      description: `${row.company_name} license ${
        daysLeft >= 0 ? `expires in ${daysLeft} day${daysLeft === 1 ? "" : "s"}` : `expired ${Math.abs(daysLeft)} day${Math.abs(daysLeft) === 1 ? "" : "s"} ago`
      }. Renewal application review required.`,
      time: relativeTime(updatedAt),
      sortAt: updatedAt.getTime(),
    });
  });

  // ── Vendor Master: renewals awaiting approval ──
  const [renewalRows] = await pool.execute<RowDataPacket[]>(
    `SELECT r.id, r.created_at, v.full_name, v.vendor_code
     FROM vendor_renewals r
     JOIN vendors v ON v.id = r.vendor_id
     WHERE r.status = 1 AND r.renewals_status = 'pending_approval'
       ${divisionId ? "AND v.division_id = ?" : ""}
     ORDER BY r.created_at DESC
     LIMIT 15`,
    divisionId ? [divisionId] : []
  );
  renewalRows.forEach((row) => {
    const createdAt = new Date(row.created_at);
    items.push({
      id: `renewal-${row.id}`,
      module: "vendor_master",
      moduleLabel: MODULE_LABELS.vendor_master,
      severity: "warning",
      title: "Vendor Renewal Pending Approval",
      description: `Renewal request for ${row.full_name} (${row.vendor_code}) is awaiting review.`,
      time: relativeTime(createdAt),
      sortAt: createdAt.getTime(),
    });
  });

  // ── Complaints: open / investigating ──
  const [complaintRows] = await pool.execute<RowDataPacket[]>(
    `SELECT c.id, c.complaint_code, c.category, c.priority, c.created_at, u.unit_name
     FROM complaints c
     LEFT JOIN units u ON u.id = c.unit_id
     LEFT JOIN stations st ON st.id = u.station_id
     WHERE c.status = 1 AND c.complaints_status IN ('open', 'investigating')
       ${divisionId ? "AND st.division_id = ?" : ""}
     ORDER BY c.created_at DESC
     LIMIT 15`,
    divisionId ? [divisionId] : []
  );
  complaintRows.forEach((row) => {
    const createdAt = new Date(row.created_at);
    items.push({
      id: `complaint-${row.id}`,
      module: "complaints",
      moduleLabel: MODULE_LABELS.complaints,
      severity: row.priority === "high" ? "critical" : "info",
      title: "New Complaint Assigned",
      description: `Complaint ${row.complaint_code}${row.category ? ` (${row.category})` : ""} at ${row.unit_name ?? "an unassigned unit"} needs attention.`,
      time: relativeTime(createdAt),
      sortAt: createdAt.getTime(),
    });
  });

  // ── Penalties: pending recovery ──
  const [penaltyRows] = await pool.execute<RowDataPacket[]>(
    `SELECT p.id, p.penalty_code, p.amount, p.created_at, IFNULL(c.division_id, v.division_id) as division_id
     FROM penalties p
     LEFT JOIN contractors c ON c.id = p.contractor_id
     LEFT JOIN vendors v ON v.id = p.vendor_id
     WHERE p.status = 1 AND p.penalties_status = 'pending'
       ${divisionId ? "AND IFNULL(c.division_id, v.division_id) = ?" : ""}
     ORDER BY p.created_at DESC
     LIMIT 15`,
    divisionId ? [divisionId] : []
  );
  penaltyRows.forEach((row) => {
    const createdAt = new Date(row.created_at);
    items.push({
      id: `penalty-${row.id}`,
      module: "penalties",
      moduleLabel: MODULE_LABELS.penalties,
      severity: "warning",
      title: "Pending Penalty Recovery",
      description: `Notice of recovery for ₹${Number(row.amount).toLocaleString("en-IN")} against ${row.penalty_code} requires manual intervention.`,
      time: relativeTime(createdAt),
      sortAt: createdAt.getTime(),
    });
  });

  // ── User Management: recently registered users ──
  const [userRows] = await pool.execute<RowDataPacket[]>(
    `SELECT id, full_name, designation, created_at
     FROM users
     WHERE status = 1 AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
       ${divisionId ? "AND division_id = ?" : ""}
     ORDER BY created_at DESC
     LIMIT 15`,
    divisionId ? [divisionId] : []
  );
  userRows.forEach((row) => {
    const createdAt = new Date(row.created_at);
    items.push({
      id: `user-${row.id}`,
      module: "user_management",
      moduleLabel: MODULE_LABELS.user_management,
      severity: "info",
      title: "New User Registered",
      description: `${row.full_name}${row.designation ? ` (${row.designation})` : ""} was added to the system and may need role/permission review.`,
      time: relativeTime(createdAt),
      sortAt: createdAt.getTime(),
    });
  });

  items.sort((a, b) => SEVERITY_WEIGHT[a.severity] - SEVERITY_WEIGHT[b.severity] || b.sortAt - a.sortAt);

  const counts = {
    all: items.length,
    vendor_master: items.filter((i) => i.module === "vendor_master").length,
    complaints: items.filter((i) => i.module === "complaints").length,
    penalties: items.filter((i) => i.module === "penalties").length,
    user_management: items.filter((i) => i.module === "user_management").length,
  };

  const filtered = !opts.module || opts.module === "all" ? items : items.filter((i) => i.module === opts.module);
  const limit = opts.limit ?? 6;
  const rows = filtered.slice(0, limit).map(({ sortAt, ...rest }) => rest);

  return {
    counts,
    total: filtered.length,
    hasMore: filtered.length > limit,
    rows,
  };
};
