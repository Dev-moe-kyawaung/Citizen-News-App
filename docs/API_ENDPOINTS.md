# API Endpoints — `/api/v1`

Auth: `Authorization: Bearer <accessToken>` unless marked *(public)*.
Roles shown are the **minimum** role required.

## Auth
| Method | Path | Role | Description |
|---|---|---|---|
| POST | /auth/register | public | Email/password signup |
| POST | /auth/login | public | Email/password login → access+refresh token |
| POST | /auth/social/google | public | Google OAuth token exchange |
| POST | /auth/social/facebook | public | Facebook OAuth token exchange |
| POST | /auth/refresh | public | Rotate refresh token → new access token |
| POST | /auth/logout | Viewer | Revoke refresh token |
| POST | /auth/verify-email | public | Confirm email via token |
| POST | /auth/forgot-password | public | Send reset email |
| POST | /auth/reset-password | public | Reset via token |

## Users / Profiles
| Method | Path | Role | Description |
|---|---|---|---|
| GET | /users/me | Viewer | Current user profile |
| PATCH | /users/me | Viewer | Update profile, language, dark mode |
| GET | /users/:id | public | Public reporter profile |
| POST | /users/:id/follow | Viewer | Follow a reporter |
| DELETE | /users/:id/follow | Viewer | Unfollow |
| GET | /users (admin list, paginated, filter by role) | Admin | User management |
| PATCH | /users/:id/role | Admin | Change role |
| PATCH | /users/:id/suspend | Admin | Suspend/unsuspend |

## Articles
| Method | Path | Role | Description |
|---|---|---|---|
| GET | /articles | public | List published (filters: category, tag, lang, breaking, featured, search, cursor) |
| GET | /articles/:id | public | Article detail (increments view count async) |
| POST | /articles | Reporter | Create draft |
| PATCH | /articles/:id | Reporter (own)/Editor | Edit article |
| DELETE | /articles/:id | Reporter (own, draft/rejected only) / Editor | Delete |
| POST | /articles/:id/submit | Reporter (own) | DRAFT → PENDING_REVIEW |
| POST | /articles/:id/approve | Editor | PENDING_REVIEW → PUBLISHED |
| POST | /articles/:id/reject | Editor | PENDING_REVIEW → REJECTED (+ note) |
| POST | /articles/:id/feature | Editor | PUBLISHED → FEATURED |
| POST | /articles/:id/unpublish | Editor | PUBLISHED → ARCHIVED |
| POST | /articles/:id/mark-breaking | Editor | Toggle isBreaking (triggers push) |
| GET | /articles/me | Reporter | My articles, all statuses |
| GET | /articles/review-queue | Editor | Pending review list |
| POST | /articles/:id/like | Viewer | Like |
| DELETE | /articles/:id/like | Viewer | Unlike |
| POST | /articles/:id/share | Viewer | Log share event |

## Media
| Method | Path | Role | Description |
|---|---|---|---|
| POST | /media/presign | Reporter | Get presigned S3 upload URL |
| POST | /media/:articleId/attach | Reporter | Register uploaded media against article |
| DELETE | /media/:id | Reporter (own)/Editor | Remove media |

## Categories & Tags
| Method | Path | Role | Description |
|---|---|---|---|
| GET | /categories | public | List active categories (bilingual names) |
| POST | /categories | Editor | Create category |
| PATCH | /categories/:id | Editor | Update category |
| DELETE | /categories/:id | Admin | Deactivate category |
| GET | /tags/search?q= | public | Tag autocomplete |

## Comments
| Method | Path | Role | Description |
|---|---|---|---|
| GET | /articles/:id/comments | public | Threaded comments |
| POST | /articles/:id/comments | Viewer | Post comment/reply |
| PATCH | /comments/:id | Viewer (own) | Edit own comment |
| DELETE | /comments/:id | Viewer (own)/Editor | Delete |
| POST | /comments/:id/report | Viewer | Flag for moderation |

## Notifications
| Method | Path | Role | Description |
|---|---|---|---|
| GET | /notifications | Viewer | List (paginated) |
| PATCH | /notifications/:id/read | Viewer | Mark read |
| PATCH | /notifications/read-all | Viewer | Mark all read |
| POST | /devices | Viewer | Register FCM token |
| DELETE | /devices/:token | Viewer | Unregister on logout |

## Admin / Moderation / Analytics
| Method | Path | Role | Description |
|---|---|---|---|
| GET | /admin/reports | Editor | Open content reports queue |
| PATCH | /admin/reports/:id | Editor | Action/dismiss report |
| GET | /admin/analytics/overview | Editor | Views/engagement summary |
| GET | /admin/analytics/top-articles | Editor | Top articles by range |
| GET | /admin/analytics/top-reporters | Editor | Top reporters by engagement |
| GET | /admin/analytics/review-sla | Editor | Avg pending→decision time |
| GET | /admin/audit-log/:articleId | Editor | Full status-change history |

## Search
| Method | Path | Role | Description |
|---|---|---|---|
| GET | /search?q=&lang=&category= | public | Full-text search across published articles |

---

### Standard error shape
```json
{ "error": { "code": "FORBIDDEN", "message": "You cannot edit this article", "messageMy": "..." } }
```
Error messages are bilingual so the client can render directly without a lookup table for common cases.

### Pagination
Cursor-based: `?cursor=<lastId>&limit=20` → response includes `nextCursor`.
