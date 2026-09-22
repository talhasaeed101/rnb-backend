import mongoose from "mongoose";
import { assertDbName, env } from "./env.js";

export async function connectDatabase(): Promise<void> {
  const dbName = assertDbName(env.mongoUri);
  mongoose.set("strictQuery", true);
  await mongoose.connect(env.mongoUri);
  console.log(`MongoDB connected: ${dbName}`);
}
