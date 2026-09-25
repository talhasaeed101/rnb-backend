import { connectDatabase } from "../config/database.js";
import { syncCategoryCatalog } from "../services/categoryService.js";

async function seed() {
  await connectDatabase();
  const results = await syncCategoryCatalog();
  for (const row of results) {
    console.log(`${row.created ? "created" : "exists"}  ${row.name}  (${row.id})`);
  }
  console.log(`Synced ${results.length} top-level categories (idempotent).`);
  process.exit(0);
}

seed().catch((error) => {
  console.error(error);
  process.exit(1);
});
