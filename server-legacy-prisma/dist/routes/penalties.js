"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.penaltiesRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const client_1 = require("@prisma/client");
const prisma_1 = require("../lib/prisma");
const auth_1 = require("../middleware/auth");
exports.penaltiesRouter = (0, express_1.Router)();
exports.penaltiesRouter.use(auth_1.requireAuth);
function scopeFilter(req) {
    if (req.user.role === "DIVISION_ADDITIONAL_ADMIN") {
        return { division: req.user.division ?? undefined };
    }
    return {};
}
exports.penaltiesRouter.get("/", async (req, res) => {
    const penalties = await prisma_1.prisma.penalty.findMany({
        where: scopeFilter(req),
        orderBy: { createdAt: "desc" },
    });
    res.json(penalties);
});
const createPenaltySchema = zod_1.z.object({
    refNo: zod_1.z.string().min(1),
    vendorId: zod_1.z.string().optional(),
    vendorName: zod_1.z.string().min(1),
    unitLocation: zod_1.z.string().min(1),
    division: zod_1.z.nativeEnum(client_1.Division),
    penaltyType: zod_1.z.string().min(1),
    amount: zod_1.z.number().positive(),
    status: zod_1.z.nativeEnum(client_1.PenaltyStatus).default("PENDING"),
});
exports.penaltiesRouter.post("/", (0, auth_1.requireRole)("SUPER_ADMIN", "ADMIN", "DIVISION_ADDITIONAL_ADMIN"), async (req, res) => {
    const parsed = createPenaltySchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.flatten() });
    }
    if (req.user.role === "DIVISION_ADDITIONAL_ADMIN" &&
        parsed.data.division !== req.user.division) {
        return res
            .status(403)
            .json({ error: "Cannot impose penalties outside your division" });
    }
    const existing = await prisma_1.prisma.penalty.findUnique({
        where: { refNo: parsed.data.refNo },
    });
    if (existing) {
        return res.status(409).json({ error: "Reference number already in use" });
    }
    const penalty = await prisma_1.prisma.penalty.create({ data: parsed.data });
    res.status(201).json(penalty);
});
const updateStatusSchema = zod_1.z.object({
    status: zod_1.z.nativeEnum(client_1.PenaltyStatus),
});
exports.penaltiesRouter.patch("/:id/status", (0, auth_1.requireRole)("SUPER_ADMIN", "ADMIN", "DIVISION_ADDITIONAL_ADMIN"), async (req, res) => {
    const parsed = updateStatusSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: "Invalid status" });
    }
    const penalty = await prisma_1.prisma.penalty.update({
        where: { id: String(req.params.id) },
        data: { status: parsed.data.status },
    });
    res.json(penalty);
});
//# sourceMappingURL=penalties.js.map