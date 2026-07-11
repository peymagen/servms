import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";

export const dashboardRouter = Router();

dashboardRouter.use(requireAuth);

dashboardRouter.get("/stats", async (req, res) => {
  const divisionFilter =
    req.user!.role === "DIVISION_ADDITIONAL_ADMIN"
      ? { division: req.user!.division ?? undefined }
      : {};

  const [
    totalUsers,
    activeUsers,
    byDivision,
    totalContractors,
    totalVendors,
    pendingComplaints,
  ] = await Promise.all([
    prisma.user.count({ where: divisionFilter }),
    prisma.user.count({ where: { ...divisionFilter, status: "ACTIVE" } }),
    prisma.user.groupBy({
      by: ["division"],
      where:
        req.user!.role === "DIVISION_ADDITIONAL_ADMIN"
          ? { division: req.user!.division ?? undefined }
          : { division: { not: null } },
      _count: { _all: true },
    }),
    prisma.contractor.count({ where: divisionFilter }),
    prisma.vendor.count({ where: divisionFilter }),
    prisma.complaint.count({ where: { ...divisionFilter, status: { not: "RESOLVED" } } }),
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
