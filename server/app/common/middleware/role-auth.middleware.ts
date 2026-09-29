import jwt from "jsonwebtoken";
import { type NextFunction, type Request, type Response } from "express";
import expressAsyncHandler from "express-async-handler";
import createHttpError from "http-errors";
import process from "process";
import { IUser } from "../../api/user/user.dto";
import { type RowDataPacket } from "mysql2";
import { pool } from "../services/sql.service";
import { isDivisionScoped } from "../constants/roles";

// Extend Express Request interface to include 'user'
declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

export const roleAuth = (publicRoutes: string[] = []) =>
  expressAsyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      if (publicRoutes.includes(req.path)) {
        next();
        return;
      }
      const token = req.headers.authorization?.replace("Bearer ", "");

      if (!token) {
        throw createHttpError(401, {
          message: `Invalid token`,
        });
      }

      try {
        const decodedUser = jwt.verify(token, process.env.JWT_SECRET!);
        req.user = decodedUser as IUser;
      } catch (err) {
        // jsonwebtoken throws TokenExpiredError/JsonWebTokenError without an http-errors
        // .status, so without this catch it falls through to a raw 500. Session expiry /
        // tampering is a 401, not a server error.
        const message = err instanceof jwt.TokenExpiredError ? "Session expired, please log in again" : "Invalid token";
        throw createHttpError(401, { message });
      }

      // The token is a login-time snapshot. Division and role drive every
      // division-restricted query, so take them from the database instead —
      // a transfer or role change then applies on the very next request.
      const tokenUser = req.user as any;
      const [rows] = await pool.execute<RowDataPacket[]>(
        `SELECT u.role_id, u.division_id, r.role_name
         FROM users u LEFT JOIN roles r ON r.id = u.role_id
         WHERE u.id = ? AND u.status = 1`,
        [tokenUser?.id]
      );
      if (!rows[0]) {
        throw createHttpError(401, { message: "Invalid token" });
      }
      tokenUser.role_id = rows[0].role_id;
      tokenUser.division_id = rows[0].division_id;
      tokenUser.role_name = rows[0].role_name;

      // A division-restricted account with no division would otherwise get an
      // empty division filter — i.e. every division's data.
      if (isDivisionScoped(tokenUser.role_name) && tokenUser.division_id == null) {
        throw createHttpError(403, { message: "Your account is not mapped to a division. Contact HQ Admin." });
      }
      next();
    }
  );
