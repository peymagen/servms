import * as userService from "./user.service";
import { createResponse } from "../../common/helper/response.hepler";
import { logAudit } from "../../common/services/auditLog.service";
import { isDivisionScoped } from "../../common/constants/roles";
import asyncHandler from "express-async-handler";
import { type Request, type Response } from "express";
import passport from "passport";
import { createUserTokens } from "../../common/services/passport-jwt.service";
import bcrypt from "bcrypt";

// ─── Helper ────────────────────────────────────────────────────────────────────
const hashPassword = async (password: string): Promise<string> => {
  return bcrypt.hash(password, 12);
};

// ─── CREATE USER ───────────────────────────────────────────────────────────────
export const createUser = asyncHandler(async (req: Request, res: Response) => {
  if (req.file) {
    req.body.signature_path = `/uploads/${req.file.filename}`;
  }
  req.body.card_signing_authority = req.body.card_signing_authority === "true" || req.body.card_signing_authority === true;

  req.body.password = await hashPassword(req.body.password); // ✅ await fixed
  const result = await userService.createUser(req.body);
  await logAudit({
    req,
    module: "user_management",
    recordId: result.insertId,
    action: "CREATE",
    newData: { ...req.body, password: undefined },
  });
  res.send(createResponse(result, "User created successfully"));
});

// ─── LOGIN ─────────────────────────────────────────────────────────────────────
export const loginUser = asyncHandler(async (req: Request, res: Response) => {
  console.log("Login attempt for username:", req.body); // Debug log
  passport.authenticate(
    "login",
    async (err: Error | null, user: any | undefined, info: any) => {
      if (err || !user) {
        return res.status(401).json({
          message: info?.message || "Authentication failed",
        });
      }
      // Update last_login timestamp on successful login
      await userService.updateLastLogin(user.id);
      const { accessToken } = createUserTokens(user);
      res.send(createResponse({ accessToken, user }, "Login successful"));
    }
  )(req, res);
});

// ─── FULL UPDATE (PUT) ─────────────────────────────────────────────────────────
export const updateUser = asyncHandler(async (req: Request, res: Response) => {
  if (req.file) {
    req.body.signature_path = `/uploads/${req.file.filename}`;
  }
  if (req.body.password) {
    req.body.password = await hashPassword(req.body.password); // ✅ await fixed
  }
  const before = await userService.getUserById(req.params.id as string);
  const result = await userService.updateUser(req.params.id as string, req.body);
  await logAudit({
    req,
    module: "user_management",
    recordId: req.params.id,
    action: "UPDATE",
    oldData: before,
    newData: { ...req.body, password: undefined },
  });
  res.send(createResponse(result, "User updated successfully"));
});

// ─── PARTIAL UPDATE (PATCH) ────────────────────────────────────────────────────
export const editUser = asyncHandler(async (req: Request, res: Response) => {
  if (req.file) {
    req.body.signature_path = `/uploads/${req.file.filename}`;
  }
  if (req.body.card_signing_authority !== undefined) {
    req.body.card_signing_authority = req.body.card_signing_authority === "true" || req.body.card_signing_authority === true;
  }
  if (req.body.password) {
    // Hash and store under the correct column name before passing to service
    req.body.password_hash = await hashPassword(req.body.password); // ✅ await fixed
    delete req.body.password;
  }
  const before = await userService.getUserById(req.params.id as string);
  const result = await userService.editUser(req.params.id as string, req.body);
  await logAudit({
    req,
    module: "user_management",
    recordId: req.params.id,
    action: "UPDATE",
    oldData: before,
    newData: { ...req.body, password_hash: undefined },
  });
  res.send(createResponse(result, "User patched successfully"));
});

// ─── DELETE ────────────────────────────────────────────────────────────────────
export const deleteUser = asyncHandler(async (req: Request, res: Response) => {
  const before = await userService.getUserById(req.params.id as string);
  const result = await userService.deleteUser(req.params.id as string);
  await logAudit({ req, module: "user_management", recordId: req.params.id, action: "DELETE", oldData: before });
  res.send(createResponse(result, "User deleted successfully"));
});

// ─── GET BY ID ─────────────────────────────────────────────────────────────────
export const getUserById = asyncHandler(async (req: Request, res: Response) => {
  const result = await userService.getUserById(req.params.id as string);
  if (!result) {
    res.status(404).send(createResponse(null, "User not found"));
    return;
  }
  res.send(createResponse(result));
});

// ─── GET ALL ───────────────────────────────────────────────────────────────────
export const getAllUser = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user as any;
  const divisionId = isDivisionScoped(user?.role_name) ? user.division_id : undefined;
  const result = await userService.getAllUsers(divisionId);
  res.send(createResponse(result));
});

// ─── TOGGLE STATUS ─────────────────────────────────────────────────────────────
export const toggleStatus = asyncHandler(async (req: Request, res: Response) => {
  const before = await userService.getUserById(req.params.id as string);
  const result = await userService.toggleStatus(req.params.id as string);
  await logAudit({
    req,
    module: "user_management",
    recordId: req.params.id,
    action: "STATUS_CHANGE",
    oldData: before,
    newData: result,
  });
  res.send(createResponse(result, "User status toggled successfully"));
});

// ─── CHANGE PASSWORD ───────────────────────────────────────────────────────────
export const changePassword = asyncHandler(async (req: Request, res: Response) => {
  const { currentPassword, newPassword } = req.body;
  const user = await userService.getUserById(req.params.id as string);
  if (!user) {
    res.status(404).send(createResponse(null, "User not found"));
    return;
  }
  const dbUser = await userService.getUserByUsername((user as any).username);
  if (!dbUser) {
    res.status(404).send(createResponse(null, "User details not found"));
    return;
  }
  const isMatch = await bcrypt.compare(currentPassword, (dbUser as any).password_hash);
  if (!isMatch) {
    res.status(400).send(createResponse(null, "Current password is incorrect"));
    return;
  }
  const newHash = await hashPassword(newPassword);
  const result = await userService.changePassword(req.params.id as string, newHash);
  await logAudit({ req, module: "user_management", recordId: req.params.id, action: "PASSWORD_RESET" });
  res.send(createResponse(result, "Password changed successfully"));
});