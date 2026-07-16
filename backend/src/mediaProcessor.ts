/**
 * BullMQ worker: picks up "process-media" jobs, compresses/transcodes,
 * uploads result to the public CDN bucket, updates the Media row.
 * Run separately from the API process: `npm run worker`
 */
import { Worker } from "bullmq";
import { PrismaClient } from "@prisma/client";
import sharp from "sharp";
import { execFile } from "child_process";
import { promisify } from "util";
import { S3Client, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { connection } from "./queue";

const prisma = new PrismaClient();
const s3 = new S3Client({ region: process.env.AWS_REGION });
const execFileAsync = promisify(execFile);

interface ProcessMediaJob {
  mediaId: string;
  stagingKey: string;
  type: "IMAGE" | "VIDEO";
}

async function downloadFromStaging(key: string): Promise<Buffer> {
  const obj = await s3.send(new GetObjectCommand({ Bucket: process.env.S3_STAGING_BUCKET, Key: key }));
  const chunks: Buffer[] = [];
  for await (const chunk of obj.Body as any) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks);
}

async function uploadToPublicCdn(key: string, body: Buffer, contentType: string) {
  await s3.send(new PutObjectCommand({ Bucket: process.env.S3_PUBLIC_BUCKET, Key: key, Body: body, ContentType: contentType, CacheControl: "public, max-age=31536000, immutable" }));
  return `${process.env.CDN_BASE_URL}/${key}`;
}

async function processImage(mediaId: string, stagingKey: string) {
  const input = await downloadFromStaging(stagingKey);

  // Strip EXIF/metadata, cap dimensions, compress — auto-optimized for mobile.
  const full = await sharp(input).rotate().resize({ width: 1600, withoutEnlargement: true }).jpeg({ quality: 78, mozjpeg: true }).toBuffer();
  const thumb = await sharp(input).rotate().resize({ width: 400, withoutEnlargement: true }).jpeg({ quality: 70 }).toBuffer();
  const meta = await sharp(full).metadata();

  const cdnUrl = await uploadToPublicCdn(`media/${mediaId}/full.jpg`, full, "image/jpeg");
  const thumbUrl = await uploadToPublicCdn(`media/${mediaId}/thumb.jpg`, thumb, "image/jpeg");

  await prisma.media.update({
    where: { id: mediaId },
    data: { cdnUrl, thumbnailUrl: thumbUrl, width: meta.width, height: meta.height, processed: true, sizeBytes: full.length },
  });
}

async function processVideo(mediaId: string, stagingKey: string) {
  const input = await downloadFromStaging(stagingKey);
  const tmpIn = `/tmp/${mediaId}-in`;
  const tmpOut = `/tmp/${mediaId}-out.mp4`;
  const tmpThumb = `/tmp/${mediaId}-thumb.jpg`;
  const fs = await import("fs/promises");
  await fs.writeFile(tmpIn, input);

  // Transcode to mobile-friendly H.264/AAC, capped bitrate/resolution.
  await execFileAsync("ffmpeg", [
    "-i", tmpIn, "-vf", "scale=-2:720", "-c:v", "libx264", "-preset", "veryfast",
    "-crf", "26", "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", tmpOut,
  ]);
  // Grab a thumbnail frame at 1s.
  await execFileAsync("ffmpeg", ["-i", tmpOut, "-ss", "00:00:01", "-vframes", "1", tmpThumb]);

  const outBuf = await fs.readFile(tmpOut);
  const thumbBuf = await fs.readFile(tmpThumb);

  const cdnUrl = await uploadToPublicCdn(`media/${mediaId}/video.mp4`, outBuf, "video/mp4");
  const thumbUrl = await uploadToPublicCdn(`media/${mediaId}/thumb.jpg`, thumbBuf, "image/jpeg");

  await prisma.media.update({
    where: { id: mediaId },
    data: { cdnUrl, thumbnailUrl: thumbUrl, processed: true, sizeBytes: outBuf.length },
  });

  await Promise.all([fs.unlink(tmpIn), fs.unlink(tmpOut), fs.unlink(tmpThumb)]);
}

export const mediaWorker = new Worker<ProcessMediaJob>(
  "process-media",
  async (job) => {
    const { mediaId, stagingKey, type } = job.data;
    if (type === "IMAGE") await processImage(mediaId, stagingKey);
    else await processVideo(mediaId, stagingKey);
  },
  { connection, concurrency: 3 }
);

mediaWorker.on("failed", (job, err) => {
  console.error(`Media job ${job?.id} failed:`, err.message);
});
