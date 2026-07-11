import express from "express";
import userRoutes from "./api/user/user.route";
import vendorRoutes from "./api/vendor/vendor.route";
import complaintRoutes from "./api/complaint/complaint.route";
import penaltyRoutes from "./api/penalty/penalty.route";
import masterRoutes from "./api/master/master.route";
import dashboardRoutes from "./api/dashboard/dashboard.route";
import contractorRoutes from "./api/contractor/contractor.route";
import unitRoutes from "./api/unit/unit.route";
import idcardRoutes from "./api/idcard/idcard.route";
import renewalRoutes from "./api/renewal/renewal.route";
import roleRoutes from "./api/role/role.route";

const router = express.Router();

router.use("/users", userRoutes);
router.use("/vendors", vendorRoutes);
router.use("/complaints", complaintRoutes);
router.use("/penalties", penaltyRoutes);
router.use("/masters", masterRoutes);
router.use("/dashboard", dashboardRoutes);
router.use("/contractors", contractorRoutes);
router.use("/units", unitRoutes);
router.use("/idcards", idcardRoutes);
router.use("/renewals", renewalRoutes);
router.use("/roles", roleRoutes);

export default router;
