# Citizen News — Bilingual Citizen Journalism App
### Full Architecture Specification

## 1. System Overview

A CNN-style news app where any user can report news, but publication is gated by an
editorial workflow (Draft → Pending Review → Published/Rejected → Featured).
Fully bilingual (Myanmar + English), mobile-first, role-based.

```
┌─────────────────┐      ┌──────────────────┐      ┌─────────────────┐
│  React Native    │◄────►│   REST API        │◄────►│  PostgreSQL      │
│  (iOS/Android)   │      │   Node.js/Express │      │  (Prisma ORM)    │
└─────────────────┘      │   + Redis (cache/  │      └─────────────────┘
        │                 │     rate limit)   │
        │                 └──────────────────┘
        │                          │
        │                          ▼
        │                 ┌──────────────────┐
        │                 │  S3-compatible    │
        └────────────────►│  Object Storage   │
        (direct upload     │  + CloudFront CDN │
         via presigned URL)└──────────────────┘
                                    │
                          ┌──────────────────┐
                          │  Background Jobs  │
                          │  (BullMQ + Redis) │
                          │  - image/video     │
                          │    transcoding     │
                          │  - push notifs     │
                          │  - digest emails   │
                          └──────────────────┘
```

## 2. Tech Stack

| Layer          | Choice                                   | Why |
|----------------|-------------------------------------------|-----|
| Mobile         | React Native + TypeScript                | Single codebase iOS/Android, huge lib ecosystem |
| State          | Redux Toolkit + RTK Query                | Predictable state, built-in caching/invalidation |
| Navigation     | React Navigation (native-stack + tabs)   | Standard, supports RTL/i18n-aware layouts |
| i18n           | react-i18next                            | Namespace splitting, lazy-load locale bundles |
| Backend        | Node.js + Express + TypeScript           | Matches team familiarity, huge middleware ecosystem |
| ORM/DB         | Prisma + PostgreSQL                      | Relational integrity for roles/workflow/comments |
| Cache/Queue    | Redis + BullMQ                           | Rate limiting, job queue for media processing |
| Auth           | JWT (access+refresh) + bcrypt, optional OAuth (Google/Facebook) | Simple, stateless, standard |
| Storage        | S3-compatible (AWS S3 / DO Spaces / MinIO for self-host) | CDN-ready, presigned direct upload |
| Media pipeline | Sharp (images) + FFmpeg (video transcode/thumbnail) in worker | Auto-compress for mobile |
| Push           | Firebase Cloud Messaging (FCM)           | Cross-platform (Android + iOS via APNs bridge) |
| Search         | PostgreSQL full-text (pg_trgm) → swap to Meilisearch/Elasticsearch at scale | Start simple, upgrade path clear |
| Infra          | Docker Compose (dev) → AWS ECS/Fargate or DO App Platform (prod) | Portable, no vendor lock-in for MVP |

## 3. User Roles & Permissions

| Action                          | Viewer | Reporter | Editor | Admin |
|----------------------------------|:------:|:--------:|:------:|:-----:|
| Read published articles          | ✅ | ✅ | ✅ | ✅ |
| Comment / like / follow          | ✅ | ✅ | ✅ | ✅ |
| Create draft article             | ❌ | ✅ | ✅ | ✅ |
| Submit for review                | ❌ | ✅ | ✅ | ✅ |
| Edit/delete **own** article       | ❌ | ✅ (draft/pending only) | ✅ | ✅ |
| Approve / reject / feature any article | ❌ | ❌ | ✅ | ✅ |
| Edit/delete **any** article        | ❌ | ❌ | ✅ | ✅ |
| Manage categories                | ❌ | ❌ | ✅ | ✅ |
| Manage users / roles             | ❌ | ❌ | ❌ | ✅ |
| View analytics dashboard          | ❌ | own stats only | ✅ | ✅ |
| Moderate comments                | ❌ | ❌ | ✅ | ✅ |

RBAC is enforced via middleware (`requireRole([...])`) plus row-level ownership
checks (`req.user.id === article.authorId`) for the "own content" cases.

## 4. Editorial Workflow (state machine)

```
DRAFT ──(submit)──► PENDING_REVIEW ──(approve)──► PUBLISHED ──(feature)──► FEATURED
  ▲                        │                          │
  │                     (reject)                   (unpublish)
  │                        ▼                          ▼
  └──────────────────  REJECTED                  ARCHIVED
                     (author can revise
                      → back to DRAFT)
```

Rules:
- Only `authorId === user.id` can transition DRAFT → PENDING_REVIEW.
- Only Editor/Admin can transition PENDING_REVIEW → PUBLISHED/REJECTED.
- REJECTED articles store an `editorNote` (reason), visible to the author only.
- PUBLISHED → FEATURED/ARCHIVED is Editor/Admin only.
- Every transition is logged in `ArticleAuditLog` (who, when, from→to, note).
- Deleting: Reporters can hard-delete only DRAFT/REJECTED own articles. Anything
  that has ever been PUBLISHED is soft-deleted (`deletedAt`) to preserve public
  record integrity and audit trail.

