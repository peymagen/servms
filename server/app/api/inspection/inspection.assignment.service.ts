import { pool } from "../../common/services/sql.service";
import { type RowDataPacket, type ResultSetHeader } from "mysql2";
import { type IInspectionAssign } from "./inspection.dto";
import { recordStatusChange } from "./inspection.service";

const assertInspectionExists = async (id: string) => {
  const [rows] = await pool.execute<RowDataPacket[]>(
    "SELECT id, unit_id, inspection_status FROM inspections WHERE id = ? AND status = 1",
    [id]
  );
  if (!rows.length) throw new Error("Inspection not found");
  return rows[0]!;
};

// Assign (first-time, requires the inspection to have been Submitted and
// reviewed by Sub-admin), reassign, or transfer the Responsible Unit / Dealing
// Section user. `inspection_assignments` holds every such event — the latest
// row per inspection_id is the current assignment, the full set is history.
export const assignInspection = async (
  id: string,
  data: IInspectionAssign,
  userId: number,
  assignmentType: "initial" | "reassign" | "transfer"
) => {
  const inspection = await assertInspectionExists(id);
  if (assignmentType === "initial" && inspection.inspection_status !== "submitted") {
    throw new Error(`Cannot assign an inspection that is "${inspection.inspection_status}"`);
  }

  const [result] = await pool.execute<ResultSetHeader>(
    `INSERT INTO inspection_assignments (inspection_id, assignment_type, from_unit_id, to_unit_id, assigned_to_user_id, assigned_by, remarks)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, assignmentType, inspection.unit_id, data.to_unit_id, data.assigned_to_user_id ?? null, userId, data.remarks ?? null]
  );

  const nextStatus = inspection.inspection_status === "submitted" ? "assigned" : inspection.inspection_status;

  await pool.execute(
    `UPDATE inspections SET unit_id = ?, assigned_to_user_id = ?, inspection_status = ? WHERE id = ?`,
    [data.to_unit_id, data.assigned_to_user_id ?? null, nextStatus, id]
  );

  if (nextStatus !== inspection.inspection_status) {
    await recordStatusChange(Number(id), inspection.inspection_status, nextStatus, userId, `Assigned to unit #${data.to_unit_id}`);
  }

  return { id: result.insertId, inspection_id: Number(id) };
};

export const getAssignmentHistory = async (inspectionId: string) => {
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT ia.*, fu.unit_name as from_unit_name, tu.unit_name as to_unit_name, au.full_name as assigned_to_user_name, ab.full_name as assigned_by_name
     FROM inspection_assignments ia
     LEFT JOIN units fu ON fu.id = ia.from_unit_id
     LEFT JOIN units tu ON tu.id = ia.to_unit_id
     LEFT JOIN users au ON au.id = ia.assigned_to_user_id
     LEFT JOIN users ab ON ab.id = ia.assigned_by
     WHERE ia.inspection_id = ? ORDER BY ia.created_at DESC`,
    [inspectionId]
  );
  return rows;
};
