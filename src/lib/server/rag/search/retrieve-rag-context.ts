import {
  searchSemantic,
  type SemanticSearchMatch,
} from "./semantic-search";
import {
  searchHybrid,
  type HybridSearchMatch,
} from "./hybrid-search";
import {
  searchBm25,
  type Bm25SearchMatch,
} from "./bm25-search";
import type { SearchChunkType } from "./search-shared";
import {
  searchKnowledgeGraph,
  type KnowledgeGraphMatch,
  type KnowledgeGraphPath,
} from "$lib/server/knowledge-graph";

const DEFAULT_RAG_TOP_K = 5; // Can be adjsuted, number of chunks the LLM recieves 
const MAX_CONTEXT_CHARS = 1200; // Same as chunk size for now
const MAX_PREVIEW_CHARS = 200;
const DEFAULT_RETRIEVAL_MODE =
  process.env.RAG_RETRIEVAL_MODE === "bm25" ? "bm25" :
  process.env.RAG_RETRIEVAL_MODE === "semantic" ? "semantic" :
  process.env.RAG_RETRIEVAL_MODE === "graph" ? "graph" : "hybrid";

export type RagRetrievalMode = "semantic" | "bm25" | "hybrid" | "graph";
type RagMatch = SemanticSearchMatch | Bm25SearchMatch | HybridSearchMatch | KnowledgeGraphMatch;

export type RagSource = {
  title: string;
  description: string;
  documentId: string;
  chunkId: string;
  pageIndex: number;
  chunkIndex: number;
  score: number;
};

export type RagContextResult = {
  mode: RagRetrievalMode;
  contextBlock: string;
  sources: RagSource[];
};

// The prompt gets compact text only. Full chunk content stays in storage/search results
function compactText(text: string, limit: number) {
  const compact = text.replace(/\s+/g, " ").trim();
  if (compact.length <= limit) return compact;
  return `${compact.slice(0, limit).trimEnd()}...`;
}

// Format retrieved chunks as numbered context blocks so answers can cite the matching source
function formatContext(matches: RagMatch[]) {
  if (matches.length === 0) return "";

  const sections = matches.map((match, index) => {
    const content = compactText(match.content, MAX_CONTEXT_CHARS);

    return [
      `[${index + 1}] Title: ${match.sourceTitle}`,
      `Page: ${match.pageIndex + 1}`,
      `Chunk: ${match.chunkIndex}`,
      "Content:",
      content,
    ].join("\n");
  });

  return [
    "Retrieved document context:",
    "",
    ...sections.flatMap((section) => [section, ""]),
  ].join("\n").trim();
}

// Sources are the user-facing citation list, so keep them shorter than the model context
function buildSources(matches: RagMatch[]): RagSource[] {
  return matches.map((match) => ({
    title: match.sourceTitle,
    description: `Page ${match.pageIndex + 1}: ${compactText(match.content, MAX_PREVIEW_CHARS)}`,
    documentId: match.documentId,
    chunkId: match.chunkId,
    pageIndex: match.pageIndex,
    chunkIndex: match.chunkIndex,
    score: match.score,
  }));
}

// Relational paths are appended separately so the model can explain how entities connect.
function formatGraphPaths(paths: KnowledgeGraphPath[]): string {
  if (!paths.length) return "";

  const lines = paths.slice(0, 5).map((path, index) => {
    const chain = path.nodes.map((node, nodeIndex) => {
      if (nodeIndex === 0) return node.label;
      const relation = path.edges[nodeIndex - 1]?.relation ?? "RELATED_TO";
      return `--${relation}--> ${node.label}`;
    }).join(" ");
    return `[Path ${index + 1}] ${chain}`;
  });

  return ["Retrieved knowledge-graph paths:", "", ...lines].join("\n");
}

// Chat uses hybrid by default. Set RAG_RETRIEVAL_MODE=semantic / bm25 to force one path
// May want to switch to hybrid only in the future, kept for now to test/validate
export async function retrieveRagContext({
  question,
  documentIds = [],
  chunkTypes = ["TEXT", "TABLE"],
  topK = DEFAULT_RAG_TOP_K,
  mode = DEFAULT_RETRIEVAL_MODE,
}: {
  question: string;
  documentIds?: string[];
  chunkTypes?: SearchChunkType[];
  topK?: number;
  mode?: RagRetrievalMode;
}): Promise<RagContextResult> {
  // Keep each branch explicit so it is easy to see exactly which retriever is running
  if (mode === "bm25") {
    const search = await searchBm25({
      query: question,
      topK,
      documentIds,
      chunkTypes,
    });

    return {
      mode,
      contextBlock: formatContext(search.results),
      sources: buildSources(search.results),
    };
  }

  if (mode === "hybrid") {
    const search = await searchHybrid({
      query: question,
      topK,
      documentIds,
      chunkTypes,
    });

    return {
      mode,
      contextBlock: formatContext(search.results),
      sources: buildSources(search.results),
    };
  }

  if (mode === "graph") {
    const search = await searchKnowledgeGraph({
      query: question,
      topK,
      documentIds,
      chunkTypes,
    });
    const chunkContext = formatContext(search.results);
    const pathContext = formatGraphPaths(search.paths);

    return {
      mode,
      contextBlock: [chunkContext, pathContext].filter(Boolean).join("\n\n"),
      sources: buildSources(search.results),
    };
  }

  const search = await searchSemantic({
    query: question,
    topK,
    documentIds,
    chunkTypes,
  });

  return {
    mode,
    contextBlock: formatContext(search.results),
    sources: buildSources(search.results),
  };
}
