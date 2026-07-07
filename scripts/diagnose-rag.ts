import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "../src/lib/server/database/database";
import {
  document_chunks,
  documents,
  promptTemplates,
  session_messages,
  settings,
  type SessionMessage,
} from "../src/lib/server/database/schema";
import { searchBm25 } from "../src/lib/server/rag/search/bm25-search";
import { searchHybrid } from "../src/lib/server/rag/search/hybrid-search";
import { retrieveRagContext, type RagRetrievalMode } from "../src/lib/server/rag/search/retrieve-rag-context";
import { searchSemantic } from "../src/lib/server/rag/search/semantic-search";
import { searchKnowledgeGraph } from "../src/lib/server/knowledge-graph";
import { getProvider } from "../src/lib/server/providers/registry";

type Args = {
  query: string;
  mode: RagRetrievalMode;
  topK: number;
  documentIds: string[];
  sessionId: string;
  includeLlm: boolean;
  providerId: string;
  modelId: string;
  maxMessageId: number | null;
};

function readArgs(): Args {
  const args = process.argv.slice(2);
  const get = (name: string) => {
    const prefix = `--${name}=`;
    return args.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
  };

  const mode = get("mode") ?? "graph";
  if (!["semantic", "bm25", "hybrid", "graph"].includes(mode)) {
    throw new Error(`Unsupported mode: ${mode}`);
  }

  return {
    query: get("query") ?? "In one sentence, what does MARCH stand for?",
    mode: mode as RagRetrievalMode,
    topK: Number(get("topK") ?? "5"),
    documentIds: (get("documentIds") ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
    sessionId: get("sessionId") ?? "",
    includeLlm: args.includes("--llm"),
    providerId: get("provider") ?? "",
    modelId: get("model") ?? "",
    maxMessageId: get("maxMessageId") ? Number(get("maxMessageId")) : null,
  };
}

function compact(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function createPrompt(
  messages: SessionMessage[],
  userMessage: string,
  systemPrompt = "",
  persona = "",
  ragContext = "",
) {
  const lines = [];
  const retrievalInstruction = ragContext
    ? [
        "Current retrieved document context for the latest user question:",
        "Use this current retrieved context when it is relevant.",
        "This current retrieved context supersedes earlier assistant answers or earlier statements that an answer was not found.",
        "If the context does not contain the answer, say that clearly.",
        "",
        ragContext,
      ].join("\n")
    : "";
  const systemParts = [systemPrompt, persona]
    .map((part) => part.trim())
    .filter(Boolean);

  if (systemParts.length) lines.push(`system: ${systemParts.join("\n\n")}`);

  for (const message of messages.slice(-20)) {
    lines.push(`${message.role}: ${message.content}`);
  }

  if (retrievalInstruction) lines.push(`system: ${retrievalInstruction}`);

  lines.push(`user: ${userMessage}`, "assistant:");
  return lines.join("\n\n");
}

async function getMessages(sessionId: string, maxMessageId: number | null): Promise<SessionMessage[]> {
  if (!sessionId) return [];

  const rows = await db
    .select()
    .from(session_messages)
    .where(eq(session_messages.sessionId, sessionId))
    .orderBy(asc(session_messages.id));

  return maxMessageId == null
    ? rows
    : rows.filter((message) => Number(message.id) <= maxMessageId);
}

async function getPromptTemplate(userSettings: typeof settings.$inferSelect) {
  if (!userSettings.promptTemplateId?.trim()) return null;

  return await db
    .select()
    .from(promptTemplates)
    .where(
      and(
        eq(promptTemplates.id, userSettings.promptTemplateId.trim()),
        eq(promptTemplates.userId, userSettings.userId),
      ),
    )
    .get();
}

async function printCorpus() {
  const rows = await db
    .select({
      id: documents.id,
      title: documents.title,
      sourcePath: documents.sourcePath,
      updatedAt: documents.updatedAt,
    })
    .from(documents);

  console.log("\n=== CORPUS ===");
  for (const row of rows) {
    const countRows = await db
      .select({ id: document_chunks.id })
      .from(document_chunks)
      .where(eq(document_chunks.documentId, row.id));
    console.log(`${row.title} | chunks=${countRows.length} | id=${row.id} | path=${row.sourcePath}`);
  }
}

async function printFullChunks(chunkIds: string[]) {
  if (!chunkIds.length) return;

  const rows = await db
    .select({
      chunkId: document_chunks.id,
      documentId: document_chunks.documentId,
      title: documents.title,
      pageIndex: document_chunks.pageIndex,
      chunkIndex: document_chunks.chunkIndex,
      chunkType: document_chunks.chunkType,
      content: document_chunks.content,
    })
    .from(document_chunks)
    .innerJoin(documents, eq(documents.id, document_chunks.documentId))
    .where(inArray(document_chunks.id, chunkIds));
  const byId = new Map(rows.map((row) => [row.chunkId, row]));

  console.log("\n=== FULL RETRIEVED CHUNK TEXT ===");
  for (const id of chunkIds) {
    const row = byId.get(id);
    if (!row) continue;
    console.log(`\n--- ${row.title} | page=${Number(row.pageIndex) + 1} | chunk=${row.chunkIndex} | type=${row.chunkType} | id=${id}`);
    console.log(row.content);
  }
}

async function main() {
  const args = readArgs();
  const userSettings = await db
    .select()
    .from(settings)
    .where(eq(settings.id, "local_user"))
    .get();
  if (!userSettings) throw new Error("Missing local_user settings.");

  const mode = args.mode;
  const providerId = args.providerId || userSettings.provider;
  const modelId = args.modelId || userSettings.model;

  console.log("=== QUERY ===");
  console.log(args.query);
  console.log(JSON.stringify({
    mode,
    topK: args.topK,
    documentIds: args.documentIds.length ? args.documentIds : "ALL",
    providerId,
    modelId,
    sessionId: args.sessionId || null,
    maxMessageId: args.maxMessageId,
  }, null, 2));

  await printCorpus();

  const semantic = await searchSemantic({
    query: args.query,
    topK: args.topK,
    documentIds: args.documentIds,
    chunkTypes: ["TEXT", "TABLE"],
  });
  const bm25 = await searchBm25({
    query: args.query,
    topK: args.topK,
    documentIds: args.documentIds,
    chunkTypes: ["TEXT", "TABLE"],
  });
  const hybrid = await searchHybrid({
    query: args.query,
    topK: args.topK,
    documentIds: args.documentIds,
    chunkTypes: ["TEXT", "TABLE"],
  });
  const graph = await searchKnowledgeGraph({
    query: args.query,
    topK: args.topK,
    documentIds: args.documentIds,
    chunkTypes: ["TEXT", "TABLE"],
  });

  const printResults = (label: string, results: Array<{
    chunkId: string;
    sourceTitle: string;
    pageIndex: number;
    chunkIndex: number;
    score: number;
    content: string;
  }>) => {
    console.log(`\n=== ${label} RESULTS ===`);
    results.forEach((match, index) => {
      console.log(`${index + 1}. score=${match.score.toFixed(6)} | ${match.sourceTitle} | page=${match.pageIndex + 1} | chunk=${match.chunkIndex} | id=${match.chunkId}`);
      console.log(`   preview=${compact(match.content).slice(0, 260)}`);
    });
  };

  printResults("SEMANTIC", semantic.results);
  printResults("BM25", bm25.results);
  printResults("HYBRID", hybrid.results);
  printResults("GRAPH", graph.results);

  const ragContext = await retrieveRagContext({
    question: args.query,
    mode,
    topK: args.topK,
    documentIds: args.documentIds,
  });
  const chunkIds = ragContext.sources.map((source) => source.chunkId);
  await printFullChunks(chunkIds);

  const needle = "massive hemorrhage, airway, respirations, circulation, head injury/hypothermia";
  console.log("\n=== CONTEXT CHECKS ===");
  console.log(`source count=${ragContext.sources.length}`);
  console.log(`context chars=${ragContext.contextBlock.length}`);
  console.log(`context contains MARCH definition=${ragContext.contextBlock.toLowerCase().includes(needle.toLowerCase())}`);

  console.log("\n=== FINAL CONTEXT STRING SENT TO PROMPT ===");
  console.log(ragContext.contextBlock);

  const messages = await getMessages(args.sessionId, args.maxMessageId);
  const promptTemplate = await getPromptTemplate(userSettings);
  const prompt = createPrompt(
    messages,
    args.query,
    promptTemplate?.systemPrompt || "",
    userSettings.persona || "",
    ragContext.contextBlock,
  );

  console.log("\n=== FINAL PROMPT SENT TO MODEL ===");
  console.log(prompt);
  console.log("\n=== PROMPT CHECKS ===");
  console.log(`prompt chars=${prompt.length}`);
  console.log(`prompt contains MARCH definition=${prompt.toLowerCase().includes(needle.toLowerCase())}`);

  if (args.includeLlm) {
    console.log("\n=== LLM ANSWER ===");
    const provider = getProvider(providerId);
    let answer = "";
    for await (const chunk of provider.chat(prompt, modelId, {
      temperature: userSettings.temperature,
      topK: userSettings.topK,
      maxTokens: userSettings.maxTokens,
    })) {
      answer += chunk;
    }
    console.log(answer);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
