import { Order } from "../models/Order.js";
import { Product } from "../models/Product.js";
import { Customer } from "../models/Customer.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { success } from "../utils/apiResponse.js";

function startOfDay(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function monthsAgo(n: number) {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  return d;
}

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

export const summary = asyncHandler(async (_req, res) => {
  const today = startOfDay();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

  const paidFilter = { paymentStatus: "paid" };

  const [
    totalRevenueAgg,
    totalOrders,
    todayOrders,
    monthlyOrders,
    totalProducts,
    totalCustomers,
  ] = await Promise.all([
    Order.aggregate([
      { $match: paidFilter },
      { $group: { _id: null, total: { $sum: "$total" } } },
    ]),
    Order.countDocuments(),
    Order.countDocuments({ createdAt: { $gte: today } }),
    Order.countDocuments({ createdAt: { $gte: monthStart } }),
    Product.countDocuments({ status: { $ne: "inactive" } }),
    Customer.countDocuments(),
  ]);

  return success(res, {
    totalRevenue: totalRevenueAgg[0]?.total || 0,
    totalOrders,
    todayOrders,
    monthlyOrders,
    totalProducts,
    totalCustomers,
  });
});

export const revenue = asyncHandler(async (req, res) => {
  const range = String(req.query.range || "30d");
  let from = daysAgo(30);
  if (range === "7d") from = daysAgo(7);
  if (range === "3m") from = monthsAgo(3);
  if (range === "6m") from = monthsAgo(6);
  if (range === "1y") from = monthsAgo(12);

  const groupFormat =
    range === "7d" || range === "30d"
      ? { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }
      : { $dateToString: { format: "%Y-%m", date: "$createdAt" } };

  const series = await Order.aggregate([
    { $match: { createdAt: { $gte: from } } },
    {
      $group: {
        _id: groupFormat,
        revenue: {
          $sum: {
            $cond: [{ $eq: ["$paymentStatus", "paid"] }, "$total", 0],
          },
        },
        orders: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  return success(res, {
    range,
    series: series.map((row) => ({
      label: row._id,
      revenue: row.revenue,
      orders: row.orders,
    })),
  });
});

export const recentOrders = asyncHandler(async (req, res) => {
  const limit = Number(req.query.limit || 8);
  const items = await Order.find().sort({ createdAt: -1 }).limit(limit);
  return success(
    res,
    items.map((obj) => ({
      id: String(obj._id),
      orderNumber: obj.orderNumber,
      customerName: obj.customerName,
      customerEmail: obj.customerEmail,
      date: obj.createdAt,
      total: obj.total,
      payment: obj.paymentStatus,
      status: obj.orderStatus,
      items: obj.items,
    })),
  );
});

export const topProducts = asyncHandler(async (req, res) => {
  const limit = Number(req.query.limit || 5);
  const rows = await Order.aggregate([
    { $unwind: "$items" },
    {
      $group: {
        _id: "$items.name",
        orders: { $sum: "$items.quantity" },
        revenue: {
          $sum: { $multiply: ["$items.quantity", "$items.price"] },
        },
        image: { $first: "$items.image" },
      },
    },
    { $sort: { revenue: -1 } },
    { $limit: limit },
  ]);

  return success(
    res,
    rows.map((row) => ({
      name: row._id,
      orders: row.orders,
      revenue: row.revenue,
      image: row.image,
    })),
  );
});

export const lowStock = asyncHandler(async (req, res) => {
  const threshold = Number(req.query.threshold || 10);
  const items = await Product.find({
    stock: { $lte: threshold },
    status: { $ne: "inactive" },
  })
    .sort({ stock: 1 })
    .limit(20);

  return success(
    res,
    items.map((p) => ({
      id: String(p._id),
      name: p.name,
      stock: p.stock,
      status: p.stock <= 0 ? "out_of_stock" : "low_stock",
      image: p.images?.[0]?.url || "",
      sku: p.sku,
    })),
  );
});
