"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.usersRouter = void 0;
const express_1 = require("express");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const zod_1 = require("zod");
const client_1 = require("@prisma/client");
const prisma_1 = require("../lib/prisma");
const auth_1 = require("../middleware/auth");
exports.usersRouter = (0, express_1.Router)();
exports.usersRouter.use(auth_1.requireAuth);
function scopeFilter(req) {
    if (req.user.role === "DIVISION_ADDITIONAL_ADMIN") {
        return { division: req.user.division ?? undefined };
    }
    return {};
}
exports.usersRouter.get("/", async (req, res) => {
    const users = await prisma_1.prisma.user.findMany({
        where: scopeFilter(req),
        orderBy: { createdAt: "desc" },
        select: {
            id: true,
            employeeId: true,
            fullName: true,
            designation: true,
            email: true,
            role: true,
            division: true,
            status: true,
            lastLogin: true,
            createdAt: true,
        },
    });
    res.json(users);
});
const createUserSchema = zod_1.z.object({
    employeeId: zod_1.z.string().min(3),
    password: zod_1.z.string().min(6),
    fullName: zod_1.z.string().min(1),
    designation: zod_1.z.string().optional(),
    email: zod_1.z.string().email().optional().or(zod_1.z.literal("")),
    role: zod_1.z.nativeEnum(client_1.Role),
    division: zod_1.z.nativeEnum(client_1.Division).optional(),
});
exports.usersRouter.post("/", (0, auth_1.requireRole)("SUPER_ADMIN", "ADMIN"), async (req, res) => {
    const parsed = createUserSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.flatten() });
    }
    const data = parsed.data;
    if (data.role === "DIVISION_ADDITIONAL_ADMIN" && !data.division) {
        return res
            .status(400)
            .json({ error: "Division is required for Division Additional Admin" });
    }
    if (req.user.role === "ADMIN" &&
        data.role === "SUPER_ADMIN") {
        return res.status(403).json({ error: "Admins cannot create Super Admins" });
    }
    const existing = await prisma_1.prisma.user.findUnique({
        where: { employeeId: data.employeeId },
    });
    if (existing) {
        return res.status(409).json({ error: "Employee ID already in use" });
    }
    const passwordHash = await bcryptjs_1.default.hash(data.password, 10);
    const user = await prisma_1.prisma.user.create({
        data: {
            employeeId: data.employeeId,
            passwordHash,
            fullName: data.fullName,
            designation: data.designation,
            email: data.email || undefined,
            role: data.role,
            division: data.role === "DIVISION_ADDITIONAL_ADMIN" ? data.division : undefined,
        },
        select: {
            id: true,
            employeeId: true,
            fullName: true,
            designation: true,
            email: true,
            role: true,
            division: true,
            status: true,
            lastLogin: true,
            createdAt: true,
        },
    });
    res.status(201).json(user);
});
const updateStatusSchema = zod_1.z.object({
    status: zod_1.z.enum(["ACTIVE", "INACTIVE"]),
});
exports.usersRouter.patch("/:id/status", (0, auth_1.requireRole)("SUPER_ADMIN", "ADMIN"), async (req, res) => {
    const parsed = updateStatusSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: "Invalid status" });
    }
    const user = await prisma_1.prisma.user.update({
        where: { id: String(req.params.id) },
        data: { status: parsed.data.status },
    });
    res.json({ id: user.id, status: user.status });
});
//# sourceMappingURL=users.js.map