import { randomUUID } from "node:crypto";
import path from "node:path";
import type { Response } from "express";
import { DeleteObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "../config/env.js";
import { getR2Client, getR2PublicUrl, isR2Configured } from "../config/r2.js";
import { AppError } from "../middleware/errorMiddleware.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { success } from "../utils/apiResponse.js";

const IMAGE_PREFIX = "products/";
const VIDEO_PREFIX = "products/videos/";

const PRESIGNED_URL_EXPIRES_IN = 900;
const MAX_PRESIGN_BATCH = 50;

const IMAGE_MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/pjpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

const VIDEO_MIME_TO_EXT: Record<string, string> = {
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
  "video/x-msvideo": "avi",
};

function assertR2Configured() {
  if (!isR2Configured()) {
    throw new AppError(
      "Cloudflare R2 is not configured. Set R2_* in backend/.env",
      503,
    );
  }
}

function sanitizeFilename(name: string): string {
  const base = path.basename(name).replace(/[^a-zA-Z0-9._-]/g, "-");
  return base.slice(0, 80) || "file";
}

function normalizeContentType(contentType: string): string {
  const ct = (contentType || "").toLowerCase().trim();
  if (!ct) return "application/octet-stream";
  if (ct in IMAGE_MIME_TO_EXT) return ct;
  if (ct === "image/jpg" || ct === "image/pjpeg") return "image/jpeg";
  return ct;
}

function extFromContentType(contentType: string): string {
  const ct = normalizeContentType(contentType);
  const mimeExt = IMAGE_MIME_TO_EXT[ct] || VIDEO_MIME_TO_EXT[ct];
  if (mimeExt) return mimeExt;
  if (ct === "application/octet-stream") return "bin";
  return ct.split("/").pop() || "bin";
}

function buildImageKeyFromMeta(originalName: string, contentType: string): string {
  const extFromMime = extFromContentType(contentType);
  const fromName = path.extname(originalName).replace(".", "").toLowerCase();
  const ext = extFromMime !== "bin" ? extFromMime : fromName || "bin";
  const safe = sanitizeFilename(originalName.replace(/\.[^.]+$/, ""));
  return `${IMAGE_PREFIX}${randomUUID()}-${safe}.${ext}`;
}

function buildImageKey(file: Express.Multer.File): string {
  return buildImageKeyFromMeta(file.originalname, file.mimetype);
}

function buildVideoKey(file: Express.Multer.File): string {
  const fromMime = VIDEO_MIME_TO_EXT[file.mimetype];
  const fromName = path.extname(file.originalname).replace(".", "").toLowerCase();
  const ext = fromMime || fromName || "mp4";
  const safe = sanitizeFilename(file.originalname.replace(/\.[^.]+$/, ""));
  return `${VIDEO_PREFIX}${randomUUID()}-${safe}.${ext}`;
}

function isProductImageKey(publicId: string): boolean {
  return (
    publicId.startsWith(IMAGE_PREFIX) &&
    !publicId.startsWith(VIDEO_PREFIX) &&
    publicId.length > IMAGE_PREFIX.length
  );
}

function isProductVideoKey(publicId: string): boolean {
  return publicId.startsWith(VIDEO_PREFIX) && publicId.length > VIDEO_PREFIX.length;
}

function isAllowedImage(file: Express.Multer.File): boolean {
  if (IMAGE_MIME_TO_EXT[file.mimetype]) return true;
  const ext = path.extname(file.originalname).replace(".", "").toLowerCase();
  return ["jpg", "jpeg", "png", "webp", "gif"].includes(ext);
}

function collectImageFiles(req: { files?: unknown; file?: Express.Multer.File }): Express.Multer.File[] {
  if (Array.isArray(req.files)) return req.files;
  if (req.files && typeof req.files === "object") {
    return Object.values(req.files as Record<string, Express.Multer.File[]>).flat();
  }
  if (req.file) return [req.file];
  return [];
}

type PresignRequestItem = {
  fileName?: string;
  contentType?: string;
  size?: number;
  kind?: "image" | "video";
};

const ALLOWED_IMAGE_MIMES = new Set(Object.keys(IMAGE_MIME_TO_EXT).concat(["image/jpg", "image/pjpeg"]));

function validatePresignItem(item: PresignRequestItem, index: number) {
  if (!item || typeof item !== "object") {
    throw new AppError(`Item ${index}: invalid presign request`, 400);
  }
  if (!item.fileName || typeof item.fileName !== "string" || item.fileName.trim().length === 0) {
    throw new AppError(`Item ${index}: fileName is required`, 400);
  }
  const kind = item.kind === "video" ? "video" : "image";
  if (kind === "image") {
    const ct = normalizeContentType(item.contentType || "");
    const ext = path.extname(item.fileName).replace(".", "").toLowerCase();
    const extOk = ["jpg", "jpeg", "png", "webp", "gif"].includes(ext);
    const mimeOk = ALLOWED_IMAGE_MIMES.has(ct);
    if (!mimeOk && !extOk) {
      throw new AppError(
        `Item ${index}: unsupported image type "${ct}" (fileName: ${item.fileName}). Use JPEG, PNG, WebP, or GIF.`,
        400,
      );
    }
    if (typeof item.size === "number" && item.size > 50 * 1024 * 1024) {
      throw new AppError(`Item ${index}: image exceeds 50MB max size`, 400);
    }
  }
}

export const presignUploads = asyncHandler(async (req, res: Response) => {
  assertR2Configured();

  const body = req.body as
    | PresignRequestItem
    | PresignRequestItem[]
    | { items?: PresignRequestItem[] }
    | null
    | undefined;

  let items: PresignRequestItem[] = [];
  if (Array.isArray(body)) items = body;
  else if (body && typeof body === "object" && Array.isArray((body as { items?: PresignRequestItem[] }).items)) {
    items = (body as { items: PresignRequestItem[] }).items;
  } else if (body && typeof body === "object" && ("fileName" in body || "contentType" in body)) {
    items = [body as PresignRequestItem];
  }

  if (!items.length) {
    throw new AppError("Provide an array of items or a single item to presign", 400);
  }
  if (items.length > MAX_PRESIGN_BATCH) {
    throw new AppError(`Too many items per presign request (max ${MAX_PRESIGN_BATCH})`, 400);
  }

  items.forEach(validatePresignItem);

  const client = getR2Client();
  const bucket = env.r2.bucketName;

  const results = [];

  for (const item of items) {
    const contentType = normalizeContentType(item.contentType || "application/octet-stream");
    const kind = item.kind === "video" ? "video" : "image";
    const objectKey =
      kind === "video"
        ? (() => {
            const ext = VIDEO_MIME_TO_EXT[contentType]
              || path.extname(item.fileName!).replace(".", "").toLowerCase()
              || "mp4";
            const safe = sanitizeFilename((item.fileName || "video").replace(/\.[^.]+$/, ""));
            return `${VIDEO_PREFIX}${randomUUID()}-${safe}.${ext}`;
          })()
        : buildImageKeyFromMeta(item.fileName!, contentType);

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: objectKey,
      ContentType: contentType,
      ...(typeof item.size === "number" ? { ContentLength: item.size } : {}),
    });

    const uploadUrl = await getSignedUrl(client, command, { expiresIn: PRESIGNED_URL_EXPIRES_IN });
    const publicUrl = getR2PublicUrl(objectKey);

    results.push({
      objectKey,
      publicUrl,
      uploadUrl,
      contentType,
      fileName: item.fileName,
      size: item.size ?? null,
      kind,
      expiresIn: PRESIGNED_URL_EXPIRES_IN,
    });
  }

  return success(res, results, 200, {
    count: results.length,
  });
});

