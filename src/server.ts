import app from "./app.js";
import { connectDatabase } from "./config/database.js";
import { env } from "./config/env.js";

async function start() {
  try {
    await connectDatabase();
    app.listen(env.port, () => {
      console.log(`RNB API listening on http://localhost:${env.port}`);
    });
  } catch (error) {
    console.error("Failed to start RNB API:", error);
    process.exit(1);
  }
}

start();
