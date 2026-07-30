import { Router } from "express";
import { type NextFunction, type Request, type Response } from "express";
import { validationResult } from "express-validator";
import * as clusterController from "./cluster.controller";
import { roleAuth } from "../../common/middleware/role-auth.middleware";
import { requirePermission } from "../../common/middleware/permission.middleware";
import { createClusterValidation, updateClusterValidation } from "./cluster.validation";

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

router.get("/", requirePermission("location_management", "view"), clusterController.getClusters);
router.get("/:id", requirePermission("location_management", "view"), clusterController.getClusterById);
router.post(
  "/",
  requirePermission("location_management", "create"),
  createClusterValidation,
  validate,
  clusterController.createCluster
);
router.patch(
  "/:id",
  requirePermission("location_management", "edit"),
  updateClusterValidation,
  validate,
  clusterController.editCluster
);
router.delete("/:id", requirePermission("location_management", "delete"), clusterController.deleteCluster);

export default router;