type ConfirmItem = {
  objectKey: string;
  publicUrl: string;
  fileName?: string;
  contentType?: string;
  size?: number;
  width?: number | null;
  height?: number | null;
};

export const confirmUploads = asyncHandler(async (req, res: Response) => {
  assertR2Configured();
  const body = req.body as ConfirmItem | ConfirmItem[] | { items?: ConfirmItem[] } | null | undefined;

  let items: ConfirmItem[] = [];
  if (Array.isArray(body)) items = body;
  else if (body && typeof body === "object" && Array.isArray((body as { items?: ConfirmItem[] }).items)) {
    items = (body as { items: ConfirmItem[] }).items;
  } else if (body && typeof body === "object" && "objectKey" in body) {
    items = [body as ConfirmItem];
  }

  if (!items.length) {
    throw new AppError("Provide at least one confirmed upload", 400);
  }

  if (items.length > 500) {
    throw new AppError("Too many items to confirm in one request (max 500)", 400);
  }

  const confirmed = items.map((item, idx) => {
    if (!item.objectKey || typeof item.objectKey !== "string") {
      throw new AppError(`Item ${idx}: objectKey is required`, 400);
    }
    if (!item.publicUrl || typeof item.publicUrl !== "string") {
      throw new AppError(`Item ${idx}: publicUrl is required`, 400);
    }
    const objKey = item.objectKey.replace(/^\/+/, "");
    if (!isProductImageKey(objKey) && !isProductVideoKey(objKey)) {
      throw new AppError(`Item ${idx}: invalid objectKey scope`, 400);
    }
    if (
      !item.publicUrl.startsWith(env.r2.publicUrl.replace(/\/$/, ""))
      && !item.publicUrl.includes("/products/")
    ) {
      throw new AppError(`Item ${idx}: publicUrl does not match expected R2_PUBLIC_URL`, 400);
    }
    const ext = path.extname(item.objectKey).replace(".", "").toLowerCase();
    return {
      objectKey: objKey,
      publicUrl: item.publicUrl,
      url: item.publicUrl,
      publicId: objKey,
      originalName: item.fileName || path.basename(objKey),
      mimeType: item.contentType || null,
      format: ext,
      bytes: typeof item.size === "number" ? item.size : null,
      width: typeof item.width === "number" ? item.width : null,
      height: typeof item.height === "number" ? item.height : null,
      alt: "",
      isMain: idx === 0,
      sortOrder: idx,
    };
  });

  return success(res, confirmed, 200, {
    count: confirmed.length,
    images: confirmed,
  });
});

