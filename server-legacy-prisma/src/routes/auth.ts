import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { signToken } from "../lib/jwt";
import { requireAuth } from "../middleware/auth";

export const authRouter = Router();

const loginSchema = z.object({
  employeeId: z.string().min(1, "Employee ID is required"),
  password: z.string().min(1, "Password is required"),
});

authRouter.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Employee ID and password are required" });
  }

  const { employeeId, password } = parsed.data;

  const user = await prisma.user.findUnique({ where: { employeeId } });
  if (!user || user.status !== "ACTIVE") {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLogin: new Date() },
  });

  const token = signToken({
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

authRouter.get("/me", requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user!.sub } });
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
