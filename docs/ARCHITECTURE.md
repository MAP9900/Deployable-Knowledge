# Architecture Overview

The project is organised into three layers:

1. **core/** – Headless library that owns retrieval, prompt rendering, LLM providers and the chat pipeline.  It exposes
   Pydantic models (`ChatRequest`, `ChatResponse`, etc.) and helpers to build prompts or stream responses.
2. **api/** – Thin FastAPI adapters that translate HTTP requests into core calls.  These routers handle auth, request
   validation and markdown→HTML conversion.  Streaming uses Server‑Sent Events with `meta`, `delta`, `done` and `error`
   chunks.
3. **ui/** – Browser side ES module SDK (`DKClient`) and vanilla controllers.  Controllers never call `fetch` directly;
   instead they use `DKClient` for chat, streaming and settings.

The separation allows the core library to be reused in other apps while this repo provides a full FastAPI + JS
implementation.  A minimal example of using the browser SDK:

```js
import { DKClient } from "./static/js/ui/sdk/sdk.js";
const dk = new DKClient();
const resp = await dk.chat({ message: "hello" });
```

```text
Browser UI ──HTTP──► api/ routers ──calls──► core/ pipeline ──► LLM & ChromaDB
```

<img width="2600" height="1600" alt="semantic-search-pipeline" src="https://github.com/user-attachments/assets/11c9dc52-2e67-4487-8118-df11ac181f70" />
<img width="2600" height="1600" alt="bm25-search-pipeline" src="https://github.com/user-attachments/assets/a90d66e6-ad48-4bd8-810c-620c968b89ce" />
<img width="2600" height="1600" alt="knowledge-graph-search-pipeline" src="https://github.com/user-attachments/assets/2910c53f-33d6-4b83-9c2f-15ab9ee10328" />
<img width="2600" height="1600" alt="hybrid-search-pipeline" src="https://github.com/user-attachments/assets/94d86da9-1e14-4d7c-acc5-29343afadb26" />


Return to [README](../README.md) or browse the [API reference](API_REFERENCE.md).
