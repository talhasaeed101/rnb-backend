import { Router } from "express";
import * as dashboardController from "../controllers/dashboardController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = Router();
router.use(protect);
router.get("/summary", dashboardController.summary);
router.get("/revenue", dashboardController.revenue);
router.get("/recent-orders", dashboardController.recentOrders);
router.get("/top-products", dashboardController.topProducts);
router.get("/low-stock", dashboardController.lowStock);

export default router;
