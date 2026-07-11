"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.contractorsRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const client_1 = require("@prisma/client");
const prisma_1 = require("../lib/prisma");
const auth_1 = require("../middleware/auth");
exports.contractorsRouter = (0, express_1.Router)();
exports.contractorsRouter.use(auth_1.requireAuth);
function scopeFilter(req) {
    if (req.user.role === "DIVISION_ADDITIONAL_ADMIN") {
        return { division: req.user.division ?? undefined };
    }
    return {};
}
exports.contractorsRouter.get("/", async (req, res) => {
    const contractors = await prisma_1.prisma.contractor.findMany({
        where: scopeFilter(req),
        orderBy: { createdAt: "desc" },
        include: { _count: { select: { vendors: true } } },
    });
    res.json(contractors);
});
const createContractorSchema = zod_1.z.object({
    name: zod_1.z.string().min(1),
    licenseNumber: zod_1.z.string().min(1),
    division: zod_1.z.nativeEnum(client_1.Division),
    validityDate: zod_1.z.string(),
    feeStatus: zod_1.z.nativeEnum(client_1.FeeStatus).default("PAID"),
});
exports.contractorsRouter.post("/", (0, auth_1.requireRole)("SUPER_ADMIN", "ADMIN", "DIVISION_ADDITIONAL_ADMIN"), async (req, res) => {
    const parsed = createContractorSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.flatten() });
    }
    if (req.user.role === "DIVISION_ADDITIONAL_ADMIN" &&
        parsed.data.division !== req.user.division) {
        return res
            .status(403)
            .json({ error: "Cannot create contractors outside your division" });
    }
    const existing = await prisma_1.prisma.contractor.findUnique({
        where: { licenseNumber: parsed.data.licenseNumber },
    });
    if (existing) {
        return res.status(409).json({ error: "License number already in use" });
    }
    const contractor = await prisma_1.prisma.contractor.create({
        data: {
            name: parsed.data.name,
            licenseNumber: parsed.data.licenseNumber,
            division: parsed.data.division,
            validityDate: new Date(parsed.data.validityDate),
            feeStatus: parsed.data.feeStatus,
        },
    });
    res.status(201).json(contractor);
});
//# sourceMappingURL=contractors.js.map