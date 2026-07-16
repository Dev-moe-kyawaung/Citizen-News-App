import { Router } from "express";
import { Role } from "@prisma/client";
import { requireAuth, requireRole, optionalAuth } from "../middleware/auth";
import { articleCreateLimiter } from "../middleware/rateLimit";
import {
  submitForReview,
  approveArticle,
  rejectArticle,
  featureArticle,
  unpublishArticle,
  deleteArticle,
} from "../controllers/articleWorkflow";
import * as articles from "../controllers/articles"; // CRUD/list/detail — standard REST, omitted here for brevity

const router = Router();

// Public reads
router.get("/", optionalAuth, articles.listPublished);
router.get("/review-queue", requireAuth, requireRole(Role.EDITOR), articles.listReviewQueue);
router.get("/me", requireAuth, requireRole(Role.REPORTER), articles.listMine);
router.get("/:id", optionalAuth, articles.getById);

// Reporter CRUD
router.post("/", requireAuth, requireRole(Role.REPORTER), articleCreateLimiter, articles.create);
router.patch("/:id", requireAuth, requireRole(Role.REPORTER), articles.update);
router.delete("/:id", requireAuth, requireRole(Role.REPORTER), deleteArticle);

// Workflow transitions
router.post("/:id/submit", requireAuth, requireRole(Role.REPORTER), submitForReview);
router.post("/:id/approve", requireAuth, requireRole(Role.EDITOR), approveArticle);
router.post("/:id/reject", requireAuth, requireRole(Role.EDITOR), rejectArticle);
router.post("/:id/feature", requireAuth, requireRole(Role.EDITOR), featureArticle);
router.post("/:id/unpublish", requireAuth, requireRole(Role.EDITOR), unpublishArticle);
router.post("/:id/mark-breaking", requireAuth, requireRole(Role.EDITOR), articles.markBreaking);

// Engagement
router.post("/:id/like", requireAuth, articles.like);
router.delete("/:id/like", requireAuth, articles.unlike);
router.post("/:id/share", requireAuth, articles.recordShare);

export default router;
