import { Router } from "express";
import * as categoryController from "../controllers/categoryController.js";
import { protect } from "../middleware/authMiddleware.js";
import { validateBody } from "../middleware/validateMiddleware.js";
import { categoryBodySchema } from "../validators/categoryValidator.js";

const router = Router();

router.get("/", categoryController.listCategories);
router.get("/:id", categoryController.getCategory);
router.post("/", protect, validateBody(categoryBodySchema), categoryController.createCategory);
router.put("/:id", protect, validateBody(categoryBodySchema.partial()), categoryController.updateCategory);
router.delete("/:id", protect, categoryController.deleteCategory);

export default router;
