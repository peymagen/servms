import * as exportService from "./inspection.export.service";
import { createResponse } from "../../common/helper/response.hepler";
import asyncHandler from "express-async-handler";
import { type Request, type Response } from "express";
import { isDivisionScoped, isSelfScoped, isAssigneeScoped } from "../../common/constants/roles";
import { logAudit } from "../../common/services/auditLog.service";

const str = (v: unknown) => (v !== undefined && v !== "" ? String(v) : undefined);
const num = (v: unknown) => (v !== undefined && v !== "" ? Number(v) : undefined);

export const exportInspections = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user as any;
  const q = req.query;
  const format = str(q.format) ?? "xlsx";

  let division_id = num(q.division_id);
  if (isDivisionScoped(user?.role_name)) division_id = user.division_id;

  const filters = {
    search: str(q.search),
    inspection_no: str(q.inspection_no),
    division_id,
    unit_id: num(q.unit_id),
    station_id: num(q.station_id),
    train_id: num(q.train_id),
    inspector_id: isSelfScoped(user?.role_name) ? user.id : num(q.inspector_id),
    assigned_to_user_id: isAssigneeScoped(user?.role_name) ? user.id : num(q.assigned_to_user_id),
    inspection_category_id: num(q.inspection_category_id),
    inspection_type_id: num(q.inspection_type_id),
    status: str(q.status),
    priority: str(q.priority),
    date_from: str(q.date_from),
    date_to: str(q.date_to),
  };

  await logAudit({ req, module: "inspection", action: "EXPORT", details: `format=${format}` });

  if (format === "csv") {
    const csv = await exportService.buildInspectionsCsv(filters);
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", 'attachment; filename="inspections-report.csv"');
    res.send(csv);
    return;
  }

  if (format === "xlsx") {
    const buffer = await exportService.buildInspectionsWorkbook(filters);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", 'attachment; filename="inspections-report.xlsx"');
    res.send(buffer);
    return;
  }

  res.status(400).send(createResponse(null, "format must be xlsx or csv"));
});
