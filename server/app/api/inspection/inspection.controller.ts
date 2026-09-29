import * as inspectionService from "./inspection.service";
import * as atrService from "./inspection.atr.service";
import { createResponse } from "../../common/helper/response.hepler";
import asyncHandler from "express-async-handler";
import createHttpError from "http-errors";
import { type Request, type Response } from "express";
import {
  isDivisionScoped,
  isSelfScoped,
  isAssigneeScoped,
  assertRecordAccessible,
  pinToOwnDivision,
} from "../../common/constants/roles";
import { logAudit } from "../../common/services/auditLog.service";
import { assertRefsInOwnDivision, assertRecordInOwnDivision } from "../../common/services/divisionScope.service";

// The unit/station/train an inspection covers must be in the caller's division.
const assertInspectionRefsInOwnDivision = (req: Request) =>
  assertRefsInOwnDivision(req.user as any, {
    unit: req.body.unit_id,
    station: req.body.station_id,
    train: req.body.train_id,
  });

// Loads the inspection named by :id and applies the caller's scope (division,
// own-inspection for Inspectors, assigned-to-me for Dealing Section).
const loadAccessibleInspection = async (req: Request) => {
  const inspection = await inspectionService.getInspectionById(req.params.id as string);
  if (!inspection) throw createHttpError(404, "Inspection not found");
  assertRecordAccessible(req.user as any, inspection, { ownerField: "inspector_id", assigneeField: "assigned_to_user_id" });
  return inspection;
};

const str = (v: unknown) => (v !== undefined && v !== "" ? String(v) : undefined);
const num = (v: unknown) => (v !== undefined && v !== "" ? Number(v) : undefined);

// ─── CREATE INSPECTION (Inspector only, starts as Draft) ───────────────────────
export const createInspection = asyncHandler(async (req: Request, res: Response) => {
  const userId = (req.user as any)?.id;
  pinToOwnDivision(req.user as any, req.body);
  await assertInspectionRefsInOwnDivision(req);
  const result = await inspectionService.createInspection(req.body, userId);

  const files = req.files as Express.Multer.File[] | undefined;
  if (files && files.length > 0) {
    await inspectionService.addDocuments(result.id, files, userId, "inspection");
  }

  await logAudit({ req, module: "inspection", recordId: result.id, action: "CREATE", newData: req.body });
  res.send(createResponse(result, "Inspection created as draft"));
});

// ─── GET INSPECTIONS (list, filtered, with role scoping) ───────────────────────
export const getInspections = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user as any;
  const q = req.query;

  let division_id = num(q.division_id);
  if (isDivisionScoped(user?.role_name)) division_id = user.division_id;

  let inspector_id = num(q.inspector_id);
  if (isSelfScoped(user?.role_name)) inspector_id = user.id;

  let assigned_to_user_id = num(q.assigned_to_user_id);
  if (isAssigneeScoped(user?.role_name)) assigned_to_user_id = user.id;

  const result = await inspectionService.getInspections({
    limit: num(q.limit) ?? 10,
    offset: num(q.offset) ?? 0,
    search: str(q.search),
    inspection_no: str(q.inspection_no),
    division_id,
    unit_id: num(q.unit_id),
    station_id: num(q.station_id),
    train_id: num(q.train_id),
    inspector_id,
    assigned_to_user_id,
    inspection_category_id: num(q.inspection_category_id),
    inspection_type_id: num(q.inspection_type_id),
    status: str(q.status),
    priority: str(q.priority),
    date_from: str(q.date_from),
    date_to: str(q.date_to),
  });

  res.send(createResponse(result));
});

// ─── GET INSPECTION BY ID ───────────────────────────────────────────────────────
export const getInspectionById = asyncHandler(async (req: Request, res: Response) => {
  const result = await inspectionService.getInspectionById(req.params.id as string);
  if (!result) {
    res.status(404).send(createResponse(null, "Inspection not found"));
    return;
  }
  assertRecordAccessible(req.user as any, result, { ownerField: "inspector_id", assigneeField: "assigned_to_user_id" });
  res.send(createResponse(result));
});

