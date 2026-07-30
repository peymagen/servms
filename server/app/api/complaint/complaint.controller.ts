import * as complaintService from "./complaint.service";
import * as atrService from "./complaint.atr.service";
import { createResponse } from "../../common/helper/response.hepler";
import asyncHandler from "express-async-handler";
import { type Request, type Response } from "express";
import { isDivisionScoped } from "../../common/constants/roles";
import { logAudit } from "../../common/services/auditLog.service";

const str = (v: unknown) => (v !== undefined && v !== "" ? String(v) : undefined);
const num = (v: unknown) => (v !== undefined && v !== "" ? Number(v) : undefined);

// ─── REGISTER COMPLAINT (Manual / CPGRAMS) ─────────────────────────────────────
export const createComplaint = asyncHandler(async (req: Request, res: Response) => {
  const userId = (req.user as any)?.id;
  const result = await complaintService.createComplaint(req.body, userId);

  const files = req.files as Express.Multer.File[] | undefined;
  if (files && files.length > 0) {
    await complaintService.addDocuments(result.id, files, userId, "evidence");
  }

  await logAudit({ req, module: "complaint", recordId: result.id, action: "CREATE", newData: req.body });
  res.send(createResponse(result, "Complaint registered successfully"));
});

// ─── GET COMPLAINTS (list, filtered, with role division restriction) ──────────
export const getComplaints = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user as any;
  const q = req.query;

  let division_id = num(q.division_id);
  if (isDivisionScoped(user?.role_name)) {
    division_id = user.division_id;
  }

  const result = await complaintService.getComplaints({
    limit: num(q.limit) ?? 10,
    offset: num(q.offset) ?? 0,
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
  });

  res.send(createResponse(result));
});

// ─── GET COMPLAINT BY ID (with documents, assignment history, ATRs, timeline) ──
export const getComplaintById = asyncHandler(async (req: Request, res: Response) => {
  const result = await complaintService.getComplaintById(req.params.id as string);
  if (!result) {
    res.status(404).send(createResponse(null, "Complaint not found"));
    return;
  }
  res.send(createResponse(result));
});

// ─── UPDATE COMPLAINT (PATCH — core fields, not workflow status) ───────────────
export const editComplaint = asyncHandler(async (req: Request, res: Response) => {
  const oldData = await complaintService.getComplaintById(req.params.id as string);
  const result = await complaintService.editComplaint(req.params.id as string, req.body);
  await logAudit({ req, module: "complaint", recordId: req.params.id, action: "UPDATE", oldData, newData: req.body });
  res.send(createResponse(result, "Complaint updated successfully"));
});

// ─── GET COMPLAINT METRICS (dashboard cards + charts) ──────────────────────────
export const getComplaintMetrics = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user as any;
  let division_id: number | undefined;
  if (isDivisionScoped(user?.role_name)) {
    division_id = user.division_id;
  }
  const result = await complaintService.getComplaintMetrics(division_id);
  res.send(createResponse(result));
});

// ─── CLOSE COMPLAINT (Admin, once Approved/Rejected) ───────────────────────────
export const closeComplaint = asyncHandler(async (req: Request, res: Response) => {
  const userId = (req.user as any)?.id;
  const oldData = await complaintService.getComplaintById(req.params.id as string);
  const result = await atrService.closeComplaint(req.params.id as string, userId, req.body?.remarks);
  await logAudit({ req, module: "complaint", recordId: req.params.id, action: "STATUS_CHANGE", oldData, newData: result });
  res.send(createResponse(result, "Complaint closed"));
});
