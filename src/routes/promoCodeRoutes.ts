import { Router } from "express";
import * as promoController from "../controllers/promoCodeController.js";
import { protect } from "../middleware/authMiddleware.js";
import { validateBody } from "../middleware/validateMiddleware.js";
import {
  promoBodySchema,
  promoValidateSchema,
} from "../validators/promoCodeValidator.js";

const router = Router();

router.post("/validate", validateBody(promoValidateSchema), promoController.validatePromoCode);
router.use(protect);
router.get("/", promoController.listPromoCodes);
router.get("/:id", promoController.getPromoCode);
router.post("/", validateBody(promoBodySchema), promoController.createPromoCode);
router.put("/:id", validateBody(promoBodySchema.partial()), promoController.updatePromoCode);
router.delete("/:id", promoController.deletePromoCode);

export default router;