// ─── UPDATE INSPECTION (Inspector, own record, only while Draft/Returned) ──────
export const editInspection = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user as any;
  const oldData = await inspectionService.getInspectionById(req.params.id as string);
  if (!oldData) {
    res.status(404).send(createResponse(null, "Inspection not found"));
    return;
  }
  if (isSelfScoped(user?.role_name)) {
    if ((oldData as any).inspector_id !== user.id) {
      throw createHttpError(403, "You can only edit inspections you created");
    }
    if (!["draft", "returned"].includes((oldData as any).inspection_status)) {
      throw createHttpError(403, `Cannot edit an inspection that is "${(oldData as any).inspection_status}"`);
    }
  }
  assertRecordAccessible(user, oldData, { ownerField: "inspector_id", assigneeField: "assigned_to_user_id" });
  pinToOwnDivision(user, req.body);
  await assertInspectionRefsInOwnDivision(req);
  const result = await inspectionService.editInspection(req.params.id as string, req.body);

  const files = req.files as Express.Multer.File[] | undefined;
  if (files && files.length > 0) {
    await inspectionService.addDocuments(Number(req.params.id), files, user?.id, "inspection");
  }

  await logAudit({ req, module: "inspection", recordId: req.params.id, action: "UPDATE", oldData, newData: req.body });
  res.send(createResponse(result, "Inspection updated successfully"));
});

export const deleteInspection = asyncHandler(async (req: Request, res: Response) => {
  const oldData = await loadAccessibleInspection(req);
  const result = await inspectionService.deleteInspection(req.params.id as string);
  await logAudit({ req, module: "inspection", recordId: req.params.id, action: "DELETE", oldData });
  res.send(createResponse(result, "Inspection deleted"));
});

// ─── SUBMIT INSPECTION (Draft/Returned -> Submitted, owner only) ───────────────
export const submitInspection = asyncHandler(async (req: Request, res: Response) => {
  const userId = (req.user as any)?.id;
  const oldData = await loadAccessibleInspection(req);
  const result = await inspectionService.submitInspection(req.params.id as string, userId);
  await logAudit({ req, module: "inspection", recordId: req.params.id, action: "STATUS_CHANGE", oldData, newData: result });
  res.send(createResponse(result, "Inspection submitted for review"));
});

// ─── SUB-ADMIN: return inspection to Inspector for correction ─────────────────
export const returnToInspector = asyncHandler(async (req: Request, res: Response) => {
  const userId = (req.user as any)?.id;
  const oldData = await loadAccessibleInspection(req);
  const result = await inspectionService.returnToInspector(req.params.id as string, userId, req.body?.remarks);
  await logAudit({ req, module: "inspection", recordId: req.params.id, action: "STATUS_CHANGE", oldData, newData: result, details: "Returned to Inspector" });
  res.send(createResponse(result, "Inspection returned to Inspector"));
});

// ─── GET INSPECTION METRICS (dashboard cards + charts) ─────────────────────────
export const getInspectionMetrics = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user as any;
  let division_id: number | undefined;
  if (isDivisionScoped(user?.role_name)) division_id = user.division_id;
  let inspector_id: number | undefined;
  if (isSelfScoped(user?.role_name)) inspector_id = user.id;
  let assigned_to_user_id: number | undefined;
  if (isAssigneeScoped(user?.role_name)) assigned_to_user_id = user.id;

  const result = await inspectionService.getInspectionMetrics(division_id, inspector_id, assigned_to_user_id);
  res.send(createResponse(result));
});

// ─── CLOSE INSPECTION (Admin, once Approved/Rejected) ──────────────────────────
export const closeInspection = asyncHandler(async (req: Request, res: Response) => {
  const userId = (req.user as any)?.id;
  const oldData = await loadAccessibleInspection(req);
  const result = await atrService.closeInspection(req.params.id as string, userId, req.body?.remarks);
  await logAudit({ req, module: "inspection", recordId: req.params.id, action: "STATUS_CHANGE", oldData, newData: result });
  res.send(createResponse(result, "Inspection closed"));
});

// ─── DELETE DOCUMENT ────────────────────────────────────────────────────────────
export const deleteDocument = asyncHandler(async (req: Request, res: Response) => {
  await assertRecordInOwnDivision(req.user as any, "inspection_document", req.params.documentId);
  const result = await inspectionService.deleteDocument(req.params.documentId as string);
  await logAudit({ req, module: "inspection", recordId: req.params.documentId, action: "DELETE", details: "Document deleted" });
  res.send(createResponse(result, "Document deleted"));
});
