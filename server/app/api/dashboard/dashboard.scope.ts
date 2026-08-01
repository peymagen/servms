import { pool } from "../../common/services/sql.service";
import { isDivisionScoped } from "../../common/constants/roles";
import { type RowDataPacket } from "mysql2";

// The HQ toggle's individual-division options are fixed to exactly the 4
// named in the SRS ("Zone, ADRA, CKP, KGP, RNC, HQ") — confirmed with the
// user rather than left dynamic, even though the live `divisions` table also
// has TATA and HLD. Those two still exist and are still included in "Zone"'s
// combined total; they just have no dedicated toggle button of their own.
const HQ_TOGGLE_DIVISION_CODES = ["ADRA", "CKP", "KGP", "RNC"];

// "division": restrict to a single division_id
// "zone":     restrict to every division_id under a zone_id, summed together
//             (this still includes every division under the zone, not just
//             the 4 named toggle options — see HQ_TOGGLE_DIVISION_CODES above)
// "hq":       restrict to records with no division (division_id IS NULL) —
//             mirrors the existing convention (e.g. RailMadad complaints with
//             divCode="HQ") of HQ-owned records simply carrying no division.
// "all":      no restriction — today's implicit org-wide view, used only
//             before an HQ user has picked a toggle value.
export interface DashboardScope {
  mode: "division" | "zone" | "hq" | "all";
  divisionId?: number;
  divisionIds?: number[];
  zoneId?: number;
  view: string;
}

// Resolves the dashboard's data scope from the requesting user + an optional
// `?view=` query param. Divisional Admin/Sub-admin are always forced to their
// own division regardless of `?view=`, exactly like every other module's
// isDivisionScoped() check. HQ roles may pass `?view=` as a division_code
// (e.g. "ADRA"), "Zone", or "HQ".
export const resolveDashboardScope = async (user: any, viewParam?: string): Promise<DashboardScope> => {
  if (isDivisionScoped(user?.role_name) && user?.division_id) {
    return { mode: "division", divisionId: Number(user.division_id), view: "division" };
  }

  const view = (viewParam ?? "").trim();
  if (!view) {
    return { mode: "all", view: "all" };
  }

  if (view.toLowerCase() === "hq") {
    return { mode: "hq", view: "HQ" };
  }

  if (view.toLowerCase() === "zone") {
    const [rows] = await pool.execute<RowDataPacket[]>("SELECT id, zone_id FROM divisions WHERE status = 1");
    // Only one zone is seeded today; if a second zone is ever added, "Zone" as a
    // single flat toggle option would need to become a zone picker instead.
    const divisionIds = rows.map((r) => Number(r.id));
    const zoneId = rows[0]?.zone_id ? Number(rows[0].zone_id) : undefined;
    return { mode: "zone", divisionIds, zoneId, view: "Zone" };
  }

  // Only the 4 named division codes are honored here, even if `view` matches
  // some other real division_code (e.g. "TATA") — that guards against someone
  // hand-crafting a query string for a toggle option that was deliberately
  // left off the UI, not just an unknown/typo'd value.
  if (HQ_TOGGLE_DIVISION_CODES.includes(view.toUpperCase())) {
    const [divisionRows] = await pool.execute<RowDataPacket[]>(
      "SELECT id, division_code FROM divisions WHERE status = 1 AND division_code = ?",
      [view.toUpperCase()]
    );
    if (divisionRows[0]) {
      return { mode: "division", divisionId: Number(divisionRows[0].id), view: String(divisionRows[0].division_code) };
    }
  }

  // Unknown/stale/disallowed `view` value falls back to the org-wide default
  // rather than erroring, so a bad query param never hard-fails the dashboard.
  return { mode: "all", view: "all" };
};

// Fixed HQ toggle options per the SRS: Zone, ADRA, CKP, KGP, RNC, HQ — not
// dynamic (confirmed with the user 2026-07-31; see HQ_TOGGLE_DIVISION_CODES above).
export const getHqToggleOptions = async (): Promise<string[]> => {
  return ["Zone", ...HQ_TOGGLE_DIVISION_CODES, "HQ"];
};

// Optional filter-bar narrowing, independent of the HQ toggle's division/zone/HQ
// scope. Division is intentionally not repeated here — the toggle already picks
// the division/zone/HQ view; the filter bar adds finer-grained narrowing on top.
export interface DashboardFilters {
  dateFrom?: string;
  dateTo?: string;
  unitId?: number;
  contractorId?: number;
  vendorId?: number;
}

export const parseDashboardFilters = (query: Record<string, unknown>): DashboardFilters => ({
  dateFrom: query.dateFrom ? String(query.dateFrom) : undefined,
  dateTo: query.dateTo ? String(query.dateTo) : undefined,
  unitId: query.unit_id ? Number(query.unit_id) : undefined,
  contractorId: query.contractor_id ? Number(query.contractor_id) : undefined,
  vendorId: query.vendor_id ? Number(query.vendor_id) : undefined,
});

// Extra AND-ed conditions for whichever filters are both set and relevant to a
// given query — pass undefined for column expressions that don't apply to a
// table (e.g. contractors have no unit_id column).
export const filterConditions = (
  filters: DashboardFilters,
  cols: { createdAt?: string; unitId?: string; contractorId?: string; vendorId?: string }
): { sql: string; params: any[] } => {
  const clauses: string[] = [];
  const params: any[] = [];
  if (filters.dateFrom && cols.createdAt) {
    clauses.push(`${cols.createdAt} >= ?`);
    params.push(filters.dateFrom);
  }
  if (filters.dateTo && cols.createdAt) {
    clauses.push(`${cols.createdAt} <= ?`);
    params.push(filters.dateTo);
  }
  if (filters.unitId && cols.unitId) {
    clauses.push(`${cols.unitId} = ?`);
    params.push(filters.unitId);
  }
  if (filters.contractorId && cols.contractorId) {
    clauses.push(`${cols.contractorId} = ?`);
    params.push(filters.contractorId);
  }
  if (filters.vendorId && cols.vendorId) {
    clauses.push(`${cols.vendorId} = ?`);
    params.push(filters.vendorId);
  }
  return { sql: clauses.length ? `AND ${clauses.join(" AND ")}` : "", params };
};

// Builds a SQL condition + params applying a DashboardScope to a query whose
// row-level division id is reachable via `divisionIdExpr` (a raw SQL
// expression such as "c.division_id" or "COALESCE(st.division_id, tr.division_id)").
export const scopeCondition = (scope: DashboardScope, divisionIdExpr: string): { sql: string; params: any[] } => {
  switch (scope.mode) {
    case "division":
      return { sql: `${divisionIdExpr} = ?`, params: [scope.divisionId] };
    case "zone":
      if (!scope.divisionIds || scope.divisionIds.length === 0) {
        return { sql: "1 = 0", params: [] };
      }
      return {
        sql: `${divisionIdExpr} IN (${scope.divisionIds.map(() => "?").join(",")})`,
        params: [...scope.divisionIds],
      };
    case "hq":
      return { sql: `${divisionIdExpr} IS NULL`, params: [] };
    case "all":
    default:
      return { sql: "1 = 1", params: [] };
  }
};
