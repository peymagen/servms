import { Router } from "express";
import * as masterController from "./master.controller";
import { roleAuth } from "../../common/middleware/role-auth.middleware";
import { requirePermission } from "../../common/middleware/permission.middleware";
import { upload } from "../../common/middleware/multer.middleware";

const router = Router();

// Protect master routes
router.use(roleAuth());

router.get("/zones", masterController.getZones);
router.get("/divisions", masterController.getDivisions);
router.get("/stations", masterController.getStations);
router.get("/units", masterController.getUnits);
router.get("/contractors", masterController.getContractors);
router.get("/vendors", masterController.getVendorsLite);
router.get("/complaints", masterController.getComplaintsLite);
router.get("/inspections", masterController.getInspectionsLite);
router.get("/roles", masterController.getRoles);

// ─── Stations (individual entry + bulk import) ──────────────────────────────────
router.post("/stations", requirePermission("location_management", "create"), masterController.createStation);
router.patch("/stations/:id", requirePermission("location_management", "edit"), masterController.editStation);
router.delete("/stations/:id", requirePermission("location_management", "delete"), masterController.deleteStation);
router.post(
  "/stations/bulk-import",
  requirePermission("location_management", "create"),
  upload.single("file"),
  masterController.bulkImportStations
);

export default router;
