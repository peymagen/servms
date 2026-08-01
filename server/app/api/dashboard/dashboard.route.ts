import { Router } from "express";
import * as dashboardController from "./dashboard.controller";
import { roleAuth } from "../../common/middleware/role-auth.middleware";
import { requirePermission } from "../../common/middleware/permission.middleware";

const router = Router();

router.use(roleAuth());

router.get("/summary", requirePermission("dashboard", "view"), dashboardController.getSummary);
router.get("/graph/:group", requirePermission("dashboard", "view"), dashboardController.getGraphData);
router.get("/toggle-options", requirePermission("dashboard", "view"), dashboardController.getToggleOptions);
router.post("/track", requirePermission("dashboard", "view"), dashboardController.trackInteraction);

export default router;
