import { access, copyFile } from "node:fs/promises";
import { resolve } from "node:path";

const seedDb = resolve("app.db.seed");
const runtimeDb = resolve("app.db");
const force = process.argv.includes("--force");

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function main(): Promise<void> {
  if (!(await exists(seedDb))) {
    throw new Error("Missing app.db.seed. Build it with npm run seed:database after ingesting the corpus.");
  }

  if ((await exists(runtimeDb)) && !force) {
    console.log("app.db already exists; leaving it unchanged. Use npm run seed:restore -- --force to overwrite it.");
    return;
  }

  await copyFile(seedDb, runtimeDb);
  console.log(`Restored seeded database from ${seedDb} to ${runtimeDb}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
