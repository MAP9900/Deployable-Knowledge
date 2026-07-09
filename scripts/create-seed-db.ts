import { copyFile, stat } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { createClient } from "@libsql/client";

const runtimeDb = resolve("app.db");
const seedDb = resolve("app.db.seed");

async function main(): Promise<void> {
  await copyFile(runtimeDb, seedDb);

  const db = createClient({ url: `file:${seedDb}` });
  try {
    await db.execute(`
      DELETE FROM document_chunks
      WHERE document_id NOT IN (
        SELECT id FROM documents
        WHERE source_path LIKE '%documents\\corpus%'
           OR source_path LIKE '%documents/corpus%'
      )
    `);

    await db.execute(`
      DELETE FROM documents
      WHERE source_path NOT LIKE '%documents\\corpus%'
        AND source_path NOT LIKE '%documents/corpus%'
    `);

    const keptDocuments = await db.execute("SELECT id, source_path FROM documents");
    for (const row of keptDocuments.rows) {
      const id = String(row.id);
      const sourcePath = String(row.source_path);
      await db.execute({
        sql: "UPDATE documents SET source_path = ? WHERE id = ?",
        args: [`documents/corpus/${basename(sourcePath)}`, id],
      });
    }

    await db.execute("VACUUM");

    const documents = await db.execute("SELECT id, title, source_path FROM documents ORDER BY title");
    const chunks = await db.execute("SELECT COUNT(*) AS count FROM document_chunks");
    const size = await stat(seedDb);

    console.log("Created app.db.seed");
    console.log(JSON.stringify({
      seedDb,
      bytes: size.size,
      documents: documents.rows,
      chunkCount: Number(chunks.rows[0]?.count ?? 0),
    }, null, 2));
  } finally {
    db.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
