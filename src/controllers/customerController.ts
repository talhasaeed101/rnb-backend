import { Customer } from "../models/Customer.js";
import { Order } from "../models/Order.js";
import { AppError } from "../middleware/errorMiddleware.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { success } from "../utils/apiResponse.js";

function mapCustomer(doc: any) {
  const obj = doc.toObject ? doc.toObject() : doc;
  return {
    id: String(obj._id),
    name: obj.name,
    email: obj.email,
    phone: obj.phone,
    addresses: obj.addresses || [],
    ordersCount: obj.totalOrders || 0,
    totalSpent: obj.totalSpent || 0,
    lastOrder: obj.lastOrderAt,
    status: obj.status,
    joinedAt: obj.createdAt,
    createdAt: obj.createdAt,
    updatedAt: obj.updatedAt,
  };
}

export const listCustomers = asyncHandler(async (req, res) => {
  const page = Number(req.query.page || 1);
  const limit = Number(req.query.limit || 20);
  const search = String(req.query.search || "");
  const status = String(req.query.status || "");

  const filter: Record<string, any> = {};
  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: "i" } },
      { email: { $regex: search, $options: "i" } },
      { phone: { $regex: search, $options: "i" } },
    ];
  }
  if (status) filter.status = status;

  const total = await Customer.countDocuments(filter);
  const items = await Customer.find(filter)
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit);

  return success(res, items.map(mapCustomer), 200, {
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit) || 0,
    },
  });
});

export const getCustomer = asyncHandler(async (req, res) => {
  const customer = await Customer.findById(req.params.id);
  if (!customer) throw new AppError("Customer not found", 404);
  const orders = await Order.find({
    $or: [{ customer: customer._id }, { customerEmail: customer.email }],
  })
    .sort({ createdAt: -1 })
    .limit(20);
  return success(res, {
    ...mapCustomer(customer),
    orders: orders.map((o) => ({
      id: String(o._id),
      orderNumber: o.orderNumber,
      total: o.total,
      status: o.orderStatus,
      date: o.createdAt,
    })),
  });
});

export const updateCustomer = asyncHandler(async (req, res) => {
  const customer = await Customer.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });
  if (!customer) throw new AppError("Customer not found", 404);
  return success(res, mapCustomer(customer));
});

export const updateCustomerStatus = asyncHandler(async (req, res) => {
  const customer = await Customer.findById(req.params.id);
  if (!customer) throw new AppError("Customer not found", 404);
  customer.status = req.body.status;
  await customer.save();
  return success(res, mapCustomer(customer));
});
