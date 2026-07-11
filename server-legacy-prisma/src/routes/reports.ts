import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";

export const reportsRouter = Router();

reportsRouter.use(requireAuth);

reportsRouter.get("/summary", async (req, res) => {
  const scope =
    req.user!.role === "DIVISION_ADDITIONAL_ADMIN"
      ? { division: req.user!.division ?? undefined }
      : {};

  const [
    totalUsers,
    totalContractors,
    totalVendors,
    totalUnits,
    complaintsByStatus,
    penaltyAgg,
    recoveredAgg,
  ] = await Promise.all([
    prisma.user.count({ where: scope }),
    prisma.contractor.count({ where: scope }),
    prisma.vendor.count({ where: scope }),
    prisma.unit.count({ where: scope }),
    prisma.complaint.groupBy({
      by: ["status"],
      where: scope,
      _count: { _all: true },
    }),
    prisma.penalty.aggregate({ where: scope, _sum: { amount: true } }),
    prisma.penalty.aggregate({
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
