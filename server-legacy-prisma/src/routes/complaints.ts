import { Router } from "express";
import { z } from "zod";
import { ComplaintPriority, ComplaintStatus, Division } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";

export const complaintsRouter = Router();

complaintsRouter.use(requireAuth);

function scopeFilter(req: import("express").Request) {
  if (req.user!.role === "DIVISION_ADDITIONAL_ADMIN") {
    return { division: req.user!.division ?? undefined };
  }
  return {};
}

complaintsRouter.get("/", async (req, res) => {
  const complaints = await prisma.complaint.findMany({
    where: scopeFilter(req),
    orderBy: { createdAt: "desc" },
  });
  res.json(complaints);
});

const createComplaintSchema = z.object({
  unitStation: z.string().min(1),
  category: z.string().min(1),
  description: z.string().min(1),
  division: z.nativeEnum(Division),
  priority: z.nativeEnum(ComplaintPriority).default("MEDIUM"),
  occurrenceDate: z.string().optional(),
});

complaintsRouter.post("/", async (req, res) => {
  const parsed = createComplaintSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  if (
    req.user!.role === "DIVISION_ADDITIONAL_ADMIN" &&
    parsed.data.division !== req.user!.division
  ) {
    return res
      .status(403)
      .json({ error: "Cannot register complaints outside your division" });
  }

  const complaint = await prisma.complaint.create({
    data: {
      unitStation: parsed.data.unitStation,
      category: parsed.data.category,
      description: parsed.data.description,
      division: parsed.data.division,
      priority: parsed.data.priority,
      occurrenceDate: parsed.data.occurrenceDate
        ? new Date(parsed.data.occurrenceDate)
        : undefined,
    },
  });

  res.status(201).json(complaint);
});

const updateStatusSchema = z.object({
  status: z.nativeEnum(ComplaintStatus),
});

complaintsRouter.patch("/:id/status", async (req, res) => {
  const parsed = updateStatusSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid status" });
  }

  const complaint = await prisma.complaint.update({
    where: { id: String(req.params.id) },
    data: { status: parsed.data.status },
  });

  res.json(complaint);
});
