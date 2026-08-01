import { pool } from "../../common/services/sql.service";
import { relativeTime } from "../../common/helper/time.helper";
import { type RowDataPacket } from "mysql2";
import { getPenaltyNotificationRows } from "../penalty/penalty.service";

export type NotificationModule = "vendor_master" | "complaints" | "penalties" | "user_management" | "inspections";
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
  inspections: "Inspections",
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
  // Inspector (self-scoped) / Dealing Section (assignee-scoped) narrow the
  // Inspections feed to only their own/assigned inspections — the other
  // feeds (vendor/complaint/penalty/user) aren't touched by these two, since
  // neither role has a defined ownership concept over those modules.
  inspectorId?: number;
  assignedToUserId?: number;
}) => {
  const divisionId = opts.divisionId;
  const inspectorId = opts.inspectorId;
  const assignedToUserId = opts.assignedToUserId;
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

  // ── Complaints: pending / assigned / under_review / action_taken awaiting attention ──
  const [complaintRows] = await pool.execute<RowDataPacket[]>(
    `SELECT c.id, c.complaint_code, c.priority, c.created_at, ct.label as complaint_type_label
     FROM complaints c
     LEFT JOIN dropdown_options ct ON ct.id = c.complaint_type_id
     WHERE c.status = 1 AND c.complaints_status IN ('pending', 'assigned', 'under_review', 'action_taken')
       ${divisionId ? "AND c.division_id = ?" : ""}
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
      title: "Complaint Needs Attention",
      description: `Complaint ${row.complaint_code}${row.complaint_type_label ? ` (${row.complaint_type_label})` : ""} needs attention.`,
      time: relativeTime(createdAt),
      sortAt: createdAt.getTime(),
    });
  });

  // ── Complaints: assigned/reassigned/transferred to a Concerned Unit recently ──
  const [assignmentRows] = await pool.execute<RowDataPacket[]>(
    `SELECT ca.id, ca.assignment_type, ca.created_at, c.complaint_code, tu.unit_name as to_unit_name
     FROM complaint_assignments ca
     JOIN complaints c ON c.id = ca.complaint_id AND c.status = 1
     LEFT JOIN units tu ON tu.id = ca.to_unit_id
     WHERE ca.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
       ${divisionId ? "AND c.division_id = ?" : ""}
     ORDER BY ca.created_at DESC
     LIMIT 15`,
    divisionId ? [divisionId] : []
  );
  assignmentRows.forEach((row) => {
    const createdAt = new Date(row.created_at);
    items.push({
      id: `complaint-assign-${row.id}`,
      module: "complaints",
      moduleLabel: MODULE_LABELS.complaints,
      severity: "info",
      title: row.assignment_type === "transfer" ? "Complaint Transferred" : row.assignment_type === "reassign" ? "Complaint Reassigned" : "Complaint Assigned",
      description: `Complaint ${row.complaint_code} was ${row.assignment_type === "initial" ? "assigned" : row.assignment_type + "red"} to ${row.to_unit_name ?? "a unit"}.`,
      time: relativeTime(createdAt),
      sortAt: createdAt.getTime(),
    });
  });

  // ── Action Taken Reports: submitted / approved / rejected ──
  const [atrRows] = await pool.execute<RowDataPacket[]>(
    `SELECT atr.id, atr.review_status, atr.created_at, atr.decided_at, atr.reviewed_at, c.complaint_code, c.division_id
     FROM complaint_action_taken_reports atr
     JOIN complaints c ON c.id = atr.complaint_id AND c.status = 1
     WHERE atr.status = 1 AND atr.created_at >= DATE_SUB(NOW(), INTERVAL 14 DAY)
       ${divisionId ? "AND c.division_id = ?" : ""}
     ORDER BY atr.created_at DESC
     LIMIT 15`,
    divisionId ? [divisionId] : []
  );
  atrRows.forEach((row) => {
    const eventAt = new Date(row.decided_at ?? row.reviewed_at ?? row.created_at);
    const isTerminal = row.review_status === "accepted" || row.review_status === "rejected";
    items.push({
      id: `complaint-atr-${row.id}`,
      module: "complaints",
      moduleLabel: MODULE_LABELS.complaints,
      severity: row.review_status === "rejected" ? "warning" : "info",
      title:
        row.review_status === "accepted"
          ? "Action Taken Report Approved"
          : row.review_status === "rejected"
          ? "Action Taken Report Rejected"
          : row.review_status === "sub_admin_reviewed"
          ? "Action Taken Report Under Admin Review"
          : "Action Taken Report Submitted",
      description: `ATR for complaint ${row.complaint_code} ${isTerminal ? "was" : "is"} ${row.review_status.replace(/_/g, " ")}.`,
      time: relativeTime(eventAt),
      sortAt: eventAt.getTime(),
    });
  });

  // ── Complaints closed recently ──
  const [closedRows] = await pool.execute<RowDataPacket[]>(
    `SELECT c.id, c.complaint_code, c.closed_at
     FROM complaints c
     WHERE c.status = 1 AND c.complaints_status = 'closed' AND c.closed_at >= DATE_SUB(NOW(), INTERVAL 14 DAY)
       ${divisionId ? "AND c.division_id = ?" : ""}
     ORDER BY c.closed_at DESC
     LIMIT 15`,
    divisionId ? [divisionId] : []
  );
  closedRows.forEach((row) => {
    const closedAt = new Date(row.closed_at);
    items.push({
      id: `complaint-closed-${row.id}`,
      module: "complaints",
      moduleLabel: MODULE_LABELS.complaints,
      severity: "info",
      title: "Complaint Closed",
      description: `Complaint ${row.complaint_code} has been closed.`,
      time: relativeTime(closedAt),
      sortAt: closedAt.getTime(),
    });
  });

  // ── Penalties: upcoming due (≤7 days), overdue, and recently recovered ──
  const penaltyFeed = await getPenaltyNotificationRows(divisionId);

  penaltyFeed.upcoming.forEach((row) => {
    const dueAt = new Date(row.due_date);
    items.push({
      id: `penalty-due-${row.id}`,
      module: "penalties",
      moduleLabel: MODULE_LABELS.penalties,
      severity: "warning",
      title: "Penalty Recovery Due Soon",
      description: `₹${Number(row.amount).toLocaleString("en-IN")} against ${row.penalty_code} (${row.contractor_name ?? "—"}) is due for recovery on ${dueAt.toLocaleDateString("en-IN")}.`,
      time: relativeTime(dueAt),
      sortAt: dueAt.getTime(),
    });
  });

  penaltyFeed.overdue.forEach((row) => {
    const dueAt = new Date(row.due_date);
    items.push({
      id: `penalty-overdue-${row.id}`,
      module: "penalties",
      moduleLabel: MODULE_LABELS.penalties,
      severity: "critical",
      title: "Penalty Recovery Overdue",
      description: `₹${Number(row.amount).toLocaleString("en-IN")} against ${row.penalty_code} (${row.contractor_name ?? "—"}) is overdue since ${dueAt.toLocaleDateString("en-IN")}.`,
      time: relativeTime(dueAt),
      sortAt: dueAt.getTime(),
    });
  });

  penaltyFeed.recovered.forEach((row) => {
    const recoveredAt = new Date(row.recovery_date);
    items.push({
      id: `penalty-recovered-${row.id}`,
      module: "penalties",
      moduleLabel: MODULE_LABELS.penalties,
      severity: "info",
      title: "Penalty Recovered",
      description: `₹${Number(row.amount).toLocaleString("en-IN")} against ${row.penalty_code} (${row.contractor_name ?? "—"}) was recovered.`,
      time: relativeTime(recoveredAt),
      sortAt: recoveredAt.getTime(),
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

  // ── Inspections: submitted / assigned / ATR submitted awaiting review ──
  const inspectionScopeParams: any[] = [];
  let inspectionScopeSql = "";
  if (divisionId) {
    inspectionScopeSql += " AND i.division_id = ?";
    inspectionScopeParams.push(divisionId);
  }
  if (inspectorId) {
    inspectionScopeSql += " AND i.inspector_id = ?";
    inspectionScopeParams.push(inspectorId);
  }
  if (assignedToUserId) {
    inspectionScopeSql += " AND i.assigned_to_user_id = ?";
    inspectionScopeParams.push(assignedToUserId);
  }

  const [inspectionRows] = await pool.execute<RowDataPacket[]>(
    `SELECT i.id, i.inspection_no, i.priority, i.inspection_status, i.submitted_at, i.created_at
     FROM inspections i
     WHERE i.status = 1 AND i.inspection_status IN ('submitted', 'assigned', 'atr_submitted', 'under_review')
       ${inspectionScopeSql}
     ORDER BY i.created_at DESC
     LIMIT 15`,
    inspectionScopeParams
  );
  inspectionRows.forEach((row) => {
    const eventAt = new Date(row.submitted_at ?? row.created_at);
    const titles: Record<string, string> = {
      submitted: "Inspection Awaiting Review",
      assigned: "Inspection Assigned",
      atr_submitted: "ATR Submitted",
      under_review: "ATR Ready for Approval",
    };
    items.push({
      id: `inspection-${row.id}`,
      module: "inspections",
      moduleLabel: MODULE_LABELS.inspections,
      severity: row.priority === "high" ? "critical" : "info",
      title: titles[row.inspection_status] ?? "Inspection Needs Attention",
      description: `Inspection ${row.inspection_no ?? `#${row.id}`} is "${row.inspection_status.replace(/_/g, " ")}".`,
      time: relativeTime(eventAt),
      sortAt: eventAt.getTime(),
    });
  });

  // ── Inspections: assignment events (assigned/reassigned/transferred) ──
  const [inspectionAssignRows] = await pool.execute<RowDataPacket[]>(
    `SELECT ia.id, ia.assignment_type, ia.created_at, i.inspection_no, tu.unit_name as to_unit_name
     FROM inspection_assignments ia
     JOIN inspections i ON i.id = ia.inspection_id AND i.status = 1
     LEFT JOIN units tu ON tu.id = ia.to_unit_id
     WHERE ia.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
       ${inspectionScopeSql}
     ORDER BY ia.created_at DESC
     LIMIT 15`,
    inspectionScopeParams
  );
  inspectionAssignRows.forEach((row) => {
    const createdAt = new Date(row.created_at);
    items.push({
      id: `inspection-assign-${row.id}`,
      module: "inspections",
      moduleLabel: MODULE_LABELS.inspections,
      severity: "info",
      title: row.assignment_type === "reassign" ? "Inspection Reassigned" : row.assignment_type === "transfer" ? "Inspection Transferred" : "Inspection Assigned",
      description: `Inspection ${row.inspection_no ?? ""} was ${row.assignment_type === "initial" ? "assigned" : row.assignment_type + "ed"} to ${row.to_unit_name ?? "a unit"}.`,
      time: relativeTime(createdAt),
      sortAt: createdAt.getTime(),
    });
  });

  // ── Inspections: ATR decisions and closures ──
  const [inspectionAtrRows] = await pool.execute<RowDataPacket[]>(
    `SELECT atr.id, atr.review_status, atr.decided_at, atr.created_at, i.inspection_no, i.division_id
     FROM inspection_action_taken_reports atr
     JOIN inspections i ON i.id = atr.inspection_id AND i.status = 1
     WHERE atr.status = 1 AND atr.review_status IN ('accepted', 'rejected') AND atr.decided_at >= DATE_SUB(NOW(), INTERVAL 14 DAY)
       ${inspectionScopeSql}
     ORDER BY atr.decided_at DESC
     LIMIT 15`,
    inspectionScopeParams
  );
  inspectionAtrRows.forEach((row) => {
    const decidedAt = new Date(row.decided_at ?? row.created_at);
    items.push({
      id: `inspection-atr-${row.id}`,
      module: "inspections",
      moduleLabel: MODULE_LABELS.inspections,
      severity: row.review_status === "rejected" ? "warning" : "info",
      title: row.review_status === "accepted" ? "ATR Approved" : "ATR Rejected",
      description: `ATR for inspection ${row.inspection_no ?? ""} was ${row.review_status}.`,
      time: relativeTime(decidedAt),
      sortAt: decidedAt.getTime(),
    });
  });

  const [inspectionClosedRows] = await pool.execute<RowDataPacket[]>(
    `SELECT i.id, i.inspection_no, i.closed_at
     FROM inspections i
     WHERE i.status = 1 AND i.inspection_status = 'closed' AND i.closed_at >= DATE_SUB(NOW(), INTERVAL 14 DAY)
       ${inspectionScopeSql}
     ORDER BY i.closed_at DESC
     LIMIT 15`,
    inspectionScopeParams
  );
  inspectionClosedRows.forEach((row) => {
    const closedAt = new Date(row.closed_at);
    items.push({
      id: `inspection-closed-${row.id}`,
      module: "inspections",
      moduleLabel: MODULE_LABELS.inspections,
      severity: "info",
      title: "Inspection Closed",
      description: `Inspection ${row.inspection_no ?? ""} has been closed.`,
      time: relativeTime(closedAt),
      sortAt: closedAt.getTime(),
    });
  });

  items.sort((a, b) => SEVERITY_WEIGHT[a.severity] - SEVERITY_WEIGHT[b.severity] || b.sortAt - a.sortAt);

  const counts = {
    all: items.length,
    vendor_master: items.filter((i) => i.module === "vendor_master").length,
    complaints: items.filter((i) => i.module === "complaints").length,
    penalties: items.filter((i) => i.module === "penalties").length,
    user_management: items.filter((i) => i.module === "user_management").length,
    inspections: items.filter((i) => i.module === "inspections").length,
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
