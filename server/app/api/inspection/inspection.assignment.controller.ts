import * as assignmentService from "./inspection.assignment.service";
import * as inspectionService from "./inspection.service";
import { createResponse } from "../../common/helper/response.hepler";
import asyncHandler from "express-async-handler";
import { type Request, type Response } from "express";
import { logAudit } from "../../common/services/auditLog.service";

const SUCCESS_MESSAGE: Record<"initial" | "reassign" | "transfer", string> = {
  initial: "Inspection assigned successfully",
  reassign: "Inspection reassigned successfully",
  transfer: "Inspection transferred successfully",
};

const makeAssignHandler = (assignmentType: "initial" | "reassign" | "transfer") =>
  asyncHandler(async (req: Request, res: Response) => {
    const userId = (req.user as any)?.id;
    const oldData = await inspectionService.getInspectionById(req.params.id as string);
    const result = await assignmentService.assignInspection(req.params.id as string, req.body, userId, assignmentType);
    await logAudit({
      req,
      module: "inspection_assignment",
      recordId: req.params.id,
      action: "ASSIGN",
      oldData: { unit_id: (oldData as any)?.unit_id },
      newData: req.body,
      details: assignmentType,
    });
    res.send(createResponse(result, SUCCESS_MESSAGE[assignmentType]));
  });

export const assignInspection = makeAssignHandler("initial");
export const reassignInspection = makeAssignHandler("reassign");
export const transferInspection = makeAssignHandler("transfer");

export const getAssignmentHistory = asyncHandler(async (req: Request, res: Response) => {
  const result = await assignmentService.getAssignmentHistory(req.params.id as string);
  res.send(createResponse(result));
});
