export function shapeCustomer(customer: {
  _id: { toString(): string };
  name: string;
  email: string;
  phone?: string | null;
  emailVerified?: boolean | null;
  authProvider?: string | null;
  status?: string | null;
  createdAt?: Date | null;
}) {
  return {
    id: customer._id.toString(),
    name: customer.name,
    email: customer.email,
    phone: customer.phone || "",
    emailVerified: Boolean(customer.emailVerified),
    authProvider: customer.authProvider || "local",
    status: customer.status || "active",
    createdAt: customer.createdAt ?? undefined,
  };
}
