"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.reportsRouter = void 0;
const express_1 = require("express");
const prisma_1 = require("../lib/prisma");
const auth_1 = require("../middleware/auth");
exports.reportsRouter = (0, express_1.Router)();
exports.reportsRouter.use(auth_1.requireAuth);
exports.reportsRouter.get("/summary", async (req, res) => {
    const scope = req.user.role === "DIVISION_ADDITIONAL_ADMIN"
        ? { division: req.user.division ?? undefined }
        : {};
    const [totalUsers, totalContractors, totalVendors, totalUnits, complaintsByStatus, penaltyAgg, recoveredAgg,] = await Promise.all([
        prisma_1.prisma.user.count({ where: scope }),
        prisma_1.prisma.contractor.count({ where: scope }),
        prisma_1.prisma.vendor.count({ where: scope }),
        prisma_1.prisma.unit.count({ where: scope }),
        prisma_1.prisma.complaint.groupBy({
            by: ["status"],
            where: scope,
            _count: { _all: true },
        }),
        prisma_1.prisma.penalty.aggregate({ where: scope, _sum: { amount: true } }),
        prisma_1.prisma.penalty.aggregate({
            where: { ...scope, status: "RECOVERED" },
            _sum: { amount: true },
        }),
    ]);
    res.json({
        totalUsers,
        totalContractors,
        totalVendors,
        totalUnits,
        complaintsByStatus: complaintsByStatus.map((c) => ({
            status: c.status,
            count: c._count._all,
        })),
        totalPenaltyAmount: penaltyAgg._sum.amount ?? 0,
        totalRecoveredAmount: recoveredAgg._sum.amount ?? 0,
    });
});
//# sourceMappingURL=reports.js.map