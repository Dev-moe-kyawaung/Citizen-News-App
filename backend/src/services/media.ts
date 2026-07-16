import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import crypto from "crypto";

const s3 = new S3Client({ region: process.env.AWS_REGION });

const ALLOWED_IMAGE_MIME = ["image/jpeg", "image/png", "image/webp"];
const ALLOWED_VIDEO_MIME = ["video/mp4", "video/quicktime"];
const MAX_IMAGE_BYTES = 15 * 1024 * 1024; // 15MB pre-compression cap
const MAX_VIDEO_BYTES = 250 * 1024 * 1024; // 250MB pre-transcode cap

interface PresignInput {
  userId: string;
  mimeType: string;
  sizeBytes: number;
}

/**
 * Returns a presigned PUT URL for direct-to-S3 upload from the client.
 * File lands in a private "staging" prefix; a worker job then validates
 * (MIME sniff, not just header), transcodes/compresses, strips metadata,
 * and moves the result to the public CDN-backed bucket/prefix.
 * We never serve directly from the staging area.
 */
export async function getPresignedUpload({ userId, mimeType, sizeBytes }: PresignInput) {
  const isImage = ALLOWED_IMAGE_MIME.includes(mimeType);
  const isVideo = ALLOWED_VIDEO_MIME.includes(mimeType);

  if (!isImage && !isVideo) {
    throw Object.assign(new Error("Unsupported file type"), { status: 400 });
  }
  if (isImage && sizeBytes > MAX_IMAGE_BYTES) {
    throw Object.assign(new Error("Image exceeds 15MB limit"), { status: 400 });
  }
  if (isVideo && sizeBytes > MAX_VIDEO_BYTES) {
    throw Object.assign(new Error("Video exceeds 250MB limit"), { status: 400 });
  }

  const ext = mimeType.split("/")[1];
  const key = `staging/${userId}/${crypto.randomUUID()}.${ext}`;

  const command = new PutObjectCommand({
    Bucket: process.env.S3_STAGING_BUCKET,
    Key: key,
    ContentType: mimeType,
    ContentLength: sizeBytes,
  });

  const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 300 }); // 5 min

  return { uploadUrl, key, type: isImage ? "IMAGE" : "VIDEO" };
}

/**
 * Called by the media-processing worker (see jobs/mediaProcessor.ts) after
 * the client confirms upload completion. This is where:
 *  - Sharp compresses/resizes images (multiple responsive sizes) and strips EXIF
 *  - FFmpeg transcodes video to H.264/AAC mp4, generates a thumbnail + preview clip
 *  - Files move from staging (private) -> public CDN bucket
 * See jobs/mediaProcessor.ts for the actual worker implementation.
 */
export const MEDIA_PROCESSING_NOTE = "See src/jobs/mediaProcessor.ts for the BullMQ worker.";