## 5. Bilingual Strategy

- **UI strings**: `frontend/src/i18n/locales/{en,my}/*.json`, namespaced by screen
  (`common.json`, `feed.json`, `editor.json`, `admin.json`).
- **Article content**: each `Article` has `language` (`en`|`my`) — an article is
  authored in one language, not force-translated. Optionally a `translationOfId`
  self-relation links an EN/MY pair if a reporter/editor produces both.
- **Font handling**: Myanmar Unicode requires `Noto Sans Myanmar` / `Pyidaungsu`
  bundled as app fonts; font selection is automatic based on detected script in
  the body text (regex range `\u1000-\u109F`) so mixed EN/MY content in the feed
  renders correctly without user action.
- **Layout adaptation**: Myanmar text is glyph-tall (stacked vowels/tone marks) —
  line-height for `my` locale content is set ~1.4–1.6x vs ~1.2x for `en` via a
  `useScriptAwareStyle()` hook that inspects content and returns the right
  line-height/font-family, rather than a single global stylesheet value.
- **Direction**: both languages are LTR, so no RTL mirroring needed — simplifies
  layout considerably vs. e.g. Arabic support.

## 6. High-Level Screens (Mobile)

**Public / Viewer**
1. Onboarding / Language select (first launch)
2. Login / Register (+ social)
3. Home Feed (Breaking banner, Trending rail, Category tabs, infinite scroll)
4. Article Detail (media, body, comments, like/share/follow-reporter)
5. Search & Filters
6. Category Browse
7. Reporter Profile (bio, published articles, follow button)
8. Notifications inbox
9. Settings (language toggle, dark/light, notification prefs)

**Reporter**
10. My Articles (Draft / Pending / Published / Rejected tabs)
11. Article Editor (rich text, media upload, category/tag picker, save draft / submit)
12. My Stats (views, likes, comments per article)

**Editor/Admin**
13. Review Queue (Pending Review list → approve/reject with note)
14. Admin Dashboard (users, categories, analytics, moderation)
15. User Management (role changes, suspend/ban)
16. Category Management (CRUD, bilingual names)
17. Comment Moderation queue

Full component/route breakdown is in the RN scaffold under `frontend/src/screens`.

## 7. API Design

REST, versioned under `/api/v1`. Full endpoint list in `docs/API_ENDPOINTS.md`.
Auth via `Authorization: Bearer <accessToken>`; refresh via httpOnly-cookie or
secure storage refresh token rotation.

## 8. Security & Moderation

- **RBAC** middleware on every mutating route (see §3).
- **Rate limiting**: Redis-backed sliding window — auth endpoints (5/min),
  article creation (10/hour/user), comments (20/min/user).
- **Anti-spam**: 
  - Honeypot field on registration.
  - New accounts limited to 1 pending article until first approval ("trust
    ladder" — limits raise as reporters build a track record).
  - Comment content run through a profanity/spam heuristic filter + optional
    Perspective API toxicity scoring before it's visible (shadow-hold if score
    high, queued for moderator review).
  - Duplicate-content hash check on submit (prevents copy-paste spam floods).
- **Content moderation tools**: report-a-post/comment, moderator queue with
  bulk actions, IP/device-based temp bans, shadow-ban option.
- **Media validation**: MIME sniffing (not just extension), max size caps,
  re-encoding (never serve user-uploaded files directly — always transcode)
  to strip EXIF/metadata and neutralize embedded exploits.
- **Input sanitization**: rich text stored as sanitized HTML (allow-list via
  `sanitize-html`) — never render raw user HTML unsanitized.
- **Secrets**: all in env vars / secrets manager, never in repo.
- **Transport**: HTTPS everywhere, HSTS, JWT short-lived (15 min) + rotating
  refresh tokens (7 days) stored in secure storage (Keychain/Keystore).

## 9. Analytics (Admin Dashboard)

Tracked events (async, batched to a queue, aggregated nightly + real-time
counters in Redis for "views today"):
- `article_view`, `article_like`, `article_share`, `article_comment`
- `reporter_follow`
Dashboard surfaces: top articles (24h/7d/30d), top reporters by engagement,
category performance, review queue SLA (avg time pending→decision), spam/report
volume.

## 10. Deployment

See `docs/DEPLOYMENT.md` for full steps. Summary: Docker Compose for local dev
(Postgres, Redis, MinIO, API, worker); production on AWS ECS Fargate (or DO App
Platform) behind an ALB, RDS Postgres, ElastiCache Redis, S3 + CloudFront,
FCM for push, GitHub Actions CI/CD.
