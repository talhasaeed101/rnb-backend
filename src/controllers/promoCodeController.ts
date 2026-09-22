import { PromoCode } from "../models/PromoCode.js";
import { AppError } from "../middleware/errorMiddleware.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { success } from "../utils/apiResponse.js";

function resolveStatus(promo: any) {
  if (promo.status === "inactive") return "inactive";
  if (new Date(promo.expiryDate) < new Date()) return "expired";
  return promo.status;
}

function mapPromo(doc: any) {
  const obj = doc.toObject ? doc.toObject() : doc;
  const status = resolveStatus(obj);
  return {
    id: String(obj._id),
    code: obj.code,
    discountType: obj.discountType,
    discountValue: obj.discountValue,
    minOrder: obj.minimumOrder,
    minimumOrder: obj.minimumOrder,
    maxDiscount: obj.maximumDiscount,
    maximumDiscount: obj.maximumDiscount,
    usageLimit: obj.usageLimit,
    usageCount: obj.usedCount,
    usedCount: obj.usedCount,
    startDate: obj.startDate,
    expiryDate: obj.expiryDate,
    status,
    createdAt: obj.createdAt,
    updatedAt: obj.updatedAt,
  };
}

export const listPromoCodes = asyncHandler(async (_req, res) => {
  const items = await PromoCode.find().sort({ createdAt: -1 });
  return success(res, items.map(mapPromo));
});

export const getPromoCode = asyncHandler(async (req, res) => {
  const item = await PromoCode.findById(req.params.id);
  if (!item) throw new AppError("Promo code not found", 404);
  return success(res, mapPromo(item));
});

export const createPromoCode = asyncHandler(async (req, res) => {
  const body = req.body as Record<string, any>;
  const code = String(body.code).toUpperCase().trim();
  const exists = await PromoCode.findOne({ code });
  if (exists) throw new AppError("Promo code already exists", 409);
  const item = await PromoCode.create({
    code,
    discountType: body.discountType,
    discountValue: body.discountValue,
    minimumOrder: body.minimumOrder ?? body.minOrder ?? 0,
    maximumDiscount: body.maximumDiscount ?? body.maxDiscount ?? null,
    usageLimit: body.usageLimit ?? 0,
    startDate: body.startDate,
    expiryDate: body.expiryDate,
    status: body.status || "active",
  });
  return success(res, mapPromo(item), 201);
});

export const updatePromoCode = asyncHandler(async (req, res) => {
  const body = req.body as Record<string, any>;
  const item = await PromoCode.findById(req.params.id);
  if (!item) throw new AppError("Promo code not found", 404);
  if (body.code) {
    const code = String(body.code).toUpperCase().trim();
    const clash = await PromoCode.findOne({ code, _id: { $ne: item._id } });
    if (clash) throw new AppError("Promo code already exists", 409);
    item.code = code;
  }
  if (body.discountType !== undefined) item.discountType = body.discountType;
  if (body.discountValue !== undefined) item.discountValue = body.discountValue;
  if (body.minimumOrder !== undefined || body.minOrder !== undefined) {
    item.minimumOrder = body.minimumOrder ?? body.minOrder;
  }
  if (body.maximumDiscount !== undefined || body.maxDiscount !== undefined) {
    item.maximumDiscount = body.maximumDiscount ?? body.maxDiscount;
  }
  if (body.usageLimit !== undefined) item.usageLimit = body.usageLimit;
  if (body.startDate !== undefined) item.startDate = body.startDate;
  if (body.expiryDate !== undefined) item.expiryDate = body.expiryDate;
  if (body.status !== undefined) item.status = body.status;
  await item.save();
  return success(res, mapPromo(item));
});

export const deletePromoCode = asyncHandler(async (req, res) => {
  const item = await PromoCode.findById(req.params.id);
  if (!item) throw new AppError("Promo code not found", 404);
  item.status = "inactive";
  await item.save();
  return success(res, mapPromo(item));
});

export const validatePromoCode = asyncHandler(async (req, res) => {
  const { code, orderTotal = 0 } = req.body as {
    code: string;
    orderTotal?: number;
  };
  const item = await PromoCode.findOne({ code: code.toUpperCase().trim() });
  if (!item) throw new AppError("Invalid promo code", 404);
  const status = resolveStatus(item);
  if (status !== "active") throw new AppError("Promo code is not active", 400);
  if (item.usageLimit > 0 && item.usedCount >= item.usageLimit) {
    throw new AppError("Promo code usage limit reached", 400);
  }
  if (orderTotal < item.minimumOrder) {
    throw new AppError(
      `Minimum order of ${item.minimumOrder} required`,
      400,
    );
  }

  let discount =
    item.discountType === "percentage"
      ? (orderTotal * item.discountValue) / 100
      : item.discountValue;
  if (item.maximumDiscount != null) {
    discount = Math.min(discount, item.maximumDiscount);
  }

  return success(res, {
    code: item.code,
    discountType: item.discountType,
    discountValue: item.discountValue,
    discount,
  });
});
