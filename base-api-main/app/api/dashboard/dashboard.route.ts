import { Router } from "express";
import * as dashboardController from "./dashboard.controller";
import { roleAuth } from "../../common/middleware/role-auth.middleware";

const router = Router();

router.use(roleAuth());

router.get("/stats", dashboardController.getDashboardStats);

export default router;
