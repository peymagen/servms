"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.complaintsRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const client_1 = require("@prisma/client");
const prisma_1 = require("../lib/prisma");
const auth_1 = require("../middleware/auth");
exports.complaintsRouter = (0, express_1.Router)();
exports.complaintsRouter.use(auth_1.requireAuth);
function scopeFilter(req) {
    if (req.user.role === "DIVISION_ADDITIONAL_ADMIN") {
        return { division: req.user.division ?? undefined };
    }
    return {};
}
exports.complaintsRouter.get("/", async (req, res) => {
    const complaints = await prisma_1.prisma.complaint.findMany({
        where: scopeFilter(req),
        orderBy: { createdAt: "desc" },
    });
    res.json(complaints);
});
const createComplaintSchema = zod_1.z.object({
    unitStation: zod_1.z.string().min(1),
    category: zod_1.z.string().min(1),
    description: zod_1.z.string().min(1),
    division: zod_1.z.nativeEnum(client_1.Division),
    priority: zod_1.z.nativeEnum(client_1.ComplaintPriority).default("MEDIUM"),
    occurrenceDate: zod_1.z.string().optional(),
});
exports.complaintsRouter.post("/", async (req, res) => {
    const parsed = createComplaintSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.flatten() });
    }
    if (req.user.role === "DIVISION_ADDITIONAL_ADMIN" &&
        parsed.data.division !== req.user.division) {
        return res
            .status(403)
            .json({ error: "Cannot register complaints outside your division" });
    }
    const complaint = await prisma_1.prisma.complaint.create({
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
const updateStatusSchema = zod_1.z.object({
    status: zod_1.z.nativeEnum(client_1.ComplaintStatus),
});
exports.complaintsRouter.patch("/:id/status", async (req, res) => {
    const parsed = updateStatusSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: "Invalid status" });
    }
    const complaint = await prisma_1.prisma.complaint.update({
        where: { id: String(req.params.id) },
        data: { status: parsed.data.status },
    });
    res.json(complaint);
});
//# sourceMappingURL=complaints.js.map