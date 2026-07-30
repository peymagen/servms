import jwt from "jsonwebtoken";
import { type NextFunction, type Request, type Response } from "express";
import expressAsyncHandler from "express-async-handler";
import createHttpError from "http-errors";
import process from "process";
import { IUser } from "../../api/user/user.dto";

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
      next();
    }
  );
