import { Router } from "express";
import * as categoryController from "../controllers/categoryController.js";
import { protect } from "../middleware/authMiddleware.js";
import { validateBody } from "../middleware/validateMiddleware.js";
import { categoryBodySchema, categoryUpdateSchema } from "../validators/categoryValidator.js";

const router = Router();

router.get("/", categoryController.listCategories);
router.post("/catalog-sync", protect, categoryController.syncCatalog);
router.get("/:id", categoryController.getCategory);
router.post("/", protect, validateBody(categoryBodySchema), categoryController.createCategory);
router.put("/:id", protect, validateBody(categoryUpdateSchema), categoryController.updateCategory);
router.delete("/:id", protect, categoryController.deleteCategory);

export default router;
