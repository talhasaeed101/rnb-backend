import { Router } from "express";
import * as productController from "../controllers/productController.js";
import { protect } from "../middleware/authMiddleware.js";
import { validateBody, validateQuery } from "../middleware/validateMiddleware.js";
import {
  productBodySchema,
  productQuerySchema,
} from "../validators/productValidator.js";

const router = Router();

router.get("/", validateQuery(productQuerySchema), productController.listProducts);
router.get("/id/:id", productController.getProductById);
router.get("/:slug", productController.getProductBySlug);
router.post("/", protect, validateBody(productBodySchema), productController.createProduct);
router.put("/:id", protect, validateBody(productBodySchema.partial()), productController.updateProduct);
router.delete("/:id", protect, productController.deleteProduct);

export default router;
