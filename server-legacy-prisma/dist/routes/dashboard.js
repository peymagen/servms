"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dashboardRouter = void 0;
const express_1 = require("express");
const prisma_1 = require("../lib/prisma");
const auth_1 = require("../middleware/auth");
exports.dashboardRouter = (0, express_1.Router)();
exports.dashboardRouter.use(auth_1.requireAuth);
exports.dashboardRouter.get("/stats", async (req, res) => {
    const divisionFilter = req.user.role === "DIVISION_ADDITIONAL_ADMIN"
        ? { division: req.user.division ?? undefined }
        : {};
    const [totalUsers, activeUsers, byDivision, totalContractors, totalVendors, pendingComplaints,] = await Promise.all([
        prisma_1.prisma.user.count({ where: divisionFilter }),
        prisma_1.prisma.user.count({ where: { ...divisionFilter, status: "ACTIVE" } }),
        prisma_1.prisma.user.groupBy({
            by: ["division"],
            where: req.user.role === "DIVISION_ADDITIONAL_ADMIN"
                ? { division: req.user.division ?? undefined }
                : { division: { not: null } },
            _count: { _all: true },
        }),
        prisma_1.prisma.contractor.count({ where: divisionFilter }),
        prisma_1.prisma.vendor.count({ where: divisionFilter }),
        prisma_1.prisma.complaint.count({ where: { ...divisionFilter, status: { not: "RESOLVED" } } }),
    ]);
    res.json({
        totalUsers,
        activeUsers,
        totalContractors,
        totalVendors,
        pendingComplaints,
        divisionBreakdown: byDivision.map((d) => ({
            division: d.division,
            count: d._count._all,
        })),
    });
});
//# sourceMappingURL=dashboard.js.map