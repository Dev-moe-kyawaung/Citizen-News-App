# Deployment Guide

## Local Development

**Prerequisites**: Docker, Node 20+, `ffmpeg` installed locally (or in container).

```bash
# 1. Clone and install
cd backend && npm install
cd ../frontend && npm install

# 2. Start local infra (Postgres, Redis, MinIO as S3 stand-in)
docker compose up -d postgres redis minio

# 3. Configure env
cp backend/.env.example backend/.env
# fill in: DATABASE_URL, JWT_ACCESS_SECRET, REDIS_URL, S3_* vars pointing at MinIO,
#          FCM service account JSON path, ALLOWED_ORIGINS

# 4. Migrate DB
cd backend && npx prisma migrate dev --name init

# 5. Run API + worker (two terminals)
npm run dev
npm run worker

# 6. Run mobile app
cd ../frontend
npx react-native run-ios      # or run-android
```

### docker-compose.yml (dev)
```yaml
services:
  postgres:
    image: postgres:16
    environment:
      POSTGRES_PASSWORD: devpass
      POSTGRES_DB: citizen_news
    ports: ["5432:5432"]
    volumes: ["pgdata:/var/lib/postgresql/data"]
  redis:
    image: redis:7
    ports: ["6379:6379"]
  minio:
    image: minio/minio
    command: server /data --console-address ":9001"
    ports: ["9000:9000", "9001:9001"]
    environment:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD: minioadmin
volumes:
  pgdata:
```

---

## Production (AWS reference — DO App Platform / GCP Cloud Run are equally viable, same shape)

### Infra checklist
1. **RDS PostgreSQL** (Multi-AZ for prod) — apply Prisma migrations via CI on deploy.
2. **ElastiCache Redis** — BullMQ job queue + rate-limit store.
3. **S3 buckets**: one private `staging` bucket (pre-processed uploads), one
   public `media` bucket behind **CloudFront** (CDN).
4. **ECS Fargate** (or equivalent): two services —
   - `api` service (the Express app, autoscaled on CPU/req count)
   - `worker` service (BullMQ workers: media processing, push, digest) — scale
     separately since video transcoding is CPU-heavy and bursty.
5. **Application Load Balancer** in front of `api`, ACM cert, HTTPS only.
6. **Firebase Cloud Messaging** project for push (Android native + iOS via APNs
   key uploaded to Firebase console).
7. **Secrets Manager / Parameter Store** for all credentials — never in image.
8. **CloudWatch** alarms: 5xx rate, queue depth (BullMQ), RDS CPU/connections.

### CI/CD (GitHub Actions, sketch)
```yaml
on:
  push:
    branches: [main]
jobs:
  deploy:
    steps:
      - checkout
      - build & test backend
      - docker build -t api:$GIT_SHA ./backend
      - push to ECR
      - run `prisma migrate deploy` against RDS (as a one-off ECS task)
      - update ECS service (api + worker) to new task definition
      - build & submit RN app to TestFlight / Play Internal Track (separate
        workflow, gated on manual approval for store releases)
```

### Environment variables (backend)
```
DATABASE_URL=
JWT_ACCESS_SECRET=
JWT_REFRESH_SECRET=
REDIS_URL=
AWS_REGION=
S3_STAGING_BUCKET=
S3_PUBLIC_BUCKET=
CDN_BASE_URL=
FCM_SERVICE_ACCOUNT_JSON=
ALLOWED_ORIGINS=
PORT=4000
```

### Scaling notes
- Video transcoding is the heaviest job — give the `worker` service its own
  autoscaling policy keyed on **BullMQ queue depth**, not CPU, since ffmpeg
  jobs are bursty.
- Move from Postgres full-text search to **Meilisearch/Elasticsearch** once
  article volume passes roughly 50–100k rows or search latency degrades.
- Add a **read replica** for RDS once admin analytics queries start competing
  with feed read traffic.
- CloudFront cache TTL on `/media/*` should be long (immutable content-hashed
  paths); cache API responses only at the edge for public `GET /articles`
  list endpoints with a short TTL (30–60s) + stale-while-revalidate.

### Store submission notes (bilingual specific)
- App Store/Play listing should be submitted with **both English and Myanmar**
  localized metadata (title, description, screenshots) — this is a distinct
  step from in-app i18n and often missed.
- Ensure Myanmar font files (Noto Sans Myanmar / Pyidaungsu) are bundled in
  the app binary, not downloaded at runtime — Myanmar users are disproportionately
  on lower-end devices/slower connections.
