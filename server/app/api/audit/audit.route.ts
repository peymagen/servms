import { Router } from "express";
import * as auditController from "./audit.controller";
import { roleAuth } from "../../common/middleware/role-auth.middleware";
import { requirePermission } from "../../common/middleware/permission.middleware";

const router = Router();

router.use(roleAuth());

router.get("/", requirePermission("audit_logs", "view"), auditController.getAuditLogs);
router.get("/modules", requirePermission("audit_logs", "view"), auditController.getAuditModules);
router.get("/export/csv", requirePermission("audit_logs", "export"), auditController.exportAuditLogsCsv);
router.get("/export/pdf", requirePermission("audit_logs", "export"), auditController.exportAuditLogsPdf);

export default router;
