import * as vendorService from "./vendor.service";
import { createResponse } from "../../common/helper/response.hepler";
import asyncHandler from "express-async-handler";
import { type Request, type Response } from "express";
import { type VendorDocumentType } from "./vendor.dto";
import { isDivisionScoped, assertRecordAccessible } from "../../common/constants/roles";
import { logAudit } from "../../common/services/auditLog.service";

// ─── CREATE VENDOR ─────────────────────────────────────────────────────────────
export const createVendor = asyncHandler(async (req: Request, res: Response) => {
  const userId = (req.user as any)?.id ?? 1;

  const files = req.files as { [field: string]: Express.Multer.File[] } | undefined;

  // Handle uploaded profile image file if exists
  if (files?.profile_image?.[0]) {
    req.body.profile_image = `/uploads/${files.profile_image[0].filename}`;
  }
  if (files?.signature?.[0]) {
    req.body.signature_path = `/uploads/${files.signature[0].filename}`;
  }

  // Handle vendor documents uploaded during onboarding
  if (files?.aadhaar_document?.[0]) {
    req.body.aadhaar_document = `/uploads/${files.aadhaar_document[0].filename}`;
    req.body.aadhaar_document_name = files.aadhaar_document[0].originalname;
  }
  if (files?.medical_verification_document?.[0]) {
    req.body.medical_verification_document = `/uploads/${files.medical_verification_document[0].filename}`;
    req.body.medical_verification_document_name = files.medical_verification_document[0].originalname;
  }
  if (files?.police_verification_document?.[0]) {
    req.body.police_verification_document = `/uploads/${files.police_verification_document[0].filename}`;
    req.body.police_verification_document_name = files.police_verification_document[0].originalname;
  }

  const result = await vendorService.createVendor(req.body, userId);
  await logAudit({ req, module: "vendor", recordId: result.id, action: "CREATE", newData: req.body });
  res.send(createResponse(result, "Vendor onboarded successfully"));
});

// ─── GET ALL VENDORS (WITH SEARCH, PAGINATION & ROLE RESTRICTION) ───────────────
export const getVendors = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user as any;

  // Extract query parameters
  const limit = req.query.limit ? Number(req.query.limit) : 10;
  const offset = req.query.offset ? Number(req.query.offset) : 0;
  const search = req.query.search ? String(req.query.search) : undefined;
  const status = req.query.status ? String(req.query.status) : undefined;
  const unit_id = req.query.unit_id ? Number(req.query.unit_id) : undefined;

  // Role restriction: Divisional admins can only access their own division's vendors
  let division_id = req.query.division_id ? Number(req.query.division_id) : undefined;
  if (isDivisionScoped(user?.role_name)) {
    division_id = user.division_id;
  }

  const result = await vendorService.getVendors({
    limit,
    offset,
    search,
    division_id,
    unit_id,
    status,
  });

  res.send(createResponse(result));
});

// ─── GET VENDOR BY ID ────────────────────────────────────────────────────────────
export const getVendorById = asyncHandler(async (req: Request, res: Response) => {
  const result = await vendorService.getVendorById(req.params.id as string);
  if (!result) {
    res.status(404).send(createResponse(null, "Vendor not found"));
    return;
  }
  assertRecordAccessible(req.user as any, result);
  res.send(createResponse(result));
});

// ─── EDIT VENDOR (PATCH) ─────────────────────────────────────────────────────────
export const editVendor = asyncHandler(async (req: Request, res: Response) => {
  const files = req.files as { [field: string]: Express.Multer.File[] } | undefined;
  if (files?.profile_image?.[0]) {
    req.body.profile_image = `/uploads/${files.profile_image[0].filename}`;
  }
  if (files?.signature?.[0]) {
    req.body.signature_path = `/uploads/${files.signature[0].filename}`;
  }

  const oldData = await vendorService.getVendorById(req.params.id as string);
  const result = await vendorService.editVendor(req.params.id as string, req.body);
  await logAudit({ req, module: "vendor", recordId: req.params.id, action: "UPDATE", oldData, newData: req.body });
  res.send(createResponse(result, "Vendor updated successfully"));
});

// ─── STATUS CHANGE (dedicated, gated action) ─────────────────────────────────────
export const changeVendorStatus = asyncHandler(async (req: Request, res: Response) => {
  const result = await vendorService.changeVendorStatus(req.params.id as string, req.body.vendor_status);
  await logAudit({
    req,
    module: "vendor",
    recordId: req.params.id,
    action: "STATUS_CHANGE",
    oldData: { vendor_status: result.previousStatus },
    newData: { vendor_status: result.newStatus },
    details: req.body.reason,
  });
  res.send(createResponse(result, "Vendor status updated"));
});

