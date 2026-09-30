import { Router } from "express";
import multer from "multer";
import * as uploadController from "../controllers/uploadController.js";
import { protect } from "../middleware/authMiddleware.js";

const MAX_IMAGE_FILES = 24;
const MAX_IMAGE_BYTES_PER_FILE = 20 * 1024 * 1024;
const MAX_IMAGE_AGGREGATE_BYTES = 40 * 1024 * 1024;
const MAX_VIDEO_BYTES = 150 * 1024 * 1024;

const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_IMAGE_BYTES_PER_FILE,
    files: MAX_IMAGE_FILES,
    fieldSize: MAX_IMAGE_AGGREGATE_BYTES,
  },
});

const videoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_VIDEO_BYTES },
});

const router = Router();
router.use(protect);
router.post("/presign", uploadController.presignUploads);
router.post("/confirm", uploadController.confirmUploads);
router.post("/images", imageUpload.any(), uploadController.uploadImages);
router.post("/videos", videoUpload.single("video"), uploadController.uploadVideo);
router.delete("/images", uploadController.deleteImage);
router.delete("/videos", uploadController.deleteVideo);

export default router;
