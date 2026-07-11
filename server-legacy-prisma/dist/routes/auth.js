"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authRouter = void 0;
const express_1 = require("express");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const zod_1 = require("zod");
const prisma_1 = require("../lib/prisma");
const jwt_1 = require("../lib/jwt");
const auth_1 = require("../middleware/auth");
exports.authRouter = (0, express_1.Router)();
const loginSchema = zod_1.z.object({
    employeeId: zod_1.z.string().min(1, "Employee ID is required"),
    password: zod_1.z.string().min(1, "Password is required"),
});
exports.authRouter.post("/login", async (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: "Employee ID and password are required" });
    }
    const { employeeId, password } = parsed.data;
    const user = await prisma_1.prisma.user.findUnique({ where: { employeeId } });
    if (!user || user.status !== "ACTIVE") {
        return res.status(401).json({ error: "Invalid credentials" });
    }
    const valid = await bcryptjs_1.default.compare(password, user.passwordHash);
    if (!valid) {
        return res.status(401).json({ error: "Invalid credentials" });
    }
    await prisma_1.prisma.user.update({
        where: { id: user.id },
        data: { lastLogin: new Date() },
    });
    const token = (0, jwt_1.signToken)({
        sub: user.id,
        employeeId: user.employeeId,
        role: user.role,
        division: user.division,
    });
    res.json({
        token,
        user: {
            id: user.id,
            employeeId: user.employeeId,
            fullName: user.fullName,
            designation: user.designation,
            role: user.role,
            division: user.division,
        },
    });
});
exports.authRouter.get("/me", auth_1.requireAuth, async (req, res) => {
    const user = await prisma_1.prisma.user.findUnique({ where: { id: req.user.sub } });
    if (!user) {
        return res.status(404).json({ error: "User not found" });
    }
    res.json({
        id: user.id,
        employeeId: user.employeeId,
        fullName: user.fullName,
        designation: user.designation,
        role: user.role,
        division: user.division,
    });
});
//# sourceMappingURL=auth.js.map