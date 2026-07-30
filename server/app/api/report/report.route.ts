import { Router } from "express";
import { type NextFunction, type Request, type Response } from "express";
import { validationResult } from "express-validator";
import * as reportController from "./report.controller";
import * as importController from "./report.import.controller";
import { roleAuth } from "../../common/middleware/role-auth.middleware";
import { requirePermission } from "../../common/middleware/permission.middleware";
import { upload } from "../../common/middleware/multer.middleware";
import { generateReportValidation, createTemplateValidation, updateTemplateValidation, exportReportValidation } from "./report.validation";

const validate = (req: Request, res: Response, next: NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: errors.array().map((e) => ({ field: e.type === "field" ? e.path : "unknown", message: e.msg })),
    });
    return;
  }
  next();
};

const router = Router();
router.use(roleAuth());

// ─── Dashboard & metadata ───────────────────────────────────────────────────────
router.get("/dashboard", requirePermission("reports", "view"), reportController.getReportDashboard);
router.get("/exports", requirePermission("reports", "view"), reportController.getExportHistory);
router.get("/modules", requirePermission("reports", "view"), reportController.getReportModules);

// ─── Import Management (generic master import) — must precede /templates/:id ──
router.get("/import/masters", requirePermission("reports", "view"), importController.getImportableMasters);
router.get("/import/history", requirePermission("reports", "view"), importController.getImportHistory);
router.get("/import/:masterKey/template", requirePermission("reports", "view"), importController.downloadMasterTemplate);
router.post(
  "/import/:masterKey",
  requirePermission("reports", "create"),
  upload.single("file"),
  importController.importMasterData
);

// ─── Report Builder: generate (preview) & export ───────────────────────────────
router.post("/generate", requirePermission("reports", "view"), generateReportValidation, validate, reportController.generateReport);
router.post("/export", requirePermission("reports", "export"), exportReportValidation, validate, reportController.exportReport);

// ─── Saved report templates ─────────────────────────────────────────────────────
router.get("/templates", requirePermission("reports", "view"), reportController.listTemplates);
router.get("/templates/:id", requirePermission("reports", "view"), reportController.getTemplateById);
router.post("/templates", requirePermission("reports", "create"), createTemplateValidation, validate, reportController.createTemplate);
router.patch("/templates/:id", requirePermission("reports", "edit"), updateTemplateValidation, validate, reportController.editTemplate);
router.delete("/templates/:id", requirePermission("reports", "delete"), reportController.deleteTemplate);

export default router;
