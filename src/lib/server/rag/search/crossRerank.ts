// BERT ReRanker File

import { AutoTokenizer, AutoModelForSequenceClassification } from '@huggingface/transformers';

export interface Document {
  page: string | number;
  source: string;
  text?: string;
  segmentID?: string;
  score?: number;
  [key: string]: unknown;
}

export interface RerankOptions {
  limit?: number;
}

export interface RerankedDocument extends Document {
  score: number;
}

// Global cache for model to avoid reloading on every query
let tokenizer: any = null;
let model: any = null;
let warnedAboutFallback = false;

async function initializeModel(): Promise<void> {
  if (!tokenizer || !model) {
    const modelId = 'Xenova/ms-marco-MiniLM-L-6-v2';
    tokenizer = await AutoTokenizer.from_pretrained(modelId);
    model = await AutoModelForSequenceClassification.from_pretrained(modelId);
  }
}

function documentKey(doc: Document): string {
  if (typeof doc.segmentID === "string" && doc.segmentID.length > 0) {
    return `segment:${doc.segmentID}`;
  }
  return `location:${doc.source}:${doc.page}`;
}

function mergeDocuments(bm25Rank: Document[], vectorRank: Document[]): Map<string, Document> {
  const docs = new Map<string, Document>();

  for (const doc of vectorRank) {
    docs.set(documentKey(doc), { ...doc });
  }

  for (const doc of bm25Rank) {
    const key = documentKey(doc);
    docs.set(key, {
      ...docs.get(key),
      ...doc,
    });
  }

  return docs;
}

function numericScore(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function fallbackRank(candidates: Document[], options: RerankOptions): RerankedDocument[] {
  const maxSemantic = Math.max(1, ...candidates.map((doc) => numericScore(doc.semanticScore)));
  const maxBm25 = Math.max(1, ...candidates.map((doc) => numericScore(doc.bm25Score)));
  const reranked = candidates.map((doc) => ({
    ...doc,
    score: (() => {
      const semanticScore = numericScore(doc.semanticScore);
      const bm25Score = numericScore(doc.bm25Score);
      const semanticPart = semanticScore / maxSemantic;
      const bm25Part = bm25Score / maxBm25;
      const bothSignalsBonus = semanticScore > 0 && bm25Score > 0 ? 0.05 : 0;

      return semanticPart * 0.7 + bm25Part * 0.25 + bothSignalsBonus;
    })(),
  }));

  reranked.sort((left, right) => right.score - left.score);

  if (typeof options.limit === "number") {
    return reranked.slice(0, Math.max(0, Math.floor(options.limit)));
  }

  return reranked;
}

function warnFallback(error: unknown): void {
  if (warnedAboutFallback) return;
  warnedAboutFallback = true;
  const message = error instanceof Error ? error.message : String(error);
  console.warn(
    `Cross-reranker unavailable; falling back to fused semantic/BM25 scores. ${message}`,
  );
}

export async function reRankData(
  query: string,
  bm25Rank: Document[],
  vectorRank: Document[],
  options: RerankOptions = {},
): Promise<RerankedDocument[]> {
  
  const uniqueDocsMap = mergeDocuments(bm25Rank, vectorRank);
  const candidates = [...uniqueDocsMap.values()];

  if (candidates.length === 0) return [];

  try {
    await initializeModel();

    // Map query to document text string strings
    const queries = new Array(candidates.length).fill(query);
    const passages = candidates.map((doc) => doc.text as string);
    const encodedInputs = await tokenizer(queries, {
      text_pair: passages,
      padding: true,
      truncation: true,
      max_length: 512,
    });

    const { logits } = await model(encodedInputs);
    const rawScores = logits.data;

    const reranked: RerankedDocument[] = candidates.map((doc, index) => ({
      ...doc,
      score: rawScores[index],
    }));

    reranked.sort((left, right) => right.score - left.score);

    if (typeof options.limit === "number") {
      return reranked.slice(0, Math.max(0, Math.floor(options.limit)));
    }

    return reranked;
  } catch (error) {
    warnFallback(error);
    return fallbackRank(candidates, options);
  }
}
