import * as renewalService from "./renewal.service";
import { createResponse } from "../../common/helper/response.hepler";
import asyncHandler from "express-async-handler";
import { type Request, type Response } from "express";
import { isDivisionScoped } from "../../common/constants/roles";
import { logAudit } from "../../common/services/auditLog.service";

export const createRenewal = asyncHandler(async (req: Request, res: Response) => {
  const userId = (req.user as any)?.id ?? 1;

  const files = req.files as { [field: string]: Express.Multer.File[] } | undefined;
  if (files?.medical_fitness_doc?.[0]) {
    req.body.medical_fitness_doc = `/uploads/${files.medical_fitness_doc[0].filename}`;
  }
  if (files?.pvr_document?.[0]) {
    req.body.pvr_document = `/uploads/${files.pvr_document[0].filename}`;
  }

  const result = await renewalService.createRenewal(req.body, userId);
  await logAudit({ req, module: "renewal", recordId: result.id, action: "RENEW", newData: req.body });
  res.send(createResponse(result, "Renewal request submitted successfully"));
});

export const getRenewals = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user as any;

  const limit = req.query.limit ? Number(req.query.limit) : 10;
  const offset = req.query.offset ? Number(req.query.offset) : 0;
  const status = req.query.status ? String(req.query.status) : undefined;

  let division_id = req.query.division_id ? Number(req.query.division_id) : undefined;
  if (isDivisionScoped(user?.role_name)) {
    division_id = user.division_id;
  }

  const result = await renewalService.getRenewals({ limit, offset, division_id, status });
  res.send(createResponse(result));
});

export const getRenewalById = asyncHandler(async (req: Request, res: Response) => {
  const result = await renewalService.getRenewalById(req.params.id as string);
  if (!result) {
    res.status(404).send(createResponse(null, "Renewal record not found"));
    return;
  }
  res.send(createResponse(result));
});

export const updateRenewalStatus = asyncHandler(async (req: Request, res: Response) => {
  const result = await renewalService.updateRenewalStatus(req.params.id as string, req.body.renewals_status);
  const action = req.body.renewals_status === "approved" ? "APPROVE" : req.body.renewals_status === "rejected" ? "REJECT" : "UPDATE";
  await logAudit({ req, module: "renewal", recordId: req.params.id, action, newData: req.body });
  res.send(createResponse(result, "Renewal status updated successfully"));
});
