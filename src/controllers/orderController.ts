import { Order } from "../models/Order.js";
import { AppError } from "../middleware/errorMiddleware.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { success } from "../utils/apiResponse.js";

function mapOrder(doc: any) {
  const obj = doc.toObject ? doc.toObject() : doc;
  return {
    id: String(obj._id),
    orderNumber: obj.orderNumber,
    customerId: obj.customer ? String(obj.customer) : "",
    customerName: obj.customerName,
    customerEmail: obj.customerEmail,
    items: (obj.items || []).map((item: any) => ({
      productId: item.product ? String(item.product) : "",
      name: item.name,
      image: item.image,
      quantity: item.quantity,
      price: item.price,
      variation: item.variation,
      size: item.size,
    })),
    date: obj.createdAt,
    subtotal: obj.subtotal,
    discount: obj.discount,
    shipping: obj.shipping,
    total: obj.total,
    payment: capitalize(obj.paymentStatus),
    paymentStatus: obj.paymentStatus,
    status: capitalize(obj.orderStatus),
    orderStatus: obj.orderStatus,
    shippingAddress: obj.shippingAddress,
    billingAddress: obj.billingAddress,
    courier: obj.courier,
    trackingNumber: obj.trackingNumber,
    dispatchDate: obj.dispatchDate,
    notes: obj.notes,
    createdAt: obj.createdAt,
    updatedAt: obj.updatedAt,
  };
}

function capitalize(value: string) {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function decapitalizeStatus(value: string) {
  return value.toLowerCase();
}

async function nextOrderNumber() {
  const count = await Order.countDocuments();
  return `RNB-${2400 + count + 1}`;
}

export const listOrders = asyncHandler(async (req, res) => {
  const page = Number(req.query.page || 1);
  const limit = Number(req.query.limit || 20);
  const search = String(req.query.search || "");
  const status = String(req.query.status || "");
  const payment = String(req.query.payment || "");
  const from = String(req.query.from || "");
  const to = String(req.query.to || "");

  const filter: Record<string, any> = {};
  if (search) {
    filter.$or = [
      { orderNumber: { $regex: search, $options: "i" } },
      { customerName: { $regex: search, $options: "i" } },
      { customerEmail: { $regex: search, $options: "i" } },
    ];
  }
  if (status) filter.orderStatus = decapitalizeStatus(status);
  if (payment) filter.paymentStatus = decapitalizeStatus(payment);
  if (from || to) {
    filter.createdAt = {};
    if (from) filter.createdAt.$gte = new Date(from);
    if (to) filter.createdAt.$lte = new Date(to);
  }

  const total = await Order.countDocuments(filter);
  const items = await Order.find(filter)
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit);

  return success(res, items.map(mapOrder), 200, {
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit) || 0,
    },
  });
});

export const getOrder = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) throw new AppError("Order not found", 404);
  return success(res, mapOrder(order));
});

export const createOrder = asyncHandler(async (req, res) => {
  const body = req.body as Record<string, any>;
  const order = await Order.create({
    ...body,
    orderNumber: await nextOrderNumber(),
    paymentStatus: body.paymentStatus || "pending",
    orderStatus: body.orderStatus || "pending",
  });
  return success(res, mapOrder(order), 201);
});

export const updateOrder = asyncHandler(async (req, res) => {
  const order = await Order.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });
  if (!order) throw new AppError("Order not found", 404);
  return success(res, mapOrder(order));
});

export const updateOrderStatus = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) throw new AppError("Order not found", 404);
  const next = decapitalizeStatus(req.body.orderStatus);
  order.orderStatus = next as typeof order.orderStatus;
  await order.save();
  return success(res, mapOrder(order));
});

export const dispatchOrder = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) throw new AppError("Order not found", 404);
  if (["cancelled", "delivered"].includes(order.orderStatus)) {
    throw new AppError(`Cannot dispatch a ${order.orderStatus} order`, 400);
  }
  const { courier, trackingNumber } = req.body as {
    courier: string;
    trackingNumber: string;
  };
  order.orderStatus = "dispatched";
  order.courier = courier;
  order.trackingNumber = trackingNumber;
  order.dispatchDate = new Date();
  await order.save();
  return success(res, mapOrder(order));
});
