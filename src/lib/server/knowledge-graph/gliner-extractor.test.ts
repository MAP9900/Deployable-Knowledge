import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  parseEntities,
  parseRelations,
  BASE_ENTITY_LABELS,
  parseInferencePayload,
  resolveEntityLabels,
} from "./gliner-extractor";
import { sanitizeEntityLabel } from "./utils";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pythonScriptPath = resolve(__dirname, "gliner-extractor.py");
const workspaceRoot = resolve(__dirname, "..", "..", "..", "..");
const venvPython = resolve(workspaceRoot, ".venv", process.platform === "win32" ? "Scripts/python.exe" : "bin/python");
function getPythonExecutable(): string {
  if (process.env.PYTHON) return process.env.PYTHON;
  return existsSync(venvPython) ? venvPython : "python";
}

test("parseEntities dedupes labels and normalizes kinds", () => {
  const input = `{
    "entities": [
      {"label": "Radar", "kind": "technology"},
      {"label": "radar", "kind": "Technology"}
    ]
  }`;

  const output = parseEntities(input as unknown as string);
  assert.equal(output.length, 1);
  assert.equal(output[0].label, "Radar");
  assert.equal(output[0].kind, "technology");
});

test("parseRelations reads JSON relation objects", () => {
  const input = `{
    "relations": [
      {"source":"Radar","target":"antenna","relation":"HAS_COMPONENT","evidence":"Radar uses an antenna."}
    ]
  }`;

  const output = parseRelations(input as unknown as string);
  assert.equal(output.length, 1);
  assert.equal(output[0].source, "Radar");
  assert.equal(output[0].target, "antenna");
  assert.equal(output[0].relation, "HAS_COMPONENT");
});

test("parseInferencePayload converts python JSON into typed entities and relations", () => {
  const output = parseInferencePayload(JSON.stringify({
    entities: [{ label: "Radar", kind: "technology", chunkIds: ["chunk-1"] }],
    relations: [{ source: "Radar", target: "antenna", relation: "HAS_COMPONENT" }],
  }));

  assert.equal(output.entities.length, 1);
  assert.equal(output.entities[0].label, "Radar");
  assert.equal(output.entities[0].chunkIds?.[0], "chunk-1");
  assert.equal(output.relations.length, 1);
  assert.equal(output.relations[0].relation, "HAS_COMPONENT");
});

test("python extractor uses extracted text as entity label and model label as kind", () => {
  const result = spawnSync(getPythonExecutable(), [pythonScriptPath], {
    input: JSON.stringify({
      text: "Barack Obama visited Paris in 2024.",
      labels: ["person", "location", "date"],
    }),
    encoding: "utf8",
    env: { ...process.env, PYTHONUNBUFFERED: "1" },
  });

  assert.equal(result.status, 0, result.stderr);

  const payload = JSON.parse(result.stdout);
  assert.ok(payload.entities.length >= 1);
  assert.equal(payload.entities[0].label, "Barack Obama");
  assert.equal(payload.entities[0].kind, "person");
});

test("sanitizeEntityLabel drops chunk and sample style placeholders", () => {
  assert.equal(sanitizeEntityLabel("sample3"), "");
  assert.equal(sanitizeEntityLabel("0"), "");
  assert.equal(sanitizeEntityLabel("chunk 5"), "");
  assert.equal(sanitizeEntityLabel("Barack Obama"), "Barack Obama");
});

test("resolveEntityLabels falls back to base labels when no UI labels are provided", () => {
  assert.deepEqual(resolveEntityLabels([]), BASE_ENTITY_LABELS);
  assert.deepEqual(resolveEntityLabels(["  Radar  ", "", "antenna"]), ["Radar", "antenna"]);
});

test("base entity labels are defined", () => {
  assert.ok(BASE_ENTITY_LABELS.length > 0);
});
