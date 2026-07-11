"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.unitsRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const client_1 = require("@prisma/client");
const prisma_1 = require("../lib/prisma");
const auth_1 = require("../middleware/auth");
exports.unitsRouter = (0, express_1.Router)();
exports.unitsRouter.use(auth_1.requireAuth);
function scopeFilter(req) {
    if (req.user.role === "DIVISION_ADDITIONAL_ADMIN") {
        return { division: req.user.division ?? undefined };
    }
    return {};
}
exports.unitsRouter.get("/", async (req, res) => {
    const units = await prisma_1.prisma.unit.findMany({
        where: scopeFilter(req),
        orderBy: { createdAt: "desc" },
    });
    res.json(units);
});
const createUnitSchema = zod_1.z.object({
    station: zod_1.z.string().min(1),
    platformLocation: zod_1.z.string().optional(),
    division: zod_1.z.nativeEnum(client_1.Division),
    clusterName: zod_1.z.string().optional(),
    contractType: zod_1.z.string().optional(),
    contractCategory: zod_1.z.string().optional(),
    unitName: zod_1.z.string().min(1),
    unitCode: zod_1.z.string().min(1),
    areaDescription: zod_1.z.string().optional(),
    inspectorName: zod_1.z.string().optional(),
    status: zod_1.z.nativeEnum(client_1.UnitStatus).default("ACTIVE"),
});
exports.unitsRouter.post("/", (0, auth_1.requireRole)("SUPER_ADMIN", "ADMIN", "DIVISION_ADDITIONAL_ADMIN"), async (req, res) => {
    const parsed = createUnitSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.flatten() });
    }
    if (req.user.role === "DIVISION_ADDITIONAL_ADMIN" &&
        parsed.data.division !== req.user.division) {
        return res
            .status(403)
            .json({ error: "Cannot create units outside your division" });
    }
    const existing = await prisma_1.prisma.unit.findUnique({
        where: { unitCode: parsed.data.unitCode },
    });
    if (existing) {
        return res.status(409).json({ error: "Unit code already in use" });
    }
    const unit = await prisma_1.prisma.unit.create({ data: parsed.data });
    res.status(201).json(unit);
});
//# sourceMappingURL=units.js.map