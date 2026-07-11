import { Router } from "express";
import { z } from "zod";
import { Division, FeeStatus } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole } from "../middleware/auth";

export const contractorsRouter = Router();

contractorsRouter.use(requireAuth);

function scopeFilter(req: import("express").Request) {
  if (req.user!.role === "DIVISION_ADDITIONAL_ADMIN") {
    return { division: req.user!.division ?? undefined };
  }
  return {};
}

contractorsRouter.get("/", async (req, res) => {
  const contractors = await prisma.contractor.findMany({
    where: scopeFilter(req),
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { vendors: true } } },
  });
  res.json(contractors);
});

const createContractorSchema = z.object({
  name: z.string().min(1),
  licenseNumber: z.string().min(1),
  division: z.nativeEnum(Division),
  validityDate: z.string(),
  feeStatus: z.nativeEnum(FeeStatus).default("PAID"),
});

contractorsRouter.post(
  "/",
  requireRole("SUPER_ADMIN", "ADMIN", "DIVISION_ADDITIONAL_ADMIN"),
  async (req, res) => {
    const parsed = createContractorSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }

    if (
      req.user!.role === "DIVISION_ADDITIONAL_ADMIN" &&
      parsed.data.division !== req.user!.division
    ) {
      return res
        .status(403)
        .json({ error: "Cannot create contractors outside your division" });
    }

    const existing = await prisma.contractor.findUnique({
      where: { licenseNumber: parsed.data.licenseNumber },
    });
    if (existing) {
      return res.status(409).json({ error: "License number already in use" });
    }

    const contractor = await prisma.contractor.create({
      data: {
        name: parsed.data.name,
        licenseNumber: parsed.data.licenseNumber,
        division: parsed.data.division,
        validityDate: new Date(parsed.data.validityDate),
        feeStatus: parsed.data.feeStatus,
      },
    });

    res.status(201).json(contractor);
  }
);
