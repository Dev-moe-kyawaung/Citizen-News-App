import { Queue } from "bullmq";
import IORedis from "ioredis";

export const connection = new IORedis(process.env.REDIS_URL!, { maxRetriesPerRequest: null });

export const mediaQueue = new Queue("process-media", { connection });
export const pushQueue = new Queue("send-push", { connection });
export const digestQueue = new Queue("daily-digest", { connection });

interface PushJob {
  topic?: string; // e.g. "breaking-news" — sent via FCM topic
  userId?: string; // targeted single-user push
  title: string;
  body?: string;
  articleId?: string;
}

export async function enqueuePush(job: PushJob) {
  await pushQueue.add("send-push", job, { attempts: 3, backoff: { type: "exponential", delay: 2000 } });
}

export async function enqueueMediaProcessing(mediaId: string, stagingKey: string, type: "IMAGE" | "VIDEO") {
  await mediaQueue.add("process-media", { mediaId, stagingKey, type }, { attempts: 3, backoff: { type: "exponential", delay: 3000 } });
}

// Repeatable job: daily digest at 07:00 local server time (adjust per deployment TZ)
digestQueue.add("daily-digest", {}, { repeat: { pattern: "0 7 * * *" } });
