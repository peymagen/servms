import { Router } from "express";
import { z } from "zod";
import { Division, UnitStatus } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole } from "../middleware/auth";

export const unitsRouter = Router();

unitsRouter.use(requireAuth);

function scopeFilter(req: import("express").Request) {
  if (req.user!.role === "DIVISION_ADDITIONAL_ADMIN") {
    return { division: req.user!.division ?? undefined };
  }
  return {};
}

unitsRouter.get("/", async (req, res) => {
  const units = await prisma.unit.findMany({
    where: scopeFilter(req),
    orderBy: { createdAt: "desc" },
  });
  res.json(units);
});

const createUnitSchema = z.object({
  station: z.string().min(1),
  platformLocation: z.string().optional(),
  division: z.nativeEnum(Division),
  clusterName: z.string().optional(),
  contractType: z.string().optional(),
  contractCategory: z.string().optional(),
  unitName: z.string().min(1),
  unitCode: z.string().min(1),
  areaDescription: z.string().optional(),
  inspectorName: z.string().optional(),
  status: z.nativeEnum(UnitStatus).default("ACTIVE"),
});

unitsRouter.post(
  "/",
  requireRole("SUPER_ADMIN", "ADMIN", "DIVISION_ADDITIONAL_ADMIN"),
  async (req, res) => {
    const parsed = createUnitSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }

    if (
      req.user!.role === "DIVISION_ADDITIONAL_ADMIN" &&
      parsed.data.division !== req.user!.division
    ) {
      return res
        .status(403)
        .json({ error: "Cannot create units outside your division" });
    }

    const existing = await prisma.unit.findUnique({
      where: { unitCode: parsed.data.unitCode },
    });
    if (existing) {
      return res.status(409).json({ error: "Unit code already in use" });
    }

    const unit = await prisma.unit.create({ data: parsed.data });
    res.status(201).json(unit);
  }
);
