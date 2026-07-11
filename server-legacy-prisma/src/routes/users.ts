import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { Division, Role } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole } from "../middleware/auth";

export const usersRouter = Router();

usersRouter.use(requireAuth);

function scopeFilter(req: import("express").Request) {
  if (req.user!.role === "DIVISION_ADDITIONAL_ADMIN") {
    return { division: req.user!.division ?? undefined };
  }
  return {};
}

usersRouter.get("/", async (req, res) => {
  const users = await prisma.user.findMany({
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

const createUserSchema = z.object({
  employeeId: z.string().min(3),
  password: z.string().min(6),
  fullName: z.string().min(1),
  designation: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  role: z.nativeEnum(Role),
  division: z.nativeEnum(Division).optional(),
});

usersRouter.post(
  "/",
  requireRole("SUPER_ADMIN", "ADMIN"),
  async (req, res) => {
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

    if (
      req.user!.role === "ADMIN" &&
      data.role === "SUPER_ADMIN"
    ) {
      return res.status(403).json({ error: "Admins cannot create Super Admins" });
    }

    const existing = await prisma.user.findUnique({
      where: { employeeId: data.employeeId },
    });
    if (existing) {
      return res.status(409).json({ error: "Employee ID already in use" });
    }

    const passwordHash = await bcrypt.hash(data.password, 10);
    const user = await prisma.user.create({
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
  }
);

const updateStatusSchema = z.object({
  status: z.enum(["ACTIVE", "INACTIVE"]),
});

usersRouter.patch(
  "/:id/status",
  requireRole("SUPER_ADMIN", "ADMIN"),
  async (req, res) => {
    const parsed = updateStatusSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid status" });
    }

    const user = await prisma.user.update({
      where: { id: String(req.params.id) },
      data: { status: parsed.data.status },
    });

    res.json({ id: user.id, status: user.status });
  }
);
