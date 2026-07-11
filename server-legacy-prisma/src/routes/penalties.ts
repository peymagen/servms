import { Router } from "express";
import { z } from "zod";
import { Division, PenaltyStatus } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole } from "../middleware/auth";

export const penaltiesRouter = Router();

penaltiesRouter.use(requireAuth);

function scopeFilter(req: import("express").Request) {
  if (req.user!.role === "DIVISION_ADDITIONAL_ADMIN") {
    return { division: req.user!.division ?? undefined };
  }
  return {};
}

penaltiesRouter.get("/", async (req, res) => {
  const penalties = await prisma.penalty.findMany({
    where: scopeFilter(req),
    orderBy: { createdAt: "desc" },
  });
  res.json(penalties);
});

const createPenaltySchema = z.object({
  refNo: z.string().min(1),
  vendorId: z.string().optional(),
  vendorName: z.string().min(1),
  unitLocation: z.string().min(1),
  division: z.nativeEnum(Division),
  penaltyType: z.string().min(1),
  amount: z.number().positive(),
  status: z.nativeEnum(PenaltyStatus).default("PENDING"),
});

penaltiesRouter.post(
  "/",
  requireRole("SUPER_ADMIN", "ADMIN", "DIVISION_ADDITIONAL_ADMIN"),
  async (req, res) => {
    const parsed = createPenaltySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }

    if (
      req.user!.role === "DIVISION_ADDITIONAL_ADMIN" &&
      parsed.data.division !== req.user!.division
    ) {
      return res
        .status(403)
        .json({ error: "Cannot impose penalties outside your division" });
    }

    const existing = await prisma.penalty.findUnique({
      where: { refNo: parsed.data.refNo },
    });
    if (existing) {
      return res.status(409).json({ error: "Reference number already in use" });
    }

    const penalty = await prisma.penalty.create({ data: parsed.data });
    res.status(201).json(penalty);
  }
);

const updateStatusSchema = z.object({
  status: z.nativeEnum(PenaltyStatus),
});

penaltiesRouter.patch(
  "/:id/status",
  requireRole("SUPER_ADMIN", "ADMIN", "DIVISION_ADDITIONAL_ADMIN"),
  async (req, res) => {
    const parsed = updateStatusSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid status" });
    }

    const penalty = await prisma.penalty.update({
      where: { id: String(req.params.id) },
      data: { status: parsed.data.status },
    });

    res.json(penalty);
  }
);
