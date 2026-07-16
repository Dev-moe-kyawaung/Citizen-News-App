/**
 * Article editorial workflow.
 * DRAFT -> PENDING_REVIEW -> PUBLISHED -> FEATURED / ARCHIVED
 *                        \-> REJECTED -> (author revises) -> DRAFT
 *
 * Every transition is validated server-side against both the current status
 * AND the actor's role/ownership — never trust the client-sent "from" status.
 */
import { Response } from "express";
import { PrismaClient, ArticleStatus, Role } from "@prisma/client";
import crypto from "crypto";
import { AuthedRequest } from "../middleware/auth";
import { enqueuePush } from "../jobs/queue";

const prisma = new PrismaClient();

const TRANSITIONS: Record<ArticleStatus, ArticleStatus[]> = {
  DRAFT: ["PENDING_REVIEW"],
  PENDING_REVIEW: ["PUBLISHED", "REJECTED"],
  PUBLISHED: ["FEATURED", "ARCHIVED"],
  FEATURED: ["PUBLISHED", "ARCHIVED"],
  REJECTED: ["DRAFT"],
  ARCHIVED: [],
};

async function transition(
  articleId: string,
  actorId: string,
  to: ArticleStatus,
  opts: { note?: string; reviewerId?: string } = {}
) {
  const article = await prisma.article.findUniqueOrThrow({ where: { id: articleId } });

  if (!TRANSITIONS[article.status].includes(to)) {
    throw Object.assign(new Error(`Cannot move from ${article.status} to ${to}`), { status: 409 });
  }

  const data: any = { status: to };
  if (to === "PENDING_REVIEW") data.submittedAt = new Date();
  if (to === "PUBLISHED") {
    data.publishedAt = article.publishedAt ?? new Date(); // preserve original publish time if re-publishing
    data.reviewerId = opts.reviewerId;
    data.editorNote = null;
  }
  if (to === "REJECTED") {
    data.reviewerId = opts.reviewerId;
    data.editorNote = opts.note ?? "No reason provided";
  }
  if (to === "FEATURED") data.isFeatured = true;
  if (to === "PUBLISHED" && article.status === "FEATURED") data.isFeatured = false;

  const [updated] = await prisma.$transaction([
    prisma.article.update({ where: { id: articleId }, data }),
    prisma.articleAuditLog.create({
      data: { articleId, actorId, fromStatus: article.status, toStatus: to, note: opts.note },
    }),
  ]);

  return updated;
}

/** POST /articles/:id/submit — author only, DRAFT -> PENDING_REVIEW */
export async function submitForReview(req: AuthedRequest, res: Response) {
  const article = await prisma.article.findUnique({ where: { id: req.params.id } });
  if (!article) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Article not found", messageMy: "ဆောင်းပါးမတွေ့ပါ" } });
  if (article.authorId !== req.user!.id) {
    return res.status(403).json({ error: { code: "FORBIDDEN", message: "Not your article", messageMy: "ဤဆောင်းပါးသည် သင့်ဆောင်းပါးမဟုတ်ပါ" } });
  }

  // basic pre-submit content hash for duplicate/spam detection
  const contentHash = crypto.createHash("sha256").update(article.title + article.bodyHtml).digest("hex");
  const dup = await prisma.article.findFirst({
    where: { contentHash, id: { not: article.id }, status: { in: ["PENDING_REVIEW", "PUBLISHED"] } },
  });
  if (dup) {
    return res.status(409).json({ error: { code: "DUPLICATE_CONTENT", message: "This looks like a duplicate of an existing article", messageMy: "ဤဆောင်းပါးသည် ရှိပြီးသားဆောင်းပါးနှင့် ဆင်တူနေပါသည်" } });
  }

  try {
    const updated = await transition(article.id, req.user!.id, "PENDING_REVIEW");
    await prisma.article.update({ where: { id: article.id }, data: { contentHash } });
    res.json(updated);
  } catch (e: any) {
    res.status(e.status ?? 500).json({ error: { code: "TRANSITION_ERROR", message: e.message } });
  }
}

