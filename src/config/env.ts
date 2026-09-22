import dotenv from "dotenv";

dotenv.config();

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function parseOrigins(...values: Array<string | undefined>): string[] {
  const origins = new Set<string>();
  for (const value of values) {
    if (!value) continue;
    for (const part of value.split(",")) {
      const origin = part.trim().replace(/\/$/, "");
      if (origin) origins.add(origin);
    }
  }
  return [...origins];
}

export const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT || 5000),
  mongoUri: required("MONGODB_URI"),
  jwtSecret: required("JWT_SECRET", "dev-secret-change-me"),
  clientUrl: process.env.CLIENT_URL || "http://localhost:5173",
  adminUrl: process.env.ADMIN_URL || "http://localhost:5173",
  /** Comma-separated CORS allowlist (CLIENT_URL, ADMIN_URL, ALLOWED_ORIGINS). */
  allowedOrigins: parseOrigins(
    process.env.ALLOWED_ORIGINS,
    process.env.CLIENT_URL || "http://localhost:5173",
    process.env.ADMIN_URL || "http://localhost:5173",
  ),
  r2: {
    accountId: process.env.R2_ACCOUNT_ID || "",
    accessKeyId: process.env.R2_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || "",
    bucketName: process.env.R2_BUCKET_NAME || "",
    publicUrl: process.env.R2_PUBLIC_URL || "",
  },
  admin: {
    name: process.env.ADMIN_NAME || "RNB Admin",
    email: process.env.ADMIN_EMAIL || "admin@rnbcollections.com",
    password: process.env.ADMIN_PASSWORD || "Admin@123",
  },
};

export function assertDbName(uri: string): string {
  const match = uri.match(/\/([^/?]+)(\?|$)/);
  const dbName = match?.[1] || "";
  if (dbName === "zivora") {
    throw new Error("Refusing to connect to Zivora database. Use rnb_collections only.");
  }
  if (dbName && dbName !== "rnb_collections") {
    console.warn(`Warning: MongoDB database name is "${dbName}", expected rnb_collections`);
  }
  return dbName || "rnb_collections";
}
