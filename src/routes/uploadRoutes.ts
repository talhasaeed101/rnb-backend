import { Router } from "express";
import multer from "multer";
import * as uploadController from "../controllers/uploadController.js";
import { protect } from "../middleware/authMiddleware.js";

const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB per image
});

const videoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
});

const router = Router();
router.use(protect);
router.post("/images", imageUpload.array("images", 12), uploadController.uploadImages);
router.post("/videos", videoUpload.single("video"), uploadController.uploadVideo);
router.delete("/images", uploadController.deleteImage);
router.delete("/videos", uploadController.deleteVideo);

export default router;
