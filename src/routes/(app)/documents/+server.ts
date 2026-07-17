import { createHash } from "node:crypto";
import { mkdir, writeFile, unlink, readdir } from "node:fs/promises";
import { join, isAbsolute } from "node:path";
import { json, error } from "@sveltejs/kit";
import { ingestDocument } from "$lib/server/rag/ingest-document";
import { invalidateKnowledgeGraphCache } from "$lib/server/knowledge-graph/graph-index";
import { db } from "$lib/server/database/database";
import { documents } from "$lib/server/database/schema";
import { inArray } from "drizzle-orm";
import type { RequestHandler } from "./$types";

const DOCUMENTS_DIR = "documents";

async function safeDeleteFile(filePath: string): Promise<void> {
  try {
    await unlink(filePath);
  } catch (err) {
    if ((err as NodeJS.ErrnoException)?.code !== "ENOENT") {
      throw err;
    }
  }
}

async function deleteDocumentFiles(sourcePaths: string[]): Promise<void> {
  await Promise.all(
    sourcePaths.map(async (sourcePath) => {
      const targetPath = isAbsolute(sourcePath)
        ? sourcePath
        : join(process.cwd(), sourcePath);
      await safeDeleteFile(targetPath);
    }),
  );
}

export const POST: RequestHandler = async ({ request }) => {
  const form = await request.formData();
  const upload = form.get("file");

  if (!(upload instanceof File)) {
    throw error(400, "Upload a PDF file.");
  }

  const originalName = upload.name || "document.pdf";
  const isPdfName = originalName.toLowerCase().endsWith(".pdf");
  const buffer = Buffer.from(await upload.arrayBuffer());
  const isPdfContent = buffer.subarray(0, 5).toString() === "%PDF-";

  if (!isPdfName || !isPdfContent) {
    throw error(400, "Only PDF uploads are supported.");
  }

  const contentHash = createHash("sha256").update(buffer).digest("hex");
  const savedName = `${contentHash.slice(0, 16)}.pdf`;
  const savedPath = join(DOCUMENTS_DIR, savedName);

  await mkdir(DOCUMENTS_DIR, { recursive: true });
  await writeFile(savedPath, buffer);

  const result = await ingestDocument({
    filePath: savedPath,
    title: originalName.replace(/\.pdf$/i, "").trim() || originalName,
  });

  return json(result);
};

export const DELETE: RequestHandler = async ({ request }) => {
  const body = await request.json();
  const clearAll = body?.clearAll === true;
  const documentIds = Array.isArray(body?.documentIds)
    ? body.documentIds.filter((id) => typeof id === "string" && id.trim())
    : [];

  if (!clearAll && documentIds.length === 0) {
    throw error(400, "Specify documentIds to delete or set clearAll to true.");
  }

  const documentsToDelete = clearAll
    ? await db.select({ sourcePath: documents.sourcePath }).from(documents)
    : await db
        .select({ sourcePath: documents.sourcePath })
        .from(documents)
        .where(inArray(documents.id, documentIds));

  const sourcePaths = documentsToDelete.map((row) => String(row.sourcePath));

  if (clearAll) {
    await db.delete(documents);
    const directoryEntries = await readdir(DOCUMENTS_DIR, { withFileTypes: true }).catch(
      () => [],
    );
    const filePaths = directoryEntries
      .filter((entry) => entry.isFile())
      .map((entry) => join(DOCUMENTS_DIR, entry.name));
    await Promise.all(filePaths.map(safeDeleteFile));
  } else {
    await db.delete(documents).where(inArray(documents.id, documentIds));
    await deleteDocumentFiles(sourcePaths);
  }

  invalidateKnowledgeGraphCache();

  return json({ deleted: sourcePaths.length });
};