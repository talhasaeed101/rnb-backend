import { Router } from "express";
import * as customerController from "../controllers/customerController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = Router();
router.use(protect);
router.get("/", customerController.listCustomers);
router.get("/:id", customerController.getCustomer);
router.put("/:id", customerController.updateCustomer);
router.patch("/:id/status", customerController.updateCustomerStatus);

export default router;
