import { createHash } from "node:crypto";
import { access, readFile, readdir } from "node:fs/promises";
import { basename, extname, resolve } from "node:path";
import { databaseClient } from "../src/lib/server/database/database";
import { loadKnowledgeGraph } from "../src/lib/server/knowledge-graph/graph-index";
import { ingestDocument } from "../src/lib/server/rag/ingest-document";

type PdfFile = {
  path: string;
  hash: string;
};

async function listPdfs(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const paths = await Promise.all(
    entries.map(async (entry) => {
      const path = resolve(directory, entry.name);
      if (entry.isDirectory()) return listPdfs(path);
      return entry.isFile() && extname(entry.name).toLowerCase() === ".pdf" ? [path] : [];
    }),
  );
  return paths.flat().sort((left, right) => left.localeCompare(right));
}

async function hashPdf(path: string): Promise<PdfFile> {
  const contents = await readFile(path);
  return {
    path,
    hash: createHash("sha256").update(contents).digest("hex"),
  };
}

async function reportManifestGaps(directory: string): Promise<void> {
  const manifestPath = resolve(directory, "manifest.json");
  try {
    await access(manifestPath);
  } catch {
    return;
  }

  const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as unknown;
  if (!Array.isArray(manifest)) return;

  const missing: string[] = [];
  for (const entry of manifest) {
    if (typeof entry !== "string") continue;
    try {
      await access(resolve(directory, entry));
    } catch {
      missing.push(entry);
    }
  }

  if (missing.length) {
    console.warn(`Manifest entries not found: ${missing.join(", ")}`);
  }
}

async function main(): Promise<void> {
  const sourceDirectory = resolve(process.argv[2] ?? resolve(process.cwd(), "..", "data"));
  console.log(`Scanning ${sourceDirectory}`);
  await reportManifestGaps(sourceDirectory);

  const pdfPaths = await listPdfs(sourceDirectory);
  if (!pdfPaths.length) throw new Error(`No PDFs found in ${sourceDirectory}`);

  const files = await Promise.all(pdfPaths.map(hashPdf));
  const uniqueFiles: PdfFile[] = [];
  const firstPathByHash = new Map<string, string>();

  for (const file of files) {
    const duplicateOf = firstPathByHash.get(file.hash);
    if (duplicateOf) {
      console.log(`Skipping duplicate ${basename(file.path)} (same as ${basename(duplicateOf)})`);
      continue;
    }
    firstPathByHash.set(file.hash, file.path);
    uniqueFiles.push(file);
  }

  console.log(`Found ${pdfPaths.length} PDFs (${uniqueFiles.length} unique)`);
  const failures: Array<{ path: string; error: unknown }> = [];
  let storedChunks = 0;

  for (const [index, file] of uniqueFiles.entries()) {
    const name = basename(file.path);
    console.log(`\n[${index + 1}/${uniqueFiles.length}] Ingesting ${name}`);
    try {
      const result = await ingestDocument({
        filePath: file.path,
        title: basename(name, extname(name)),
      });
      storedChunks += result.chunkCount;
      console.log(`Stored ${result.chunkCount} chunks from ${result.pageCount} extracted pages`);
    } catch (error) {
      failures.push({ path: file.path, error });
      console.error(`Failed ${name}:`, error);
    }
  }

  const index = await loadKnowledgeGraph();
  const graphStats = index.graph.stats();
  console.log("\nBulk ingestion complete");
  console.log(JSON.stringify({
    discoveredPdfs: pdfPaths.length,
    uniquePdfs: uniqueFiles.length,
    ingestedPdfs: uniqueFiles.length - failures.length,
    failedPdfs: failures.length,
    storedChunks,
    indexedChunks: index.chunksById.size,
    graphNodes: graphStats.nodes,
    graphEdges: graphStats.edges,
  }, null, 2));

  if (failures.length) process.exitCode = 1;
}

try {
  await main();
} finally {
  databaseClient.close();
}
