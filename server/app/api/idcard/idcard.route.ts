import { Router } from "express";
import * as idcardController from "./idcard.controller";
import { roleAuth } from "../../common/middleware/role-auth.middleware";

const router = Router();

// Public route — no auth required, used for QR scan verification
router.get("/verify/:code", idcardController.verifyIdCard);

// Protected routes
router.get("/", roleAuth(), idcardController.getIdCards);
router.post("/:vendorId/issue", roleAuth(), idcardController.issueIdCard);

export default router;
