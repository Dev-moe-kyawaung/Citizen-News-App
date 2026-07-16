import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { Role } from "@prisma/client";

export interface AuthedRequest extends Request {
  user?: { id: string; role: Role };
}

const ROLE_RANK: Record<Role, number> = {
  VIEWER: 0,
  REPORTER: 1,
  EDITOR: 2,
  ADMIN: 3,
};

/** Verifies the JWT access token and attaches { id, role } to req.user */
export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({
      error: { code: "UNAUTHENTICATED", message: "Login required", messageMy: "အကောင့်ဝင်ရန်လိုအပ်သည်" },
    });
  }
  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET!) as { sub: string; role: Role };
    req.user = { id: payload.sub, role: payload.role };
    next();
  } catch {
    return res.status(401).json({
      error: { code: "TOKEN_INVALID", message: "Session expired, please log in again", messageMy: "အချိန်ကုန်သွားပါပြီ၊ ထပ်မံဝင်ရောက်ပါ" },
    });
  }
}

/** Role-gate a route. Pass the MINIMUM role required (role hierarchy is respected). */
export function requireRole(minRole: Role) {
  return (req: AuthedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: { code: "UNAUTHENTICATED", message: "Login required", messageMy: "အကောင့်ဝင်ရန်လိုအပ်သည်" } });
    }
    if (ROLE_RANK[req.user.role] < ROLE_RANK[minRole]) {
      return res.status(403).json({
        error: { code: "FORBIDDEN", message: "You don't have permission for this action", messageMy: "သင့်တွင် ဤလုပ်ဆောင်ချက်အတွက် ခွင့်ပြုချက်မရှိပါ" },
      });
    }
    next();
  };
}

/** Optional auth — attaches user if token present, but doesn't block if absent. Useful for public GET routes that personalize (e.g. "did I like this"). */
export function optionalAuth(req: AuthedRequest, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) {
    try {
      const payload = jwt.verify(header.slice(7), process.env.JWT_ACCESS_SECRET!) as { sub: string; role: Role };
      req.user = { id: payload.sub, role: payload.role };
    } catch {
      /* ignore invalid token on optional routes */
    }
  }
  next();
}
