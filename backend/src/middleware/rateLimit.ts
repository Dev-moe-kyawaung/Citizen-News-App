import rateLimit from "express-rate-limit";

/** 5 attempts / minute — brute-force protection on auth endpoints */
export const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: "RATE_LIMITED", message: "Too many attempts, please wait a moment", messageMy: "ကြိုးစားမှုများပြားနေသည်၊ ခဏစောင့်ပါ" } },
});

/** 10 article creations / hour / user — prevents flood-posting */
export const articleCreateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  keyGenerator: (req: any) => req.user?.id ?? req.ip,
  message: { error: { code: "RATE_LIMITED", message: "You've hit the hourly article limit", messageMy: "တစ်နာရီအတွင်း ဆောင်းပါးကန့်သတ်ချက်ပြည့်သွားပါပြီ" } },
});

/** 20 comments / minute / user */
export const commentLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  keyGenerator: (req: any) => req.user?.id ?? req.ip,
  message: { error: { code: "RATE_LIMITED", message: "Slow down a little before commenting again", messageMy: "မှတ်ချက်ပြန်ပေးခြင်းမပြုမီ ခဏစောင့်ပါ" } },
});

/**
 * Trust-ladder check (not a rate limiter, but same "anti-spam" concern):
 * brand-new reporters (trustScore 0, no prior approved articles) may only have
 * ONE PENDING_REVIEW article at a time. This is enforced in the article
 * controller at submit-time by counting PENDING_REVIEW articles for the user,
 * rather than here, since it needs a DB read against current state.
 */
