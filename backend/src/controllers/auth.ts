import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { z } from "zod";

const prisma = new PrismaClient();

const ACCESS_TTL = "15m";
const REFRESH_TTL_DAYS = 7;

function signAccessToken(userId: string, role: string) {
  return jwt.sign({ sub: userId, role }, process.env.JWT_ACCESS_SECRET!, { expiresIn: ACCESS_TTL });
}

async function issueRefreshToken(userId: string) {
  const token = crypto.randomBytes(48).toString("hex");
  const expiresAt = new Date(Date.now() + REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000);
  await prisma.refreshToken.create({ data: { token, userId, expiresAt } });
  return token;
}

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  displayName: z.string().min(2).max(60),
  preferredLanguage: z.enum(["EN", "MY"]).default("EN"),
  honeypot: z.string().max(0).optional(), // anti-spam: bots fill hidden fields
});

export async function register(req: Request, res: Response) {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: parsed.error.message } });
  }
  const { email, password, displayName, preferredLanguage } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return res.status(409).json({ error: { code: "EMAIL_TAKEN", message: "Email already registered", messageMy: "ဤအီးမေးလ်ဖြင့် အကောင့်ရှိပြီးသားဖြစ်သည်" } });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: { email, passwordHash, displayName, preferredLanguage, role: "VIEWER" },
  });

  const accessToken = signAccessToken(user.id, user.role);
  const refreshToken = await issueRefreshToken(user.id);
  res.status(201).json({ accessToken, refreshToken, user: sanitizeUser(user) });
}

const loginSchema = z.object({ email: z.string().email(), password: z.string() });

export async function login(req: Request, res: Response) {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Invalid input" } });
  }
  const { email, password } = parsed.data;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user?.passwordHash || !(await bcrypt.compare(password, user.passwordHash))) {
    return res.status(401).json({ error: { code: "INVALID_CREDENTIALS", message: "Incorrect email or password", messageMy: "အီးမေးလ် သို့မဟုတ် စကားဝှက် မှားနေသည်" } });
  }
  if (user.isSuspended) {
    return res.status(403).json({ error: { code: "SUSPENDED", message: "This account has been suspended", messageMy: "ဤအကောင့်ကို ယာယီရပ်ဆိုင်းထားသည်" } });
  }

  const accessToken = signAccessToken(user.id, user.role);
  const refreshToken = await issueRefreshToken(user.id);
  res.json({ accessToken, refreshToken, user: sanitizeUser(user) });
}

export async function refresh(req: Request, res: Response) {
  const { refreshToken } = req.body as { refreshToken?: string };
  if (!refreshToken) return res.status(400).json({ error: { code: "MISSING_TOKEN", message: "Refresh token required" } });

  const stored = await prisma.refreshToken.findUnique({ where: { token: refreshToken } });
  if (!stored || stored.revoked || stored.expiresAt < new Date()) {
    return res.status(401).json({ error: { code: "TOKEN_INVALID", message: "Please log in again", messageMy: "ထပ်မံဝင်ရောက်ပါ" } });
  }

  // rotate: revoke old, issue new
  await prisma.refreshToken.update({ where: { id: stored.id }, data: { revoked: true } });
  const user = await prisma.user.findUniqueOrThrow({ where: { id: stored.userId } });
  const accessToken = signAccessToken(user.id, user.role);
  const newRefreshToken = await issueRefreshToken(user.id);

  res.json({ accessToken, refreshToken: newRefreshToken });
}

export async function logout(req: Request, res: Response) {
  const { refreshToken } = req.body as { refreshToken?: string };
  if (refreshToken) {
    await prisma.refreshToken.updateMany({ where: { token: refreshToken }, data: { revoked: true } });
  }
  res.status(204).send();
}

function sanitizeUser(user: any) {
  const { passwordHash, ...safe } = user;
  return safe;
}
