import * as idcardService from "./idcard.service";
import { createResponse } from "../../common/helper/response.hepler";
import asyncHandler from "express-async-handler";
import { type Request, type Response } from "express";

// ─── GET ID CARDS ───────────────────────────────────────────────────────────────
export const getIdCards = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user as any;

  const limit = req.query.limit ? Number(req.query.limit) : 10;
  const offset = req.query.offset ? Number(req.query.offset) : 0;
  const search = req.query.search ? String(req.query.search) : undefined;

  let division_id = req.query.division_id ? Number(req.query.division_id) : undefined;
  if (user?.role_name === "admin") {
    division_id = user.division_id;
  }

  const result = await idcardService.getIdCards({ limit, offset, search, division_id });
  res.send(createResponse(result));
});

// ─── ISSUE / REISSUE ID CARD ────────────────────────────────────────────────────
export const issueIdCard = asyncHandler(async (req: Request, res: Response) => {
  const result = await idcardService.issueIdCard(req.params.vendorId);
  res.send(createResponse(result, "ID card issued successfully"));
});

// ─── PUBLIC QR VERIFICATION ─────────────────────────────────────────────────────
export const verifyIdCard = asyncHandler(async (req: Request, res: Response) => {
  const result = await idcardService.verifyIdCard(req.params.code);
  if (!result) {
    res.status(404).send(createResponse(null, "Invalid or unrecognized ID card / QR code"));
    return;
  }
  res.send(createResponse(result));
});
