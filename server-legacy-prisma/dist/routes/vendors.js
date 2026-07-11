"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.vendorsRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const client_1 = require("@prisma/client");
const prisma_1 = require("../lib/prisma");
const auth_1 = require("../middleware/auth");
exports.vendorsRouter = (0, express_1.Router)();
exports.vendorsRouter.use(auth_1.requireAuth);
function scopeFilter(req) {
    if (req.user.role === "DIVISION_ADDITIONAL_ADMIN") {
        return { division: req.user.division ?? undefined };
    }
    return {};
}
exports.vendorsRouter.get("/", async (req, res) => {
    const vendors = await prisma_1.prisma.vendor.findMany({
        where: scopeFilter(req),
        orderBy: { createdAt: "desc" },
        include: { contractor: { select: { name: true, licenseNumber: true } } },
    });
    res.json(vendors);
});
exports.vendorsRouter.get("/:id", async (req, res) => {
    const vendor = await prisma_1.prisma.vendor.findUnique({
        where: { id: String(req.params.id) },
        include: { contractor: true },
    });
    if (!vendor) {
        return res.status(404).json({ error: "Vendor not found" });
    }
    if (req.user.role === "DIVISION_ADDITIONAL_ADMIN" &&
        vendor.division !== req.user.division) {
        return res.status(403).json({ error: "Insufficient permissions" });
    }
    res.json(vendor);
});
const createVendorSchema = zod_1.z.object({
    vendorCode: zod_1.z.string().min(1),
    fullName: zod_1.z.string().min(1),
    contractorId: zod_1.z.string().min(1),
    division: zod_1.z.nativeEnum(client_1.Division),
    unitStation: zod_1.z.string().min(1),
    vendorType: zod_1.z.string().min(1),
    mobileNumber: zod_1.z.string().optional(),
    email: zod_1.z.string().email().optional().or(zod_1.z.literal("")),
    aadhaarStatus: zod_1.z.nativeEnum(client_1.AadhaarStatus).default("PENDING"),
    medicalValidity: zod_1.z.string().optional(),
});
exports.vendorsRouter.post("/", (0, auth_1.requireRole)("SUPER_ADMIN", "ADMIN", "DIVISION_ADDITIONAL_ADMIN"), async (req, res) => {
    const parsed = createVendorSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.flatten() });
    }
    const data = parsed.data;
    if (req.user.role === "DIVISION_ADDITIONAL_ADMIN" &&
        data.division !== req.user.division) {
        return res
            .status(403)
            .json({ error: "Cannot create vendors outside your division" });
    }
    const contractor = await prisma_1.prisma.contractor.findUnique({
        where: { id: data.contractorId },
    });
    if (!contractor) {
        return res.status(400).json({ error: "Contractor not found" });
    }
    const existing = await prisma_1.prisma.vendor.findUnique({
        where: { vendorCode: data.vendorCode },
    });
    if (existing) {
        return res.status(409).json({ error: "Vendor code already in use" });
    }
    const vendor = await prisma_1.prisma.vendor.create({
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
});
exports.vendorsRouter.post("/:id/issue-id-card", (0, auth_1.requireRole)("SUPER_ADMIN", "ADMIN", "DIVISION_ADDITIONAL_ADMIN"), async (req, res) => {
    const vendor = await prisma_1.prisma.vendor.findUnique({
        where: { id: String(req.params.id) },
    });
    if (!vendor) {
        return res.status(404).json({ error: "Vendor not found" });
    }
    if (req.user.role === "DIVISION_ADDITIONAL_ADMIN" &&
        vendor.division !== req.user.division) {
        return res.status(403).json({ error: "Insufficient permissions" });
    }
    const updated = await prisma_1.prisma.vendor.update({
        where: { id: vendor.id },
        data: { idCardStatus: "ACTIVE", idCardIssuedAt: new Date() },
    });
    res.json(updated);
});
//# sourceMappingURL=vendors.js.map