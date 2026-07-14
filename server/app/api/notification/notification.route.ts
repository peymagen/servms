import { Router } from "express";
import * as notificationController from "./notification.controller";
import { roleAuth } from "../../common/middleware/role-auth.middleware";

const router = Router();

router.use(roleAuth());

router.get("/", notificationController.getNotifications);

export default router;
