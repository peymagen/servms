import * as exportService from "./complaint.export.service";
import { createResponse } from "../../common/helper/response.hepler";
import asyncHandler from "express-async-handler";
import { type Request, type Response } from "express";
import { isDivisionScoped } from "../../common/constants/roles";
import { logAudit } from "../../common/services/auditLog.service";

const str = (v: unknown) => (v !== undefined && v !== "" ? String(v) : undefined);
const num = (v: unknown) => (v !== undefined && v !== "" ? Number(v) : undefined);

export const exportComplaints = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user as any;
  const q = req.query;
  const format = str(q.format) ?? "xlsx";

  let division_id = num(q.division_id);
  if (isDivisionScoped(user?.role_name)) {
    division_id = user.division_id;
  }

  const filters = {
    search: str(q.search),
    complaint_ref_no: str(q.complaint_ref_no),
    complaint_source: str(q.complaint_source),
    division_id,
    unit_id: num(q.unit_id),
    station_id: num(q.station_id),
    train_id: num(q.train_id),
    complaint_type_id: num(q.complaint_type_id),
    complaint_subtype_id: num(q.complaint_subtype_id),
    status: str(q.status),
    priority: str(q.priority),
    date_from: str(q.date_from),
    date_to: str(q.date_to),
  };

  await logAudit({ req, module: "complaint", action: "EXPORT", details: `format=${format}` });

  if (format === "csv") {
    const csv = await exportService.buildComplaintsCsv(filters);
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", 'attachment; filename="complaints-report.csv"');
    res.send(csv);
    return;
  }

  if (format === "xlsx") {
    const buffer = await exportService.buildComplaintsWorkbook(filters);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", 'attachment; filename="complaints-report.xlsx"');
    res.send(buffer);
    return;
  }

  res.status(400).send(createResponse(null, "format must be xlsx or csv"));
});
