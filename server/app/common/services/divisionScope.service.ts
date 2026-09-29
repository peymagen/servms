import createHttpError from "http-errors";
import { type RowDataPacket } from "mysql2";
import { pool } from "./sql.service";
import { isDivisionScoped } from "../constants/roles";

// How to resolve the owning division of each division-restricted entity, by id.
// Units have no division column of their own — it comes from their location.
const DIVISION_LOOKUPS = {
  unit: `SELECT COALESCE(st.division_id, tr.division_id, cl.division_id) AS division_id
         FROM units u
         LEFT JOIN stations st ON st.id = u.station_id
         LEFT JOIN trains tr ON tr.id = u.train_id
         LEFT JOIN location_clusters cl ON cl.id = u.cluster_id
         WHERE u.id = ?`,
  station: "SELECT division_id FROM stations WHERE id = ?",
  train: "SELECT division_id FROM trains WHERE id = ?",
  cluster: "SELECT division_id FROM location_clusters WHERE id = ?",
  contractor: "SELECT division_id FROM contractors WHERE id = ?",
  vendor: "SELECT division_id FROM vendors WHERE id = ?",
  complaint: "SELECT division_id FROM complaints WHERE id = ?",
  inspection: "SELECT division_id FROM inspections WHERE id = ?",
  renewal: "SELECT v.division_id FROM vendor_renewals r JOIN vendors v ON v.id = r.vendor_id WHERE r.id = ?",
  inspection_document:
    "SELECT i.division_id FROM inspection_documents d JOIN inspections i ON i.id = d.inspection_id WHERE d.id = ?",
} as const;

export type DivisionScopedEntity = keyof typeof DIVISION_LOOKUPS;

const LABELS: Record<DivisionScopedEntity, string> = {
  unit: "Unit",
  station: "Station",
  train: "Train",
  cluster: "Cluster",
  contractor: "Contractor",
  vendor: "Vendor",
  complaint: "Complaint",
  inspection: "Inspection",
  renewal: "Renewal",
  inspection_document: "Document",
};

type ScopedUser = { role_name?: string | null; division_id?: number | null } | undefined | null;

const isBlank = (id: unknown) => id === undefined || id === null || id === "";

const getDivisionOf = async (entity: DivisionScopedEntity, id: unknown): Promise<number | null | undefined> => {
  const [rows] = await pool.execute<RowDataPacket[]>(DIVISION_LOOKUPS[entity], [id]);
  if (!rows[0]) return undefined;
  return rows[0].division_id ?? null;
};

// For ids a division-scoped user sends in a create/edit payload (the unit,
// contractor, vendor... a record links to): each must sit in the user's own
// division. Blank ids are skipped; a record with no division counts as outside.
export const assertRefsInOwnDivision = async (
  user: ScopedUser,
  refs: Partial<Record<DivisionScopedEntity, unknown>>
): Promise<void> => {
  if (!isDivisionScoped(user?.role_name)) return;
  for (const [entity, id] of Object.entries(refs) as Array<[DivisionScopedEntity, unknown]>) {
    if (isBlank(id)) continue;
    const divisionId = await getDivisionOf(entity, id);
    if (divisionId == null || Number(divisionId) !== Number(user?.division_id)) {
      throw createHttpError(403, `${LABELS[entity]} is not in your division`);
    }
  }
};

// For the record a request acts on (the :id in the URL): 404 rather than 403
// so a division-scoped user can't probe which ids exist in other divisions.
export const assertRecordInOwnDivision = async (
  user: ScopedUser,
  entity: DivisionScopedEntity,
  id: unknown
): Promise<void> => {
  if (!isDivisionScoped(user?.role_name)) return;
  const divisionId = await getDivisionOf(entity, id);
  if (divisionId == null || Number(divisionId) !== Number(user?.division_id)) {
    throw createHttpError(404, `${LABELS[entity]} not found`);
  }
};
