import { pool } from "../../common/services/sql.service";
import { type RowDataPacket, type ResultSetHeader } from "mysql2";
import { type IComplaintAssign } from "./complaint.dto";
import { recordStatusChange, getUnitDivisionId } from "./complaint.service";

const assertComplaintExists = async (id: string) => {
  const [rows] = await pool.execute<RowDataPacket[]>(
    "SELECT id, unit_id, complaints_status FROM complaints WHERE id = ? AND status = 1",
    [id]
  );
  if (!rows.length) throw new Error("Complaint not found");
  return rows[0]!;
};

// Assign (first-time), reassign, or transfer the complaint's Concerned Unit /
// responsible Dealing Section user. `complaint_assignments` holds every such
// event — the latest row per complaint_id is the current assignment, and the
// full set is the assignment history.
export const assignComplaint = async (
  id: string,
  data: IComplaintAssign,
  userId: number,
  assignmentType: "initial" | "reassign" | "transfer"
) => {
  const complaint = await assertComplaintExists(id);

  const [result] = await pool.execute<ResultSetHeader>(
    `INSERT INTO complaint_assignments (complaint_id, assignment_type, from_unit_id, to_unit_id, assigned_to_user_id, assigned_by, remarks)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, assignmentType, complaint.unit_id, data.to_unit_id, data.assigned_to_user_id ?? null, userId, data.remarks ?? null]
  );

  const nextStatus = complaint.complaints_status === "pending" ? "assigned" : complaint.complaints_status;

  // Re-derive division_id from the newly assigned unit every time (not just when
  // currently NULL) — this is what actually makes an HQ-sourced complaint
  // (division_id IS NULL, e.g. a RailMadad row with divCode="HQ") show up in the
  // right division's Complaint module once it's assigned to one of that division's
  // units. Without this, HQ complaints stayed permanently invisible to divisional
  // roles even after assignment, since division_id never got backfilled.
  const divisionId = await getUnitDivisionId(data.to_unit_id);

  await pool.execute(
    `UPDATE complaints SET unit_id = ?, division_id = ?, assigned_to_user_id = ?, complaints_status = ? WHERE id = ?`,
    [data.to_unit_id, divisionId, data.assigned_to_user_id ?? null, nextStatus, id]
  );

  if (nextStatus !== complaint.complaints_status) {
    await recordStatusChange(Number(id), complaint.complaints_status, nextStatus, userId, `Assigned to unit #${data.to_unit_id}`);
  }

  return { id: result.insertId, complaint_id: Number(id) };
};

export const getAssignmentHistory = async (complaintId: string) => {
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT ca.*, fu.unit_name as from_unit_name, tu.unit_name as to_unit_name, au.full_name as assigned_to_user_name, ab.full_name as assigned_by_name
     FROM complaint_assignments ca
     LEFT JOIN units fu ON fu.id = ca.from_unit_id
     LEFT JOIN units tu ON tu.id = ca.to_unit_id
     LEFT JOIN users au ON au.id = ca.assigned_to_user_id
     LEFT JOIN users ab ON ab.id = ca.assigned_by
     WHERE ca.complaint_id = ? ORDER BY ca.created_at DESC`,
    [complaintId]
  );
  return rows;
};
