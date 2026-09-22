import { Router } from "express";
import rateLimit from "express-rate-limit";
import * as authController from "../controllers/authController.js";
import { protect } from "../middleware/authMiddleware.js";
import { validateBody } from "../middleware/validateMiddleware.js";
import { loginSchema } from "../validators/authValidator.js";

const router = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many login attempts", errors: [] },
});

router.post("/login", loginLimiter, validateBody(loginSchema), authController.login);
router.get("/me", protect, authController.me);
router.post("/logout", protect, authController.logout);

export default router;
