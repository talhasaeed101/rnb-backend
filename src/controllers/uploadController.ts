import { randomUUID } from "node:crypto";
import path from "node:path";
import type { Response } from "express";
import { DeleteObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { env } from "../config/env.js";
import { getR2Client, getR2PublicUrl, isR2Configured } from "../config/r2.js";
import { AppError } from "../middleware/errorMiddleware.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { success } from "../utils/apiResponse.js";

const IMAGE_PREFIX = "products/";
const VIDEO_PREFIX = "products/videos/";

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

function buildImageKey(file: Express.Multer.File): string {
  const fromMime = IMAGE_MIME_TO_EXT[file.mimetype];
  const fromName = path.extname(file.originalname).replace(".", "").toLowerCase();
  const ext = fromMime || fromName || "bin";
  const safe = sanitizeFilename(file.originalname.replace(/\.[^.]+$/, ""));
  return `${IMAGE_PREFIX}${randomUUID()}-${safe}.${ext}`;
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

function collectImageFiles(req: { files?: unknown; file?: Express.Multer.File }): Express.Multer.File[] {
  if (Array.isArray(req.files)) return req.files;
  if (req.files && typeof req.files === "object") {
    return Object.values(req.files as Record<string, Express.Multer.File[]>).flat();
  }
  if (req.file) return [req.file];
  return [];
}

export const uploadImages = asyncHandler(async (req, res: Response) => {
  assertR2Configured();
  const files = collectImageFiles(req);
  if (!files.length) throw new AppError("No images uploaded", 400);

  const allowed = Object.keys(IMAGE_MIME_TO_EXT);
  for (const file of files) {
    if (!allowed.includes(file.mimetype)) {
      throw new AppError(`Unsupported image type: ${file.mimetype}`, 400);
    }
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
        ContentType: file.mimetype,
      }),
    );

    const format =
      IMAGE_MIME_TO_EXT[file.mimetype] || file.mimetype.split("/")[1] || "";
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
