import { useState, useCallback } from "react";
import { apiClient } from "../services/apiClient";

interface Asset {
  uri: string;
  type?: string;
  fileSize?: number;
  fileName?: string;
}

/**
 * Uploads directly to S3 via a presigned URL (never proxies file bytes through
 * our API server), then registers the upload against the article so the
 * backend worker can pick it up for compression/transcoding.
 */
export function useMediaUpload() {
  const [uploadProgress, setUploadProgress] = useState(0);

  const uploadMedia = useCallback(async (asset: Asset) => {
    setUploadProgress(0);
    const mimeType = asset.type ?? "image/jpeg";
    const sizeBytes = asset.fileSize ?? 0;

    // 1. Ask backend for a presigned PUT URL
    const { uploadUrl, key, type } = await apiClient
      .post("/media/presign", { mimeType, sizeBytes })
      .then((r) => r.data);

    // 2. Upload directly to S3 with progress tracking
    const fileBlob = await fetch(asset.uri).then((r) => r.blob());
    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("PUT", uploadUrl);
      xhr.setRequestHeader("Content-Type", mimeType);
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) setUploadProgress(Math.round((e.loaded / e.total) * 100));
      };
      xhr.onload = () => (xhr.status < 300 ? resolve() : reject(new Error("Upload failed")));
      xhr.onerror = () => reject(new Error("Upload failed"));
      xhr.send(fileBlob);
    });

    // 3. Register the staged upload — backend enqueues processing job
    const media = await apiClient.post("/media/register", { key, type }).then((r) => r.data);
    setUploadProgress(100);
    return media as { id: string; type: string };
  }, []);

  return { uploadMedia, uploadProgress };
}