/** POST /articles/:id/approve — Editor+, PENDING_REVIEW -> PUBLISHED */
export async function approveArticle(req: AuthedRequest, res: Response) {
  try {
    const updated = await transition(req.params.id, req.user!.id, "PUBLISHED", { reviewerId: req.user!.id });

    await prisma.notification.create({
      data: {
        userId: updated.authorId,
        type: "ARTICLE_APPROVED",
        title: "Your article was published",
        body: `"${updated.title}" is now live.`,
        data: { articleId: updated.id },
      },
    });
    if (updated.isBreaking) {
      await enqueuePush({ topic: "breaking-news", title: updated.title, articleId: updated.id });
    }
    res.json(updated);
  } catch (e: any) {
    res.status(e.status ?? 500).json({ error: { code: "TRANSITION_ERROR", message: e.message } });
  }
}

/** POST /articles/:id/reject — Editor+, PENDING_REVIEW -> REJECTED */
export async function rejectArticle(req: AuthedRequest, res: Response) {
  const { note } = req.body as { note?: string };
  try {
    const updated = await transition(req.params.id, req.user!.id, "REJECTED", { reviewerId: req.user!.id, note });
    await prisma.notification.create({
      data: {
        userId: updated.authorId,
        type: "ARTICLE_REJECTED",
        title: "Your article needs changes",
        body: note ?? "An editor requested changes before this can be published.",
        data: { articleId: updated.id },
      },
    });
    res.json(updated);
  } catch (e: any) {
    res.status(e.status ?? 500).json({ error: { code: "TRANSITION_ERROR", message: e.message } });
  }
}

/** POST /articles/:id/feature — Editor+, PUBLISHED -> FEATURED */
export async function featureArticle(req: AuthedRequest, res: Response) {
  try {
    res.json(await transition(req.params.id, req.user!.id, "FEATURED"));
  } catch (e: any) {
    res.status(e.status ?? 500).json({ error: { code: "TRANSITION_ERROR", message: e.message } });
  }
}

/** POST /articles/:id/unpublish — Editor+, PUBLISHED|FEATURED -> ARCHIVED (soft, preserves record) */
export async function unpublishArticle(req: AuthedRequest, res: Response) {
  try {
    const updated = await transition(req.params.id, req.user!.id, "ARCHIVED");
    res.json(updated);
  } catch (e: any) {
    res.status(e.status ?? 500).json({ error: { code: "TRANSITION_ERROR", message: e.message } });
  }
}

/**
 * DELETE /articles/:id
 * Reporters: hard-delete allowed only for their own DRAFT/REJECTED articles.
 * Editor/Admin: soft-delete (deletedAt) anything, to preserve public record/audit trail
 * once something has ever been published.
 */
export async function deleteArticle(req: AuthedRequest, res: Response) {
  const article = await prisma.article.findUnique({ where: { id: req.params.id } });
  if (!article) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Article not found", messageMy: "ဆောင်းပါးမတွေ့ပါ" } });

  const isOwner = article.authorId === req.user!.id;
  const isEditorPlus = req.user!.role === Role.EDITOR || req.user!.role === Role.ADMIN;

  if (!isOwner && !isEditorPlus) {
    return res.status(403).json({ error: { code: "FORBIDDEN", message: "Not your article", messageMy: "ဤဆောင်းပါးသည် သင့်ဆောင်းပါးမဟုတ်ပါ" } });
  }

  const neverPublished = !article.publishedAt;
  const ownerCanHardDelete = isOwner && neverPublished && ["DRAFT", "REJECTED"].includes(article.status);

  if (ownerCanHardDelete || (isEditorPlus && neverPublished)) {
    await prisma.article.delete({ where: { id: article.id } });
    return res.status(204).send();
  }

  // Anything that has ever been published: soft-delete only, editor/admin required.
  if (!isEditorPlus) {
    return res.status(403).json({
      error: { code: "FORBIDDEN", message: "Published articles can only be removed by an editor", messageMy: "ထုတ်ဝေပြီးဆောင်းပါးများကို အယ်ဒီတာမှသာ ဖျက်နိုင်သည်" },
    });
  }
  await prisma.article.update({ where: { id: article.id }, data: { deletedAt: new Date(), status: "ARCHIVED" } });
  res.status(204).send();
}
