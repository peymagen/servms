import { Router } from "express";
import * as masterController from "./master.controller";
import { roleAuth } from "../../common/middleware/role-auth.middleware";
import { requirePermission } from "../../common/middleware/permission.middleware";
import { upload } from "../../common/middleware/multer.middleware";

const router = Router();

// Protect master routes
router.use(roleAuth());

// Zones/divisions/stations stay ungated — pure low-sensitivity reference/location
// data needed broadly for dropdowns app-wide (same precedent as dropdown.route.ts).
router.get("/zones", masterController.getZones);
router.get("/divisions", masterController.getDivisions);
router.get("/stations", masterController.getStations);

// These "lite" picker endpoints previously had no permission gate at all —
// any authenticated role could list org-wide contractor/vendor/unit/
// complaint/inspection/role data through them, bypassing role_permissions
// entirely. Gated to the same module each has a full endpoint for.
router.get("/units", requirePermission("unit_management", "view"), masterController.getUnits);
router.get("/contractors", requirePermission("contractor_management", "view"), masterController.getContractors);
router.get("/vendors", requirePermission("vendor_management", "view"), masterController.getVendorsLite);
router.get("/complaints", requirePermission("complaint_management", "view"), masterController.getComplaintsLite);
router.get("/inspections", requirePermission("inspection_management", "view"), masterController.getInspectionsLite);
// Gated on user_management, not role_management: this lite list is consumed by
// the "assign a role to this new user" picker on the User Management create
// form, which HQ/Divisional Sub-admin also need despite having no
// role_management access at all — gating it on role_management would break
// their (permitted) ability to create users.
router.get("/roles", requirePermission("user_management", "view"), masterController.getRoles);

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