export const uploadImages = asyncHandler(async (req, res: Response) => {
  assertR2Configured();
  const incoming = collectImageFiles(req);
  if (!incoming.length) throw new AppError("No images uploaded", 400);

  const files = incoming.filter(isAllowedImage);
  if (!files.length) {
    throw new AppError("Unsupported image type. Use JPEG, PNG, WebP, or GIF.", 400);
  }

  const client = getR2Client();
  const uploaded = [];

  for (const [index, file] of files.entries()) {
    const publicId = buildImageKey(file);
    await client.send(
      new PutObjectCommand({
        Bucket: env.r2.bucketName,
        Key: publicId,
        Body: file.buffer,
        ContentType: file.mimetype || "application/octet-stream",
      }),
    );

    const format =
      IMAGE_MIME_TO_EXT[file.mimetype] ||
      path.extname(file.originalname).replace(".", "").toLowerCase() ||
      file.mimetype.split("/")[1] ||
      "";
    uploaded.push({
      url: getR2PublicUrl(publicId),
      publicId,
      width: null,
      height: null,
      format,
      bytes: file.size,
      originalName: file.originalname,
      mimeType: file.mimetype,
      alt: "",
      isMain: index === 0,
      sortOrder: index,
    });
  }

  return success(res, uploaded, 201, {
    count: uploaded.length,
    images: uploaded,
  });
});

export const uploadVideo = asyncHandler(async (req, res: Response) => {
  assertR2Configured();
  const file = req.file as Express.Multer.File | undefined;
  if (!file) throw new AppError("No video uploaded", 400);

  const allowed = Object.keys(VIDEO_MIME_TO_EXT);
  if (!file.mimetype.startsWith("video/") || !allowed.includes(file.mimetype)) {
    throw new AppError(`Unsupported video type: ${file.mimetype}`, 400);
  }

  const publicId = buildVideoKey(file);
  await getR2Client().send(
    new PutObjectCommand({
      Bucket: env.r2.bucketName,
      Key: publicId,
      Body: file.buffer,
      ContentType: file.mimetype,
      // Original bytes only — no transcode/compress
    }),
  );

  const format =
    VIDEO_MIME_TO_EXT[file.mimetype] ||
    path.extname(file.originalname).replace(".", "").toLowerCase() ||
    file.mimetype.split("/")[1] ||
    "";

  return success(
    res,
    {
      url: getR2PublicUrl(publicId),
      publicId,
      duration: null,
      format,
      width: null,
      height: null,
    },
    201,
  );
});

export const deleteImage = asyncHandler(async (req, res) => {
  assertR2Configured();
  const publicId = String(req.body.publicId || "").replace(/^\/+/, "");
  if (!publicId) throw new AppError("publicId is required", 400);
  if (!isProductImageKey(publicId)) {
    throw new AppError("Invalid image publicId", 400);
  }

  await getR2Client().send(
    new DeleteObjectCommand({
      Bucket: env.r2.bucketName,
      Key: publicId,
    }),
  );

  return success(res, { publicId });
});

export const deleteVideo = asyncHandler(async (req, res) => {
  assertR2Configured();
  const publicId = String(req.body.publicId || "").replace(/^\/+/, "");
  if (!publicId) throw new AppError("publicId is required", 400);
  if (!isProductVideoKey(publicId)) {
    throw new AppError("Invalid video publicId", 400);
  }

  await getR2Client().send(
    new DeleteObjectCommand({
      Bucket: env.r2.bucketName,
      Key: publicId,
    }),
  );

  return success(res, { publicId });
});
