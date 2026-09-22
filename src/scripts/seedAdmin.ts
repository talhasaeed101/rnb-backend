import bcrypt from "bcryptjs";
import { connectDatabase } from "../config/database.js";
import { env } from "../config/env.js";
import { Admin } from "../models/Admin.js";

async function seed() {
  await connectDatabase();
  const email = env.admin.email.toLowerCase();
  const existing = await Admin.findOne({ email });
  if (existing) {
    console.log(`Admin already exists: ${email}`);
    process.exit(0);
  }

  const passwordHash = await bcrypt.hash(env.admin.password, 12);
  await Admin.create({
    name: env.admin.name,
    email,
    passwordHash,
    role: "admin",
    status: "active",
  });

  console.log(`Admin created: ${email}`);
  process.exit(0);
}

seed().catch((error) => {
  console.error(error);
  process.exit(1);
});
