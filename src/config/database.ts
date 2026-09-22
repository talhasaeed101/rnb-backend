import mongoose from "mongoose";
import { assertDbName, env } from "./env.js";

let connecting: Promise<void> | null = null;

export async function connectDatabase(): Promise<void> {
  // Already connected (reuse across Vercel warm invocations).
  if (mongoose.connection.readyState === 1) return;

  if (!connecting) {
    connecting = (async () => {
      const dbName = assertDbName(env.mongoUri);
      mongoose.set("strictQuery", true);
      await mongoose.connect(env.mongoUri, {
        serverSelectionTimeoutMS: 10_000,
      });
      console.log(`MongoDB connected: ${dbName}`);
    })().finally(() => {
      connecting = null;
    });
  }

  await connecting;
}
