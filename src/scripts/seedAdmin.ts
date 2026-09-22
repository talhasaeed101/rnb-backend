import bcrypt from "bcryptjs";
import { connectDatabase } from "../config/database.js";
import { env } from "../config/env.js";
import { Admin } from "../models/Admin.js";

async function seed() {
  await connectDatabase();
  const email = env.admin.email.toLowerCase();
  const passwordHash = await bcrypt.hash(env.admin.password, 12);
  const existing = await Admin.findOne({ email });

  if (existing) {
    existing.passwordHash = passwordHash;
    existing.name = env.admin.name;
    existing.status = "active";
    await existing.save();
    console.log(`Admin password updated: ${email}`);
    process.exit(0);
  }

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
