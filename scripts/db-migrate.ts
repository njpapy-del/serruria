// Usage : DATABASE_URL=… npx tsx scripts/db-migrate.ts up|down
import { getSql } from "@/lib/db/sql";
import { migrateDown, migrateUp } from "@/lib/db/migrate";

async function main() {
  const sql = getSql();
  if (!sql) throw new Error("DATABASE_URL absente");
  const dir = process.argv[2] ?? "up";
  if (dir === "up") console.log("appliquées :", await migrateUp(sql));
  else if (dir === "down") console.log("annulée :", await migrateDown(sql));
  else throw new Error("argument attendu : up ou down");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
