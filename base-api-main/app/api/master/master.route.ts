import { Router } from "express";
import * as masterController from "./master.controller";
import { roleAuth } from "../../common/middleware/role-auth.middleware";

const router = Router();

// Protect master routes
router.use(roleAuth());

router.get("/divisions", masterController.getDivisions);
router.get("/stations", masterController.getStations);
router.get("/units", masterController.getUnits);
router.get("/contractors", masterController.getContractors);
router.get("/roles", masterController.getRoles);

export default router;
