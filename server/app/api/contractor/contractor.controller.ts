import * as contractorService from "./contractor.service";
import { createResponse } from "../../common/helper/response.hepler";
import { isDivisionScoped, assertRecordAccessible } from "../../common/constants/roles";
import { logAudit } from "../../common/services/auditLog.service";
import asyncHandler from "express-async-handler";
import createHttpError from "http-errors";
import { type Request, type Response } from "express";

// Loads the contractor named by :id and applies the caller's division scope —
// every read-one and every mutation goes through this, so a divisional user can't
// view or change another division's contractor by calling the API with its id.
const loadAccessibleContractor = async (req: Request) => {
  const contractor = await contractorService.getContractorById(req.params.id as string);
  if (!contractor) throw createHttpError(404, "Contractor not found");
  assertRecordAccessible(req.user as any, contractor);
  return contractor;
};

// Status only changes through changeContractorStatus (approve_reject permission),
// so it's stripped from create/edit payloads — otherwise anyone with create/edit
// could onboard a contractor straight to "active" and skip the approval step.
const stripStatus = (body: any) => {
  delete body.contractors_status;
};

// ─── CREATE CONTRACTOR ──────────────────────────────────────────────────────────
export const createContractor = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user as any;
  const userId = user?.id ?? 1;

  if (req.file) {
    req.body.logo_image = `/uploads/${req.file.filename}`;
  }
  stripStatus(req.body);
  // A divisional user can only onboard into their own division, whatever the form sent.
  if (isDivisionScoped(user?.role_name)) {
    req.body.division_id = user.division_id;
  }

  const result = await contractorService.createContractor(req.body, userId);
  await logAudit({ req, module: "contractor", recordId: result.id, action: "CREATE", newData: req.body });
  res.send(createResponse(result, "Contractor onboarded successfully"));
});

// ─── GET CONTRACTORS ────────────────────────────────────────────────────────────
export const getContractors = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user as any;

  const limit = req.query.limit ? Number(req.query.limit) : 10;
  const offset = req.query.offset ? Number(req.query.offset) : 0;
  const search = req.query.search ? String(req.query.search) : undefined;
  const status = req.query.status ? String(req.query.status) : undefined;

  let division_id = req.query.division_id ? Number(req.query.division_id) : undefined;
  if (isDivisionScoped(user?.role_name)) {
    division_id = user.division_id;
  }

  const result = await contractorService.getContractors({
    limit,
    offset,
    search,
    division_id,
    status,
  });

  res.send(createResponse(result));
});

// ─── GET CONTRACTOR BY ID ────────────────────────────────────────────────────────
export const getContractorById = asyncHandler(async (req: Request, res: Response) => {
  const result = await loadAccessibleContractor(req);
  res.send(createResponse(result));
});

// ─── EDIT CONTRACTOR (PATCH) ─────────────────────────────────────────────────────
export const editContractor = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user as any;
  const oldData = await loadAccessibleContractor(req);

  if (req.file) {
    req.body.logo_image = `/uploads/${req.file.filename}`;
  }
  stripStatus(req.body);
  // Moving a contractor between divisions is an HQ-level decision.
  if (isDivisionScoped(user?.role_name)) {
    delete req.body.division_id;
  }

  const result = await contractorService.editContractor(req.params.id as string, req.body);
  await logAudit({
    req,
    module: "contractor",
    recordId: req.params.id,
    action: "UPDATE",
    oldData,
    newData: req.body,
    details: "Contract details updated",
  });
  res.send(createResponse(result, "Contractor updated successfully"));
});

// ─── STATUS CHANGE (dedicated, gated action) ─────────────────────────────────────
export const changeContractorStatus = asyncHandler(async (req: Request, res: Response) => {
  await loadAccessibleContractor(req);
  const result = await contractorService.changeContractorStatus(req.params.id as string, req.body.contractors_status);
  await logAudit({
    req,
    module: "contractor",
    recordId: req.params.id,
    action: "STATUS_CHANGE",
    oldData: { contractors_status: result.previousStatus },
    newData: { contractors_status: result.newStatus },
    details: req.body.reason,
  });
  res.send(createResponse(result, "Contractor status updated"));
});

// ─── DELETE CONTRACTOR ───────────────────────────────────────────────────────────
export const deleteContractor = asyncHandler(async (req: Request, res: Response) => {
  const oldData = await loadAccessibleContractor(req);
  const result = await contractorService.deleteContractor(req.params.id as string);
  await logAudit({ req, module: "contractor", recordId: req.params.id, action: "DELETE", oldData });
  res.send(createResponse(result, "Contractor deleted successfully"));
});

// ─── UNIT LINKING ─────────────────────────────────────────────────────────────────
export const getContractorUnits = asyncHandler(async (req: Request, res: Response) => {
  await loadAccessibleContractor(req);
  const result = await contractorService.getContractorUnits(req.params.id as string);
  res.send(createResponse(result));
});

export const assignUnit = asyncHandler(async (req: Request, res: Response) => {
  const contractor = await loadAccessibleContractor(req);
  const result = await contractorService.assignUnit(
    req.params.id as string,
    Number(req.body.unit_id),
    contractor.division_id ?? null
  );
  await logAudit({
    req,
    module: "contractor",
    recordId: req.params.id,
    action: "TRANSFER",
    oldData: { contractor_id: result.previous_contractor_id },
    newData: { contractor_id: result.contractor_id },
    details: `Unit #${result.unit_id} linked to contractor`,
  });
  res.send(createResponse(result, "Unit linked to contractor"));
});

export const unassignUnit = asyncHandler(async (req: Request, res: Response) => {
  await loadAccessibleContractor(req);
  const result = await contractorService.unassignUnit(req.params.id as string, Number(req.params.unitId));
  await logAudit({
    req,
    module: "contractor",
    recordId: req.params.id,
    action: "TRANSFER",
    oldData: { contractor_id: result.previous_contractor_id },
    newData: { contractor_id: null },
    details: `Unit #${result.unit_id} unlinked from contractor`,
  });
  res.send(createResponse(result, "Unit unlinked from contractor"));
});

// ─── GET CONTRACTOR METRICS ─────────────────────────────────────────────────────
export const getContractorMetrics = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user as any;
  let division_id = undefined;
  if (isDivisionScoped(user?.role_name)) {
    division_id = user.division_id;
  }
  const result = await contractorService.getContractorMetrics(division_id);
  res.send(createResponse(result));
});