// ─── DELETE VENDOR ───────────────────────────────────────────────────────────────
export const deleteVendor = asyncHandler(async (req: Request, res: Response) => {
  const result = await vendorService.deleteVendor(req.params.id as string);
  await logAudit({ req, module: "vendor", recordId: req.params.id, action: "DELETE" });
  res.send(createResponse(result, "Vendor deleted successfully"));
});

// ─── TRANSFERS ─────────────────────────────────────────────────────────────────────
export const transferUnit = asyncHandler(async (req: Request, res: Response) => {
  const result = await vendorService.transferUnit(req.params.id as string, Number(req.body.unit_id));
  await logAudit({
    req,
    module: "vendor",
    recordId: req.params.id,
    action: "TRANSFER",
    oldData: { unit_id: result.previous_unit_id },
    newData: { unit_id: result.new_unit_id },
    details: "Unit transfer",
  });
  res.send(createResponse(result, "Vendor transferred to new unit"));
});

export const transferContractor = asyncHandler(async (req: Request, res: Response) => {
  const result = await vendorService.transferContractor(req.params.id as string, Number(req.body.contractor_id));
  await logAudit({
    req,
    module: "vendor",
    recordId: req.params.id,
    action: "TRANSFER",
    oldData: { contractor_id: result.previous_contractor_id },
    newData: { contractor_id: result.new_contractor_id },
    details: "Contractor transfer",
  });
  res.send(createResponse(result, "Vendor transferred to new contractor"));
});

// ─── GET VENDOR METRICS ─────────────────────────────────────────────────────────
export const getVendorMetrics = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user as any;
  let division_id = undefined;

  if (isDivisionScoped(user?.role_name)) {
    division_id = user.division_id;
  }

  const result = await vendorService.getVendorMetrics(division_id);
  res.send(createResponse(result));
});

// ─── GET VENDOR VERIFICATION DETAILS ─────────────────────────────────────────────
export const getVendorVerification = asyncHandler(async (req: Request, res: Response) => {
  const result = await vendorService.getVendorVerification(req.params.id as string);
  if (!result) {
    res.status(404).send(createResponse(null, "Vendor not found"));
    return;
  }
  res.send(createResponse(result));
});

// ─── UPDATE POLICE VERIFICATION ──────────────────────────────────────────────────
export const updatePoliceVerification = asyncHandler(async (req: Request, res: Response) => {
  const documentPath = req.file ? `/uploads/${req.file.filename}` : undefined;
  const result = await vendorService.updatePoliceVerification(req.params.id as string, req.body, documentPath);
  await logAudit({
    req,
    module: "vendor",
    recordId: req.params.id,
    action: "UPDATE",
    newData: req.body,
    details: "Police verification updated",
  });
  res.send(createResponse(result, "Police verification updated successfully"));
});

// ─── UPDATE MEDICAL VERIFICATION ─────────────────────────────────────────────────
export const updateMedicalVerification = asyncHandler(async (req: Request, res: Response) => {
  const documentPath = req.file ? `/uploads/${req.file.filename}` : undefined;
  const result = await vendorService.updateMedicalVerification(req.params.id as string, req.body, documentPath);
  await logAudit({
    req,
    module: "vendor",
    recordId: req.params.id,
    action: "UPDATE",
    newData: req.body,
    details: "Medical verification updated",
  });
  res.send(createResponse(result, "Medical verification updated successfully"));
});

// ─── VENDOR DOCUMENTS ─────────────────────────────────────────────────────────────
export const getVendorDocuments = asyncHandler(async (req: Request, res: Response) => {
  const result = await vendorService.getVendorDocuments(req.params.id as string);
  res.send(createResponse(result));
});

export const uploadVendorDocument = asyncHandler(async (req: Request, res: Response) => {
  const userId = (req.user as any)?.id ?? 1;

  if (!req.file) {
    res.status(400).send(createResponse(null, "A document file is required"));
    return;
  }

  const documentPath = `/uploads/${req.file.filename}`;
  const documentType = req.body.document_type as VendorDocumentType;

  const result = await vendorService.uploadVendorDocument(
    req.params.id as string,
    documentType,
    documentPath,
    userId,
    req.file.originalname
  );
  await logAudit({
    req,
    module: "vendor",
    recordId: req.params.id,
    action: "UPDATE",
    details: `Document uploaded (${documentType})`,
  });
  res.send(createResponse(result, "Document uploaded successfully"));
});

export const deleteVendorDocument = asyncHandler(async (req: Request, res: Response) => {
  const result = await vendorService.deleteVendorDocument(req.params.id as string, req.params.docId as string);
  await logAudit({ req, module: "vendor", recordId: req.params.id, action: "DELETE", details: "Document removed" });
  res.send(createResponse(result, "Document removed successfully"));
});
