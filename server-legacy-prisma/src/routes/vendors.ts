import { Router } from "express";
import { z } from "zod";
import { AadhaarStatus, Division } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole } from "../middleware/auth";

export const vendorsRouter = Router();

vendorsRouter.use(requireAuth);

function scopeFilter(req: import("express").Request) {
  if (req.user!.role === "DIVISION_ADDITIONAL_ADMIN") {
    return { division: req.user!.division ?? undefined };
  }
  return {};
}

vendorsRouter.get("/", async (req, res) => {
  const vendors = await prisma.vendor.findMany({
    where: scopeFilter(req),
    orderBy: { createdAt: "desc" },
    include: { contractor: { select: { name: true, licenseNumber: true } } },
  });
  res.json(vendors);
});

vendorsRouter.get("/:id", async (req, res) => {
  const vendor = await prisma.vendor.findUnique({
    where: { id: String(req.params.id) },
    include: { contractor: true },
  });

  if (!vendor) {
    return res.status(404).json({ error: "Vendor not found" });
  }

  if (
    req.user!.role === "DIVISION_ADDITIONAL_ADMIN" &&
    vendor.division !== req.user!.division
  ) {
    return res.status(403).json({ error: "Insufficient permissions" });
  }

  res.json(vendor);
});

const createVendorSchema = z.object({
  vendorCode: z.string().min(1),
  fullName: z.string().min(1),
  contractorId: z.string().min(1),
  division: z.nativeEnum(Division),
  unitStation: z.string().min(1),
  vendorType: z.string().min(1),
  mobileNumber: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  aadhaarStatus: z.nativeEnum(AadhaarStatus).default("PENDING"),
  medicalValidity: z.string().optional(),
});

vendorsRouter.post(
  "/",
  requireRole("SUPER_ADMIN", "ADMIN", "DIVISION_ADDITIONAL_ADMIN"),
  async (req, res) => {
    const parsed = createVendorSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }

    const data = parsed.data;

    if (
      req.user!.role === "DIVISION_ADDITIONAL_ADMIN" &&
      data.division !== req.user!.division
    ) {
      return res
        .status(403)
        .json({ error: "Cannot create vendors outside your division" });
    }

    const contractor = await prisma.contractor.findUnique({
      where: { id: data.contractorId },
    });
    if (!contractor) {
      return res.status(400).json({ error: "Contractor not found" });
    }

    const existing = await prisma.vendor.findUnique({
      where: { vendorCode: data.vendorCode },
    });
    if (existing) {
      return res.status(409).json({ error: "Vendor code already in use" });
    }

    const vendor = await prisma.vendor.create({
      data: {
        vendorCode: data.vendorCode,
        fullName: data.fullName,
        contractorId: data.contractorId,
        division: data.division,
        unitStation: data.unitStation,
        vendorType: data.vendorType,
        mobileNumber: data.mobileNumber || undefined,
        email: data.email || undefined,
        aadhaarStatus: data.aadhaarStatus,
        medicalValidity: data.medicalValidity
          ? new Date(data.medicalValidity)
          : undefined,
      },
    });

    res.status(201).json(vendor);
  }
);

vendorsRouter.post(
  "/:id/issue-id-card",
  requireRole("SUPER_ADMIN", "ADMIN", "DIVISION_ADDITIONAL_ADMIN"),
  async (req, res) => {
    const vendor = await prisma.vendor.findUnique({
      where: { id: String(req.params.id) },
    });

    if (!vendor) {
      return res.status(404).json({ error: "Vendor not found" });
    }

    if (
      req.user!.role === "DIVISION_ADDITIONAL_ADMIN" &&
      vendor.division !== req.user!.division
    ) {
      return res.status(403).json({ error: "Insufficient permissions" });
    }

    const updated = await prisma.vendor.update({
      where: { id: vendor.id },
      data: { idCardStatus: "ACTIVE", idCardIssuedAt: new Date() },
    });

    res.json(updated);
  }
);
