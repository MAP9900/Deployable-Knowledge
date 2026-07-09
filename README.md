# Deployable-Knowledge: Advanced Offline Multi-Modal RAG Stack

**Version vA0.6.7**

Deployable Knowledge is an edge-first, comprehensive knowledge retrieval and generation tool. Built in TypeScript, it is designed for disconnected or bandwidth-constrained environments, providing high-precision multi-hop reasoning through a unique triple-engine search architecture. Deployable‑Knowledge bundles a local vector store, prompt management and a lightweight web UI around a pluggable large‑language model.  Documents are embedded locally, the frontend is developed in [Sveltekit](https://svelte.dev), the backend is written in [Typescript](https://typescriptlang.org).

## Overview

Deployable‑Knowledge bundles a local vector store, prompt management, and a lightweight web UI around a pluggable large‑language model.  Documents are embedded locally and queried through FastAPI endpoints which power the TypeScript front end.

🚀 Key Features
Multi-Modal Ingestion: Supports high-efficiency extraction of text, tables, formulas, and images via OCR and specialized parsing engines like MinerU and Docling
Local Persistence: High-performance chunk storage and application state management utilizing a local SQLite backend
Triple Search Architecture: Performs three side-by-side searches to ensure comprehensive retrieval:
 - **Semantic Search: Cosine similarity-based vector retrieval for capturing deep semantic meaning**
 - **Lexical Search: BM25-based keyword matching to ensure precise factual alignment**
 - **Graph-Based Search: A hybrid of LightRAG and HippoRAG methodologies, utilizing Personalized PageRank (PPR) to follow directed paths through a knowledge graph**
Neural Reranking: Scored results from the reference searches are processed through a BERT-based Cross-Encoder (e.g., MiniLM-L6) for high-fidelity cross-extraction before being fed to the LLM
Knowledge Visualization: A dedicated UI for visualizing directed graph paths and comparing chunk-level retrieval results side-by-side

🏗️ Architecture Overview
1. Offline Indexing (The Hippocampal Index)
During ingestion, the system mimics human long-term memory by creating a dual-layer index
 - **Dense Coding: Original document passages are stored as contextual nodes**
 - **Sparse Coding: A linked LLM extracts entities and relationships to form a directed knowledge graph**
 - **Structured Backbones: The graph is governed by an automatically generated ontology to transform loose associations into deterministic reasoning paths**
2. Online Retrieval (Neural Activation)
When a query is received, the system simulates a neural activation process
 - **Seed Node Activation: The query is matched against both text chunks and graph triples**
 - **Recognition Memory Filter: The LLM-based "recognition memory" step filters irrelevant triples to ensure the PPR algorithm travels along high-quality "highways" of information**
 - **Graph Traversal: Personalized PageRank (PPR) spreads activation across the graph to find relevant documents even without direct keyword overlap**
3. Generation and Synthesis
The final retrieved contexts—selected through the re-ranker—are provided to the local LLM for grounded, hallucination-free response generation

🛠️ Quick Start
Installation
Ensure you have the necessary environments for OCR and local LLM serving (e.g., vLLM or Ollama)

# Install dependencies
npm install

# Run the deployment wizard
npm run setup
Configuration
Deployable Knowledge allows for role-specific model configurations:
 - **EXTRACT: High-capability models for entity/triple extraction**
 - **RERANK: Optimized BERT cross-encoders for re-scoring**
 - **GENERATE: Local LLMs for final answer synthesis**

📊 Benchmarking and Performance
In multi-hop reasoning tasks (such as MuSiQue), this architecture's semantic backbone pushes accuracy significantly higher than standard vector RAG by effectively "connecting the dots" across disparate documents
📜 License
This project is released under the MIT License
Inspired by the neurobiological Hippocampal Indexing Theory and state-of-the-art GraphRAG research (HippoRAG or HippoRAG 2)

## Features (or future goals)

- **Document ingestion** for PDF and plaintext sources
- **SQLite** vector store with sentence‑transformer embeddings
- **Chat and search** endpoints with optional streaming responses
- **Configurable prompts** and persona editing
- **Authentication middleware** with session and CSRF protection

## Quick Start for Development

```bash
# First time setup (don't do this everytime)
npm install
npm run db:generate

npm run db:migrate # to be run if there were upstream database changes

# After and every other startup run 
npm run dev
```

## Architecture overview

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for detailed diagrams and data‑flow breakdowns.

The system is split into three layers:

```text
core/  – retrieval, prompt rendering and LLM adapters
api/   – FastAPI routers translating HTTP ↔ core
app/   – static assets and UI routes
```

## Documentation

Additional guides live in the [`docs/`](docs) folder:

- [API reference](docs/API_REFERENCE.md)
- [UI overview](docs/UI_OVERVIEW.md)
- [Backend services](docs/BACKEND_SERVICES.md)
- [Configuration guide](docs/CONFIGURATION.md)
- [Prompt & LLM integration](docs/PROMPTS_LLM.md)

### Bibliography

#### Academic Papers and Technical Reports
*   Chen, B., Guo, Z., Yang, Z., Chen, Y., Chen, J., Liu, Z., Shi, C., & Yang, C. (2025). *PathRAG: Pruning graph-based retrieval augmented generation with relational paths*. arXiv. [https://arxiv.org/abs/2502.14902](https://arxiv.org/abs/2502.14902)
*   Edge, D., Trinh, H., Cheng, N., Bradley, J., Chao, A., Mody, A., Truitt, S., Metropolitansky, D., Ness, R. O., & Larson, J. (2024). *From local to global: A graph RAG approach to query-focused summarization*. arXiv. [https://doi.org/10.48550/arXiv.2404.16130](https://doi.org/10.48550/arXiv.2404.16130)
*   Guo, Z., Xia, L., Yu, Y., Ao, T., & Huang, C. (2024). *LightRAG: Simple and fast retrieval-augmented generation*. arXiv. [https://arxiv.org/abs/2410.05779](https://arxiv.org/abs/2410.05779)
*   Khosravi, L. ["xhluca"]. (2024). *BM25S: A fast and efficient Python implementation of BM25*. arXiv. [https://arxiv.org/abs/2407.03618](https://arxiv.org/abs/2407.03618)
*   Xiao, S., Liu, Z., Zhang, P., & Nik, M. (2023). *C-Pack: Packaged resources to advance general Chinese embedding*. arXiv. [https://doi.org/10.48550/arXiv.2309.07597](https://doi.org/10.48550/arXiv.2309.07597)

#### Technical Documentation and Professional Guides
*   LangChain. (2026). *Text splitter integrations*. [https://docs.langchain.com/oss/python/integrations/splitters](https://docs.langchain.com/oss/python/integrations/splitters)
*   Liu, J. (2023). *SentenceSplitter* (v0.10.10) [Software documentation]. LlamaIndex. [https://llamaindexxx.readthedocs.io/en/latest/api/llama_index.core.node_parser.SentenceSplitter.html](https://llamaindexxx.readthedocs.io/en/latest/api/llama_index.core.node_parser.SentenceSplitter.html)
*   LlamaIndex. (n.d.). *Semantic chunker* [Developer documentation]. [https://developers.llamaindex.ai/python/examples/node_parsers/semantic_chunking/](https://developers.llamaindex.ai/python/examples/node_parsers/semantic_chunking/)
*   Schwaber-Cohen, R., & Patel, A. (2025, June 28). *Chunking strategies for LLM applications*. Pinecone. [https://www.pinecone.io/learn/chunking-strategies/](https://www.pinecone.io/learn/chunking-strategies/)
*   Stegeman, J. (2024, July 22). *What is a knowledge graph?* Neo4j. [https://neo4j.com/blog/genai/what-is-knowledge-graph/](https://neo4j.com/blog/genai/what-is-knowledge-graph/)

#### Models and Repositories
*   Beijing Academy of Artificial Intelligence. (2023). *bge-reranker-large* [Model card]. Hugging Face. [https://huggingface.co/BAAI/bge-reranker-large](https://huggingface.co/BAAI/bge-reranker-large)
*   Cross-Encoder. (n.d.). *ms-marco-MiniLM-L6-v2* [Model card]. Hugging Face. [https://huggingface.co/cross-encoder/ms-marco-MiniLM-L6-v2](https://huggingface.co/cross-encoder/ms-marco-MiniLM-L6-v2)
*   Zaratiana, U., Tomeh, N., Holat, P., & Charnois, T. (n.d.). *GLiNER: Generalist and lightweight model for named entity recognition* [GitHub repository]. GitHub. [https://github.com/urchade/GLiNER](https://github.com/urchade/GLiNER)

#### Video Presentations
*   Ebbelaar, D. (2026). *The complete guide to hybrid search in RAG (BM25 + embeddings + reranker)* [Video]. YouTube.
*   Julien, S. (2026). *When vectors break down: Graph-based RAG for dense enterprise knowledge* [Video]. AI Engineer / YouTube.

## Contributing

1. Create a fork off this repo
2. Create a feature branch off `cancun` on your fork.
3. Follow the existing coding style (run formatter, before committing `npm run format`). 
4. Open a PR describing the change and link to any relevant issues.

## Quick Start for Usage

- For verbose start/run, simply run (double-click) `Launch-DeployableKnowledge.bat` or `Launch-DeployableKnowledge.ps1`
- For user-friendly/silent start, simply run (double-click) `Launch-DeployableKnowledge.bat-User` or `Launch-DeployableKnowledge-User.ps1`

## Quick Start for Development

**Unix / macOS:**

```bash
make setup
make run
```

Visit <http://localhost:8000> once the server starts. Ollama is available by default with the seeded `llama3` model; use **Manage API Keys** in the prompt editor to connect hosted providers.
