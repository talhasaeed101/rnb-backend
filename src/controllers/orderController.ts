import mongoose from "mongoose";
import { Order } from "../models/Order.js";
import { Product } from "../models/Product.js";
import { AppError } from "../middleware/errorMiddleware.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { success } from "../utils/apiResponse.js";
import { sendOrderEmail, sendAdminOrderEmail } from "../utils/email.js";

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
    paymentMethod: obj.paymentMethod,
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
  
  if (!body.items || body.items.length === 0) {
    throw new AppError("Order must contain at least one item", 400);
  }

  let subtotal = 0;
  const validatedItems = [];
  
  for (const item of body.items) {
    const productId = item.product || item.productId;

    // Validate that the productId is a valid MongoDB ObjectId before querying
    if (!productId || !mongoose.Types.ObjectId.isValid(productId)) {
      throw new AppError(
        `Invalid product ID: "${productId}". Each item must have a valid product ID.`,
        400
      );
    }

    const product = await Product.findById(productId);
    if (!product) {
      throw new AppError(`Product not found: ${productId}`, 404);
    }
    if (product.status !== "active") {
      throw new AppError(`Product "${product.name}" is not currently available`, 400);
    }

    const availableStock = product.stock ?? 0;
    if (availableStock < item.quantity) {
      throw new AppError(
        `Not enough stock for "${product.name}". Available: ${availableStock}`,
        400
      );
    }
    
    const price = product.salePrice ?? product.price;
    subtotal += price * item.quantity;
    
    validatedItems.push({
      product: product._id,
      name: product.name,
      image: item.image || (product.images?.[0]?.url ?? ""),
      quantity: item.quantity,
      price: price,
      variation: item.variation || "",
      size: item.size || "",
    });
  }

  const discount = body.discount || 0;
  const shipping = body.shipping || 0;
  const total = subtotal - discount + shipping;

  const orderNumber = await nextOrderNumber();

  const order = await Order.create({
    ...body,
    items: validatedItems,
    subtotal,
    discount,
    shipping,
    total,
    orderNumber,
    paymentMethod: body.paymentMethod || "cod",
    paymentStatus: body.paymentStatus || "pending",
    orderStatus: "pending",
  });

  for (const item of validatedItems) {
    await Product.findByIdAndUpdate(item.product, {
      $inc: { stock: -item.quantity },
    });
  }

  await sendAdminOrderEmail({
    orderNumber: order.orderNumber,
    customerName: order.customerName,
    paymentMethod: order.paymentMethod === "cod" ? "Cash on Delivery" : "Bank Transfer",
    total: order.total,
    itemsCount: validatedItems.length,
  });

  if (order.paymentMethod === "cod") {
    await sendOrderEmail({
      to: order.customerEmail,
      name: order.customerName,
      orderNumber: order.orderNumber,
      status: "Placed",
      total: order.total,
    });
  }

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
  
  await sendOrderEmail({
    to: order.customerEmail,
    name: order.customerName,
    orderNumber: order.orderNumber,
    status: capitalize(order.orderStatus),
    total: order.total,
  });

  return success(res, mapOrder(order));
});

export const verifyPayment = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) throw new AppError("Order not found", 404);
  
  order.paymentStatus = "paid";
  order.orderStatus = "confirmed";
  await order.save();
  
  await sendOrderEmail({
    to: order.customerEmail,
    name: order.customerName,
    orderNumber: order.orderNumber,
    status: "Confirmed",
    total: order.total,
  });

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
  
  await sendOrderEmail({
    to: order.customerEmail,
    name: order.customerName,
    orderNumber: order.orderNumber,
    status: "Dispatched",
    total: order.total,
  });

  return success(res, mapOrder(order));
});
