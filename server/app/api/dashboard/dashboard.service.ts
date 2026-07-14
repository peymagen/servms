import { pool } from "../../common/services/sql.service";
import { relativeTime } from "../../common/helper/time.helper";
import { type RowDataPacket } from "mysql2";

function scoreLabel(compliance: number): string {
  if (compliance < 80) return "POOR";
  if (compliance < 88) return "AVERAGE";
  if (compliance < 93) return "GOOD";
  return "EXCELLENT";
}

export const getDashboardStats = async (userDivisionId?: number) => {
  const [divisionsRows] = await pool.execute<RowDataPacket[]>(
    userDivisionId
      ? "SELECT id, division_code, division_name FROM divisions WHERE status = 1 AND id = ?"
      : "SELECT id, division_code, division_name FROM divisions WHERE status = 1",
    userDivisionId ? [userDivisionId] : []
  );

  // Vendors per division
  const [vendorRows] = await pool.execute<RowDataPacket[]>(
    "SELECT division_id, COUNT(*) as count FROM vendors WHERE status = 1 GROUP BY division_id"
  );
  const vendorsByDivision: Record<number, number> = {};
  vendorRows.forEach((r) => {
    if (r.division_id) vendorsByDivision[r.division_id] = r.count;
  });

  // Active contractors per division
  const [contractorRows] = await pool.execute<RowDataPacket[]>(
    "SELECT division_id, COUNT(*) as count FROM contractors WHERE status = 1 AND contractors_status = 'active' GROUP BY division_id"
  );
  const activeContractorsByDivision: Record<number, number> = {};
  contractorRows.forEach((r) => {
    if (r.division_id) activeContractorsByDivision[r.division_id] = r.count;
  });

  // Average compliance rate per division
  const [complianceRows] = await pool.execute<RowDataPacket[]>(
    "SELECT division_id, AVG(compliance_rate) as avg_compliance FROM contractors WHERE status = 1 GROUP BY division_id"
  );
  const complianceByDivision: Record<number, number> = {};
  complianceRows.forEach((r) => {
    if (r.division_id) complianceByDivision[r.division_id] = Number(r.avg_compliance || 0);
  });

  // Recovered penalty amount per division
  const [recoveredRows] = await pool.execute<RowDataPacket[]>(
    `SELECT IFNULL(c.division_id, v.division_id) as division_id, SUM(p.amount) as total
     FROM penalties p
     LEFT JOIN contractors c ON c.id = p.contractor_id
     LEFT JOIN vendors v ON v.id = p.vendor_id
     WHERE p.status = 1 AND p.penalties_status = 'recovered'
     GROUP BY division_id`
  );
  const recoveredByDivision: Record<number, number> = {};
  recoveredRows.forEach((r) => {
    if (r.division_id) recoveredByDivision[r.division_id] = Number(r.total || 0);
  });

  // Pending penalty count per division
  const [pendingPenaltyRows] = await pool.execute<RowDataPacket[]>(
    `SELECT IFNULL(c.division_id, v.division_id) as division_id, COUNT(*) as count
     FROM penalties p
     LEFT JOIN contractors c ON c.id = p.contractor_id
     LEFT JOIN vendors v ON v.id = p.vendor_id
     WHERE p.status = 1 AND p.penalties_status = 'pending'
     GROUP BY division_id`
  );
  const pendingPenaltiesByDivision: Record<number, number> = {};
  pendingPenaltyRows.forEach((r) => {
    if (r.division_id) pendingPenaltiesByDivision[r.division_id] = r.count;
  });

  // Pending complaints per division
  const [pendingComplaintRows] = await pool.execute<RowDataPacket[]>(
    `SELECT s.division_id, COUNT(*) as count
     FROM complaints c
     JOIN units u ON u.id = c.unit_id
     JOIN stations s ON s.id = u.station_id
     WHERE c.status = 1 AND c.complaints_status IN ('open', 'investigating')
     GROUP BY s.division_id`
  );
  const pendingComplaintsByDivision: Record<number, number> = {};
  pendingComplaintRows.forEach((r) => {
    if (r.division_id) pendingComplaintsByDivision[r.division_id] = r.count;
  });

  const divisionStatsList = divisionsRows.map((div) => {
    const compliance = Number((complianceByDivision[div.id] ?? 0).toFixed(1));
    return {
      id: div.id,
      code: div.division_code,
      name: (div.division_name as string).replace(" Division", ""),
      vendors: vendorsByDivision[div.id] || 0,
      activeContractors: activeContractorsByDivision[div.id] || 0,
      recoveredPenalties: recoveredByDivision[div.id] || 0,
      pendingPenalties: pendingPenaltiesByDivision[div.id] || 0,
      pendingComplaints: pendingComplaintsByDivision[div.id] || 0,
      compliance,
    };
  });

  const totalRegisteredVendors = divisionStatsList.reduce((sum, d) => sum + d.vendors, 0);
  const activeContractors = divisionStatsList.reduce((sum, d) => sum + d.activeContractors, 0);
  const penaltiesRecovered = divisionStatsList.reduce((sum, d) => sum + d.recoveredPenalties, 0);
  const pendingPenaltyOrders = divisionStatsList.reduce((sum, d) => sum + d.pendingPenalties, 0);
  const pendingComplaints = divisionStatsList.reduce((sum, d) => sum + d.pendingComplaints, 0);

  const divisionWisePerformance = divisionStatsList.map((d) => ({
    divisionName: d.name,
    score: d.compliance,
    vendorCount: d.vendors,
  }));

  // Inspection result breakdown
  const [inspRows] = await pool.execute<RowDataPacket[]>(
    `SELECT result, COUNT(*) as count
     FROM inspections i
     JOIN units u ON u.id = i.unit_id
     JOIN stations st ON st.id = u.station_id
     WHERE i.status = 1
     ${userDivisionId ? "AND st.division_id = ?" : ""}
     GROUP BY result`,
    userDivisionId ? [userDivisionId] : []
  );

  const inspectionCounts = { satisfactory: 0, minor_issues: 0, critical_failure: 0 };
  for (const row of inspRows) {
    const res = row.result as keyof typeof inspectionCounts;
    if (inspectionCounts[res] !== undefined) {
      inspectionCounts[res] = row.count;
    }
  }
  const totalInspections =
    inspectionCounts.satisfactory + inspectionCounts.minor_issues + inspectionCounts.critical_failure;

  const inspectionSummary = {
    satisfactory: totalInspections > 0 ? Math.round((inspectionCounts.satisfactory / totalInspections) * 100) : 0,
    minorIssues: totalInspections > 0 ? Math.round((inspectionCounts.minor_issues / totalInspections) * 100) : 0,
    criticalFailures: totalInspections > 0 ? Math.round((inspectionCounts.critical_failure / totalInspections) * 100) : 0,
  };

  const divisionServicePerformance = divisionStatsList
    .map((d) => ({
      id: d.id,
      code: d.code,
      name: d.name,
      vendors: d.vendors,
      compliance: d.compliance,
      score: scoreLabel(d.compliance),
    }))
    .sort((a, b) => b.vendors - a.vendors);

  // Recent critical alerts — real events only
  const [expiryRows] = await pool.execute<RowDataPacket[]>(
    `SELECT company_name, license_validity_date, division_id
     FROM contractors
     WHERE status = 1 AND license_validity_date IS NOT NULL
     ${userDivisionId ? "AND division_id = ?" : ""}
     ORDER BY license_validity_date ASC LIMIT 3`,
    userDivisionId ? [userDivisionId] : []
  );

  const [overduePenalties] = await pool.execute<RowDataPacket[]>(
    `SELECT p.penalty_code, c.company_name, p.amount, p.created_at, IFNULL(c.division_id, v.division_id) as division_id
     FROM penalties p
     LEFT JOIN contractors c ON c.id = p.contractor_id
     LEFT JOIN vendors v ON v.id = p.vendor_id
     WHERE p.status = 1 AND p.penalties_status = 'pending'
     ${userDivisionId ? "AND IFNULL(c.division_id, v.division_id) = ?" : ""}
     ORDER BY p.created_at DESC LIMIT 3`,
    userDivisionId ? [userDivisionId] : []
  );

  const divisionCodeById = new Map(divisionStatsList.map((d) => [d.id, d.code]));
  const alerts: { type: string; title: string; description: string; time: string; sortAt: number }[] = [];

  expiryRows.forEach((row) => {
    const divisionName = divisionCodeById.get(row.division_id) || "HQ";
    const validityDate = new Date(row.license_validity_date);
    const daysLeft = Math.ceil((validityDate.getTime() - Date.now()) / (1000 * 3600 * 24));
    alerts.push({
      type: "expiry",
      title: "Vendor License Expiry",
      description: `${row.company_name} (${divisionName} Division) - ${
        daysLeft >= 0 ? `Expires in ${daysLeft} days` : `Expired ${Math.abs(daysLeft)} days ago`
      }`,
      time: relativeTime(validityDate),
      sortAt: validityDate.getTime(),
    });
  });

  overduePenalties.forEach((row) => {
    const createdAt = new Date(row.created_at);
    alerts.push({
      type: "penalty",
      title: "Overdue Penalty Notice",
      description: `${row.company_name ?? "Unknown"} - Pending ₹${Number(row.amount).toLocaleString("en-IN")}`,
      time: relativeTime(createdAt),
      sortAt: createdAt.getTime(),
    });
  });

  const recentCriticalAlerts = alerts
    .sort((a, b) => b.sortAt - a.sortAt)
    .slice(0, 5)
    .map(({ sortAt, ...alert }) => alert);

  return {
    totalRegisteredVendors,
    activeContractors,
    penaltiesRecovered,
    pendingPenaltyOrders,
    pendingComplaints,
    divisionWisePerformance,
    inspectionSummary,
    recentCriticalAlerts,
    divisionServicePerformance,
  };
};
