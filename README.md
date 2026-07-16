# Citizen News — Bilingual Citizen Journalism App

A CNN-style news app where any user can report, but publishing goes through a
real editorial workflow: **Draft → Pending Review → Published/Rejected → Featured**.
Fully bilingual (English + Myanmar), mobile-first, role-based access control.

## What's in this package

```
citizen-news-app/
├── docs/
│   ├── ARCHITECTURE.md      ← full system design, roles, workflow, security
│   ├── API_ENDPOINTS.md     ← complete REST API reference
│   └── DEPLOYMENT.md        ← local dev + AWS production deployment
├── backend/                 ← Node.js + Express + Prisma + PostgreSQL
│   ├── prisma/schema.prisma ← full DB schema (users, articles, media, comments...)
│   └── src/
│       ├── controllers/     ← auth.ts, articleWorkflow.ts (the editorial state machine)
│       ├── middleware/      ← auth.ts (RBAC), rateLimit.ts (anti-spam)
│       ├── services/media.ts← presigned S3 upload
│       ├── jobs/            ← BullMQ workers: media transcode, push, digest
│       └── routes/articles.ts
└── frontend/                ← React Native + TypeScript
    └── src/
        ├── i18n/            ← react-i18next, full en/my locale JSON
        ├── hooks/
        │   ├── useScriptAwareStyle.ts   ← Myanmar-aware font/line-height logic
        │   └── useMediaUpload.ts        ← client-side presigned upload
        ├── theme/           ← light/dark tokens
        └── screens/
            ├── HomeFeedScreen.tsx        ← breaking/trending/categories feed
            ├── ArticleEditorScreen.tsx   ← create/edit + submit for review
            └── ReviewQueueScreen.tsx     ← editor approve/reject UI
```

## Start here

1. Read `docs/ARCHITECTURE.md` for the full system design and the roles/workflow rules.
2. Read `docs/API_ENDPOINTS.md` for the complete route list.
3. Follow `docs/DEPLOYMENT.md` to run it locally.

## What's scaffolded vs. what you'll still build out

**Fully implemented as reference code**: DB schema, auth (register/login/refresh
with rotation), RBAC middleware, the full article editorial state machine
(submit/approve/reject/feature/delete with audit logging), rate limiting,
presigned media upload + a working ffmpeg/sharp processing worker, i18n setup
with real EN/MY strings, the Myanmar font-rendering hook, and three complete
screens (feed, editor, review queue).

**Stubbed / referenced but not written line-by-line** (standard CRUD, follows
the same patterns as the code above, so it's mechanical rather than novel):
`controllers/articles.ts` list/get/create/update handlers, comments routes,
categories CRUD, notifications routes, admin analytics queries, the
`RichTextEditor`/`CategoryPicker`/`TagInput` components, and the remaining
screens listed in the architecture doc (Article Detail, Search, Reporter
Profile, Admin Dashboard, Settings). Say the word if you want any of these
built out fully next — happy to keep going screen by screen or endpoint by
endpoint.
