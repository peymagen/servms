import express from "express";
import userRoutes from "./api/user/user.route";
import vendorRoutes from "./api/vendor/vendor.route";
import complaintRoutes from "./api/complaint/complaint.route";
import penaltyRoutes from "./api/penalty/penalty.route";
import masterRoutes from "./api/master/master.route";
import dashboardRoutes from "./api/dashboard/dashboard.route";

const router = express.Router();

router.use("/users", userRoutes);
router.use("/vendors", vendorRoutes);
router.use("/complaints", complaintRoutes);
router.use("/penalties", penaltyRoutes);
router.use("/masters", masterRoutes);
router.use("/dashboard", dashboardRoutes);

export default router;