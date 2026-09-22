import { Router } from "express";
import * as orderController from "../controllers/orderController.js";
import { protect } from "../middleware/authMiddleware.js";
import { validateBody, validateQuery } from "../middleware/validateMiddleware.js";
import {
  dispatchSchema,
  orderBodySchema,
  orderQuerySchema,
  orderStatusSchema,
} from "../validators/orderValidator.js";

const router = Router();

router.use(protect);
router.get("/", validateQuery(orderQuerySchema), orderController.listOrders);
router.get("/:id", orderController.getOrder);
router.post("/", validateBody(orderBodySchema), orderController.createOrder);
router.put("/:id", orderController.updateOrder);
router.patch("/:id/status", validateBody(orderStatusSchema), orderController.updateOrderStatus);
router.patch("/:id/dispatch", validateBody(dispatchSchema), orderController.dispatchOrder);

export default router;
