import app from "../src/app.js";
import { connectDatabase } from "../src/config/database.js";

// Warm the DB connection on cold start when possible.
connectDatabase().catch((error) => {
  console.error("Initial MongoDB connect failed:", error);
});

export default app;
